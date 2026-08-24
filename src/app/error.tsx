"use client";

import Link from "next/link";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="narrow stack">
      <p className="eyebrow">Tutor biologii</p>
      <section className="card stack" role="alert">
        <h1>Coś przerwało tę stronę</h1>
        <p className="muted">
          Twoje zapisane postępy pozostają w bazie. Spróbuj ponownie albo wróć do dashboardu.
        </p>
        {error.digest ? <p className="muted">Kod zdarzenia: {error.digest}</p> : null}
        <div className="row">
          <button className="button" type="button" onClick={() => retry()}>Spróbuj ponownie</button>
          <Link className="button secondary" href="/dashboard">Wróć do dashboardu</Link>
        </div>
      </section>
    </main>
  );
}
