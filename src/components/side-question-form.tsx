"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

export function SideQuestionForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const locked = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  return <form ref={formRef} action={action} className="side-chat-form field" onSubmit={(event) => {
    if (locked.current) event.preventDefault();
    else locked.current = true;
  }}>
    <input type="hidden" name="submissionId" value={submissionId} />
    <SideQuestionFields onSettled={() => {
      locked.current = false;
      formRef.current?.reset();
      setSubmissionId(crypto.randomUUID());
    }} />
  </form>;
}

function SideQuestionFields({ onSettled }: { onSettled: () => void }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    if (pending) wasPending.current = true;
    else if (wasPending.current) {
      wasPending.current = false;
      onSettled();
    }
  }, [pending, onSettled]);
  return <>
    <label htmlFor="side-question" className="muted">To pytanie nie zmieni wyniku ani miejsca w głównej nauce.</label>
    <textarea id="side-question" name="sideQuestion" required disabled={pending} placeholder="Np. czym jest wiązanie wodorowe?" />
    <button type="submit" className="button" disabled={pending}>{pending ? "Szukam w materiałach…" : "Zapytaj"}</button>
  </>;
}
