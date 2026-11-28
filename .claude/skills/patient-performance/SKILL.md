---
name: patient-performance
description: Use when changing patient prompts, personality definitions or voice delivery; prove believable, recognisable behaviour with paired examples while preserving clinical truth and disclosure permissions.
---

# Patient performance

Author: Codex, 2026-11-28.

Produce paired responses to identical questions, a performance matrix and separate transcript/audio ratings. Aim for recognisable people with stable facts, rather than adding personality adjectives.

## Ground the performance

Read the target case, `lib/case/prompt.ts` and the relevant patient or Realtime path. Read [paired-examples.md](references/paired-examples.md) when drafting contrasts or checking text/voice latency. Compare `truth`, `lay` and `reveal_when` before editing any delivery instruction.

Hold clinical content and permission constant across personalities. Let a reserved patient answer direct questions fully, a composed patient acknowledge severe pain, and an anxious patient sound worried without adding palpitations, breathlessness or symptom changes. Keep diagnoses and clinical explanations out of patient speech.

Author substantive ideas, concerns, expectations and functional impact in the case with disclosure conditions. Use those patient-perspective domains to respond credibly to clarification and acknowledgement; do not improvise a clinical belief or new life event as flavour. Allow empathy to change conversational warmth without changing symptom severity or consent to disclose unrelated information.

## Build observable contrasts

Fill this matrix for each personality pair. Use ordinary behaviour rather than accents or demographic stereotypes.

| Dimension | Restrained / downplaying example | Anxious example |
| --- | --- | --- |
| Brevity / register | One plain, direct sentence | One or two short sentences, occasional restart |
| Pace / hesitation | Even pace; brief pause on discomfort | Slightly uneven pace; sparse fillers |
| Humour / reassurance | Dry understatement; no reassurance request | Occasional short reassurance question |
| Repetition | Repeat facts without adding detail | Repeat the same facts, perhaps checking clarity |
| Interruption / redirection | Pause, then answer the resumed question | Stop the aside and answer the resumed question |
| Empathy | Brief acknowledgement, perhaps warmer | Acknowledge concern without claiming physical improvement |

Adjust dimensions for the actual pair: sociable does not mean anxious, and analytical does not mean indifferent to severe pain. Review `buildVoiceDelivery()` keyword effects: it currently includes `chatty` and `talkative` in its nervous branch. Inspect generated instructions when the warm `chatty` personality sounds tense; a label alone does not establish appropriate delivery.

## Judge transcript and audio separately

1. Collect opening, sensitive-history, repeated-question, unknown-answer, false-premise and redirection examples with identical questions and permitted facts. Annotate the expected IDs and forbidden extra assertions.
2. Rate factuality and disclosure as separate pass/fail checks. Audit spoken assertions even when returned `revealed` IDs look correct.
3. Rate transcript naturalness with anchors: 1 = scripted, evasive or repetitive; 2 = understandable with some awkward phrasing; 3 = concise, responsive, everyday speech. Record a quote supporting each rating.
4. Rate audio delivery separately: 1 = flat or theatrical relative to the authored personality; 2 = partly consistent pacing/emotion; 3 = sustained, believable delivery with intelligible speech and appropriate turn-taking. Do not infer this score from text.
5. Classify personalities blind with balanced labels and a confusion matrix. Hide labels, stock opening lines and catchphrases in a second check; use held-out questions. Include a same-voice comparison so voice identity cannot explain recognition. Retain candidate rotation already in `scripts/eval.ts`.
6. Use the project's ≥80% personality-recognition target as a measured goal, with denominators and uncertainty. A few selected examples do not establish that target. Use `patient-evaluation` for judge calibration, human review and paired comparisons.

Measure the relevant latency before changing model choice, instructions or tool sequencing. Preserve `reveal_fact` recording before speech, including repetitions; faster speech is not a success if disclosure tracking is lost. Test interruption, recovery and long-context memo behaviour in a real voice session outside browser-restricted sandboxes.

## Hand over

Return the matrix, paired examples, evidence-backed ratings, measured text/voice latency definitions and remaining uncertainties. Run `npm run check` for implementation changes; run paired `npm run eval -- --n 3` before and after prompt or case changes and include numbers in the PR. Block added inventions, contradictions or reduced coverage. Keep text fallback connected to OpenAI and use a backup recording for an unavailable live demo; do not introduce canned product replies.

## Sources

Derived rubric ideas: [Aperivue/medsci-skills](https://github.com/Aperivue/medsci-skills) (MIT), `design-ai-benchmarking`; evidence per rating: [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) (MIT), `scholar-evaluation`, via supplied research notes. Patient-perspective and communication concepts are general clinical-education knowledge, supported by the [University of Bristol consultation handbook](https://www.bristol.ac.uk/media-library/sites/primaryhealthcare/migrated/documents/conshandbook.pdf). Text and examples are original, not copied.
