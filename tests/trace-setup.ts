import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after } from "node:test";

// Each test process gets its own directory, never the app's budget ledger.
const directory = await mkdtemp(path.join(tmpdir(), "medbot-traces-"));
process.env.MEDBOT_TRACE_DIR = directory;
after(async () => { await rm(directory, { recursive: true, force: true }); });
