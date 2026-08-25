export function visibleQuestionFromMessage(message: string) {
  return message.split(/\n\s*\n/gu).map((part) => part.trim()).filter(Boolean).at(-1) ?? message.trim();
}

export function questionRequiresExplanation(question: string) {
  return /\b(dlaczego|uzasadnij|wyjaśnij|wytłumacz|opisz mechanizm|wykaż zależność)\b/iu.test(question);
}
