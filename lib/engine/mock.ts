import type { ChatMessage, Fact, PatientCase, PatientTurn, Personality } from "../case/types.ts";

const aliases: [RegExp, string][] = [
  [/\b(smoke|smokes|smoked|smoking|cigarettes?|tobacco)\b/g, "smoking"],
  [/\b(spreads?|spreading|radiates?|radiation|travels?|traveling)\b/g, "spread"],
  [/\b(began|begin|begins|started|starts?|onset)\b/g, "start"],
  [/\b(lasts|lasting|duration|episodes?|how long)\b/g, "duration"],
  [/\b(triggers?|exertion|exercise|activity|stairs|walking|worse|worsens|brings on)\b/g, "trigger"],
  [/\b(relieves?|relief|resting|rest|better|helps?|eases?)\b/g, "relief"],
  [/\b(breathless|breathlessness|breathing|breath|sweaty|sweating|sweat)\b/g, "associated"],
  [/\b(medication|medications|medicines?|tablets?|pills?|prescriptions?)\b/g, "medicine"],
  [/\bblood[ -]pressure\b/g, "bloodpressure"],
  [/\b(allergic|allergies|allergy)\b/g, "allergy"],
  [/\b(parents?|father|mother|family|relatives?)\b/g, "family"],
  [/\b(alcohol|beer|wine|drinks?|drinking)\b/g, "alcohol"],
  [/\b(operations?|surgery|surgeries|illnesses|conditions?|medical history|past health)\b/g, "history"],
  [/\b(location|located|where|site)\b/g, "location"],
  [/\b(severe|severity|scale|bad|rate)\b/g, "severity"],
  [/\b(nausea|nauseous|sick|vomiting|vomit|appetite|eating)\b/g, "nausea"],
  [/\b(fever|feverish|temperature|chills)\b/g, "fever"],
  [/\b(period|menstrual|pregnancy|pregnant|sexually|contraception)\b/g, "period"],
  [/\b(urine|urinary|urination|wee|peeing|pee|bowels?|stool|diarrhoea|diarrhea)\b/g, "bowel"],
];
const stop = new Set("a an the it its this that is are was were do does did have has had i you your me my to of for in on at and or any ever anything how what when whether about asked asking ask if specifically each please feels feel symptom symptoms pain complaint tightness means nothing elsewhere anywhere can could would tell with from taken takes taking day every daily same since long like other also then as before after not no health problems during possibility".split(" "));

function tokens(text: string): Set<string> {
  let normalized = text.toLowerCase().replaceAll("’", "'");
  for (const [pattern, replacement] of aliases) normalized = normalized.replace(pattern, replacement);
  return new Set((normalized.match(/[a-z]+/g) ?? []).filter(t => !stop.has(t)));
}

export function isOpeningQuestion(text: string): boolean {
  return /what (?:brings|brought)|what.*(?:wrong|problem|troubl)|tell me.*(?:happen|problem)|why.*(?:here|come)|(?:describe|about|having|have|is|the|your).*(?:complaint|chest tightness|stomach pain|abdominal pain)|what.*mean.*nothing/i.test(text);
}

/** Broad questions that must never dump facts: "tell me about yourself", "anything else?". */
export function isSmallTalk(text: string): boolean {
  return /tell me (?:a bit |a little )?about (?:yourself|you)\b|who are you|(?:(?:is there )?(?:anything|something) else|any other (?:problems?|symptoms?|complaints?|concerns?|issues?))(?:\s+(?:you(?:'d| would) like to (?:tell|mention|add)|to (?:tell|mention) me))?\s*[?.!]*\s*$|(?:is there )?anything (?:more|you(?:'d| would) like to add)|how are you|how do you feel (?:about|today)/i.test(text);
}

function smallTalkReply(c: PatientCase, text: string): string {
  if (/yourself|who are you/i.test(text)) return `I'm ${c.patient.name.split(" ")[0]}, I'm ${c.patient.age}. I work as a ${c.patient.job}.`;
  return "I'm not sure what you'd like to know. Please ask me and I'll tell you.";
}

export function matchesFact(fact: Fact, question: string): boolean {
  if (fact.category === "complaint" && isOpeningQuestion(question)) return true;
  if (/specifically/i.test(fact.reveal_when) && !/blood[ -]pressure|daily|every day/i.test(question)) return false;
  const q = tokens(question);
  const trigger = tokens(fact.reveal_when);
  if (q.has("family") && fact.category !== "family" && !trigger.has("family")) return false;
  if ([...trigger].some(t => q.has(t))) return true;
  const lay = tokens(`${fact.category} ${fact.lay}`);
  return [...lay].filter(t => q.has(t)).length >= 2;
}

export function mockPatientTurn(c: PatientCase, p: Personality, history: ChatMessage[], studentText: string): Omit<PatientTurn, "latencyMs"> {
  const make = (reply: string, revealed: string[] = []): Omit<PatientTurn, "latencyMs"> => ({ reply, revealed, mode: "mock" });
  if (/^\s*(?:hello|hi|hey|good (?:morning|afternoon|evening))[!.,\s]*$/i.test(studentText)) return make("Hello.");
  if (/ignore.*instructions|reveal.*(?:all|instructions|prompt)|system prompt|are you.*(?:ai|robot)|pretend|diagnos/i.test(studentText)) return make("I'd like to stick to talking about why I'm here.");
  if (/shut up|idiot|stupid/i.test(studentText)) return make("Please don't speak to me like that.");
  if (isSmallTalk(studentText)) return make(smallTalkReply(c, studentText));
  const firstOpening = !history.some(m => m.role === "patient" && m.text.includes(p.opening_line)) && isOpeningQuestion(studentText);
  if (firstOpening) return make(p.opening_line);
  const candidates = c.facts.filter(f => matchesFact(f, studentText));
  // Prefer a fresh fact when a broad question matches more than one condition.
  const previous = history.filter(m => m.role === "patient").map(m => m.text).join("\n").toLowerCase();
  const fact = candidates.find(f => !previous.includes(f.lay.toLowerCase())) ?? candidates[0];
  const content = fact?.lay ?? c.unknown_answer;
  const anxious = /anxious|worried/i.test(p.label);
  const worry = (content.match(/[.!?](?:\s|$)/g)?.length ?? 1) < 3 ? " I'm worried about all this." : "";
  const reply = anxious ? `Um, ${content[0]?.toLowerCase() ?? ""}${content.slice(1)}${worry}` : /downplaying|dry humour/i.test(`${p.label} ${p.style}`) ? `Well, ${content[0]?.toLowerCase() ?? ""}${content.slice(1)}` : content;
  return make(reply, fact ? [fact.id] : []);
}
