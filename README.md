# medBot

Virtual interview patient for medical students (hackaTUM 2026, Avelios challenge "VIP – Virtual Interview Patient").
Students talk to a patient by voice; the patient has a medical background, a personality, speaks lay English and
reveals facts only when asked.

## What the judges look at (from the Avelios deck)
- Naturalness: fast responses, stays in character.
- Medical consistency: no invented or contradictory facts.
- Personality: two patients with the same disease feel different.
- A working demo: someone talking to the patient, live or recorded.
- "Show your patient behaves correctly, beyond one lucky demo run."

Must have: believable background story, English speech in and out, distinct personality with emotion in the voice,
flowing conversation that reveals facts only when asked, working demo. Not needed: login, polished UI, business plan.

## Plan
1. **Voice:** OpenAI Realtime API (speech to speech, WebRTC from the browser, server-issued ephemeral key).
2. **Case file** (`cases/*.json`): facts with lay wording and disclosure triggers, opening line, personality, never-say list.
3. **Disclosure tracking:** the model calls `reveal_fact(fact_id)` before stating a key fact; the UI shows revealed facts.
4. **Consistency guard:** an async text model checks each patient turn against the case file.
5. **Evaluation harness:** a simulated student runs N text interviews per case and personality; reports invented facts,
   contradictions, unprompted disclosures, medical jargon, latency and personality difference.
6. **Feedback coach (nice to have):** after the talk, what the student covered and missed, with transcript quotes.

Demo safety: headset mic, backup video, text-mode fallback. API keys are capped: test cheaply, cache.

## Layout
- `cases/` patient cases (synthetic, written by the team)
- `docs/` challenge notes and decisions
- app code: added once the stack is agreed

## Rules
See [AGENTS.md](AGENTS.md). Keys stay local: copy the example environment file and never commit the real one.
