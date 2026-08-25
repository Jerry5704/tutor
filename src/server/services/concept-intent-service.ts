import { db } from "@/server/db/client";
import { visibleConceptsFor } from "@/server/services/concept-visibility";
import { conceptAliasAppearsInText } from "@/server/services/concept-alias-policy";

const EXPLANATION_INTENT = /(?:\?|\bco (?:to|znaczy|oznacza)\b|\bczym jest\b|\bnie rozumiem\b|\bwyjaśnij\b|\bwytłumacz\b|\bnaucz mnie\b|\bjak działa\b|\bjak dziala\b)/iu;

export class ConceptIntentService {
  async resolve(studentId: string, studySessionId: string, message: string) {
    if (!EXPLANATION_INTENT.test(message)) return undefined;
    const session = await db.studySession.findFirst({
      where: { id: studySessionId, studentId, endedAt: null, pausedAt: null },
      include: { unit: { include: { course: true } } },
    });
    if (!session) return undefined;
    const concepts = await db.concept.findMany({
      where: {
        active: true,
        curriculumVersionId: session.unit.course.curriculumVersionId,
        ...visibleConceptsFor(studentId),
        objectives: { some: { learningObjective: { topic: { unitId: session.unitId } } } },
      },
      include: { aliases: true },
    });
    return concepts
      .flatMap((concept) => [concept.name, ...concept.aliases.map((item) => item.alias)].map((alias) => ({ concept, alias })))
      .filter(({ alias }) => conceptAliasAppearsInText(message, alias))
      .sort((a, b) => b.alias.length - a.alias.length)[0]?.concept;
  }
}
