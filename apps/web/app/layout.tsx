import type { Metadata } from "next";
import { Anton, Archivo, Manrope, JetBrains_Mono } from "next/font/google";
import { publicApi } from "./lib/api";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const mode = await publicApi.siteMode();
  const full = process.env.PUBLIC_SITE_MODE === "full" || mode.live;
  return {
    title: full
      ? "Americas Netball Regional Qualifier 2026 · NetballAmericas.org"
      : "Coming Soon · Americas Netball Regional Qualifier 2026",
    description: full
      ? "The official home of the Americas Netball Regional Qualifier 2026 — fixtures, results, standings, nations and live coverage."
      : "The official website for the Americas Netball Regional Qualifier 2026 is coming soon.",
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${archivo.variable} ${manrope.variable} ${jetbrains.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
