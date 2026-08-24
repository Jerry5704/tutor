import "server-only";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function databaseUrl() {
  return required("DATABASE_URL");
}

export function authSecret() {
  const value = required("AUTH_SECRET");
  if (value.length < 32) throw new Error("AUTH_SECRET must have at least 32 characters");
  return value;
}

export function openAIConfig() {
  return {
    apiKey: required("OPENAI_API_KEY"),
    model: process.env.OPENAI_MODEL?.trim() || "gpt-5.4-mini",
  };
}

export function internetVisualsEnabled() {
  return process.env.INTERNET_VISUALS_ENABLED?.trim().toLowerCase() !== "false";
}

export function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function sourceAssetStorageConfig() {
  const mode = process.env.SOURCE_ASSET_STORAGE?.trim().toLowerCase() || "local";
  if (mode === "local") return { mode: "local" as const };
  if (mode !== "s3") throw new Error("SOURCE_ASSET_STORAGE must be local or s3");
  return {
    mode: "s3" as const,
    bucket: required("SOURCE_ASSET_S3_BUCKET"),
    prefix: (process.env.SOURCE_ASSET_S3_PREFIX?.trim() || "textbook/unit-1/assets").replace(/^\/+|\/+$/gu, ""),
    region: process.env.AWS_REGION?.trim() || "eu-central-1",
  };
}
