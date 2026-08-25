"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { OpenAIProvider } from "@/server/ai/openai-provider";
import { requireStudent } from "@/server/auth/session";
import { TestPlanService } from "@/server/services/test-plan-service";
import { TutorService } from "@/server/services/tutor-service";

const draftSchema = z.object({
  testDate: z.iso.date(),
  dailyMinutes: z.coerce.number().int().min(5).max(180),
  teacherNote: z.string().trim().max(5000),
});

const scopeSchema = z.enum(["INCLUDED", "EXCLUDED", "PRIORITY"]);

export async function createTestPlanDraft(unitId: string, form: FormData) {
  const student = await requireStudent();
  const parsed = draftSchema.safeParse({
    testDate: form.get("testDate"),
    dailyMinutes: form.get("dailyMinutes"),
    teacherNote: form.get("teacherNote") ?? "",
  });
  if (!parsed.success) throw new Error("Uzupełnij prawidłową datę sprawdzianu i dzienny czas nauki.");
  const testDate = new Date(`${parsed.data.testDate}T12:00:00.000Z`);
  const earliest = new Date();
  earliest.setUTCHours(0, 0, 0, 0);
  const latest = new Date(earliest);
  latest.setUTCFullYear(latest.getUTCFullYear() + 2);
  if (testDate < earliest || testDate > latest) throw new Error("Data sprawdzianu musi przypadać w ciągu najbliższych dwóch lat.");
  await new TestPlanService(new OpenAIProvider()).createDraft(student.id, {
    unitId,
    testDate,
    dailyMinutes: parsed.data.dailyMinutes,
    teacherNote: parsed.data.teacherNote,
  });
  redirect(`/units/${unitId}/test-plan`);
}

export async function confirmTestPlan(unitId: string, planId: string, form: FormData) {
  const student = await requireStudent();
  const scopes = new Map<string, "INCLUDED" | "EXCLUDED" | "PRIORITY">();
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("scope:")) continue;
    const objectiveId = key.slice("scope:".length);
    const parsed = scopeSchema.safeParse(value);
    if (objectiveId && parsed.success) scopes.set(objectiveId, parsed.data);
  }
  await new TestPlanService(new OpenAIProvider()).confirm(student.id, planId, scopes);
  const session = await new TutorService(new OpenAIProvider()).start(student.id, unitId);
  redirect(`/study/${session.id}`);
}

export async function startUnit(unitId: string) {
  const student = await requireStudent();
  const session = await new TutorService(new OpenAIProvider()).start(student.id, unitId);
  redirect(`/study/${session.id}`);
}
