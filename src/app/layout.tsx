import type { Metadata } from "next";
import { Geist } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "Ringside",
  description:
    "The AI front desk for one-person trades: it answers the call, books the job and holds the money with PayPal.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
