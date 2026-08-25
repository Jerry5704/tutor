import type { AIUsageFeature } from "@/generated/prisma/enums";
import { openAIConfig, openAIPricing } from "@/server/config/env";
import { db } from "@/server/db/client";
import { logError, logInfo } from "@/server/observability/logger";

type UsageResult = {
  responseId: string;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  cachedInputTokens?: number;
  outputTokens?: number;
  reasoningOutputTokens?: number;
  totalTokens?: number;
};

type CaptureContext = {
  studentId: string;
  studySessionId?: string;
  conceptSessionId?: string;
  feature: AIUsageFeature;
  promptVersion: string;
};

function estimatedCost(result: UsageResult) {
  const pricing = openAIPricing(result.model);
  if (pricing.inputUsdPerMillion === undefined
    || pricing.cachedInputUsdPerMillion === undefined
    || pricing.outputUsdPerMillion === undefined) {
    return { pricing, cost: undefined };
  }
  const cached = Math.min(result.cachedInputTokens ?? 0, result.inputTokens ?? 0);
  const uncached = Math.max(0, (result.inputTokens ?? 0) - cached);
  const cost = (
    uncached * pricing.inputUsdPerMillion
    + cached * pricing.cachedInputUsdPerMillion
    + (result.outputTokens ?? 0) * pricing.outputUsdPerMillion
  ) / 1_000_000;
  return { pricing, cost };
}

export class AIUsageService {
  private async recordCompleted(context: CaptureContext, result: UsageResult) {
    const { pricing, cost } = estimatedCost(result);
    await db.aiUsageEvent.upsert({
      where: { providerResponseId: result.responseId },
      update: {},
      create: {
        ...context,
        status: "COMPLETED",
        providerResponseId: result.responseId,
        model: result.model,
        latencyMs: result.latencyMs,
        inputTokens: result.inputTokens,
        cachedInputTokens: result.cachedInputTokens,
        outputTokens: result.outputTokens,
        reasoningOutputTokens: result.reasoningOutputTokens,
        totalTokens: result.totalTokens,
        inputUsdPerMillion: pricing.inputUsdPerMillion,
        cachedInputUsdPerMillion: pricing.cachedInputUsdPerMillion,
        outputUsdPerMillion: pricing.outputUsdPerMillion,
        estimatedCostUsd: cost,
      },
    });
    logInfo("ai_usage_recorded", {
      studentId: context.studentId,
      studySessionId: context.studySessionId,
      feature: context.feature,
      model: result.model,
      responseId: result.responseId,
      inputTokens: result.inputTokens,
      cachedInputTokens: result.cachedInputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd: cost,
    });
  }

  private async recordFailed(context: CaptureContext, error: unknown, latencyMs: number) {
    await db.aiUsageEvent.create({
      data: {
        ...context,
        status: "FAILED",
        model: openAIConfig().model,
        latencyMs,
        errorType: error instanceof Error ? error.name : "UnknownError",
      },
    });
  }

  private async safely(operation: () => Promise<void>, context: CaptureContext) {
    try {
      await operation();
    } catch (error) {
      logError("ai_usage_recording_failed", error, {
        studentId: context.studentId,
        studySessionId: context.studySessionId,
        feature: context.feature,
      });
    }
  }

  async capture<T extends UsageResult>(context: CaptureContext, operation: () => Promise<T>) {
    const started = Date.now();
    try {
      const result = await operation();
      await this.safely(() => this.recordCompleted(context, result), context);
      return result;
    } catch (error) {
      await this.safely(() => this.recordFailed(context, error, Date.now() - started), context);
      throw error;
    }
  }
}
