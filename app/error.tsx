"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="error-page"><h1>We couldn’t load the patient cases.</h1><p>Check that the case files are valid, then try again.</p><button onClick={reset}>Try again</button></main>;
}
