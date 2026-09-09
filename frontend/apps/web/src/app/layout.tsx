import type { Metadata } from "next";
import { Inter, Instrument_Serif, Geist_Mono } from "next/font/google";
import "./globals.css";

/** The comp's three families: Inter UI · Instrument Serif display · Geist Mono micro-labels. */
const inter = Inter({ subsets: ["latin"], variable: "--inter", display: "swap" });
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--mandela-serif",
  display: "swap",
});
const mono = Geist_Mono({ subsets: ["latin"], variable: "--mandela-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Mandela — School Management, Rebuilt Simple",
  description:
    "Five modules. People · Money · Classroom · Talk · Insights. Zero training required.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
