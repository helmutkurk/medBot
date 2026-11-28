# Decisions (overnight, coordinator)

| Date | Decision | Why | Alternative | Revert |
| --- | --- | --- | --- | --- |
| 2026-11-28 | Text patient stays gpt-5-mini | gpt-4.1-mini: 8 invented / 5 contradictions in paired eval | gpt-4.1-mini (3x faster) | `OPENAI_PATIENT_MODEL` |
| 2026-11-28 | Voice stays gpt-realtime | bench: mini not faster, contradictions | gpt-realtime-mini | `OPENAI_REALTIME_MODEL` |
| 2026-11-28 | Name stays medBot | Helmut's choice | Anamnesia, VIPatient | — |
| 2026-11-28 | No new npm dependencies overnight | AGENTS.md asks before deps; Helmut asleep | add libs | — |
| 2026-11-28 | Leaderboard = opt-in nickname only, server JSON file | needs shared state; no personal data | none / accounts | delete `data/leaderboard.json` |
| 2026-11-28 | Doctor-recorded real cases not built | synthetic-only rule, consent/privacy | build import | pitch roadmap |
| 2026-11-28 | Host on Vercel, not GitHub Pages | Pages is static; server routes and the secret key need a server | GitHub Pages (would expose key) | remove Vercel project |
| 2026-11-28 | Public deploy waits for Helmut | external publication with his account | deploy overnight | — |
