import { SearchX } from "lucide-react";
import { MikesWordmark, PoweredByRingside, SandboxTag } from "@/components/brand";
import s from "./job.module.css";

/** An unknown booking code: a real 404 (so links and crawlers know), with the same friendly page as before. */
export default function JobNotFound() {
  return (
    <div className={`fs ${s.page}`}>
      <header className={s.band}>
        <MikesWordmark size={50} />
      </header>
      <main className={s.sheet}>
        <h1 className={s.title}>No booking found</h1>
        <section className={`${s.card} ${s.notFound}`}>
          <SearchX className={s.notFoundIcon} aria-hidden="true" />
          <p>
            There’s no booking with that code. Codes look like MP-4127; the assistant reads yours out at the end of the call.
          </p>
        </section>
        <a className={s.btnPrimary} href="/call">
          Call Mike’s Plumbing to book
        </a>
        <footer className={s.footer}>
          <div className={s.footerRow}>
            <PoweredByRingside />
            <SandboxTag />
          </div>
          <p>Mike’s Plumbing is a fictional business. Payments run on the PayPal sandbox: no real money moves.</p>
        </footer>
      </main>
    </div>
  );
}
