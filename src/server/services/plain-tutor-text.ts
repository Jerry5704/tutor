export function plainTutorText(text: string) {
  return text
    .replace(/\*\*/gu, "")
    .replace(/^#{1,6}\s+/gmu, "")
    .replace(/`([^`\n]+)`/gu, "$1");
}
