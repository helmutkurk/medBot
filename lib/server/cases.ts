import type { PatientCase } from "../case/types.ts";

export function interviewCase(c: PatientCase) {
  return {
    id: c.id, title: c.title, patient: c.patient,
    personalities: c.personalities.map(({ id, label, voice }) => ({ id, label, voice })),
    factCount: c.facts.length,
    redFlagCount: c.facts.filter(f => f.red_flag).length,
    facts: c.facts.map(({ id, category, lay }) => ({ id, category, lay })),
  };
}
