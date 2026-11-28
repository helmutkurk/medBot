#!/usr/bin/env bash
# Requires npm run build. Uses HTTP only; no browser or provider requests.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
smoke_dir=$(mktemp -d)
server_pid=""
cleanup() {
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -r -- "$smoke_dir"
}
trap cleanup EXIT
smoke_port=$(node --input-type=module <<'JS'
import net from "node:net";
const server = net.createServer();
server.on("error", () => {
  console.error("HTTP smoke needs localhost listeners. Run npm run smoke outside this sandbox after npm run build.");
  process.exitCode = 1;
});
server.listen(0, "127.0.0.1", () => { console.log(server.address().port); server.close(); });
JS
)
OPENAI_API_KEY='' node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port "$smoke_port" >"$smoke_dir/server.log" 2>&1 &
server_pid=$!
base="http://127.0.0.1:$smoke_port"
ready=false
for ((attempt=0; attempt<30; attempt++)); do
  if curl --silent --fail "$base/api/health" > /dev/null; then ready=true; break; fi
  if ! kill -0 "$server_pid" 2>/dev/null; then break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then echo "Server could not start on $base. Run npm run build first; localhost listeners must be allowed." >&2; exit 1; fi
node --input-type=module - "$base" <<'JS'
import assert from "node:assert/strict";
const base = process.argv[2];
const healthResponse = await fetch(`${base}/api/health`);
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.ready, false);
assert.ok(health.models.text);
assert.ok(health.models.patient);
const casesResponse = await fetch(`${base}/api/cases`);
assert.equal(casesResponse.status, 200);
const cases = await casesResponse.json();
assert.ok(cases.length > 0);
assert.equal((await fetch(`${base}/eval`)).status, 200);
const home = await fetch(base);
assert.equal(home.status, 200);
const html = await home.text();
assert.ok(html.includes("Connect to OpenAI"));
assert.ok(!html.includes('id="question"'));
const chat = await fetch(`${base}/api/chat`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ caseId: cases[0].id, history: [], text: "Hello" }),
});
assert.equal(chat.status, 503);
assert.deepEqual(await chat.json(), { error: { code: "no_api_key", message: "Set OPENAI_API_KEY in .env.local and restart the server." } });
console.log("HTTP smoke passed: setup screen, health ready:false, cases, /eval 200, chat no_api_key 503.");
JS
