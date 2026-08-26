"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function MockExamGradingRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timeout = window.setTimeout(() => router.refresh(), 2500);
    return () => window.clearTimeout(timeout);
  }, [router]);
  return null;
}
