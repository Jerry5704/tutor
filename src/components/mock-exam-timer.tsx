"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function remainingSeconds(expiresAt: string) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function MockExamTimer({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(() => remainingSeconds(expiresAt));
  useEffect(() => {
    const interval = window.setInterval(() => {
      const next = remainingSeconds(expiresAt);
      setRemaining(next);
      if (next === 0) {
        window.clearInterval(interval);
        router.refresh();
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt, router]);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return <strong className={remaining <= 120 ? "mock-timer urgent" : "mock-timer"} aria-live="polite">
    {minutes}:{seconds.toString().padStart(2, "0")}
  </strong>;
}
