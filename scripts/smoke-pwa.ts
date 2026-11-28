// Codex, 2026-11-28. HTTP only; run against npm start outside a sandbox that blocks localhost listeners.
import assert from "node:assert/strict";

const base = process.argv[2] || "http://localhost:3000";
const manifestResponse = await fetch(`${base}/manifest.webmanifest`);
assert.equal(manifestResponse.status, 200);
const manifest = await manifestResponse.json();
assert.equal(manifest.name, "medBot");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.theme_color, "#07756f");
for (const icon of manifest.icons) {
  const response = await fetch(new URL(icon.src, base));
  assert.equal(response.status, 200, icon.src);
  assert.match(response.headers.get("content-type") || "", /image\//);
}
assert.equal((await fetch(`${base}/icons/apple-touch-icon.png`)).status, 200);
for (const route of ["/", "/learning", "/learning/review", "/eval"]) {
  const response = await fetch(`${base}${route}`);
  assert.equal(response.status, 200, route);
  const html = await response.text();
  assert.match(html, /Mobile navigation/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /name="theme-color"/);
  assert.match(html, /rel="manifest"/);
}
const sw = await fetch(`${base}/sw.js`);
assert.equal(sw.status, 200);
assert.match(sw.headers.get("content-type") || "", /javascript/);
const offline = await fetch(`${base}/offline.html`);
assert.equal(offline.status, 200);
assert.match(await offline.text(), /Voice and text interviews/);
console.log("PWA HTTP smoke passed: manifest, icons, viewport/theme metadata, four pages, worker and offline shell. No OpenAI calls.");
