import type { CaseSummary, CommunicationSkill, FactCategory } from "../case/types.ts";
import type { InterviewMode } from "./interview-mode.ts";
import { communicationSkills } from "../case/types.ts";

export const domains = ["complaint", "symptom", "history", "medication", "allergy", "family", "social", "lifestyle", "red_flags", "ice", ...communicationSkills] as const;
export type Domain = typeof domains[number];
export const domainLabels: Record<Domain, string> = {
  complaint: "Presenting complaint", symptom: "Symptoms", history: "Past history", medication: "Medicines", allergy: "Allergies", family: "Family history", social: "Social history", lifestyle: "Lifestyle", red_flags: "Red flags", ice: "Ideas, concerns and expectations",
  open_questions: "Open questions", active_listening_summarising: "Listening and summarising", empathy: "Empathy", ice_exploration: "Exploring ICE", signposting: "Signposting", jargon_avoidance: "Everyday language",
};
export interface Mastery { value: number; count: number }
export interface Reflection { concern: string; confidence: number }
export interface SessionResult {
  id: string;
  caseId: string;
  personalityId: string;
  completedAt: string;
  reflection: Reflection;
  mode?: InterviewMode;
  hintsUsed?: number;
  elapsedMs?: number;
  viva?: { score: number };

  // Summaries only: no patient names, transcript or model evidence in local storage.
  outcome?: {
    score: number;
    coverage: { category: FactCategory; found: number; total: number }[];
    communication: Record<CommunicationSkill, number>;
    redFlags: { factId: string; label: string; found: boolean }[];
  };
}
export interface ReviewItem { caseId: string; factId: string; label: string; stage: number; due: string }
export interface LearnerProfile {
  version: 1;
  sessions: SessionResult[];
  domainMastery: Record<Domain, Mastery>;
  reviewQueue: ReviewItem[];
  calibration: { count: number; meanAbsoluteError: number; meanBias: number; highConfidenceMisses: number };
}
export function emptyProfile(): LearnerProfile {
  return { version: 1, sessions: [], domainMastery: Object.fromEntries(domains.map(d => [d, { value: 0, count: 0 }])) as Record<Domain, Mastery>, reviewQueue: [], calibration: { count: 0, meanAbsoluteError: 0, meanBias: 0, highConfidenceMisses: 0 } };
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const date = (value: string) => new Date(value).getTime();
const afterDays = (value: string, days: number) => new Date(date(value) + days * 86_400_000).toISOString();

/** Rebuilding from the small local history makes retries/replaced reports idempotent. */
export function updateProfile(profile: LearnerProfile, result: SessionResult): LearnerProfile {
  const sessions = [...profile.sessions.filter(s => s.id !== result.id), result].sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id));
  const next = emptyProfile();
  next.sessions = sessions;
  const observe = (domain: Domain, value: number) => {
    const old = next.domainMastery[domain];
    next.domainMastery[domain] = { value: old.count ? .65 * old.value + .35 * clamp(value) : clamp(value), count: old.count + 1 };
  };
  for (const session of sessions) {
    const outcome = session.outcome;
    if (!outcome) continue;
    for (const row of outcome.coverage) if (row.total > 0) observe(row.category, row.found / row.total);
    for (const skill of communicationSkills) observe(skill, outcome.communication[skill] / 2);
    observe("ice", outcome.communication.ice_exploration / 2);
    const safety = outcome.redFlags.length ? outcome.redFlags.filter(f => f.found).length / outcome.redFlags.length : outcome.score / 100;
    if (outcome.redFlags.length) observe("red_flags", safety);
    for (const fact of outcome.redFlags) {
      const index = next.reviewQueue.findIndex(r => r.caseId === session.caseId && r.factId === fact.factId);
      const old = next.reviewQueue[index];
      if (fact.found && !old) continue;
      // A failed retrieval restarts at one day. Only a due retrieval earns promotion.
      if (fact.found && old && date(old.due) > date(session.completedAt)) continue;
      const stage = fact.found && old ? old.stage + 1 : 0;
      if (index >= 0) next.reviewQueue.splice(index, 1);
      if (stage < 3) next.reviewQueue.push({ caseId: session.caseId, factId: fact.factId, label: fact.label, stage, due: afterDays(session.completedAt, [1, 3, 7][stage]!) });
    }
    const confidence = clamp((session.reflection.confidence - 1) / 4);
    const error = confidence - (clamp(outcome.score / 100) + clamp(safety)) / 2;
    const previous = next.calibration;
    const count = previous.count + 1;
    next.calibration = { count, meanAbsoluteError: (previous.meanAbsoluteError * previous.count + Math.abs(error)) / count, meanBias: (previous.meanBias * previous.count + error) / count, highConfidenceMisses: previous.highConfidenceMisses + (session.reflection.confidence >= 4 && outcome.redFlags.some(f => !f.found) ? 1 : 0) };
  }
  next.reviewQueue.sort((a, b) => a.due.localeCompare(b.due) || a.caseId.localeCompare(b.caseId) || a.factId.localeCompare(b.factId));
  return next;
}
export function weakestDomains(profile: LearnerProfile): Domain[] {
  // ICE and its communication rating share a measurement: only recommend it once.
  return domains.filter(d => d !== "ice_exploration").slice().sort((a, b) => profile.domainMastery[a].value - profile.domainMastery[b].value || profile.domainMastery[a].count - profile.domainMastery[b].count || domains.indexOf(a) - domains.indexOf(b));
}
export function difficultyFor(profile: LearnerProfile): "supported" | "stretch" | "challenge" {
  const observed = domains.filter(d => profile.domainMastery[d].count > 0);
  const mean = observed.length ? observed.reduce((sum, d) => sum + profile.domainMastery[d].value, 0) / observed.length : 0;
  const safety = profile.domainMastery.red_flags;
  const ready = profile.calibration.count >= 3 && mean > .7 && safety.count > 0 && safety.value > .7;
  return ready && mean > .85 && safety.value > .85 ? "challenge" : ready ? "stretch" : "supported";
}
export interface Recommendation { caseId: string; personalityId: string; goals: string[]; reasons: string[]; difficulty: ReturnType<typeof difficultyFor> }
type RecommendationCase = CaseSummary & { facts?: { category: FactCategory }[] };
export function recommendNext(profile: LearnerProfile, cases: RecommendationCase[], now = profile.sessions.at(-1)?.completedAt ?? "1970-01-01T00:00:00.000Z"): Recommendation | null {
  if (!cases.length) return null;
  const last = profile.sessions.at(-1)?.caseId;
  const candidates = cases.length > 1 ? cases.filter(c => c.id !== last) : cases;
  const weak = weakestDomains(profile).slice(0, 2);
  const due = profile.reviewQueue.filter(r => date(r.due) <= date(now));
  const rank = (c: RecommendationCase) => due.filter(r => r.caseId === c.id).length * 10 + weak.filter(d => c.facts?.some(f => f.category === d)).length;
  const chosen = [...candidates].sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id))[0]!;
  const difficulty = difficultyFor(profile);
  const challenge = (p: CaseSummary["personalities"][number]) => /reserved|irritable|angry|anxious|downplay|guarded|dismissive/i.test(`${p.id} ${p.label}`) ? 2 : /cooperat|forthcoming|calm|chatty|friendly/i.test(`${p.id} ${p.label}`) ? 0 : 1;
  const personalities = [...chosen.personalities].sort((a, b) => (difficulty === "supported" ? challenge(a) - challenge(b) : challenge(b) - challenge(a)) || a.id.localeCompare(b.id));
  const goals = weak.map(d => goalFor(d, difficulty));
  if (due.some(r => r.caseId === chosen.id)) goals[0] = "Independently revisit safety questions you previously missed.";
  return { caseId: chosen.id, personalityId: personalities[0]?.id ?? "", goals, difficulty, reasons: [
    last && chosen.id !== last ? "A different case interleaves practice with your last interview." : "Build a baseline with this case.",
    due.some(r => r.caseId === chosen.id) ? "This patient has red-flag reviews due." : due.length ? "Due reviews remain queued while you practise a different case." : `Practise ${weak.map(d => domainLabels[d].toLowerCase()).join(" and ")}.`,
    difficulty === "supported" ? "Start with the most cooperative available personality; build mastery before adding difficulty." : "Sustained mastery above 70% including red flags unlocks a more demanding personality.",
  ] };
}
export function goalFor(domain: Domain, difficulty: ReturnType<typeof difficultyFor>): string {
  const hints: Record<Domain, string> = {
    complaint: "Begin with an open invitation, then establish the main problem.", symptom: "Explore onset, progression and impact of the symptoms.", history: "Ask about past conditions and similar episodes.", medication: "Ask about all medicines, doses and recent changes.", allergy: "Ask about allergies and what reaction occurred.", family: "Explore relevant family history.", social: "Ask how the problem affects life and support at home.", lifestyle: "Explore smoking, alcohol and everyday habits without judgement.", red_flags: "Ask direct safety questions before closing.", ice: "Ask what the patient thinks, worries about and hopes for.", open_questions: "Start broadly and let the patient tell their story.", active_listening_summarising: "Summarise what you heard and invite correction.", empathy: "Acknowledge the patient's emotion with a specific response.", ice_exploration: "Explore the patient's ideas, concerns and expectations.", signposting: "Explain why you are moving to the next topic.", jargon_avoidance: "Use everyday language and check understanding.",
  };
  return difficulty === "supported" ? hints[domain] : `Cover ${domainLabels[domain].toLowerCase()} independently, then check your own gaps.`;
}
export function adaptationsActive(profile: LearnerProfile): string[] {
  const weak = weakestDomains(profile).slice(0, 2).map(d => domainLabels[d].toLowerCase());
  return [
    `Session goals and coach focus prioritise ${weak.join(" and ")} based on your recorded coverage and communication ratings.`,
    "Case selection alternates patients to interleave retrieval; due red-flag reviews receive priority among eligible cases.",
    "Missed safety items return after 1, 3 and 7 days; successful due retrieval promotes them, and a miss restarts spacing.",
    difficultyFor(profile) === "supported" ? "The most cooperative available personality and specific goal prompts support practice until sustained mastery exceeds 70%, including safety." : "More demanding personalities and shorter goal prompts now increase difficulty because sustained mastery exceeds 70%, including safety.",
    "Reflection compares your confidence with coverage and red-flag retrieval to help calibrate self-assessment.",
    "The case creator receives only weak-domain focus labels when you request a targeted patient. Clinical facts and patient behaviour stay fixed for everyone interviewing that case and personality.",
  ];
}
