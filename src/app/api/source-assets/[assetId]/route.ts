import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireStudent } from "@/server/auth/session";

const assetRoot = path.join(process.cwd(), "materials", "derived", "biologia-na-czasie-4", "unit-1", "assets");

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
  if (!fileName || fileName !== path.basename(fileName)) return new Response("Not found", { status: 404 });
  const content = await readFile(path.join(assetRoot, fileName));
  return new Response(new Uint8Array(content), {
    headers: {
      "Content-Type": asset.mediaType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
