# Paired performance examples and latency checklist

Author: Codex, 2026-11-28. Use these as authored review examples, not canned runtime answers or evidence of model performance. Recheck the current case before reuse. Quotation marks below represent dialogue, not quotations from external sources.

## Same question, same fact

Hold the question and clinical meaning fixed. Add no measurements, symptoms or sensitive facts to express emotion. IDs identify the case support; return only IDs actually spoken.

| Case / support | Exact question | Personality A | Personality B |
| --- | --- | --- | --- |
| `chest-tightness-01` / `chest_tightness` (location and trigger components) | What brings you here? | Downplaying: “A tightness in my chest, mostly on the depot stairs. Bit of a nuisance.” | Anxious: “Um, a tightness in my chest, mostly on the stairs at the depot. It's worrying me.” |
| `chest-tightness-01` / `episode_duration` | How long does each episode last? | Downplaying: “About five minutes.” | Anxious: “Um, about five minutes each time. Is that worrying?” |
| `abdominal-pain-01` / sexual-history component of `period_pregnancy` | Have you been sexually active in the last year? | Reserved: “No, I have not had sex in the last year.” | Anxious: “Um, no. I haven't had sex in the last year.” |
| `chest-tightness-01` / `episode_duration` after the same earlier question | Just to check again, how long does an episode last? | Downplaying: “Still about five minutes.” | Anxious: “About five minutes, yes. Am I explaining that clearly?” |
| `chest-tightness-01` / unknown, no new ID | What was your measured blood pressure this morning? | Downplaying: “I'm not sure. I couldn't tell you.” | Anxious: “Um, I'm not sure. I couldn't tell you.” |
| `chest-tightness-01` / `smoking` | You have never smoked, correct? | Downplaying: “No. Twenty a day, for thirty years.” | Anxious: “No, um, twenty a day for thirty years.” |
| `chest-tightness-01` / `smoking`, after a work-related diversion | Let's return to the question: how much do you smoke? | Downplaying: “Fair enough. Twenty a day, for thirty years.” | Anxious: “Yes, sorry. Twenty a day for thirty years.” |
| `thunderclap-headache` / current-severity component of `worst_ever` | How bad is the pain right now, out of ten? | Calm engineer: “At present, nine out of ten.” | Irritable: “Nine. Can we keep going?” |

For the broad chest opening, keep the same components in both answers; the current `chest_tightness` truth also bundles onset. For the sensitive-history and severity examples, annotate the precise component spoken instead of granting credit for the whole bundled ID. Use `clinical-case-design` to resolve these schema/disclosure seams. Anxiety, embarrassment and frustration may change delivery, never the reported answer.

For an empathy turn such as “That sounds difficult,” compare a brief acknowledgement in each personality. Do not add a new concern, diagnosis, bodily sensation or improvement in pain unless already authored and permitted. After an interruption, resume only the requested fact, with disclosure recording intact.

## Text latency

- Record patient/text model IDs, case, personality, turn, input length, retries, timestamp and sample count.
- Use `PatientTurn.latencyMs` / eval `latenciesMs` for the engine patient request through the complete structured reply, including its validation work. Do not describe it as time to first token.
- Keep browser text request round-trip separate; it includes transport and server work. Keep `evaluationCyclesMs` separate again: student question + patient response + guard. Coach, judge and anamnesis calls are outside that per-turn cycle.
- Compare p50/p95 from individual durations for the same workload, not averages of per-interview percentiles. Record errors and timeouts instead of dropping slow failures.
- Inspect instruction length, model choice, reasoning settings and retries before proposing changes. Report which boundary was measured and what remains unmeasured.

## Voice latency and delivery

- Measure the browser interval from `input_audio_buffer.speech_stopped` to the first output-audio event. Treat it as an event-based onset approximation, not an acoustic measurement. Keep transcript arrival time separate.
- Measure perceived audible response separately with an actual headset session or timed recording; note VAD behaviour, network/device, model, voice, tools and sample count. VAD's detected speech end may differ from the speaker's physical speech end.
- Instrument tool request, tool result and audio-event timestamps before changing sequencing. Preserve `reveal_fact` before speech and repeat its call when repeating facts.
- Check acknowledgement, interruption/barge-in, recovery, direct safety questions and the memo update after the configured interval (currently every sixth patient turn). Confirm actual audible performance; inspect incomplete transcription as a limitation on guard evaluation.
- Compare personalities using the same voice as well as their assigned voices. Record pacing, hesitation, emotional credibility, intelligibility and whether catchphrases drove recognition.
- Treat the winning plan's roughly 1.2-second voice target as a target until measured over repeated live turns. Text eval cannot verify it. Run manual browser checks outside browser-restricted sandboxes; use `npm run dev` in a permitted environment, then follow the README voice flow.

## Sources

Anchored rubric design: [Aperivue/medsci-skills](https://github.com/Aperivue/medsci-skills) (MIT), `design-ai-benchmarking`; evidence-backed ratings: [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills) (MIT), `scholar-evaluation`, via supplied research notes. Text and dialogue are original, not copied. Case facts, latency boundaries and memo cadence come from this repo's cases, engine, eval harness and README. Patient-perspective framing is general clinical-education knowledge.
