"use client";

import { BookOpen, Mic, MicOff, Minus, Plus, Search, Send, Trash2, X } from "lucide-react";
import { COMMON_SERVICES } from "@/lib/book-form";
import { findService, searchServices, type Service } from "@/lib/price-book";
import { isItemCode } from "@/lib/rate-card";
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

/** Jobs that can be added on site: closed price-book ranges, not estimate-only projects. */
const COMMON_JOBS = COMMON_SERVICES.map((c) => findService(c)).filter((x): x is Service => Boolean(x) && x!.kind !== "estimate");
const dollars = (cents: number) => (cents % 100 === 0 ? `$${cents / 100}` : usd(cents));
const rangeText = (svc: Pick<Service, "lowCents" | "highCents">) => `${dollars(svc.lowCents)}–${dollars(svc.highCents)}`;
const bookJob = (code: string) => (isItemCode(code) ? undefined : findService(code));

function toCents(text: string): number | null {
  const m = /^\s*\$?\s*(\d{1,5})(?:\.(\d{1,2}))?\s*$/.exec(text);
  return m ? Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0")) : null;
}

const inRange = (svc: Service, text: string) => {
  const c = toCents(text);
  return c !== null && c >= svc.lowCents && c <= svc.highCents;
};

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
  // Whole jobs from the price book, at the price Mike types inside the job's range (dollars as typed).
  const [jobPicks, setJobPicks] = useState<Record<string, string>>({});
  const [jobQuery, setJobQuery] = useState("");
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});
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

  const price = async (body: { transcript: string } | { picks: unknown[] }): Promise<Draft | undefined> => {
    setBusy("price");
    setError(null);
    try {
      const next = (await post(`/api/dashboard/jobs/${code}/change-orders`, body)) as unknown as Draft;
      setDraft(next);
      setDraftPrices({});
      setPicking(false);
      setPicks({});
      setJobPicks({});
      setJobQuery("");
      return next;
    } catch (e) {
      setError((e as Error).message);
      return undefined;
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

  const pricesEdited = draft ? draft.lines.some((l) => bookJob(l.item_code) && draftPrices[l.item_code] !== undefined && toCents(draftPrices[l.item_code]!) !== l.unit_price_cents) : false;
  const pricesValid = draft ? draft.lines.every((l) => { const svc = bookJob(l.item_code); return !svc || draftPrices[l.item_code] === undefined || inRange(svc, draftPrices[l.item_code]!); }) : true;
  // The total as Mike types: fixed card lines plus each price-book job at the price in its box.
  const liveTotal = draft ? draft.lines.reduce((sum, l) => sum + (bookJob(l.item_code) && draftPrices[l.item_code] !== undefined ? (toCents(draftPrices[l.item_code]!) ?? 0) : l.unit_price_cents * l.qty), 0) : 0;

  const send = async () => {
    if (!draft) return;
    let current: Draft | undefined = draft;
    if (pricesEdited) {
      // Mike changed a price-book job's price: save the lines again at his prices, then send that.
      current = await price({
        picks: draft.lines.map((l) =>
          bookJob(l.item_code) ? { service_code: l.item_code, price_cents: toCents(draftPrices[l.item_code] ?? "") ?? l.unit_price_cents } : { item_code: l.item_code, qty: l.qty },
        ),
      });
      if (!current) return;
    }
    setBusy("send");
    setError(null);
    try {
      await post(`/api/dashboard/jobs/${code}/change-orders/${current.id}`, { action: "send" });
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
  const jobList = Object.entries(jobPicks);
  const jobsValid = jobList.every(([c, t]) => { const svc = findService(c); return svc ? inRange(svc, t) : false; });
  const pickTotal =
    pickList.reduce((sum, [c, q]) => sum + (items.find((i) => i.code === c)?.unitPriceCents ?? 0) * q, 0) + jobList.reduce((sum, [, t]) => sum + (toCents(t) ?? 0), 0);
  const jobMatches = (jobQuery.trim().length > 1 ? searchServices(jobQuery, 8) : COMMON_JOBS).filter((j) => j.kind !== "estimate");
  const jobResults = jobMatches.filter((j) => !(j.code in jobPicks));
  const allPicks = [...pickList.map(([item_code, qty]) => ({ item_code, qty })), ...jobList.map(([service_code, t]) => ({ service_code, price_cents: toCents(t) ?? 0 }))];

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
              <p className={s.pickHeading}>Parts and labour</p>
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
              <p className={s.pickHeading}>Whole jobs from your price book</p>
              {jobList.length ? (
                <ul className={s.pickList}>
                  {jobList.map(([c, t]) => {
                    const svc = findService(c)!;
                    const ok = inRange(svc, t);
                    return (
                      <li key={c} className={s.pickItem}>
                        <span className={s.pickName}>
                          {svc.name}
                          <small className={ok ? undefined : s.outOfRange}>Your price, {rangeText(svc)}</small>
                        </span>
                        <span className={s.jobPrice}>
                          <span aria-hidden="true">$</span>
                          <input inputMode="decimal" value={t} onChange={(e) => setJobPicks({ ...jobPicks, [c]: e.target.value })} aria-label={`Price for ${svc.name}`} aria-invalid={!ok} />
                          <button type="button" onClick={() => setJobPicks(Object.fromEntries(jobList.filter(([k]) => k !== c)))} aria-label={`Remove ${svc.name}`}>
                            <X aria-hidden="true" />
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
              <label className={s.jobSearch}>
                <Search aria-hidden="true" />
                <span className={s.visuallyHidden}>Search the price book</span>
                <input type="search" value={jobQuery} onChange={(e) => setJobQuery(e.target.value)} placeholder="Search all jobs, e.g. flapper, disposal, water heater" autoComplete="off" />
              </label>
              {jobResults.length || jobQuery.trim().length > 1 ? <ul className={s.pickList}>
                {jobResults.map((svc) => (
                  <li key={svc.code} className={s.pickItem}>
                    <span className={s.pickName}>
                      {svc.name}
                      <small>{rangeText(svc)}</small>
                    </span>
                    <button type="button" className={s.addJob} onClick={() => setJobPicks({ ...jobPicks, [svc.code]: (svc.lowCents / 100).toFixed(2) })}>
                      <Plus aria-hidden="true" /> Add
                    </button>
                  </li>
                ))}
                {jobQuery.trim().length > 1 && !jobMatches.length ? <li className={s.pickEmpty}>No job in the price book matches that.</li> : null}
                {jobMatches.length && !jobResults.length ? <li className={s.pickEmpty}>Already added. Search for another job.</li> : null}
              </ul> : null}
              <button type="button" className={s.primaryWide} disabled={!allPicks.length || !jobsValid || busy !== null} onClick={() => void price({ picks: allPicks })}>
                {busy === "price" ? "Pricing…" : !jobsValid ? "Keep each job's price inside its range" : allPicks.length ? `Add ${usd(pickTotal)} of extra work` : "Pick the extra work"}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className={s.draft}>
          <p className={s.draftSaid}>{draft.transcript.startsWith("Picked from the") ? "Picked from the price list" : `“${draft.transcript}”`}</p>
          <ul className={s.lines}>
            {draft.lines.map((l) => {
              const svc = bookJob(l.item_code);
              const t = draftPrices[l.item_code] ?? (l.unit_price_cents / 100).toFixed(2);
              return (
                <li key={l.item_code}>
                  <span>
                    {l.name ?? l.item_code}
                    {svc ? (
                      <small className={inRange(svc, t) ? undefined : s.outOfRange}>Your price, {rangeText(svc)}</small>
                    ) : l.qty > 1 || l.item_code === "labour_hr" ? (
                      <small>{l.item_code === "labour_hr" ? `${l.qty * 15} min` : `× ${l.qty}`}</small>
                    ) : null}
                  </span>
                  {svc ? (
                    <span className={s.jobPrice}>
                      <span aria-hidden="true">$</span>
                      <input inputMode="decimal" value={t} onChange={(e) => setDraftPrices({ ...draftPrices, [l.item_code]: e.target.value })} aria-label={`Price for ${l.name ?? l.item_code}`} aria-invalid={!inRange(svc, t)} />
                    </span>
                  ) : (
                    <span>{usd(l.unit_price_cents * l.qty)}</span>
                  )}
                </li>
              );
            })}
            <li className={s.linesTotal}>
              <span>Extra work</span>
              <span>{pricesValid ? usd(liveTotal) : "—"}</span>
            </li>
          </ul>
          {draft.unclear ? <p className={s.unclear}>Not on the price list, left out: {draft.unclear}</p> : null}
          <button type="button" className={s.sendButton} onClick={send} disabled={busy !== null || !pricesValid}>
            <Send aria-hidden="true" />
            <span>
              {busy === "send" ? "Sending…" : `Send to ${customer} to approve`}
              <small>{pricesValid ? `A second PayPal payment for exactly ${usd(liveTotal)}` : "Keep each job's price inside its range"}</small>
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
