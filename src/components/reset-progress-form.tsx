"use client";

export function ResetProgressForm({ action }: { action: () => Promise<void> }) {
  return <form
    action={action}
    onSubmit={(event) => {
      const confirmed = window.confirm("Wyzerować postęp całego działu? Historia pozostanie w audycie, ale mastery celów i pojęć zacznie się od zera.");
      if (!confirmed) event.preventDefault();
    }}
  >
    <button type="submit" className="button secondary">Wyzeruj postęp działu i zacznij od nowa</button>
  </form>;
}
