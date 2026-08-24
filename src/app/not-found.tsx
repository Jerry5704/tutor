import Link from "next/link";

export default function NotFound() {
  return (
    <main className="narrow stack">
      <p className="eyebrow">Tutor biologii</p>
      <section className="card stack">
        <h1>Nie znaleziono tej strony</h1>
        <p className="muted">Link mógł wygasnąć albo wskazuje element, do którego nie masz dostępu.</p>
        <Link className="button" href="/dashboard">Wróć do dashboardu</Link>
      </section>
    </main>
  );
}
