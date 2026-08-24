import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { databaseUrl, isProduction } from "@/server/config/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl() }) });
}

export const db = globalForPrisma.prisma ?? createClient();
if (!isProduction()) globalForPrisma.prisma = db;
