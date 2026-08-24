import { login } from "./actions";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="narrow"><p className="eyebrow">Twój osobisty plan nauki</p><h1>Biologia, którą naprawdę rozumiesz.</h1><p className="muted">Tutor najpierw sprawdzi Twój stan wiedzy, a potem skupi się na konkretnych brakach.</p><form action={login} className="card stack"><h2>Zaloguj się</h2>{error && <p className="error">Nieprawidłowy e-mail lub hasło.</p>}<label className="field">E-mail<input name="email" type="email" defaultValue="uczen@example.com" required /></label><label className="field">Hasło<input name="password" type="password" defaultValue="Tutor123!" required /></label><button type="submit" className="button">Przejdź do nauki</button></form></main>;
}
