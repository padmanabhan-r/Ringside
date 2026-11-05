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
export function JobDone({ code, customer, lowCents, holdCents, blocked }: { code: string; customer: string; lowCents: number; holdCents: number; blocked?: string }) {
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
      <label htmlFor="final-cost" className={s.finalLabel}>
        Final cost of the job
        <small>
          Between {usd(lowCents)} and {usd(holdCents)}, the hold {customer} approved
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
              ? `${customer} pays ${usd(cents)}; PayPal releases the other ${usd(holdCents - cents)}.`
              : "Type what the job really cost."}
      </p>
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
