import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const projectDir = path.resolve(import.meta.dirname, "..");
const derivedDir = path.join(projectDir, "materials/derived/biologia-na-czasie-4/unit-1");
const pagesDir = path.join(derivedDir, "pages");

type Manifest = {
  source: string;
  unit: string;
  pdfPageRange: { from: number; to: number };
  bookPageRange: { from: number; to: number };
  language: string;
  ocr: string;
  renderDpi: number;
  sourceSha256: string;
};

function cleanOcr(text: string) {
  return text
    .replace(/([\p{L}])[-–]\n(?=[\p{Ll}])/gu, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function topicOrderForPage(bookPage: number) {
  if (bookPage <= 15) return 1;
  if (bookPage <= 26) return 2;
  if (bookPage <= 34) return 3;
  if (bookPage <= 48) return 4;
  if (bookPage <= 58) return 5;
  return null;
}

async function main() {
  const manifest = JSON.parse(await readFile(path.join(derivedDir, "manifest.json"), "utf8")) as Manifest;
  const unit = await db.unit.findFirst({
    where: { slug: "genetyka-molekularna" },
    include: {
      course: true,
      topics: { orderBy: { order: "asc" }, include: { objectives: true } },
    },
  });
  if (!unit) throw new Error("Unit 1 curriculum is missing. Run npm run db:seed:unit-1 first.");

  const pageFiles = (await readdir(pagesDir)).filter((file) => /^page-\d{3}\.txt$/.test(file)).sort();
  const expectedPages = manifest.bookPageRange.to - manifest.bookPageRange.from + 1;
  if (pageFiles.length !== expectedPages) {
    throw new Error(`Expected ${expectedPages} OCR pages, found ${pageFiles.length}.`);
  }

  const chunks = await Promise.all(pageFiles.map(async (file) => {
    const bookPage = Number(file.match(/\d{3}/)?.[0]);
    const pdfPage = bookPage + 2;
    const content = cleanOcr(await readFile(path.join(pagesDir, file), "utf8"));
    if (content.length < 250) throw new Error(`OCR page ${bookPage} is unexpectedly short.`);
    return {
      locator: `book-page:${bookPage}`,
      content,
      metadata: {
        bookPage,
        pdfPage,
        topicOrder: topicOrderForPage(bookPage),
        section: bookPage <= 58 ? "lesson" : bookPage <= 60 ? "summary" : bookPage <= 62 ? "worked_tasks" : "review_tasks",
        extraction: manifest.ocr,
        sourceSha256: manifest.sourceSha256,
        quality: "ocr_sample_reviewed",
      },
    };
  }));

  await db.$transaction(async (tx) => {
    const provenance = `User-provided scan; ${manifest.source}; sha256:${manifest.sourceSha256}`;
    const existing = await tx.knowledgeSource.findFirst({ where: { provenance } });
    const source = existing
      ? await tx.knowledgeSource.update({
          where: { id: existing.id },
          data: {
            title: "Biologia na czasie 4 — dział 1. Genetyka molekularna",
            sourceType: "USER_PROVIDED_TEXTBOOK_OCR",
            rightsNote: "Prywatne użycie legalnie posiadanego egzemplarza; bez publicznego udostępniania treści.",
            version: "wydanie 2022; OCR tesseract-5.3.4",
            status: "APPROVED",
          },
        })
      : await tx.knowledgeSource.create({
          data: {
            title: "Biologia na czasie 4 — dział 1. Genetyka molekularna",
            sourceType: "USER_PROVIDED_TEXTBOOK_OCR",
            provenance,
            rightsNote: "Prywatne użycie legalnie posiadanego egzemplarza; bez publicznego udostępniania treści.",
            version: "wydanie 2022; OCR tesseract-5.3.4",
            status: "APPROVED",
          },
        });

    await tx.knowledgeChunk.deleteMany({ where: { sourceId: source.id } });
    await tx.knowledgeSourceCurriculum.deleteMany({ where: { sourceId: source.id } });
    await tx.knowledgeSourceUnit.deleteMany({ where: { sourceId: source.id } });
    await tx.knowledgeSourceTopic.deleteMany({ where: { sourceId: source.id } });
    await tx.knowledgeSourceObjective.deleteMany({ where: { sourceId: source.id } });

    await tx.knowledgeChunk.createMany({ data: chunks.map((chunk) => ({ ...chunk, sourceId: source.id })) });
    await tx.knowledgeSourceCurriculum.create({ data: { sourceId: source.id, curriculumVersionId: unit.course.curriculumVersionId } });
    await tx.knowledgeSourceUnit.create({ data: { sourceId: source.id, unitId: unit.id } });
    await tx.knowledgeSourceTopic.createMany({ data: unit.topics.map((topic) => ({ sourceId: source.id, topicId: topic.id })) });
    await tx.knowledgeSourceObjective.createMany({
      data: unit.topics.flatMap((topic) => topic.objectives.map((objective) => ({ sourceId: source.id, learningObjectiveId: objective.id }))),
    });
  });

  console.log(`Imported ${chunks.length} textbook pages for ${unit.title}.`);
}

main().finally(() => db.$disconnect());
