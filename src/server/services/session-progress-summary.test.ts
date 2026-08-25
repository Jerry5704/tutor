import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sessionProgressSummary } from "@/server/services/session-progress-summary";

describe("session progress summary", () => {
  it("separates mastered, developing, and untouched objectives", () => {
    const summary = sessionProgressSummary([
      { id: "mastered", title: "Opanowane", status: "MASTERED", mastery: 0.82 },
      { id: "threshold", title: "Próg mastery", status: "LEARNING", mastery: 0.78 },
      { id: "diagnostic", title: "W diagnostyce", status: "DIAGNOSING", mastery: 0 },
      { id: "partial", title: "Częściowe", status: "NOT_STARTED", mastery: 0.35 },
      { id: "remaining", title: "Przed uczniem", status: "NOT_STARTED", mastery: 0 },
    ]);

    assert.deepEqual(summary.mastered.map((item) => item.id), ["mastered", "threshold"]);
    assert.deepEqual(summary.developing.map((item) => item.id), ["partial", "diagnostic"]);
    assert.deepEqual(summary.remaining.map((item) => item.id), ["remaining"]);
    assert.equal(summary.mastered[0]?.masteryPercent, 82);
    assert.equal(summary.developing[1]?.masteryPercent, 0);
  });

  it("bounds malformed mastery values before displaying percentages", () => {
    const summary = sessionProgressSummary([
      { id: "high", title: "Za wysokie", status: "MASTERED", mastery: 1.2 },
      { id: "low", title: "Za niskie", status: "LEARNING", mastery: -0.2 },
    ]);

    assert.equal(summary.mastered[0]?.masteryPercent, 100);
    assert.equal(summary.developing[0]?.masteryPercent, 0);
  });
});
