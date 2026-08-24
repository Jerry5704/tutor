import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TutorTurn } from "@/server/ai/contracts";
import {
  challengeFor,
  diagnosticMasteryDelta,
  explicitlyRequestsHelp,
  masteryDelta,
  nextScaffoldLevel,
  requestsBulkDiagnosticSkip,
  asksForClarification,
  confirmsUnderstanding,
} from "@/server/services/progress-policy";

const turn = (overrides: Partial<TutorTurn> = {}): TutorTurn => ({
  feedback: "Informacja zwrotna.",
  nextQuestion: "Dlaczego?",
  studentIntent: "ANSWER",
  assessment: "CORRECT",
  evidenceLevel: "MECHANISM",
  misconceptions: [],
  learningObjectives: ["natural_selection"],
  nextAction: "TRANSFER_QUESTION",
  rationale: "Uczeń wyjaśnił mechanizm.",
  sourceLocators: [],
  ...overrides,
});

describe("progress policy", () => {
  it("recognizes explicit permission to continue after an explanation", () => {
    assert.equal(confirmsUnderstanding("tak, już rozumiem"), true);
    assert.equal(confirmsUnderstanding("możemy iść dalej"), true);
    assert.equal(confirmsUnderstanding("chyba nie rozumiem"), false);
  });
  it("recognizes a question about terminology as clarification", () => {
    assert.equal(asksForClarification("ale jaka nić, jak ja mam to sobie wyobrazić"), true);
    assert.equal(asksForClarification("co to znaczy 5′→3′ i czym jest reszta fosforanowa?"), true);
    assert.equal(asksForClarification("nić jest zbudowana z nukleotydów"), false);
  });
  it("recognizes a request to skip the rest of diagnosis", () => {
    assert.equal(requestsBulkDiagnosticSkip("czy możemy wszędzie oznaczyć że nie wiem automatycznie?"), true);
    assert.equal(requestsBulkDiagnosticSkip("Nie znam jeszcze tego działu, pomiń resztę diagnostyki"), true);
    assert.equal(requestsBulkDiagnosticSkip("nie wiem"), false);
  });
  it("recognizes an explicit request for an explanation", () => {
    assert.equal(explicitlyRequestsHelp("no nie wiem xD ty mi napisz"), true);
    assert.equal(explicitlyRequestsHelp("wytłumacz mi to proszę"), true);
    assert.equal(explicitlyRequestsHelp("czy ty nie pytasz mnie o to samo?"), true);
    assert.equal(explicitlyRequestsHelp("nie rozumiem"), true);
    assert.equal(explicitlyRequestsHelp("nie wiem"), true);
    assert.equal(explicitlyRequestsHelp("Nie wiem dokładnie, ale skoro matryca biegnie 5′→3′, nowa nić powinna powstawać fragmentami jako opóźniona."), false);
    assert.equal(explicitlyRequestsHelp("jaka jest odpowiedź na pytanie, które przed chwilą zadałeś?"), true);
    assert.equal(explicitlyRequestsHelp("po prostu podaj mi poprawną odpowiedź"), true);
  });

  it("never grants mastery for uncertainty or a help request", () => {
    assert.equal(masteryDelta(turn({ studentIntent: "UNCERTAIN", evidenceLevel: "NONE" }), 0, false), 0);
    assert.equal(masteryDelta(turn(), 0, true), 0);
    assert.equal(diagnosticMasteryDelta(0.4, turn({ studentIntent: "REQUEST_HELP", evidenceLevel: "NONE" }), true), 0);
    assert.equal(nextScaffoldLevel(turn({ studentIntent: "REQUEST_HELP", evidenceLevel: "NONE" }), 2, true), 3);
  });

  it("calibrates diagnostic evidence instead of adding tiny learning increments", () => {
    assert.equal(diagnosticMasteryDelta(0, turn({ assessment: "PARTIALLY_CORRECT", evidenceLevel: "MECHANISM" }), false), 0.4);
    assert.equal(diagnosticMasteryDelta(0, turn({ assessment: "CORRECT", evidenceLevel: "MECHANISM" }), false), 0.68);
    assert.equal(diagnosticMasteryDelta(0.4, turn({ studentIntent: "UNCERTAIN", evidenceLevel: "NONE" }), false), 0);
  });

  it("rewards mechanism and transfer more than recall", () => {
    const recall = masteryDelta(turn({ evidenceLevel: "RECALL" }), 0, false);
    const mechanism = masteryDelta(turn({ evidenceLevel: "MECHANISM" }), 0, false);
    const transfer = masteryDelta(turn({ assessment: "TRANSFER_DEMONSTRATED", evidenceLevel: "TRANSFER" }), 0, false);
    assert.ok(recall < mechanism);
    assert.ok(mechanism < transfer);
  });

  it("reduces credit when the student needed more support", () => {
    assert.ok(masteryDelta(turn(), 0, false) > masteryDelta(turn(), 4, false));
  });

  it("increases scaffolding after uncertainty instead of resetting it", () => {
    assert.equal(nextScaffoldLevel(turn({ studentIntent: "UNCERTAIN" }), 1, false), 2);
    assert.equal(nextScaffoldLevel(turn({ assessment: "PARTIALLY_CORRECT" }), 2, false), 2);
  });

  it("raises question difficulty only with mastery", () => {
    assert.equal(challengeFor(0.1), "RECALL");
    assert.equal(challengeFor(0.5), "MECHANISM");
    assert.equal(challengeFor(0.8), "TRANSFER");
  });
});
