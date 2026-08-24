import { createHash } from "node:crypto";
import { db } from "@/server/db/client";

type MetadataValue = { value?: string };
type CommonsPage = {
  title?: string;
  imageinfo?: Array<{
    thumburl?: string;
    descriptionurl?: string;
    mime?: string;
    extmetadata?: Record<string, MetadataValue>;
  }>;
};

type CommonsResponse = { query?: { pages?: Record<string, CommonsPage> } };

const ALLOWED_LICENSE = /^(?:CC0|Public domain|CC BY(?:-SA)?(?: \d\.\d)?)$/iu;

function plainText(value?: string) {
  return (value ?? "")
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function trustedImageUrl(value?: string) {
  if (!value) return undefined;
  const url = new URL(value);
  return url.protocol === "https:" && url.hostname === "upload.wikimedia.org" ? url.toString() : undefined;
}

export class WikimediaVisualProvider {
  async findAndStore(learningObjectiveId: string, excludedIds: string[] = []) {
    if (process.env.INTERNET_VISUALS_ENABLED === "false") return undefined;
    const objective = await db.learningObjective.findUnique({
      where: { id: learningObjectiveId },
      select: { code: true, title: true, description: true },
    });
    if (!objective) return undefined;

    const query = `${objective.title} ${objective.description} biology diagram`;
    const params = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrnamespace: "6",
      gsrsearch: query,
      gsrlimit: "8",
      prop: "imageinfo",
      iiprop: "url|mime|extmetadata",
      iiurlwidth: "1400",
      format: "json",
      formatversion: "2",
      origin: "*",
    });
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { "User-Agent": "TutorBiologii/0.1 educational-visual-search" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return undefined;
    const payload = await response.json() as CommonsResponse;

    for (const page of Object.values(payload.query?.pages ?? {})) {
      const info = page.imageinfo?.[0];
      const metadata = info?.extmetadata ?? {};
      const imageUrl = trustedImageUrl(info?.thumburl);
      const license = plainText(metadata.LicenseShortName?.value);
      const sourceUrl = info?.descriptionurl;
      if (!imageUrl || !sourceUrl || !info?.mime?.startsWith("image/") || !ALLOWED_LICENSE.test(license)) continue;

      const author = plainText(metadata.Artist?.value) || "autor wskazany na Wikimedia Commons";
      const title = plainText(metadata.ObjectName?.value) || page.title?.replace(/^File:/u, "") || objective.title;
      const licenseUrl = metadata.LicenseUrl?.value;
      const digest = createHash("sha256").update(sourceUrl).digest("hex").slice(0, 16);
      const key = `commons-${digest}`;
      const existing = await db.knowledgeAsset.findUnique({ where: { key }, select: { id: true } });
      if (existing && excludedIds.includes(existing.id)) continue;
      return db.knowledgeAsset.upsert({
        where: { key },
        update: {},
        create: {
          key,
          learningObjectiveId,
          sourceType: "WIKIMEDIA_COMMONS",
          mediaType: info.mime,
          externalUrl: imageUrl,
          caption: title,
          altText: `Ilustracja do zagadnienia: ${objective.title}`,
          attribution: `${author}; ${license}; Wikimedia Commons`,
          rightsNote: `Źródło: ${sourceUrl}${licenseUrl ? `; licencja: ${licenseUrl}` : ""}`,
          priority: 200,
          status: "APPROVED",
          metadata: { sourceUrl, license, licenseUrl, author, searchQuery: query, automaticReview: "license_and_host" },
        },
        select: { id: true },
      });
    }
    return undefined;
  }
}
