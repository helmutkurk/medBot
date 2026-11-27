# medBot roadmap (hackaTUM 2026, Avelios VIP)

Times are Berlin. Deadlines from the team brief: registration Sat 10:00, feature freeze Sat 18:00,
submission candidate Sun 08:00, submission Sun 10:00. Each step names its acceptance check.
Status is updated after every block; the evaluation report decides what we fix next.

## Phase 0 – Foundation (Fri night, done by agents)
- Next.js app, Realtime voice over WebRTC with ephemeral key, text fallback, mock mode.
- Patient engine: case schema, prompt, `reveal_fact` disclosure, consistency guard, 2 cases x 2 personalities.
- Eval harness and offline tests. `npm run check` green.

## Phase 1 – Go live (Sat 00:00–04:00) · goal: one real voice conversation
1. Add `OPENAI_API_KEY` to the local env file (capped key from Avelios Discord). *Check:* `/api/health` shows `voice: true`.
2. First real voice interview with a headset, both cases. *Check:* patient answers in character, facts panel fills.
3. Measure latency (median shown in UI). *Target:* < 1.2 s speech end → first audio. If slower: shorter
   instructions, `semantic_vad` eagerness, smaller transcription model.
4. Run `npm run eval -- --n 3`. *Check:* report in `eval/results/`; list the top 3 failure types.
5. Register the project (deadline Sat 10:00), verify Avelios submission requirements.

## Phase 2 – Quality from eval data (Sat 04:00–14:00) · judged: consistency, disclosure, personality
Pick by the eval report, highest count first:
- Invented facts / contradictions → tighten prompt, add missing facts to the case, stronger `unknown_answer`.
- Unprompted disclosures → sharper `reveal_when`, few-shot examples of withholding.
- Jargon → extend `never_say`, guard feedback loop.
- Weak personality distinctness (< 80 % blind-judge accuracy) → richer example lines, voice and pacing
  differences, emotion words in the voice (`instructions` for tone).
- 15-minute consistency → summarise disclosed facts into the session every N turns.
*Check:* each change re-run on eval; never merge a prompt change that lowers coverage or raises issues.

## Phase 3 – Wow features (Sat 10:00–18:00, only if Phase 2 is green)
1. Feedback coach: after the interview, covered vs missed history items with transcript quotes
   (structured output over transcript + case). Strongest addition for the judges.
2. Case creator: generate a new synthetic case from a diagnosis + personality, validated by `validateCase`.
3. Embodiment light: animated orb/avatar reacting to emotion; no 3D.
Feature freeze Sat 18:00: after that only fixes, eval evidence and pitch.

## Phase 4 – Evidence and pitch (Sat 18:00–Sun 08:00)
- Final eval run, n ≥ 5 per case x personality; table into the pitch ("beyond one lucky demo run").
- Backup video of a full voice interview; text-mode fallback rehearsed; seeded demo state.
- 3-minute pitch: problem → live demo (same disease, two personalities) → eval numbers → coach.
- Freeze submission candidate Sun 08:00; submit before 10:00 with spare time.

## Working rules
- One branch per person/agent, PR to `main`, main always demoable; evaluate before merging prompt changes.
- Keys only in the local env file; costs: eval with small n first, mock for UI work.
- Cut scope with the lead if a milestone slips; never demo a broken path.

## Open questions
- Team members and roles beyond Helmut and chr1st0ph199.
- Exact Avelios submission format and whether a recorded demo is accepted.
- Key cap: how many eval runs fit the budget.
