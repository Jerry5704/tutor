import assert from "node:assert/strict";
import test from "node:test";
import { applyScopeRecommendations, objectivesInTestScope } from "@/server/services/test-plan-policy";

const objectives = [
  { id: "a", code: "BIO.A", importance: 1 },
  { id: "b", code: "BIO.B", importance: 2 },
  { id: "c", code: "BIO.C", importance: 1 },
];

test("unknown AI objective codes cannot modify curriculum scope", () => {
  const result = applyScopeRecommendations(objectives, [
    { objectiveCode: "INVENTED", scope: "EXCLUDED", reason: "unsupported" },
  ]);
  assert.deepEqual(result.map((item) => item.scope), ["INCLUDED", "INCLUDED", "INCLUDED"]);
});

test("confirmed exclusions are removed and priorities are ordered first and weighted", () => {
  const result = objectivesInTestScope(objectives, [
    { learningObjectiveId: "a", confirmedScope: "INCLUDED" },
    { learningObjectiveId: "b", confirmedScope: "EXCLUDED" },
    { learningObjectiveId: "c", confirmedScope: "PRIORITY" },
  ]);
  assert.deepEqual(result.map((item) => item.id), ["c", "a"]);
  assert.equal(result[0]?.importance, 1.5);
});
