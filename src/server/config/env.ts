import "server-only";

function required(name: "DATABASE_URL" | "AUTH_SECRET" | "OPENAI_API_KEY") {
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
