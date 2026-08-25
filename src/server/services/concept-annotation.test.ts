import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { annotateConceptText, type AnnotatableConcept } from "@/server/services/concept-annotation";

const genotypeNotation: AnnotatableConcept = {
  id: "genotype-notation",
  slug: "zapis-genotypu",
  name: "zapis genotypu AA, Aa i aa",
  aliases: [{ alias: "AA" }],
  studentStates: [],
};

describe("concept annotation", () => {
  it("does not apply the AA alias to lowercase aa", () => {
    const segments = annotateConceptText("AA jest inne niż aa.", [genotypeNotation]);
    assert.equal(segments.filter((segment) => segment.concept).length, 1);
    assert.equal(segments.find((segment) => segment.concept)?.text, "AA");
  });
});
