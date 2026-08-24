import { db } from "@/server/db/client";
import { aiRateLimits } from "@/server/config/env";
import { logInfo } from "@/server/observability/logger";

type BucketRow = { count: number; expiresAt: Date };

async function consumeBucket(key: string, limit: number, windowMs: number, now: Date) {
  const expiresAt = new Date(now.getTime() + windowMs);
  const [bucket] = await db.$queryRaw<BucketRow[]>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count", "expiresAt", "updatedAt")
    VALUES (${key}, ${now}, 1, ${expiresAt}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "windowStart" = CASE
        WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${now}
        ELSE "RateLimitBucket"."windowStart"
      END,
      "count" = CASE
        WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "expiresAt" = CASE
        WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${expiresAt}
        ELSE "RateLimitBucket"."expiresAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "expiresAt"
  `;
  if (!bucket) throw new Error("Rate limit bucket was not returned");
  return {
    allowed: bucket.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt.getTime() - now.getTime()) / 1000)),
  };
}

export class AIRateLimitService {
  async consume(studentId: string) {
    const now = new Date();
    const limits = aiRateLimits();
    const short = await consumeBucket(`student:${studentId}:ai:10m`, limits.perTenMinutes, 10 * 60_000, now);
    if (!short.allowed) {
      logInfo("ai_rate_limit_rejected", { studentId, window: "10m", retryAfterSeconds: short.retryAfterSeconds });
      return short;
    }
    const daily = await consumeBucket(`student:${studentId}:ai:day`, limits.perDay, 24 * 60 * 60_000, now);
    if (!daily.allowed) {
      logInfo("ai_rate_limit_rejected", { studentId, window: "day", retryAfterSeconds: daily.retryAfterSeconds });
    }
    return daily;
  }

  async notifyStudySession(studentId: string, sessionId: string) {
    const content = "Na chwilę zatrzymuję nowe odpowiedzi AI, ponieważ wysłano ich bardzo dużo w krótkim czasie. Twój postęp jest zapisany — wróć za kilka minut.";
    const session = await db.studySession.findFirstOrThrow({
      where: { id: sessionId, studentId, endedAt: null },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (session.messages[0]?.content === content) return;
    await db.tutorMessage.create({
      data: { sessionId, role: "TUTOR", content, learningObjectiveId: session.currentObjectiveId },
    });
  }

  async notifyConceptSession(studentId: string, conceptSessionId: string) {
    const content = "Na chwilę zatrzymuję nowe odpowiedzi AI, ponieważ wysłano ich bardzo dużo w krótkim czasie. Twój postęp jest zapisany — wróć za kilka minut.";
    const session = await db.conceptSession.findFirstOrThrow({
      where: { id: conceptSessionId, studentId, status: "ACTIVE" },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (session.messages[0]?.content === content) return;
    await db.conceptMessage.create({ data: { conceptSessionId, role: "TUTOR", content } });
  }
}
