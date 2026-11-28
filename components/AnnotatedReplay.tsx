import type { ChatMessage } from "../lib/case/types.ts";
import type { CoachReport } from "../lib/engine/coach.ts";
import { replayChips } from "../lib/engine/replay.ts";
import type { DisclosureEvent, GuardEvent } from "../lib/engine/replay.ts";
import styles from "./Interview.module.css";

export function AnnotatedReplay({ messages, disclosures, warnings, report, facts }: {
  messages: (ChatMessage & { id: string })[]; disclosures: DisclosureEvent[]; warnings: GuardEvent[]; report: CoachReport;
  facts: { id: string; redFlag: boolean }[];
}) {
  return <section aria-labelledby="replay-title"><h3 id="replay-title">Annotated replay</h3><p className={styles.subtle}>Turn numbers follow the transcript. Phase chips use the coach’s quoted communication evidence; disclosure chips mark where the disclosure event was received.</p>
    <ol className={styles.replay}>{messages.map((message, index) => <li key={message.id}>
      <strong>Turn {index + 1} · {message.role === "student" ? "You" : "Patient"}</strong><p>{message.text}</p>
      <div className={styles.chips}>{replayChips(message, index, disclosures, warnings, report, facts).map((chip, i) => <span key={i} className={styles.chip}>{chip}</span>)}</div>
      {report.opportunities.filter(o => o.turn === index).map(o => <p key={o.turn}>Try: {o.better}</p>)}
    </li>)}</ol>
  </section>;
}
