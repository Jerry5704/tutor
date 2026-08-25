import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { questionRequiresExplanation, visibleQuestionFromMessage } from "@/server/services/question-contract";

describe("visible question contract", () => {
  it("extracts the question block actually shown after tutor feedback", () => {
    assert.equal(
      visibleQuestionFromMessage("Dobrze — teraz nowa sytuacja.\n\nCzy nić będzie wiodąca czy opóźniona?"),
      "Czy nić będzie wiodąca czy opóźniona?",
    );
  });

  it("does not require a hidden justification for a classification question", () => {
    assert.equal(questionRequiresExplanation("Czy nić będzie wiodąca czy opóźniona?"), false);
  });

  it("requires reasoning only when the visible question asks for it", () => {
    assert.equal(questionRequiresExplanation("Która to nić? Odpowiedz i uzasadnij kierunkiem syntezy."), true);
    assert.equal(questionRequiresExplanation("Dlaczego powstają fragmenty Okazaki?"), true);
  });
});
