import { AccessForm } from "../../components/HostedForms.tsx";
import styles from "../hosted.module.css";

export default function AccessPage() {
  return <main className={styles.page}>
    <h1>Welcome to medBot</h1>
    <p>A private demo for practicing interviews with synthetic patients. Enter the passcode shared by the host.</p>
    <AccessForm />
    <p>Use fictional details only. Do not enter real patient data. Audio and interview text are processed by OpenAI; we do not store recordings. Your learning profile stays in this browser. Optional feedback is stored for the host.</p>
    <p>This is an education demo, not clinical advice.</p>
  </main>;
}
