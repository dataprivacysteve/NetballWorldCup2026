import type { Metadata } from "next";
import { Anton, Archivo, Manrope, JetBrains_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Americas Netball Regional Qualifier 2026 · NetballAmericas.org",
  description:
    "The official home of the Americas Netball Regional Qualifier 2026 — fixtures, results, standings, nations and live coverage.",
};

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
