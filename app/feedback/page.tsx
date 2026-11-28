import { FeedbackAdmin, FeedbackForm } from "../../components/HostedForms.tsx";
import styles from "../hosted.module.css";

export default function FeedbackPage() {
  return <main className={styles.page}>
    <a className={styles.back} href="/">← Back to medBot</a>
    <h1>Send feedback</h1>
    <p>Sharing feedback is optional. No name or contact details are requested.</p>
    <FeedbackForm /><FeedbackAdmin />
  </main>;
}
