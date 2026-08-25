"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { explainSentence } from "@/server/actions/quick-explanation";

export type ExplanationSource = {
  kind: "STUDY_MESSAGE" | "CONCEPT_MESSAGE" | "CONCEPT_CARD";
  id: string;
  studySessionId?: string;
};

export function SentenceExplanation({ children, sentence, source }: {
  children: ReactNode;
  sentence: string;
  source: ExplanationSource;
}) {
  const targetRef = useRef<HTMLSpanElement>(null);
  const popupRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [explanation, setExplanation] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (popupRef.current?.contains(event.target as Node)) return;
      if (targetRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  function requestExplanation(event: React.MouseEvent<HTMLSpanElement>) {
    if ((event.target as Element).closest("a, button")) return;
    setOpen(true);
    setExplanation(undefined);
    setError(undefined);
    startTransition(async () => {
      const result = await explainSentence(source.kind, source.id, sentence, source.studySessionId);
      setExplanation(result.explanation);
      setError(result.error);
    });
  }

  return <>
    {/* biome-ignore lint/a11y/useSemanticElements: A button cannot legally contain the nested concept links rendered inside this sentence. */}
    <span
      ref={targetRef}
      className="sentence-explanation-target"
      role="button"
      tabIndex={0}
      title="Kliknij, aby wyjaśnić całe zdanie"
      onClick={requestExplanation}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") requestExplanation(event as unknown as React.MouseEvent<HTMLSpanElement>);
      }}
    >{children}</span>
    {open && <span ref={popupRef} className="sentence-explanation">
      <span className="sentence-explanation-card" role="dialog" aria-label="Głębsze wyjaśnienie zdania">
        <strong>Głębsze wyjaśnienie</strong>
        <q>{sentence.trim()}</q>
        {pending && <span className="muted">Przygotowuję wyjaśnienie…</span>}
        {explanation && <span>{explanation}</span>}
        {error && <span className="error">{error}</span>}
        <button type="button" className="sentence-explanation-close" onClick={() => setOpen(false)}>Zamknij</button>
      </span>
    </span>}
  </>;
}
