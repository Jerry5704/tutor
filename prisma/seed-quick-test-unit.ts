import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { quickTestUnit } from "../src/server/curriculum/quick-test-unit-data";
import { normalizedConceptAlias } from "../src/server/services/concept-alias-policy";
import { syncBaselineQuestionBank } from "./question-bank-seed";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const course = await db.course.findFirst({
    where: { subject: { code: "BIO" }, grade: 4, level: "ADVANCED" },
  });
  if (!course) throw new Error("Biology grade 4 advanced course is missing. Run npm run db:seed first.");

  const orderConflict = await db.unit.findFirst({
    where: { courseId: course.id, order: quickTestUnit.order, slug: { not: quickTestUnit.slug } },
  });
  if (orderConflict) throw new Error(`Unit order 2 is already occupied by: ${orderConflict.title}`);

  const unit = await db.unit.upsert({
    where: { courseId_slug: { courseId: course.id, slug: quickTestUnit.slug } },
    update: { title: quickTestUnit.title, order: quickTestUnit.order, description: quickTestUnit.description },
    create: {
      courseId: course.id,
      slug: quickTestUnit.slug,
      title: quickTestUnit.title,
      order: quickTestUnit.order,
      description: quickTestUnit.description,
    },
  });
  const topic = await db.topic.upsert({
    where: { unitId_order: { unitId: unit.id, order: quickTestUnit.topic.order } },
    update: { title: quickTestUnit.topic.title },
    create: { unitId: unit.id, order: quickTestUnit.topic.order, title: quickTestUnit.topic.title },
  });

  const objectives: Array<{ id: string; code: string }> = [];
  for (const objective of quickTestUnit.objectives) {
    const seededObjective = await db.learningObjective.upsert({
      where: { code: objective.code },
      update: {
        topicId: topic.id,
        order: objective.order,
        title: objective.title,
        description: objective.description,
        diagnosticPrompt: objective.diagnosticPrompt,
        hook: objective.hook,
        microExplanation: objective.microExplanation,
        workedExample: objective.workedExample,
        practicePrompt: objective.practicePrompt,
        transferPrompt: objective.transferPrompt,
        visualData: objective.visualData,
        importance: objective.importance,
        maturaRelevant: objective.maturaRelevant,
        active: true,
      },
      create: {
        topicId: topic.id,
        code: objective.code,
        order: objective.order,
        title: objective.title,
        description: objective.description,
        diagnosticPrompt: objective.diagnosticPrompt,
        hook: objective.hook,
        microExplanation: objective.microExplanation,
        workedExample: objective.workedExample,
        practicePrompt: objective.practicePrompt,
        transferPrompt: objective.transferPrompt,
        visualData: objective.visualData,
        importance: objective.importance,
        maturaRelevant: objective.maturaRelevant,
        maturaRequirementId: null,
        active: true,
      },
    });
    objectives.push(seededObjective);
    await syncBaselineQuestionBank(db, seededObjective);
  }

  await db.$transaction(async (tx) => {
    const existing = await tx.knowledgeSource.findFirst({ where: { provenance: quickTestUnit.source.provenance } });
    const source = existing
      ? await tx.knowledgeSource.update({
          where: { id: existing.id },
          data: {
            title: quickTestUnit.source.title,
            rightsNote: quickTestUnit.source.rightsNote,
            version: quickTestUnit.source.version,
            status: "APPROVED",
          },
        })
      : await tx.knowledgeSource.create({
          data: {
            title: quickTestUnit.source.title,
            sourceType: "USER_PROVIDED_TEXTBOOK_OCR",
            provenance: quickTestUnit.source.provenance,
            rightsNote: quickTestUnit.source.rightsNote,
            version: quickTestUnit.source.version,
            status: "APPROVED",
          },
        });
    await tx.knowledgeChunk.deleteMany({ where: { sourceId: source.id } });
    await tx.knowledgeChunk.createMany({
      data: quickTestUnit.source.chunks.map((chunk) => ({ sourceId: source.id, ...chunk })),
    });
    const chunks = await tx.knowledgeChunk.findMany({ where: { sourceId: source.id } });
    await tx.knowledgeSourceCurriculum.upsert({
      where: { sourceId_curriculumVersionId: { sourceId: source.id, curriculumVersionId: course.curriculumVersionId } },
      update: {},
      create: { sourceId: source.id, curriculumVersionId: course.curriculumVersionId },
    });
    await tx.knowledgeSourceUnit.upsert({
      where: { sourceId_unitId: { sourceId: source.id, unitId: unit.id } },
      update: {},
      create: { sourceId: source.id, unitId: unit.id },
    });
    await tx.knowledgeSourceTopic.upsert({
      where: { sourceId_topicId: { sourceId: source.id, topicId: topic.id } },
      update: {},
      create: { sourceId: source.id, topicId: topic.id },
    });
    for (const objective of objectives) {
      await tx.knowledgeSourceObjective.upsert({
        where: { sourceId_learningObjectiveId: { sourceId: source.id, learningObjectiveId: objective.id } },
        update: {},
        create: { sourceId: source.id, learningObjectiveId: objective.id },
      });
    }
    for (const conceptData of quickTestUnit.concepts) {
      const objective = objectives.find((item) => item.code === conceptData.objectiveCode);
      if (!objective) throw new Error(`Missing objective for concept: ${conceptData.slug}`);
      const concept = await tx.concept.upsert({
        where: {
          curriculumVersionId_slug: {
            curriculumVersionId: course.curriculumVersionId,
            slug: conceptData.slug,
          },
        },
        update: {
          name: conceptData.name,
          shortDefinition: conceptData.shortDefinition,
          simpleExplanation: conceptData.simpleExplanation,
          whyItMatters: conceptData.whyItMatters,
          commonMisconception: conceptData.commonMisconception,
          concreteExample: conceptData.concreteExample,
          checkQuestion: conceptData.checkQuestion,
          transferQuestion: conceptData.transferQuestion,
          active: true,
          origin: "CURATED",
          reviewStatus: "APPROVED",
        },
        create: {
          curriculumVersionId: course.curriculumVersionId,
          slug: conceptData.slug,
          name: conceptData.name,
          shortDefinition: conceptData.shortDefinition,
          simpleExplanation: conceptData.simpleExplanation,
          whyItMatters: conceptData.whyItMatters,
          commonMisconception: conceptData.commonMisconception,
          concreteExample: conceptData.concreteExample,
          checkQuestion: conceptData.checkQuestion,
          transferQuestion: conceptData.transferQuestion,
          active: true,
          origin: "CURATED",
          reviewStatus: "APPROVED",
        },
      });
      for (const alias of conceptData.aliases) {
        const normalizedAlias = normalizedConceptAlias(alias);
        await tx.conceptAlias.upsert({
          where: { conceptId_normalizedAlias: { conceptId: concept.id, normalizedAlias } },
          update: { alias },
          create: { conceptId: concept.id, alias, normalizedAlias },
        });
      }
      await tx.conceptObjective.upsert({
        where: { conceptId_learningObjectiveId: { conceptId: concept.id, learningObjectiveId: objective.id } },
        update: { importance: 1 },
        create: { conceptId: concept.id, learningObjectiveId: objective.id, importance: 1 },
      });
      for (const locator of conceptData.sourceLocators) {
        const chunk = chunks.find((item) => item.locator === locator);
        if (!chunk) throw new Error(`Missing knowledge chunk ${locator} for concept ${conceptData.slug}`);
        await tx.conceptSource.upsert({
          where: { conceptId_knowledgeChunkId: { conceptId: concept.id, knowledgeChunkId: chunk.id } },
          update: {},
          create: { conceptId: concept.id, knowledgeChunkId: chunk.id },
        });
      }
    }
  });

  console.log(`Seeded ${unit.title}: ${objectives.length} learning objectives.`);
}

main().finally(() => db.$disconnect());
