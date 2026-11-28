# Case catalogue

All cases are synthetic. Each one is modelled on the typical presentation that public patient
information describes (NHS condition pages linked in each file's `note`), so the symptoms fit
together clinically. The suspected diagnosis is for evaluators only; the patient never knows or
names it, and `never_say` blocks the giveaway terms.

| Case id | Title | Patient | Suspected diagnosis | Key teaching points | Personalities |
| --- | --- | --- | --- | --- | --- |
| `chest-tightness-01` | Chest tightness | Frank, 58, mechanic | Stable angina (inferred) | Exertion/rest pattern, risk factors, forgotten tablets | Downplaying, Anxious |
| `abdominal-pain-01` | Lower abdominal pain | Maya, 24, student | Appendicitis (from its note) | Pain migration, pregnancy/period questions | Reserved, Anxious |
| `cough-fever-01` | Cough and fever | Ingrid, 71, retired teacher | Community-acquired pneumonia | Pain on breathing, breathlessness vs baseline, **penicillin allergy**, lives alone | Stoic, Chatty |
| `thirst-tiredness-01` | Tiredness and thirst | Daniel, 52, van driver | New type 2 diabetes | Thirst, night-time urination, weight loss, itching, family history, **driving job** | Impatient, Jovial |
| `recurring-headaches-01` | Recurring headaches | Sophie, 29, barista | Migraine with aura | Visual warning, triggers, red-flag negatives, **combined pill with aura** | Frustrated, Worried |
| `tiredness-weight-gain-01` | Tiredness and weight gain | Linda, 46, practice manager | Underactive thyroid | Cold intolerance, constipation, heavy periods, low mood, sister on daily tablet | Apologetic, Tearful |
| `painful-toe-01` | Painful swollen toe | Martin, 63, chef | Acute gout | Night onset, previous episode, **water tablet**, alcohol/diet trigger, no fever or injury | Grumpy, Storyteller |

## Testing notes

- Each case has 15–16 facts, including important negatives (for example no fever in the toe
  case and no weakness or numbness in the headache case) that a good student should ask about.
- Bold teaching points are the facts a weak interview usually misses; the coach report should
  list them as missed when they aren't asked about.
- Offline check: `node scripts/eval.ts --mock --n 1 --turns 20 --case <id>`. Mock coverage is
  lower for the new cases because the mock student's fixed question list doesn't cover topics
  such as vision, skin or periods. Use live runs for real numbers.
