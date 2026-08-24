import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fingerprintsOverlap,
  intentForNextAction,
  questionFingerprint,
  selectTransferQuestion,
} from "@/server/services/question-history";

describe("question history", () => {
  const objectiveId = "mol_dna_structure_complementarity";
  const practice = "Dwa fragmenty DNA mają taką samą długość, ale pierwszy zawiera więcej par G-C. Dlaczego do rozdzielenia jego nici potrzeba zwykle wyższej temperatury? Wyjaśnij cały mechanizm.";
  const repeatedTransfer = "W próbce A jest 30% par G-C, a w próbce B — 70%. Oba fragmenty mają taką samą długość i są w tych samych warunkach. Która próbka ma wyższą temperaturę rozdzielenia nici: A czy B? Porównaj je bezpośrednio i uzasadnij.";

  it("recognizes the saved G-C practice and transfer as the same tested mechanism", () => {
    assert.equal(
      fingerprintsOverlap(questionFingerprint(objectiveId, practice), questionFingerprint(objectiveId, repeatedTransfer)),
      true,
    );
  });

  it("replaces a repeated configured transfer with a genuinely different task form", () => {
    const selected = selectTransferQuestion({
      learningObjectiveId: objectiveId,
      objectiveTitle: "Podwójna helisa i komplementarność DNA",
      configuredQuestion: repeatedTransfer,
      previousFingerprints: [questionFingerprint(objectiveId, practice)],
    });
    assert.equal(selected.replacedRepeatedQuestion, true);
    assert.notEqual(selected.question, repeatedTransfer);
    assert.match(selected.question, /własny, nowy przykład/u);
  });

  it("keeps a distinct transfer question and never merges different objectives", () => {
    const distinct = "W próbce nieznanego DNA wykryto adeninę na 22% pozycji. Oblicz udział pozostałych zasad i uzasadnij wynik komplementarnością.";
    const selected = selectTransferQuestion({
      learningObjectiveId: objectiveId,
      objectiveTitle: "Podwójna helisa i komplementarność DNA",
      configuredQuestion: distinct,
      previousFingerprints: [questionFingerprint(objectiveId, practice)],
    });
    assert.equal(selected.replacedRepeatedQuestion, false);
    assert.equal(selected.question, distinct);
    assert.equal(
      fingerprintsOverlap(questionFingerprint("another_objective", practice), questionFingerprint(objectiveId, practice)),
      false,
    );
  });

  it("assigns an intent to every question-producing AI action", () => {
    assert.equal(intentForNextAction("PROBE"), "DIAGNOSTIC");
    assert.equal(intentForNextAction("GUIDED_QUESTION"), "CORRECTION");
    assert.equal(intentForNextAction("TRANSFER_QUESTION"), "TRANSFER");
    assert.equal(intentForNextAction("NEXT_OBJECTIVE"), "PRACTICE");
  });
});
