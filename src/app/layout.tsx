import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Tutor biologii", description: "Adaptacyjna nauka biologii do sprawdzianu" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pl"><body>{children}</body></html>;
}
