import { db } from "@/server/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const READY_TIMEOUT_MS = 2_000;

async function databaseIsReady() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("readiness timeout")), READY_TIMEOUT_MS);
      }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function GET() {
  const ready = await databaseIsReady();
  return Response.json(
    { status: ready ? "ready" : "unavailable" },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
