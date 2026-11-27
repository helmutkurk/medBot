// Shared contract between the web app (app/, components/, lib/server/) and the
// patient engine (lib/case/, lib/engine/, scripts/). Change only with both owners.

export type RealtimeVoice =
  | "alloy" | "ash" | "ballad" | "coral" | "echo" | "sage" | "shimmer" | "verse" | "marin" | "cedar";

export type FactCategory =
  | "complaint" | "symptom" | "history" | "medication" | "allergy" | "family" | "social" | "lifestyle";

export interface Fact {
  id: string;            // snake_case, unique within the case
  category: FactCategory;
  truth: string;         // clinical truth, never spoken verbatim
  lay: string;           // how the patient says it in lay English
  reveal_when: string;   // what the student must ask before this is disclosed
}

export interface Personality {
  id: string;            // unique within the case
  label: string;         // short UI label, e.g. "Downplaying"
  style: string;         // behaviour description for the model
  emotion: string;       // dominant emotion and how it shows in the voice
  voice: RealtimeVoice;
  opening_line: string;  // first answer to "what brings you here?"
  example_lines: string[];
}

export interface PatientCase {
  id: string;
  title: string;         // UI title, e.g. "Chest tightness"
  note: string;          // provenance; cases are synthetic
  patient: { name: string; age: number; sex: "male" | "female" | "other"; job: string; lives_with: string };
  background: string;    // life story the model may use for small talk, no extra medical facts
  facts: Fact[];
  unknown_answer: string; // what to say when asked something not in the case
  never_say: string[];   // medical jargon the patient must not use
  personalities: Personality[];
}

export interface CaseSummary {
  id: string;
  title: string;
  patient: PatientCase["patient"];
  personalities: Pick<Personality, "id" | "label" | "voice">[];
  factCount: number;
}

export interface ChatMessage {
  role: "student" | "patient";
  text: string;
}

export interface PatientTurn {
  reply: string;
  revealed: string[];    // fact ids disclosed in this turn
  mode: "openai" | "mock";
  latencyMs: number;
}

export type GuardIssueType = "invented" | "contradiction" | "jargon" | "unprompted" | "out_of_character";

export interface GuardResult {
  ok: boolean;
  issues: { type: GuardIssueType; detail: string }[];
  mode: "openai" | "mock";
}

export interface EngineOptions {
  apiKey?: string;       // absent → deterministic mock engine
  model?: string;        // text model, default from lib/engine
  signal?: AbortSignal;
}
