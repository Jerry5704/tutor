import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { plainTutorText } from "@/server/services/plain-tutor-text";

describe("plain tutor text", () => {
  it("removes visible Markdown markers without removing their content", () => {
    assert.equal(
      plainTutorText("**Wiązanie wodorowe** łączy zasady.\n\n### Przykład\n`A–T`"),
      "Wiązanie wodorowe łączy zasady.\n\nPrzykład\nA–T",
    );
  });

  it("leaves ordinary biology text unchanged", () => {
    const text = "DNA ma dwie nici, a RNA zwykle jedną.";
    assert.equal(plainTutorText(text), text);
  });
});
