import type { TutorContext } from "@/server/ai/contracts";

export function tutorRequestInput(context: TutorContext) {
  return {
    phase: context.phase,
    objective: { code: context.objectiveCode, description: context.objectiveDescription },
    teacherScopeNote: context.teacherScopeNote ?? null,
    clarificationRequest: context.clarificationRequest,
    currentQuestion: context.currentQuestion,
    questionRequiresExplanation: context.questionRequiresExplanation,
    scoringRubric: context.questionRubric ?? null,
    approvedKnowledge: context.knowledge,
    recentConversation: context.recentMessages,
    studentAnswer: context.answer,
  };
}
