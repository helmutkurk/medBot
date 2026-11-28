---
name: demo-polish
description: Use for the last six hours before the deadline: freeze, known-good rollback, seeded demo account, offline fallback, backup video and speaker notes. Complements demo-check; do not duplicate it.
---

# demo-polish

Author: Claude (Sonnet), 2026-11-21. Time anchors (Berlin) come from the team brief and
`AGENTS.md`: feature freeze Sat 18:00; submission candidate frozen Sun 08:00; submission
deadline Sun 10:00. Confirm organizer rules; run `demo-check` for the flow check itself.

## Checklist
1. Freeze: announce on the board (team-sync); only fixes, integration, evidence and pitch.
   Merges are made by the lead after checks and another teammate's review.
2. Known-good rollback: the lead tags or records the last good commit SHA and branch in
   `docs/event/demo-script.md`, with the exact restore command. Re-verify after each merge.
3. Seeded demo account/data: deterministic reset script or documented steps; synthetic
   data only (data-and-fixtures); verify a reset takes under two minutes.
4. Offline fallback: with the network off the flow still completes via cached/fake
   answers (llm-integration), clearly labelled; test it once on the presenter laptop.
5. Backup video: record the happy path (2-3 minutes) on the demo device; play it back
   with sound; store it outside the repo and note its location and owner.
6. Second device and URL: confirm access, battery, charger, adapter, a hotspot and a
   second browser profile already signed in.
7. Speaker notes: one line per demo step, the sentence that names the problem, and
   a list of limitations stated honestly (what is fixture, what is real).
8. Rehearse the pitch (pitch-3min) twice against the clock; assign who clicks and who speaks.
9. Submission artifacts (submission-check): repo link, description, video, receipt;
   keep evidence without personal data. Leave spare time before the deadline.
10. Rest in shifts; hand off first (handoff skill). Never ship an untested late change.

## Acceptance check
- Two consecutive clean runs of the demo from reset, one on the presenter device.
- Rollback command tested once on a scratch copy by a human.
- Backup video plays; its path is in the demo notes.

Related: demo-check, pitch-3min, submission-check, testing-qa, handoff.
