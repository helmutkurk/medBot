import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

function worker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const stored = new Map<string, Response>();
  const fetched: string[] = [];
  let offline = false;
  let full = false;
  const key = (request: Request | string) => typeof request === "string" ? new URL(request, "https://medbot.test").href : request.url;
  const cache = {
    match: async (request: Request | string) => stored.get(key(request)),
    put: async (request: Request | string, response: Response) => { if (full) throw new Error("Quota exceeded"); stored.set(key(request), response); },
    keys: async () => [...stored.keys()].map(url => new Request(url)),
    delete: async (request: Request | string) => stored.delete(key(request)),
    addAll: async (urls: string[]) => { for (const url of urls) stored.set(key(url), new Response(url === "/offline.html" ? "Offline: voice needs a connection" : "asset")); },
  };
  const deleted: string[] = [];
  runInNewContext(source, {
    self: { location: { origin: "https://medbot.test" }, clients: { claim: async () => {} }, addEventListener: (name: string, handler: (event: unknown) => void) => listeners.set(name, handler) },
    URL,
    caches: { open: async () => cache, keys: async () => ["medbot-shell-v0", "medbot-shell-v1", "other-app"], delete: async (name: string) => { deleted.push(name); return true; } },
    fetch: async (request: Request) => { fetched.push(request.url); if (offline) throw new Error("offline"); return new Response("network", { headers: { "content-type": request.url.endsWith(".mp3") ? "audio/mpeg" : "text/javascript" } }); },
  });
  return {
    stored, fetched, deleted,
    offline: () => { offline = true; },
    full: () => { full = true; },
    lifecycle: async (name: string) => { let work: Promise<unknown> | undefined; listeners.get(name)?.({ waitUntil: (promise: Promise<unknown>) => { work = promise; } }); await work; },
    request: (path: string, options: { mode?: string; method?: string; destination?: string; headers?: Record<string, string> } = {}) => {
      const request = new Request(new URL(path, "https://medbot.test"), { method: options.method, headers: options.headers });
      Object.defineProperty(request, "mode", { value: options.mode ?? "cors" });
      Object.defineProperty(request, "destination", { value: options.destination ?? "" });
      let response: Promise<Response> | undefined;
      listeners.get("fetch")?.({ request, respondWith: (promise: Promise<Response>) => { response = promise; } });
      return response;
    },
  };
}

test("offline shell installs, old medBot caches retire without touching other apps", async () => {
  const sw = worker();
  await sw.lifecycle("install");
  await sw.lifecycle("activate");
  assert.deepEqual(sw.deleted, ["medbot-shell-v0"]);
  assert.equal(await (await sw.request("/learning", { mode: "navigate" }))?.text(), "network");
  assert.equal(sw.stored.has("https://medbot.test/learning"), false);
  sw.offline();
  assert.match(await (await sw.request("/learning", { mode: "navigate" }))!.text(), /voice needs a connection/);
});

test("API, audio, cross-origin, RSC, queries and mutations never enter the worker cache", async () => {
  const sw = worker();
  for (const path of ["/api", "/api/session", "/api/chat", "/api/coach", "/api/trace", "/api/usage", "/audio.mp3", "/_next/static/voice.mp3", "/learning?_rsc=abc", "/_next/static/chunk.js?audio=1", "https://api.openai.com/v1/realtime/calls"]) {
    assert.equal(sw.request(path), undefined, path);
  }
  assert.equal(sw.request("/api/cases", { mode: "navigate" }), undefined);
  assert.equal(sw.request("/_next/static/chunk.js", { method: "POST" }), undefined);
  assert.equal(sw.request("/_next/static/chunk.js", { destination: "audio" }), undefined);
  assert.equal(sw.request("/_next/static/chunk.js", { headers: { range: "bytes=0-1" } }), undefined);
  assert.equal(sw.stored.size, 0);
  assert.equal(sw.fetched.length, 0);
});

test("allowed static assets are available offline, while cache failures preserve the network response", async () => {
  const sw = worker();
  assert.equal(await (await sw.request("/_next/static/chunk.js"))!.text(), "network");
  sw.offline();
  assert.equal(await (await sw.request("/_next/static/chunk.js"))!.text(), "network");
  assert.equal(sw.fetched.length, 1);
  const full = worker();
  full.full();
  assert.equal(await (await full.request("/_next/static/chunk.css"))!.text(), "network");
});
