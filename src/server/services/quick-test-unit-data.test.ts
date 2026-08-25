import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { quickTestUnit } from "@/server/curriculum/quick-test-unit-data";

describe("quick test unit curriculum", () => {
  it("is the second unit and contains exactly two learning objectives", () => {
    assert.equal(quickTestUnit.order, 2);
    assert.equal(quickTestUnit.objectives.length, 2);
  });

  it("gives every objective a complete learning loop", () => {
    for (const objective of quickTestUnit.objectives) {
      assert.ok(objective.diagnosticPrompt.length > 20);
      assert.ok(objective.microExplanation.length > 100);
      assert.ok(objective.practicePrompt.length > 20);
      assert.ok(objective.transferPrompt.length > 20);
      assert.equal(objective.maturaRelevant, true);
    }
  });

  it("uses controlled textbook-derived knowledge with page locators", () => {
    assert.ok(quickTestUnit.source.chunks.length >= 2);
    assert.ok(quickTestUnit.source.chunks.every((chunk) => chunk.locator.startsWith("book-page")));
  });
});
