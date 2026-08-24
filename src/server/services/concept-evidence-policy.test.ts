import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateConceptMastery,
  conceptMasteryTarget,
  explicitlySupportedConceptIds,
} from "@/server/services/concept-evidence-policy";

const concepts = [
  { id: "nucleotide", name: "nukleotyd", aliases: ["nukleotyd DNA"] },
  { id: "sugar", name: "cukier pięciowęglowy", aliases: ["pentoza"] },
  { id: "phosphate", name: "reszta fosforanowa(V)", aliases: ["fosforan"] },
  { id: "five-prime", name: "koniec 5′", aliases: ["koniec 5'"] },
];

describe("concept evidence policy", () => {
  it("credits only concepts explicitly present in the question or answer", () => {
    assert.deepEqual(
      explicitlySupportedConceptIds("Nukleotyd ma cukier pięciowęglowy i zasadę.", concepts),
      ["nucleotide", "sugar"],
    );
  });

  it("does not infer evidence for every concept linked to an objective", () => {
    assert.deepEqual(
      explicitlySupportedConceptIds("Wyjaśnij, dlaczego nić DNA ma określony kierunek.", concepts),
      [],
    );
  });

  it("keeps indirect main-thread evidence below dedicated concept mastery", () => {
    assert.equal(conceptMasteryTarget("RECALL"), 0.35);
    assert.equal(conceptMasteryTarget("MECHANISM"), 0.6);
    assert.equal(conceptMasteryTarget("TRANSFER"), 0.72);
    assert.ok(conceptMasteryTarget("TRANSFER") < 0.75);
  });

  it("aggregates completed concepts proportionally and treats missing concepts as zero", () => {
    const result = aggregateConceptMastery({
      links: [
        { conceptId: "nucleotide", importance: 1 },
        { conceptId: "sugar", importance: 1 },
        { conceptId: "phosphate", importance: 1 },
        { conceptId: "five-prime", importance: 1 },
      ],
      masteryByConcept: new Map([["nucleotide", 0.8]]),
      currentObjectiveMastery: 0,
    });
    assert.equal(result, 0.2);
  });

  it("never lowers objective mastery when concept evidence is weaker", () => {
    const result = aggregateConceptMastery({
      links: [{ conceptId: "nucleotide", importance: 1 }, { conceptId: "sugar", importance: 1 }],
      masteryByConcept: new Map([["nucleotide", 0.8]]),
      currentObjectiveMastery: 0.65,
    });
    assert.equal(result, 0.65);
  });
});
