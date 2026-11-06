"use client";

import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import s from "./job.module.css";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function toCents(text: string): number | null {
  const m = /^\s*\$?\s*(\d{1,5})(?:\.(\d{1,2}))?\s*$/.exec(text);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}

/**
 * Job done (hard rule: the only path to a capture is Mike's confirmed action). He enters the real cost of the
 * booked job, inside the quoted range and never above the hold; a second tap confirms; PayPal charges exactly that.
 */
export function JobDone({
  code,
  customer,
  jobName,
  lowCents,
  holdCents,
  extraCents = 0,
  blocked,
}: {
  code: string;
  customer: string;
  /** The quoted job, e.g. "Faucet leak repair": the only thing this box prices. */
  jobName: string;
  lowCents: number;
  holdCents: number;
  /** Extra work the customer already paid as its own payments: shown, never charged again. */
  extraCents?: number;
  blocked?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cents = toCents(text);
  const valid = cents !== null && cents >= lowCents && cents <= holdCents;

  const charge = async () => {
    if (!valid || cents === null) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/dashboard/jobs/${code}/done`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finalCents: cents, confirmed: true }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setConfirming(false);
      return setError(body.error ?? "PayPal didn’t take the charge. Try again.");
    }
    router.refresh();
  };

  return (
    <div className={s.doneBody}>
      {/* A small bill: the box prices only the original job; extra work is already paid; the total follows. */}
      <div className={s.bill}>
        <label htmlFor="final-cost" className={s.finalLabel}>
          {jobName}: what did it really cost?
          <small>
            Quoted {usd(lowCents)} to {usd(holdCents)}. PayPal takes it from {customer}’s {usd(holdCents)} hold and releases the rest.
          </small>
        </label>
        <div className={s.finalRow}>
          <span className={s.dollar} aria-hidden="true">
            $
          </span>
          <input
            id="final-cost"
            className={s.finalInput}
            inputMode="decimal"
            placeholder={(holdCents / 100).toFixed(2)}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setConfirming(false);
            }}
            disabled={Boolean(blocked) || busy}
            aria-describedby="final-help"
          />
        </div>
        <p id="final-help" className={s.finalHelp}>
          {blocked
            ? blocked
            : cents !== null && !valid
              ? cents > holdCents
                ? `That’s more than the ${usd(holdCents)} hold. Mike never charges more than the hold.`
                : `That’s below the quoted price of ${usd(lowCents)}.`
              : valid
                ? `PayPal releases the other ${usd(holdCents - cents)} of the hold.`
                : `Type the real cost of the ${jobName.toLowerCase()}, ${usd(lowCents)} to ${usd(holdCents)}.`}
        </p>
        {extraCents > 0 ? (
          <p className={s.billRow}>
            <span>
              Extra work
              <small>Already paid by {customer}: not charged again</small>
            </span>
            <span>{usd(extraCents)}</span>
          </p>
        ) : null}
        <p className={`${s.billRow} ${s.billTotal}`}>
          <span>{customer} pays in all</span>
          <span>{valid ? usd(cents + extraCents) : "—"}</span>
        </p>
      </div>
      {!confirming ? (
        <button type="button" className={s.chargeButton} disabled={!valid || Boolean(blocked) || busy} onClick={() => setConfirming(true)}>
          <CircleCheck aria-hidden="true" />
          {valid ? `Charge ${usd(cents)} and send receipt` : "Charge and send receipt"}
        </button>
      ) : (
        <div className={s.confirmRow}>
          <button type="button" className={s.chargeButton} onClick={charge} disabled={busy}>
            <CircleCheck aria-hidden="true" />
            {busy ? "Charging…" : `Yes, charge ${usd(cents ?? 0)}`}
          </button>
          <button type="button" className={s.cancel} onClick={() => setConfirming(false)} disabled={busy}>
            Not yet
          </button>
        </div>
      )}
      {error ? (
        <p className={s.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
