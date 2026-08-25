import type { LearningEventType } from "@/generated/prisma/enums";
import { db } from "@/server/db/client";
import { logError } from "@/server/observability/logger";

type EventMetadata = Record<string, string | number | boolean | null>;

export class LearningEventService {
  async record(input: {
    studentId: string;
    studySessionId?: string;
    learningObjectiveId?: string;
    eventType: LearningEventType;
    metadata?: EventMetadata;
    deduplicationKey?: string;
  }) {
    try {
      if (input.deduplicationKey) {
        await db.learningEvent.upsert({
          where: { deduplicationKey: input.deduplicationKey },
          update: {},
          create: input,
        });
      } else {
        await db.learningEvent.create({ data: input });
      }
    } catch (error) {
      logError("learning_event_recording_failed", error, {
        studentId: input.studentId,
        studySessionId: input.studySessionId,
        eventType: input.eventType,
      });
    }
  }
}
