import type { ConceptAIProvider } from "@/server/ai/contracts";
import { db } from "@/server/db/client";
import { KnowledgeService } from "@/server/services/knowledge-service";
import { visibleConceptsFor } from "@/server/services/concept-visibility";
import { normalizedConceptAlias } from "@/server/services/concept-alias-policy";
import { requestedConceptTerm } from "@/server/services/concept-term-policy";
import { AIUsageService } from "@/server/services/ai-usage-service";
import { CONCEPT_GENERATION_PROMPT_VERSION } from "@/server/prompts/concept-generation";

function normalize(value: string) {
  return value.toLocaleLowerCase("pl-PL").normalize("NFKD").replace(/\p{Diacritic}/gu, "").replace(/\s+/gu, " ").trim();
}

function slugify(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 54) || "pojecie";
}

export class ConceptDiscoveryService {
  constructor(
    private readonly ai: ConceptAIProvider,
    private readonly knowledge = new KnowledgeService(),
    private readonly aiUsage = new AIUsageService(),
  ) {}

  private async addRequestedAlias(conceptId: string, alias: string) {
    const normalizedAlias = normalizedConceptAlias(alias);
    await db.conceptAlias.upsert({
      where: { conceptId_normalizedAlias: { conceptId, normalizedAlias } },
      update: { alias },
      create: { conceptId, alias, normalizedAlias },
    });
  }

  async discover(studentId: string, studySessionId: string, message: string, preferredObjectiveId?: string) {
    const term = requestedConceptTerm(message);
    if (!term) return undefined;
    const session = await db.studySession.findFirst({
      where: { id: studySessionId, studentId, endedAt: null, pausedAt: null },
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
            { aliases: { some: { normalizedAlias: normalizedConceptAlias(term) } } },
          ] },
        ],
      },
    });
    if (existing) {
      await this.addRequestedAlias(existing.id, term);
      return existing;
    }

    const objectiveId = preferredObjectiveId ?? session.currentObjectiveId;
    if (!objectiveId) return undefined;
    const objective = await db.learningObjective.findFirst({
      where: { id: objectiveId, topic: { unitId: session.unitId } },
    });
    if (!objective) return undefined;
    const sources = await this.knowledge.retrieveForObjective(objective.id, term, 3);
    if (!sources.length) return undefined;

    const result = await this.aiUsage.capture({
      studentId,
      studySessionId,
      feature: "CONCEPT_GENERATION",
      promptVersion: CONCEPT_GENERATION_PROMPT_VERSION,
    }, () => this.ai.generateConcept({
      requestedTerm: term,
      objectiveDescription: objective.description,
      sources: sources.map((source) => ({ locator: source.locator, content: source.content })),
    }));
    const generated = result.value;
    if (!generated.supportedBySources) return undefined;

    const canonicalName = (generated.canonicalName || term).trim();
    const canonicalMatch = await db.concept.findFirst({
      where: {
        active: true,
        curriculumVersionId: session.unit.course.curriculumVersionId,
        AND: [
          visibleConceptsFor(studentId),
          { OR: [
            { name: { equals: canonicalName, mode: "insensitive" } },
            { aliases: { some: { normalizedAlias: normalizedConceptAlias(canonicalName) } } },
          ] },
        ],
      },
    });
    if (canonicalMatch) {
      await this.addRequestedAlias(canonicalMatch.id, term);
      return canonicalMatch;
    }

    const baseSlug = slugify(canonicalName);
    const collision = await db.concept.findUnique({
      where: { curriculumVersionId_slug: { curriculumVersionId: session.unit.course.curriculumVersionId, slug: baseSlug } },
    });
    const slug = collision ? `${baseSlug}-${studentId.slice(-6)}` : baseSlug;
    const aliases = new Map<string, string>();
    for (const alias of [term, canonicalName, ...generated.aliases].filter(Boolean)) {
      const trimmed = alias.trim();
      if (trimmed.length >= 2 && trimmed.length <= 80) aliases.set(normalizedConceptAlias(trimmed), trimmed);
    }
    return db.concept.create({
      data: {
        curriculumVersionId: session.unit.course.curriculumVersionId,
        slug,
        name: canonicalName,
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
