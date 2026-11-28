import path from "node:path";
import type { PatientCase } from "./types.ts";
import { storageDirectory } from "../server/storage.ts";

// Ephemeral cases remain usable in this process even when /tmp cannot be written.
export const generatedCases = new Map<string, PatientCase>();
export const generatedDirectory = () => path.join(storageDirectory(), "cases", "generated");
