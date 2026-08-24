"use server";
import { redirect } from "next/navigation";
import { requireStudent } from "@/server/auth/session";
import { TutorService } from "@/server/services/tutor-service";
import { OpenAIProvider } from "@/server/ai/openai-provider";
export async function startUnit(unitId: string, form: FormData) { const student = await requireStudent(); const session = await new TutorService(new OpenAIProvider()).start(student.id, unitId, String(form.get("teacherNote") ?? "")); redirect(`/study/${session.id}`); }
