import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MikesWordmark, PoweredByRingside, SandboxTag } from "@/components/brand";
import { CallScreen } from "./call-screen";
import s from "./call.module.css";

export const metadata: Metadata = {
  title: "Call Mike’s Plumbing · Ringside",
  description: "Talk to Mike’s Plumbing’s AI assistant in your browser: a quote from the price book, a visit window and a PayPal sandbox hold.",
};

export default function CallPage() {
  return (
    <div className={`fs ${s.root}`}>
      <div className={s.page}>
        <header className={s.header}>
          <span className={s.brand}>
            <span className={s.brandWide}>
              <MikesWordmark size={52} />
            </span>
            <span className={s.brandNarrow}>
              <MikesWordmark size={36} />
            </span>
          </span>
          <div className={s.headline}>
            <h1 className={s.title}>AI assistant answering for Mike</h1>
            <SandboxTag />
          </div>
          <Link className={s.back} href="/" aria-label="Back to Ringside">
            <ArrowLeft aria-hidden="true" />
            <span>
              <span className={s.backLong}>Back to </span>Ringside
            </span>
          </Link>
        </header>
        <main className={s.main}>
          <CallScreen />
        </main>
        <footer className={s.footer}>
          <span>Fictional business on the PayPal sandbox: no real money moves</span>
          <span className={s.footerDot} aria-hidden="true">
            ·
          </span>
          <PoweredByRingside />
        </footer>
      </div>
    </div>
  );
}
