import styles from "../hosted.module.css";

export default function PrivacyPage() {
  return <main className={styles.page}>
    <a className={styles.back} href="/">← Back to medBot</a>
    <h1>Privacy and demo use</h1>
    <p>medBot is an educational prototype for interviewing synthetic patients. Use fictional details only. Do not enter real patient data or personal information. It is not a clinical service or medical advice.</p>
    <h2>Audio and interview text</h2>
    <p>During voice interviews, microphone audio is sent directly to OpenAI over WebRTC for the session and transcription. Typed questions, interview text, synthetic case details and report requests are processed by OpenAI through our server. Transcripts and reports are kept in the current browser session; we do not store audio recordings or interview transcripts on our server. Downloads you choose to save remain on your device.</p>
    <p>OpenAI processing and retention depend on the host’s API account settings. <a href="https://developers.openai.com/api/docs/guides/your-data">OpenAI API data controls</a>. The host has not promised zero provider retention or EU-only processing.</p>
    <h2>Your browser</h2>
    <p>Your learning profile, practice progress and preferences are stored locally in this browser, without an account. Clear this site’s browser data to remove them. The app may cache its static offline shell; it does not cache interviews or API responses. Signed, httpOnly cookies keep demo access for up to 12 hours and feedback-admin access for up to one hour.</p>
    <h2>Usage and feedback</h2>
    <p>We retain usage metadata such as model, token counts, estimated cost, timing and synthetic case identifiers. These records exclude prompts, audio, transcript text and credentials. Client IP addresses and random cookie identifiers are used temporarily in memory for rate limits and are not added to our usage or feedback records.</p>
    <p>If you send optional feedback, the host receives your rating (1–5), comment, submission time and a random entry ID. Do not include patient data, names or contact details. In the hosted demo, feedback is saved temporarily and also written to server logs accessible to the host. Only holders of the separate admin code can review entries in the app.</p>
    <p>Hosted files and in-memory state are temporary, isolated by server instance and may disappear on restart. Vercel also processes request and infrastructure logs under the host’s account settings. To request removal of feedback or ask about retention, contact the person who shared this demo; the host can identify feedback by its time and comment and manage server logs.</p>
  </main>;
}
