import { redirect } from "next/navigation";
import { currentStudent } from "@/server/auth/session";
export default async function Home() { redirect((await currentStudent()) ? "/dashboard" : "/login"); }
