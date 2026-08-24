import "server-only";

type LogValue = string | number | boolean | null | undefined;
type LogFields = Record<string, LogValue>;

function record(level: "info" | "error", event: string, fields: LogFields) {
  const payload = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...payload,
  });
  if (level === "error") console.error(line);
  else console.info(line);
}

export function logInfo(event: string, fields: LogFields = {}) {
  record("info", event, fields);
}

export function logError(event: string, error: unknown, fields: LogFields = {}) {
  record("error", event, {
    ...fields,
    errorType: error instanceof Error ? error.name : "UnknownError",
  });
}
