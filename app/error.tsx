"use client";

export default function ErrorPage({ reset }: { error?: Error; reset: () => void }) {
  return <main className="error-page">
    <h1>Something went wrong.</h1>
    <p>The page could not load. This is usually temporary: try again, or go back to the start.</p>
    <p><button onClick={reset}>Try again</button> <a href="/">Back to home</a></p>
  </main>;
}
