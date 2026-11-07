"use client";

import { RotateCcw, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import s from "./job.module.css";

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/** Takes back extra work the customer hasn't answered, so Job done isn't blocked. They're emailed that it's withdrawn. */
export function WithdrawChange({ code, changeOrderId, customer, amountCents }: { code: string; changeOrderId: string; customer: string; amountCents: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const withdraw = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/dashboard/jobs/${code}/change-orders/${changeOrderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "withdraw" }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "That didn’t work. Try again.");
    router.refresh();
  };
  return (
    <div className={s.withdraw}>
      {!confirming ? (
        <button type="button" className={s.quietSmall} onClick={() => setConfirming(true)}>
          <Undo2 aria-hidden="true" /> Withdraw this request
        </button>
      ) : (
        <p className={s.withdrawAsk}>
          Withdraw the {usd(amountCents)} request? {customer} can’t approve it any more, and nothing is charged.{" "}
          <button type="button" className={s.linkButton} onClick={withdraw} disabled={busy}>
            {busy ? "Withdrawing…" : "Yes, withdraw"}
          </button>{" "}
          <button type="button" className={s.linkButton} onClick={() => setConfirming(false)} disabled={busy}>
            Keep it
          </button>
        </p>
      )}
      {error ? (
        <p className={s.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Runs the receipt and close-out again when the receipt hasn't gone out. Safe to repeat. */
export function RetryReceipt({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const retry = async () => {
    setBusy(true);
    setNote(null);
    const res = await fetch(`/api/dashboard/jobs/${code}/receipt`, { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setNote(body.error ?? "That didn’t work. Try again.");
    setNote("Sending the receipt again…");
    setTimeout(() => router.refresh(), 4000);
  };
  return (
    <p className={s.retry}>
      <button type="button" className={s.quietSmall} onClick={retry} disabled={busy}>
        <RotateCcw aria-hidden="true" /> {busy ? "Retrying…" : "Retry the receipt"}
      </button>
      {note ? <span className={s.retryNote}>{note}</span> : null}
    </p>
  );
}
