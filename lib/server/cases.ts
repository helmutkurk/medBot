import type { PatientCase } from "../case/types.ts";

export function interviewCase(c: PatientCase) {
  return {
    id: c.id, title: c.title, patient: c.patient,
    personalities: c.personalities.map(({ id, label, voice }) => ({ id, label, voice })),
    factCount: c.facts.length,
    redFlagCount: c.facts.filter(f => f.red_flag).length,
    // reveal_when is exposed for red flags only: the daily review cards show it as the model answer.
    facts: c.facts.map(({ id, category, lay, red_flag, reveal_when }) => ({ id, category, lay, redFlag: red_flag === true, ...(red_flag ? { revealWhen: reveal_when } : {}) })),
  };
}
