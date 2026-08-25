"use client";

import { useEffect, useRef } from "react";

export function ChatAutoScroll({ latestMessageId }: { latestMessageId?: string }) {
  const previousMessageId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!latestMessageId || previousMessageId.current === latestMessageId) return;
    const isInitialRender = previousMessageId.current === undefined;
    previousMessageId.current = latestMessageId;
    if (isInitialRender && window.location.hash && window.location.hash !== `#message-${latestMessageId}`) return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`message-${latestMessageId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [latestMessageId]);

  return null;
}
