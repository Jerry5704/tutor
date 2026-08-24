export function sessionAcceptsInput(session: { pausedAt: Date | null; endedAt: Date | null }) {
  return session.pausedAt === null && session.endedAt === null;
}

export function resumePausedSessionData(session: { pausedAt: Date | null }) {
  return session.pausedAt ? { pausedAt: null } : undefined;
}

export function uniqueConceptIds(links: Array<{ conceptId: string }>) {
  return [...new Set(links.map((link) => link.conceptId))];
}
