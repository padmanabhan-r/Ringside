"use client";

import { BookOpen, Mic, MicOff, Minus, Plus, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import s from "./job.module.css";

export interface PriceItem {
  code: string;
  name: string;
  unit: string;
  unitPriceCents: number;
  maxQty: number;
}

export interface DraftLine {
  item_code: string;
  name: string | null;
  qty: number;
  unit_price_cents: number;
}

export interface Draft {
  id: string;
  transcript: string;
  delta_cents: number;
  lines: DraftLine[];
  unclear?: string;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function recognitionCtor(): (new () => Recognition) | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/**
 * Add charges: Mike says the extra work (the browser's speech recognition; typing works too) or picks it from the
 * rate card. The server prices it from the card; Mike checks the lines and sends them to the customer to approve.
 */
export function AddCharges({ code, customer, items, draft: initialDraft }: { code: string; customer: string; items: PriceItem[]; draft?: Draft }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [busy, setBusy] = useState<null | "price" | "send" | "discard">(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | undefined>(initialDraft);
  const [picking, setPicking] = useState(false);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const rec = useRef<Recognition | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setCanListen(Boolean(recognitionCtor())), 0);
    return () => clearTimeout(id);
  }, []);

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "That didn’t work. Try again.");
    return json;
  };

  const price = async (body: { transcript: string } | { picks: { item_code: string; qty: number }[] }) => {
    setBusy("price");
    setError(null);
    try {
      setDraft((await post(`/api/dashboard/jobs/${code}/change-orders`, body)) as unknown as Draft);
      setPicking(false);
      setPicks({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggleListen = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    let heard = "";
    r.onresult = (e) => {
      heard = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setText(heard);
    };
    r.onerror = (e) => {
      if (e.error !== "aborted" && e.error !== "no-speech") setError("The microphone didn’t work. Type the extra work instead.");
    };
    r.onend = () => {
      setListening(false);
      if (heard) void price({ transcript: heard });
    };
    rec.current = r;
    setError(null);
    setListening(true);
    r.start();
  };

  const send = async () => {
    if (!draft) return;
    setBusy("send");
    setError(null);
    try {
      await post(`/api/dashboard/jobs/${code}/change-orders/${draft.id}`, { action: "send" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const discard = async () => {
    if (!draft) return;
    setBusy("discard");
    try {
      await post(`/api/dashboard/jobs/${code}/change-orders/${draft.id}`, { action: "discard" });
      setDraft(undefined);
      setText("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pickList = Object.entries(picks).filter(([, q]) => q > 0);
  const pickTotal = pickList.reduce((sum, [c, q]) => sum + (items.find((i) => i.code === c)?.unitPriceCents ?? 0) * q, 0);

  return (
    <div className={s.addBody}>
      {!draft ? (
        <>
          <div className={s.inputs}>
            <button type="button" className={`${s.mic} ${listening ? s.micOn : ""}`} onClick={toggleListen} disabled={!canListen || busy !== null} aria-pressed={listening}>
              <span className={s.micDot}>{listening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}</span>
              <span>{listening ? "Listening… tap to stop" : canListen ? "Tap and say the extra work" : "Say it: not supported here"}</span>
            </button>
            <span className={s.or}>or</span>
            <button type="button" className={s.pickToggle} onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
              <BookOpen aria-hidden="true" />
              <span>Pick from price list</span>
            </button>
          </div>

          <form
            className={s.typeRow}
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) void price({ transcript: text });
            }}
          >
            <label htmlFor="extra-work" className={s.visuallyHidden}>
              Extra work
            </label>
            <input id="extra-work" className={s.typeInput} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. add a shut-off valve and 45 minutes" autoComplete="off" />
            <button type="submit" className={s.typeGo} disabled={!text.trim() || busy !== null}>
              {busy === "price" ? "Pricing…" : "Price it"}
            </button>
          </form>

          {picking ? (
            <div className={s.picker}>
              <ul className={s.pickList}>
                {items.map((item) => {
                  const q = picks[item.code] ?? 0;
                  return (
                    <li key={item.code} className={s.pickItem}>
                      <span className={s.pickName}>
                        {item.name}
                        <small>
                          {usd(item.unitPriceCents)} per {item.unit}
                        </small>
                      </span>
                      <span className={s.stepper}>
                        <button type="button" onClick={() => setPicks({ ...picks, [item.code]: Math.max(0, q - 1) })} disabled={q === 0} aria-label={`One less ${item.name}`}>
                          <Minus aria-hidden="true" />
                        </button>
                        <output aria-live="polite">{q}</output>
                        <button type="button" onClick={() => setPicks({ ...picks, [item.code]: Math.min(item.maxQty, q + 1) })} disabled={q >= item.maxQty} aria-label={`One more ${item.name}`}>
                          <Plus aria-hidden="true" />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <button type="button" className={s.primaryWide} disabled={!pickList.length || busy !== null} onClick={() => void price({ picks: pickList.map(([item_code, qty]) => ({ item_code, qty })) })}>
                {busy === "price" ? "Pricing…" : pickList.length ? `Add ${usd(pickTotal)} of extra work` : "Pick the extra work"}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className={s.draft}>
          <p className={s.draftSaid}>{draft.transcript === "Picked from the rate card" ? "Picked from the price list" : `“${draft.transcript}”`}</p>
          <ul className={s.lines}>
            {draft.lines.map((l) => (
              <li key={l.item_code}>
                <span>
                  {l.name ?? l.item_code}
                  {l.qty > 1 || l.item_code === "labour_hr" ? <small>{l.item_code === "labour_hr" ? `${l.qty * 15} min` : `× ${l.qty}`}</small> : null}
                </span>
                <span>{usd(l.unit_price_cents * l.qty)}</span>
              </li>
            ))}
            <li className={s.linesTotal}>
              <span>Extra work</span>
              <span>{usd(draft.delta_cents)}</span>
            </li>
          </ul>
          {draft.unclear ? <p className={s.unclear}>Not on the price list, left out: {draft.unclear}</p> : null}
          <button type="button" className={s.sendButton} onClick={send} disabled={busy !== null}>
            <Send aria-hidden="true" />
            <span>
              {busy === "send" ? "Sending…" : `Send to ${customer} to approve`}
              <small>A second PayPal payment for exactly {usd(draft.delta_cents)}</small>
            </span>
          </button>
          <button type="button" className={s.discard} onClick={discard} disabled={busy !== null}>
            <Trash2 aria-hidden="true" /> Discard
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
