# Next steps (handoff, 2026-11-28)

State: branch `feat/Helmut`, all checks green (`npm run check`: 34 tests, typecheck, build). OpenAI-only, no mock mode.
First real eval (n=1, 8 turns, 8 interviews): 2 invented facts and 2 unprompted disclosures, all in
abdominal-pain-01/anxious; 0 jargon; 0 out of character; personality recognised 88 % (calm-engineer missed);
text latency p50 3.3 s (reasoning effort "low"; "minimal" broke the JSON reply). Summary: `eval/summary.md`.

Migrated from the old pre-event folder: `.editorconfig`, `.gitattributes`, PR template, `docs/event/*`
(pitch, demo script, devpost, run-of-show, risk register, organiser questions), skills in `.claude/skills/`
and the read-only reviewer agent.

To do, in order:
1. Commit and push `feat/Helmut` (named paths only).
2. Done: added CI with pinned checkout, read-only permissions, Node 26, npm cache, `npm ci` and `npm run check`.
3. Test live voice in the browser with a headset (WebRTC, `reveal_fact`, latency chip, `session.update` memo).
4. Done: added abdominal pain character/radiation facts, constrained anxious embellishments, sharpened calm-engineer delivery and deduplicated guard jargon issues (Codex, 2026-11-28).
5. Eval `npm run eval -- --n 3 --turns 12 --md eval/summary.md`; watch `/usage` for budget.
6. Pitch and demo per `docs/winning-plan.md` (Frank two personalities → headache red flag → anamnesis → /eval).
