"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import s from "./today.module.css";

/** A phone caller types the job code the assistant read out; the job joins this dashboard. */
export function FindBooking() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/dashboard/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
    setBusy(false);
    if (!res.ok || !body.code) return setError(body.error ?? "That didn’t work. Try again.");
    router.push(`/dashboard/jobs/${body.code}`);
    router.refresh();
  };
  return (
    <form className={s.find} onSubmit={submit} id="find-booking">
      <label htmlFor="job-code" className={s.findLabel}>
        Called on the phone? Find your booking by its job code
      </label>
      <div className={s.findRow}>
        <input id="job-code" className={s.findInput} value={code} onChange={(e) => setCode(e.target.value)} placeholder="MP-4127" autoComplete="off" autoCapitalize="characters" inputMode="text" />
        <button type="submit" className={s.findButton} disabled={busy || code.trim().length < 4}>
          <Search aria-hidden="true" /> {busy ? "Finding…" : "Find"}
        </button>
      </div>
      {error ? (
        <p className={s.findError} role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
