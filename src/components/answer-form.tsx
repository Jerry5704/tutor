"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

export function AnswerForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const locked = useRef(false);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());
  return <form action={action} className="composer field" onSubmit={(event) => {
    if (locked.current) event.preventDefault();
    else locked.current = true;
  }}><input type="hidden" name="submissionId" value={submissionId} /><AnswerFields onSettled={() => { locked.current = false; setSubmissionId(crypto.randomUUID()); }} /></form>;
}

function AnswerFields({ onSettled }: { onSettled: () => void }) {
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  useEffect(() => {
    if (pending) wasPending.current = true;
    else if (wasPending.current) { wasPending.current = false; onSettled(); }
  }, [pending, onSettled]);
  return <><label htmlFor="answer"><strong>Twoja odpowiedź</strong></label><textarea id="answer" name="answer" required disabled={pending} placeholder="Wyjaśnij własnymi słowami…" /><button type="submit" className="button" disabled={pending}>{pending ? "Tutor analizuje…" : "Wyślij odpowiedź"}</button></>;
}
