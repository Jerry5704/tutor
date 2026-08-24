import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import { authSecret, isProduction } from "@/server/config/env";

const COOKIE = "tutor_session";

function secret() {
  return new TextEncoder().encode(authSecret());
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId }).setProtectedHeader({ alg: "HS256" })
    .setIssuedAt().setExpirationTime("14d").sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: isProduction(),
    path: "/", maxAge: 60 * 60 * 24 * 14,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentStudent() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId !== "string") return null;
    return db.studentProfile.findFirst({ where: { userId: payload.userId }, include: { user: true } });
  } catch { return null; }
}

export async function requireStudent() {
  const student = await currentStudent();
  if (!student) redirect("/login");
  return student;
}
