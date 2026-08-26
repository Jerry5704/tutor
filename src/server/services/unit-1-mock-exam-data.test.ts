import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unit1MockExamQuestions } from "../../../prisma/unit-1-mock-exam-seed";

const objectiveCodes = [
  "mol_nucleotide_structure", "mol_dna_structure_complementarity", "mol_dna_rna_comparison",
  "mol_replication_mechanism", "mol_replication_enzymes", "mol_leading_lagging_strands",
  "mol_gene_structure", "mol_genome_organization", "mol_genetic_code", "mol_transcription",
  "mol_rna_processing", "mol_translation", "mol_prokaryotic_regulation", "mol_eukaryotic_regulation",
  "mol_cell_differentiation",
];

describe("unit 1 mock exam bank", () => {
  it("contains exactly two unique approved-ready questions for every objective", () => {
    assert.equal(unit1MockExamQuestions.length, objectiveCodes.length * 2);
    assert.equal(new Set(unit1MockExamQuestions.map((question) => question.key)).size, unit1MockExamQuestions.length);
    for (const code of objectiveCodes) {
      assert.equal(unit1MockExamQuestions.filter((question) => question.objectiveCode === code).length, 2, code);
    }
  });

  it("uses textbook page locators and explicit point criteria", () => {
    for (const question of unit1MockExamQuestions) {
      assert.match(question.sourceLocator, /^book-page(s)?:/);
      assert.ok(question.prompt.length >= 80, question.key);
      assert.ok(question.criteria.length >= 2, question.key);
      assert.ok(question.criteria.every((criterion) => criterion.points > 0 && criterion.description.length >= 15), question.key);
      assert.ok(question.expectedMinutes >= 3);
    }
  });

  it("covers varied task formats instead of only plain chat questions", () => {
    const formats = new Set(unit1MockExamQuestions.map((question) => question.format));
    assert.ok(formats.has("OPEN_RESPONSE"));
    assert.ok(formats.has("SHORT_ANSWER"));
    assert.ok(formats.has("DIAGRAM"));
    assert.ok(formats.has("TABLE_OR_GRAPH"));
  });
});
