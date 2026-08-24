"use server";
import { compare } from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import { createSession } from "@/server/auth/session";

export async function login(form: FormData) {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await compare(password, user.passwordHash))) redirect("/login?error=1");
  await createSession(user.id); redirect("/dashboard");
}
