"use client";

import { Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import s from "./cancel-job.module.css";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Cancel a job that hasn't started. Two taps, like Job done: the first asks, the second voids the PayPal hold, so the
 * customer's money is released. Cancelling never charges anything.
 */
export function CancelJob({ code, customer, holdCents, approved }: { code: string; customer: string; holdCents: number; approved: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/dashboard/jobs/${code}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmed: true }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setConfirming(false);
      return setError(body.error ?? "PayPal didn’t release the hold just now. Try again.");
    }
    router.refresh();
  };

  return (
    <section className={s.cancelBox} aria-label="Cancel this job">
      {!confirming ? (
        <button type="button" className={s.quiet} onClick={() => setConfirming(true)}>
          <Undo2 aria-hidden="true" />
          {approved ? "Cancel job and release the hold" : "Cancel job"}
        </button>
      ) : (
        <div className={s.confirm} role="group" aria-labelledby="cancel-ask">
          <p id="cancel-ask" className={s.ask}>
            {approved
              ? `Cancel this job? PayPal releases ${customer}’s ${usd(holdCents)} hold right away. Nothing is charged.`
              : `Cancel this job? ${customer} hasn’t approved the ${usd(holdCents)} hold yet, so nothing is held or charged.`}
          </p>
          <div className={s.row}>
            <button type="button" className={s.yes} onClick={cancel} disabled={busy}>
              {busy ? "Cancelling…" : "Yes, cancel it"}
            </button>
            <button type="button" className={s.keep} onClick={() => setConfirming(false)} disabled={busy}>
              Keep the job
            </button>
          </div>
        </div>
      )}
      {error ? (
        <p className={s.error} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
