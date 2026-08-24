import type { KnowledgeExcerpt } from "@/server/ai/contracts";
import { db } from "@/server/db/client";

const stopWords = new Set([
  "oraz", "który", "która", "które", "jest", "jak", "się", "dla", "przez", "tego",
  "jego", "jej", "ich", "podaj", "wyjaśnij", "opisuje", "rozpoznaje", "analizuje",
]);

function terms(text: string) {
  return [...new Set(text.toLocaleLowerCase("pl-PL")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .match(/[a-z0-9′']{3,}/g) ?? [])]
    .filter((term) => !stopWords.has(term));
}

function metadata(chunk: { metadata: unknown }) {
  return (chunk.metadata ?? {}) as { bookPage?: number; topicOrder?: number | null; section?: string };
}

export class KnowledgeService {
  async retrieveForObjective(objectiveId: string, studentAnswer: string, limit = 4): Promise<KnowledgeExcerpt[]> {
    const objective = await db.learningObjective.findUniqueOrThrow({
      where: { id: objectiveId },
      include: { topic: true },
    });
    const links = await db.knowledgeSourceObjective.findMany({
      where: { learningObjectiveId: objectiveId, source: { status: "APPROVED" } },
      include: { source: { include: { chunks: true } } },
    });
    const queryTerms = terms([
      objective.title,
      objective.description,
      objective.diagnosticPrompt,
      objective.practicePrompt,
      objective.transferPrompt,
      studentAnswer,
    ].join(" "));

    return links.flatMap(({ source }) => source.chunks.map((chunk) => {
      const data = metadata(chunk);
      const normalized = chunk.content.toLocaleLowerCase("pl-PL").normalize("NFKD").replace(/\p{Diacritic}/gu, "");
      const termScore = queryTerms.reduce((score, term) => score + (normalized.includes(term) ? 1 : 0), 0);
      const topicScore = data.topicOrder === objective.topic.order ? 8 : 0;
      const taskScore = data.section === "review_tasks" || data.section === "worked_tasks" ? 2 : 0;
      return {
        score: topicScore + taskScore + termScore,
        excerpt: {
          chunkId: chunk.id,
          sourceId: source.id,
          sourceTitle: source.title,
          locator: chunk.locator ?? "brak lokalizatora",
          content: chunk.content.slice(0, 6000),
        },
      };
    }))
      .sort((a, b) => b.score - a.score || a.excerpt.locator.localeCompare(b.excerpt.locator))
      .slice(0, limit)
      .map(({ excerpt }) => excerpt);
  }
}
