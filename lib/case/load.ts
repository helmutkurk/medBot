import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { CaseSummary, PatientCase, Personality } from "./types.ts";
import { assertCase } from "./validate.ts";

export class CaseNotFoundError extends Error {
  readonly caseId: string;
  constructor(id: string) {
    super(`Patient case not found: ${id}`);
    this.name = "CaseNotFoundError";
    this.caseId = id;
  }
}

async function readCases(): Promise<PatientCase[]> {
  const directory = path.join(process.cwd(), "cases");
  const files = (await readdir(directory)).filter(file => file.endsWith(".json")).sort();
  const cases = await Promise.all(files.map(async file => {
    const value: unknown = JSON.parse(await readFile(path.join(directory, file), "utf8"));
    try { assertCase(value); } catch (error) { throw new Error(`Cannot load ${file}`, { cause: error }); }
    return value;
  }));
  const ids = new Set<string>();
  for (const c of cases) {
    if (ids.has(c.id)) throw new Error(`Duplicate patient case id: ${c.id}`);
    ids.add(c.id);
  }
  return cases;
}

export async function listCases(): Promise<CaseSummary[]> {
  return (await readCases()).sort((a, b) => a.title < b.title ? -1 : a.title > b.title ? 1 : 0).map(c => ({
    id: c.id, title: c.title, patient: c.patient, factCount: c.facts.length,
    personalities: c.personalities.map(({ id, label, voice }) => ({ id, label, voice })),
  }));
}

export async function loadCase(id: string): Promise<PatientCase> {
  const c = (await readCases()).find(c => c.id === id);
  if (!c) throw new CaseNotFoundError(id);
  return c;
}

export function getPersonality(c: PatientCase, personalityId?: string): Personality {
  const p = personalityId === undefined ? c.personalities[0] : c.personalities.find(p => p.id === personalityId);
  if (!p) throw new Error(`Unknown personality ${personalityId ?? "(default)"} for case ${c.id}.`);
  return p;
}
