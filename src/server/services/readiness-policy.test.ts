import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OBJECTIVE_MASTERY_THRESHOLD, readinessValue, weightedReadiness } from "@/server/services/readiness-policy";

describe("readiness policy", () => {
  it("treats a transfer-mastered objective as fully ready", () => {
    assert.equal(readinessValue(0.82), 1);
    assert.equal(readinessValue(OBJECTIVE_MASTERY_THRESHOLD), 1);
  });

  it("does not inflate an objective below the mastery threshold", () => {
    assert.equal(readinessValue(0.6), 0.6);
    assert.equal(readinessValue(0), 0);
  });

  it("shows 100 percent when every weighted objective is mastered", () => {
    assert.equal(weightedReadiness([
      { importance: 1, mastery: 0.82 },
      { importance: 1, mastery: 0.82 },
    ]), 100);
  });
});
