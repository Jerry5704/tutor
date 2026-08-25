import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { conceptAliasAppearsInText, normalizedConceptAlias } from "@/server/services/concept-alias-policy";
import { requestedConceptTerm } from "@/server/services/concept-term-policy";

describe("concept aliases for genotype symbols", () => {
  it("keeps AA, Aa and aa as distinct aliases", () => {
    assert.equal(normalizedConceptAlias("AA"), "genotype:AA");
    assert.equal(normalizedConceptAlias("Aa"), "genotype:Aa");
    assert.equal(normalizedConceptAlias("aa"), "genotype:aa");
  });

  it("matches genotype notation case-sensitively", () => {
    assert.equal(conceptAliasAppearsInText("Genotyp AA jest homozygotyczny.", "AA"), true);
    assert.equal(conceptAliasAppearsInText("Genotyp aa jest homozygotyczny.", "AA"), false);
  });

  it("allows a two-character genotype as an explanation request", () => {
    assert.equal(requestedConceptTerm("czym jest AA"), "AA");
    assert.equal(requestedConceptTerm("czym jest to"), undefined);
  });
});
