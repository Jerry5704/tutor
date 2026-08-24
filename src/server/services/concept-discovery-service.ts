import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { db } from "@/server/db/client";
import { KnowledgeService } from "@/server/services/knowledge-service";
import { visibleConceptsFor } from "@/server/services/concept-visibility";

const generatedConceptSchema = z.object({
  supportedBySources: z.boolean(),
  canonicalName: z.string(),
  shortDefinition: z.string(),
  simpleExplanation: z.string(),
  whyItMatters: z.string(),
  commonMisconception: z.string(),
  concreteExample: z.string(),
  checkQuestion: z.string(),
  transferQuestion: z.string(),
  aliases: z.array(z.string()),
});

const TERM_PATTERNS = [
  /\bco to jest\s+[„"']?(.+?)[”"']?[?.!]*$/iu,
  /\bco (?:to )?(?:znaczy|oznacza)\s+[„"']?(.+?)[”"']?[?.!]*$/iu,
  /\bczym jest\s+[„"']?(.+?)[”"']?[?.!]*$/iu,
  /\b(?:wyjaśnij|wytłumacz)(?: mi)?\s+[„"']?(.+?)[”"']?[?.!]*$/iu,
];

function normalize(value: string) {
  return value.toLocaleLowerCase("pl-PL").normalize("NFKD").replace(/\p{Diacritic}/gu, "").replace(/\s+/gu, " ").trim();
}

function normalizeAlias(value: string) {
  return value.toLocaleLowerCase("pl-PL").normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function requestedTerm(message: string) {
  for (const pattern of TERM_PATTERNS) {
    const term = pattern.exec(message)?.[1]?.trim();
    if (term && term.length >= 3 && term.length <= 80) return term.replace(/[?.!]+$/gu, "").trim();
  }
}

function slugify(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 54) || "pojecie";
}

export class ConceptDiscoveryService {
  private readonly client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  private readonly model = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";
  private readonly knowledge = new KnowledgeService();

  async discover(studentId: string, studySessionId: string, message: string, preferredObjectiveId?: string) {
    const term = requestedTerm(message);
    if (!term) return undefined;
    const session = await db.studySession.findFirst({
      where: { id: studySessionId, studentId, endedAt: null },
      include: { unit: { include: { course: true } } },
    });
    if (!session) return undefined;

    const existing = await db.concept.findFirst({
      where: {
        active: true,
        curriculumVersionId: session.unit.course.curriculumVersionId,
        AND: [
          visibleConceptsFor(studentId),
          { OR: [
            { name: { equals: term, mode: "insensitive" } },
            { aliases: { some: { normalizedAlias: normalizeAlias(term) } } },
          ] },
        ],
      },
    });
    if (existing) return existing;

    const objectiveId = preferredObjectiveId ?? session.currentObjectiveId;
    if (!objectiveId) return undefined;
    const objective = await db.learningObjective.findFirst({
      where: { id: objectiveId, topic: { unitId: session.unitId } },
    });
    if (!objective) return undefined;
    const sources = await this.knowledge.retrieveForObjective(objective.id, term, 3);
    if (!sources.length) return undefined;

    const sourceText = sources.map((source) => `[${source.locator}]\n${source.content.slice(0, 3000)}`).join("\n\n");
    const response = await this.client.responses.parse({
      model: this.model,
      instructions: `Tworzysz kontrolowaną kartę jednego pojęcia biologicznego dla ucznia IV klasy liceum, poziom rozszerzony.
Użyj wyłącznie dostarczonych fragmentów zatwierdzonego źródła. Jeśli nie wystarczają do rzeczowego wyjaśnienia terminu, ustaw supportedBySources=false i pozostaw pozostałe pola krótkie.
Wyjaśnienie ma budować rozumienie: definicja, mechanizm lub relacja, konkretny przykład, typowy błąd, pytanie bez podpowiedzi oraz pytanie transferowe.
Nie nazywaj analogii faktem biologicznym. Nie dodawaj informacji, których nie ma w źródłach. Odpowiadaj po polsku.`,
      input: JSON.stringify({ requestedTerm: term, learningObjective: objective.description, sources: sourceText }),
      text: { format: zodTextFormat(generatedConceptSchema, "generated_concept") },
    });
    const generated = response.output_parsed;
    if (!generated?.supportedBySources) return undefined;

    const baseSlug = slugify(generated.canonicalName || term);
    const collision = await db.concept.findUnique({
      where: { curriculumVersionId_slug: { curriculumVersionId: session.unit.course.curriculumVersionId, slug: baseSlug } },
    });
    const slug = collision ? `${baseSlug}-${studentId.slice(-6)}` : baseSlug;
    const aliases = new Map<string, string>();
    for (const alias of [term, generated.canonicalName, ...generated.aliases].filter(Boolean)) {
      aliases.set(normalizeAlias(alias), alias);
    }
    return db.concept.create({
      data: {
        curriculumVersionId: session.unit.course.curriculumVersionId,
        slug,
        name: generated.canonicalName || term,
        shortDefinition: generated.shortDefinition,
        simpleExplanation: generated.simpleExplanation,
        whyItMatters: generated.whyItMatters,
        commonMisconception: generated.commonMisconception,
        concreteExample: generated.concreteExample,
        checkQuestion: generated.checkQuestion,
        transferQuestion: generated.transferQuestion,
        origin: "AI_GENERATED",
        reviewStatus: "PENDING_REVIEW",
        createdForStudentId: studentId,
        sourceQuestion: message,
        aliases: {
          create: [...aliases].map(([normalizedAlias, alias]) => ({ alias, normalizedAlias })),
        },
        objectives: { create: { learningObjectiveId: objective.id } },
        sources: { create: sources.map((source) => ({ knowledgeChunkId: source.chunkId })) },
      },
    });
  }
}
