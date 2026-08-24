export type StudentAnswerDraft = {
  sessionId: string;
  content: string;
  submissionId?: string;
};

export interface StudentAnswerRepository<T> {
  findBySubmissionId(submissionId: string): Promise<T | null>;
  create(data: StudentAnswerDraft): Promise<T>;
}

export async function createStudentAnswerOnce<T>(repository: StudentAnswerRepository<T>, draft: StudentAnswerDraft) {
  if (draft.submissionId && await repository.findBySubmissionId(draft.submissionId)) return undefined;
  try {
    return await repository.create(draft);
  } catch (error) {
    if (draft.submissionId && await repository.findBySubmissionId(draft.submissionId)) return undefined;
    throw error;
  }
}
