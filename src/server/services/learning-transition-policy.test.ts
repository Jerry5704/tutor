import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { finishesDiagnosticProbe, learningTransition } from "@/server/services/learning-transition-policy";

describe("learning transition policy", () => {
  it("moves a demonstrated practice answer to transfer", () => {
    assert.equal(learningTransition({
      understood: true,
      learningStep: "PRACTICE",
      mastery: 0.6,
      consecutiveStruggles: 0,
      workedExamplesShown: 0,
    }), "ASK_TRANSFER");
  });

  it("masters only after sufficient transfer evidence", () => {
    assert.equal(learningTransition({
      understood: true,
      learningStep: "TRANSFER",
      mastery: 0.77,
      consecutiveStruggles: 0,
      workedExamplesShown: 0,
    }), "CONTINUE");
    assert.equal(learningTransition({
      understood: true,
      learningStep: "TRANSFER",
      mastery: 0.78,
      consecutiveStruggles: 0,
      workedExamplesShown: 0,
    }), "MASTER");
  });

  it("shows one worked example before rotating to another objective", () => {
    assert.equal(learningTransition({
      understood: false,
      learningStep: "PRACTICE",
      mastery: 0.2,
      consecutiveStruggles: 2,
      workedExamplesShown: 0,
    }), "SHOW_WORKED_EXAMPLE");
    assert.equal(learningTransition({
      understood: false,
      learningStep: "PRACTICE",
      mastery: 0.2,
      consecutiveStruggles: 2,
      workedExamplesShown: 1,
    }), "ROTATE_OBJECTIVE");
  });

  it("does not rotate or lecture after a single struggle", () => {
    assert.equal(learningTransition({
      understood: false,
      learningStep: "PRACTICE",
      mastery: 0.2,
      consecutiveStruggles: 1,
      workedExamplesShown: 0,
    }), "CONTINUE");
  });

  it("ends a diagnostic probe after evidence, uncertainty, help, or the second attempt", () => {
    assert.equal(finishesDiagnosticProbe({ understood: true, forceExplanation: false, studentIntent: "ANSWER", diagnosticAttempts: 1 }), true);
    assert.equal(finishesDiagnosticProbe({ understood: false, forceExplanation: false, studentIntent: "UNCERTAIN", diagnosticAttempts: 1 }), true);
    assert.equal(finishesDiagnosticProbe({ understood: false, forceExplanation: true, studentIntent: "REQUEST_HELP", diagnosticAttempts: 1 }), true);
    assert.equal(finishesDiagnosticProbe({ understood: false, forceExplanation: false, studentIntent: "ANSWER", diagnosticAttempts: 2 }), true);
    assert.equal(finishesDiagnosticProbe({ understood: false, forceExplanation: false, studentIntent: "ANSWER", diagnosticAttempts: 1 }), false);
  });
});
