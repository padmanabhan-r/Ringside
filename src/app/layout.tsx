import type { Metadata } from "next";
import { Figtree, Geist } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-geist" });
// The field-service world's friendly geometric sans (redesign 2026-11-05).
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-ui" });

export const metadata: Metadata = {
  title: "Ringside",
  description:
    "The AI front desk for small service businesses: it answers the call, books the job and holds the money with PayPal.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
