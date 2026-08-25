import type { TutorContext } from "@/server/ai/contracts";

export function tutorRequestInput(context: TutorContext) {
  return {
    phase: context.phase,
    objective: { code: context.objectiveCode, description: context.objectiveDescription },
    teacherScopeNote: context.teacherScopeNote ?? null,
    clarificationRequest: context.clarificationRequest,
    approvedKnowledge: context.knowledge,
    recentConversation: context.recentMessages,
    studentAnswer: context.answer,
  };
}
