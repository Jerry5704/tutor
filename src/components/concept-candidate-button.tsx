"use client";

import { useTransition, type ReactNode } from "react";

export function ConceptCandidateButton({ term, action, children }: {
  term: string;
  action: (term: string) => void | Promise<void>;
  children: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  return <button
    type="button"
    className="concept-candidate"
    title={`Utwórz wyjaśnienie pojęcia: ${term}`}
    disabled={pending}
    onClick={(event) => {
      event.stopPropagation();
      startTransition(() => action(term));
    }}
  >{pending ? "Otwieram…" : children}</button>;
}
