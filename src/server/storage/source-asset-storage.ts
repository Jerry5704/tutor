import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { sourceAssetStorageConfig } from "@/server/config/env";

const localAssetRoot = path.join(
  process.cwd(),
  "materials",
  "derived",
  "biologia-na-czasie-4",
  "unit-1",
  "assets",
);
let sharedS3Client: S3Client | undefined;
let sharedS3Region: string | undefined;

function s3Client(region: string) {
  if (!sharedS3Client || sharedS3Region !== region) {
    sharedS3Client = new S3Client({ region });
    sharedS3Region = region;
  }
  return sharedS3Client;
}

function safeFileName(fileName: string) {
  if (!fileName || fileName !== path.basename(fileName)) throw new Error("Invalid source asset name");
  return fileName;
}

function arrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export class SourceAssetStorage {
  async read(fileName: string) {
    const safeName = safeFileName(fileName);
    const config = sourceAssetStorageConfig();
    if (config.mode === "local") {
      return arrayBuffer(await readFile(path.join(localAssetRoot, safeName)));
    }

    const response = await s3Client(config.region).send(new GetObjectCommand({
      Bucket: config.bucket,
      Key: `${config.prefix}/${safeName}`,
    }));
    if (!response.Body) throw new Error("Source asset body is empty");
    return arrayBuffer(await response.Body.transformToByteArray());
  }
}
