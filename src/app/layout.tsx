import type { Metadata } from "next";
import { Figtree, Geist } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-geist" });
// The field-service world's friendly geometric sans (redesign 2026-11-05).
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-ui" });

const DESCRIPTION = "Call-to-cash for small service businesses: Ringside turns a phone call into a paid job, holding the money with PayPal.";

export const metadata: Metadata = {
  metadataBase: new URL("https://ringside-4bup.onrender.com"),
  title: "Ringside",
  description: DESCRIPTION,
  // The preview image is src/app/opengraph-image.png, rendered from assets/src/og.html.
  openGraph: {
    type: "website",
    siteName: "Ringside",
    title: "Ringside: call-to-cash for small service businesses",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
