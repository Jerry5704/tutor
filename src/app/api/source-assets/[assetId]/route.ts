import { requireStudent } from "@/server/auth/session";
import { SourceAssetStorage } from "@/server/storage/source-asset-storage";
import { logError } from "@/server/observability/logger";

export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  await requireStudent();
  const { assetId } = await params;
  const { db } = await import("@/server/db/client");
  const asset = await db.knowledgeAsset.findFirst({ where: { key: assetId, status: "APPROVED" } });
  if (asset?.sourceType === "WIKIMEDIA_COMMONS" && asset.externalUrl) {
    const externalUrl = new URL(asset.externalUrl);
    if (externalUrl.protocol !== "https:" || externalUrl.hostname !== "upload.wikimedia.org") {
      return new Response("Not found", { status: 404 });
    }
    const image = await fetch(externalUrl, { signal: AbortSignal.timeout(8_000) });
    if (!image.ok || !image.body) return new Response("Image unavailable", { status: 502 });
    return new Response(image.body, {
      headers: {
        "Content-Type": asset.mediaType,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  if (asset?.sourceType !== "TEXTBOOK") return new Response("Not found", { status: 404 });
  const fileName = asset?.localFileName;
  if (!fileName) return new Response("Not found", { status: 404 });
  const content = await new SourceAssetStorage().read(fileName).catch((error: unknown) => {
    logError("source_asset_read_failed", error, { assetId: asset.id });
    return undefined;
  });
  if (!content) return new Response("Image unavailable", { status: 503 });
  return new Response(content, {
    headers: {
      "Content-Type": asset.mediaType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
