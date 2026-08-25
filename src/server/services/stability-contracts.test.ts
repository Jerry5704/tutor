import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TutorContext } from "@/server/ai/contracts";
import { tutorRequestInput } from "@/server/ai/tutor-request-input";
import {
  resumePausedSessionData,
  sessionAcceptsInput,
  uniqueConceptIds,
} from "@/server/services/session-lifecycle-policy";
import {
  createStudentAnswerOnce,
  type StudentAnswerDraft,
  type StudentAnswerRepository,
} from "@/server/services/student-answer-idempotency";

type Answer = StudentAnswerDraft & { id: string };

class MemoryAnswerRepository implements StudentAnswerRepository<Answer> {
  private readonly bySubmission = new Map<string, Answer>();
  created = 0;

  async findBySubmissionId(submissionId: string) {
    return this.bySubmission.get(submissionId) ?? null;
  }

  async create(data: StudentAnswerDraft) {
    await Promise.resolve();
    if (data.submissionId && this.bySubmission.has(data.submissionId)) throw new Error("unique constraint");
    const answer = { ...data, id: `answer-${++this.created}` };
    if (data.submissionId) this.bySubmission.set(data.submissionId, answer);
    return answer;
  }
}

const context = (teacherScopeNote?: string): TutorContext => ({
  phase: "DIAGNOSTIC",
  objectiveCode: "mol_nucleotide_structure",
  objectiveDescription: "Uczeń wyjaśnia budowę nukleotydu.",
  objectiveGuidance: "Kontrolowana wskazówka.",
  domainGuardrails: [],
  scaffoldLevel: 0,
  mastery: 0,
  desiredChallenge: "RECALL",
  forceExplanation: false,
  clarificationRequest: false,
  currentQuestion: "Czy to nić wiodąca czy opóźniona?",
  questionRequiresExplanation: false,
  teacherScopeNote,
  knowledge: [{ chunkId: "chunk-1", sourceId: "source-1", sourceTitle: "Podręcznik", locator: "s. 12", content: "Treść źródłowa" }],
  recentMessages: [{ role: "TUTOR", content: "Pytanie" }],
  answer: "Odpowiedź ucznia",
});

describe("stability contracts", () => {
  it("creates at most one answer for concurrent submissions with the same id", async () => {
    const repository = new MemoryAnswerRepository();
    const draft = { sessionId: "session-1", content: "odpowiedź", submissionId: "submission-1" };
    const results = await Promise.all([
      createStudentAnswerOnce(repository, draft),
      createStudentAnswerOnce(repository, draft),
    ]);
    assert.equal(repository.created, 1);
    assert.equal(results.filter(Boolean).length, 1);
  });

  it("does not swallow a database error unrelated to an existing submission", async () => {
    const repository: StudentAnswerRepository<Answer> = {
      findBySubmissionId: async () => null,
      create: async () => { throw new Error("database unavailable"); },
    };
    await assert.rejects(
      createStudentAnswerOnce(repository, { sessionId: "session-1", content: "x", submissionId: "submission-2" }),
      /database unavailable/u,
    );
  });

  it("accepts input only in an active, non-paused session and resumes without reset data", () => {
    assert.equal(sessionAcceptsInput({ pausedAt: null, endedAt: null }), true);
    assert.equal(sessionAcceptsInput({ pausedAt: new Date(), endedAt: null }), false);
    assert.equal(sessionAcceptsInput({ pausedAt: null, endedAt: new Date() }), false);
    assert.deepEqual(resumePausedSessionData({ pausedAt: new Date() }), { pausedAt: null });
    assert.equal(resumePausedSessionData({ pausedAt: null }), undefined);
  });

  it("deduplicates concepts included in a unit reset", () => {
    assert.deepEqual(uniqueConceptIds([
      { conceptId: "nucleotide" },
      { conceptId: "phosphate" },
      { conceptId: "nucleotide" },
    ]), ["nucleotide", "phosphate"]);
  });

  it("keeps teacher scope separate from curriculum objective and approved knowledge", () => {
    const note = "Nie będzie punktu 4.3; szczególnie ważna jest replikacja.";
    const payload = tutorRequestInput(context(note));
    assert.equal(payload.teacherScopeNote, note);
    assert.deepEqual(payload.objective, {
      code: "mol_nucleotide_structure",
      description: "Uczeń wyjaśnia budowę nukleotydu.",
    });
    assert.equal(payload.approvedKnowledge[0]?.locator, "s. 12");
    assert.equal(payload.currentQuestion, "Czy to nić wiodąca czy opóźniona?");
    assert.equal(payload.questionRequiresExplanation, false);
    assert.equal(tutorRequestInput(context()).teacherScopeNote, null);
  });
});
