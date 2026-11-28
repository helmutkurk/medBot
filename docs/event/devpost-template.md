# Submission draft — medBot

Codex, 2026-11-28. **Verify against live form:** 2026 platform, fields, eligibility, disclosures and pitch allocation are unconfirmed. This is not a submitted entry. Historical reference only: [2025 Devpost](https://hackatum25.devpost.com/).

**Project / tagline:** medBot — interview a synthetic patient, then see what your questions uncovered and your documentation missed.

**Challenge / user:** Avelios “VIP – Virtual Interview Patient”, hackaTUM 2026. Medical students practising English history-taking. Verify eligibility and prior-code/AI-assistance rules against actual requirements.

**Inspiration:** Students must adapt to different people, ask for important details and document what they learned. We built repeatable practice around structured case truth and visible evidence. Learning outcomes have not been measured.

**What it does:** Four synthetic cases: chest tightness, lower abdominal pain, sudden severe headache, and dizziness with a fall; two personalities each. Voice/text patients should disclose facts only when asked, preserving medical truth across personalities. Coaching identifies covered/missed questions; a structured anamnesis exposes documentation gaps and exports educational FHIR-like JSON. A diagnosis-driven creator generates schema-validated cases for immediate practice.

**How we built it / tools:** Next.js, React, strict TypeScript, Node 26 and OpenAI. WebRTC voice uses `gpt-realtime` and ephemeral keys; text patients use `gpt-5-mini`. Shared case instructions, disclosure tools and an asynchronous consistency guard support the interview. OpenAI drafts feedback/notes; disclosed IDs determine documentation completeness. `/eval` shows automated text evidence; `/usage` tracks call/token/cost estimates. CI runs typecheck, offline tests and build. No product mock mode.

**Challenge / decision:** Partial paired text comparison: same chest-tightness and dizziness cells, two personalities each, 12 turns, n up to 3. `gpt-4.1-mini`: 12 OK interviews, 8 invented, 5 contradictions, 5 unprompted, persona 11/12, p50 1129 ms / p95 1793 ms, 2 refusals. `gpt-5-mini`: 9 OK, 0 invented, 1 contradiction, 0 unprompted, 1 jargon, persona 8/9, p50 3644 ms / p95 7459 ms. Keep `gpt-5-mini` for consistency; voice uses `gpt-realtime` independently.

**Evidence / limits:** “OK” means completed, not error-free. Guard issue counts and blind automated transcript classification are fallible; unequal completion limits pairing. These are not human/clinical validation or voice timings. Cases were then rewritten atomically (facts 15 → 29–41), adding ICE, function, red flags and full medicines; Chatty voice now uses the warm branch. New-case n=3, 12-turn results: **[pending eval]**; final n≥5 run: **[pending eval]**; requested-fact retrieval, independent audit and Wilson intervals: **[pending eval]**. Bind submitted numbers to inspected artifacts; changed fact denominators preclude naive coverage comparisons.

**Verified today (2026-11-28):** `npm run check` green, 41 offline tests; CI added; `feat/Helmut` pushed (`4022dfc`, `afab5ef`, `b7514c8`, `c82dacb`). Real OpenAI: health, chat 4.4 s, guard 2.2 s, ephemeral realtime key OK, coach 10 s, anamnesis 2.8 s; `/eval` and `/usage` 200. Single endpoint observations do not prove end-to-end voice. Helmut's headset test is underway: voice median/sample count **[pending eval]**. Complete case-creation acceptance remains pending.

**Lessons / next:** Separate consistency, selective disclosure, personality and naturalness. Measure requested facts answered correctly separately from raw coverage. Finish fixed probes, calibrated independent ratings, final repeats and voice measurements; evaluate text streaming, shorter instructions and cache-friendly prefixes. Clinical review remains pending.

**Team / attribution:** Authorized submitter must enter approved public roster/credits in the live form. Disclose AI assistance as required. Documentation: Codex, 2026-11-28.

**Repository / demo / access:** Repo and presentation URL: pending verified links. Local rehearsal: `http://localhost:3000`, with a server-side OpenAI key. Resolve submission access without exposing a funded unauthenticated endpoint or keys.

**Media / captions:** Screenshots and video pending capture/link/playback checks. Captions: “Same headache, contrasting personalities”; “Coach and anamnesis expose gaps”; “Evaluation with sample sizes and limits.” Label backup footage recorded.

**Data / licenses / disclosures:** Authored synthetic patients only; no real patient data or personal profiles of real people, including judges. Chest example derives from the Avelios deck excerpt as noted in its case file. Verify repository license, dependency notices and provenance. OpenAI processes interview content. Call traces store metadata only; local eval artifacts/user exports may contain synthetic transcripts. Educational demo, not clinical advice or validated FHIR interoperability.

**Submission:** Helmut verifies/submits. Berlin: freeze Sat 28-11 18:00; candidate Sun 29-11 08:00; submission before Sun 29-11 10:00. Live-form requirements, final links, submission time and receipt: pending. Test links from a fresh session and save receipt before marking submitted.
