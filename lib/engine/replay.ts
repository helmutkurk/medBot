import type { ChatMessage, CommunicationSkill } from "../case/types.ts";
import type { CoachReport } from "./coach.ts";
export interface DisclosureEvent { messageId: string; factId: string }
export interface GuardEvent { messageId?: string; type: string; detail: string }
const phases: Record<CommunicationSkill, string> = {
  open_questions: "Gathering information", active_listening_summarising: "Gathering information", empathy: "Building the relationship",
  ice_exploration: "Understanding the patient’s perspective", signposting: "Structuring the consultation", jargon_avoidance: "Explanation and planning",
};
export function replayChips(message: ChatMessage & { id: string }, index: number, disclosures: DisclosureEvent[], warnings: GuardEvent[], report: CoachReport, facts: { id: string; redFlag: boolean }[]): string[] {
  const chips: string[] = [];
  for (const event of disclosures.filter(e => e.messageId === message.id)) {
    chips.push(`Fact revealed: ${event.factId}`);
    if (facts.some(f => f.id === event.factId && f.redFlag)) chips.push(`Red flag: ${event.factId}`);
  }
  for (const warning of warnings.filter(w => w.messageId === message.id)) chips.push(`Guard flag: ${warning.type}`);
  if (message.role === "student") for (const [skill, rating] of Object.entries(report.communication)) {
    if (rating.evidence && message.text.toLowerCase().includes(rating.evidence.toLowerCase())) chips.push(`Calgary-Cambridge: ${phases[skill as CommunicationSkill]}`);
  }
  if (report.opportunities.some(o => o.turn === index)) chips.push("Missed opportunity");
  return [...new Set(chips)];
}
