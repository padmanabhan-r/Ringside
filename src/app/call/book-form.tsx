"use client";

import { ArrowLeft, Check, Clock, Info, Lock, MapPin, Search, Sparkles, TriangleAlert, Wrench, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { COMMON_SERVICES, rangeShort, townForZip } from "@/lib/book-form";
import { findService, searchServices, type Service } from "@/lib/price-book";
import { checkServiceArea } from "@/lib/service-area";
import { localDate, TIME_ZONE } from "@/lib/slots";
import s from "./book-form.module.css";

type Field = "service" | "name" | "street" | "zip" | "email" | "slot" | "confirmed";
interface Slot {
  id: string;
  label: string;
}

const COMMON = COMMON_SERVICES.map((code) => findService(code)!).filter(Boolean);

/** The next seven days in Mike's time zone, for the day picker. */
const DAYS = Array.from({ length: 7 }, (_, i) => {
  const date = new Date(Date.now() + i * 86_400_000);
  const iso = localDate(date);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short" }).format(date);
  const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : `${weekday} ${Number(iso.slice(8, 10))}`;
  return { date: iso, label };
});

/**
 * "No mic? Book without calling": the call's booking as a short form. Same price book, same service area, same visit
 * windows; then the same read-back the assistant gives, and only after "Yes" the PayPal hold (made by the agent's own
 * tools on the server). The visitor approves the hold on their booking page.
 */
export function BookForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [problem, setProblem] = useState("");
  const [matching, setMatching] = useState(false);
  const [match, setMatch] = useState<{ why: string; safety: boolean; error?: string } | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [name, setName] = useState("");
  const [street, setStreet] = useState("");
  const [zip, setZip] = useState("");
  const [email, setEmail] = useState("");
  const [slot, setSlot] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [onDay, setOnDay] = useState(true);
  const [day, setDay] = useState(() => DAYS[0]!.date);
  const [part, setPart] = useState<"any" | "morning" | "afternoon">("any");
  const [readBack, setReadBack] = useState<string | null>(null);
  const [formId, setFormId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; field?: Field } | null>(null);
  const top = useRef<HTMLElement>(null);

  useEffect(() => {
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Mike's calendar for the day and time of day the visitor picks (the same check the agent makes on a call).
  useEffect(() => {
    let stop = false;
    const q = new URLSearchParams({ day, part });
    fetch(`/api/call/book?${q}`, { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { slots?: Slot[]; onDay?: boolean; error?: string };
        if (stop) return;
        if (!res.ok || !body.slots) return setSlotsError(body.error ?? "We couldn’t load Mike’s calendar. Try again in a moment.");
        setSlotsError(null);
        setSlots(body.slots);
        setOnDay(body.onDay !== false);
        setSlot((cur) => (body.slots?.some((w) => w.id === cur) ? cur : body.slots?.[0]?.id || ""));
      })
      .catch(() => !stop && setSlotsError("We couldn’t load Mike’s calendar. Try again in a moment."));
    return () => {
      stop = true;
    };
  }, [day, part]);

  const results = useMemo(() => (query.trim().length > 2 ? searchServices(query, 6) : []), [query]);
  const area = /^\d{5}$/.test(zip) ? checkServiceArea({ zip }) : "unknown";
  const estimate = service?.kind === "estimate";
  const payload = { service: service?.code ?? "", name, street, zip, slot, email };

  const send = async (step: "check" | "book") => {
    setBusy(true);
    setError(null);
    let leaving = false;
    try {
      // Each read-back gets its own key, so a double tap on "Yes" books once and a changed booking is a new one.
      const res = await fetch("/api/call/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(step === "book" ? { ...payload, step, formId, confirmed: true } : { ...payload, step }),
      });
      const body = (await res.json().catch(() => ({}))) as { readBack?: string; code?: string; error?: string; field?: Field };
      if (!res.ok) {
        setError({ text: body.error ?? "Something went wrong on our side. Try again.", field: body.field });
        if (body.field && body.field !== "confirmed") setReadBack(null);
        return;
      }
      if (step === "check" && body.readBack) {
        setFormId(crypto.randomUUID());
        setReadBack(body.readBack);
        top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (body.code) {
        leaving = true;
        router.push(`/j/${body.code}`);
      }
    } catch {
      setError({ text: "We couldn’t reach Mike’s Plumbing. Check your connection and try again." });
    } finally {
      if (!leaving) setBusy(false);
    }
  };

  const pick = (svc: Service) => {
    setService(svc);
    setError((e) => (e?.field === "service" ? null : e));
  };
  const invalid = (f: Field) => (error?.field === f ? true : undefined);

  /** "Describe the problem": Claude matches the visitor's words to one job in the price book. */
  const findJob = async () => {
    if (problem.trim().length < 3) return;
    setMatching(true);
    setMatch(null);
    try {
      const res = await fetch("/api/call/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ problem }) });
      const body = (await res.json().catch(() => ({}))) as { code?: string; why?: string; safety?: boolean; error?: string };
      if (!res.ok || !body.code) return setMatch({ why: "", safety: false, error: body.error ?? "We couldn’t match that. Pick the job from the list instead." });
      if (body.safety) {
        setService(null);
        return setMatch({ why: "", safety: true });
      }
      const svc = findService(body.code);
      if (svc) pick(svc);
      setMatch({ why: body.why ?? "", safety: false });
    } catch {
      setMatch({ why: "", safety: false, error: "We couldn’t reach Mike’s Plumbing. Pick the job from the list instead." });
    } finally {
      setMatching(false);
    }
  };

  return (
    <section ref={top} className={s.card} aria-labelledby="book-title">
      <div className={s.head}>
        <div>
          <h2 id="book-title" className={s.title}>
            Book without calling
          </h2>
          <p className={s.sub}>The same price book and PayPal hold as the call. Nothing is charged until Mike finishes the job.</p>
        </div>
        <button type="button" className={s.close} onClick={onClose}>
          <X aria-hidden="true" />
          <span>Back to the call</span>
        </button>
      </div>

      {readBack ? (
        <div className={s.readBack} aria-live="polite">
          <h3 className={s.readTitle}>Is this right?</h3>
          <p className={s.readText}>{readBack}</p>
          <p className={s.readNote}>
            <Lock aria-hidden="true" />
            Next, you approve the hold with PayPal on your booking page. The sandbox test card is shown there.
          </p>
          {error ? (
            <p className={s.error} role="alert">
              {error.text}
            </p>
          ) : null}
          <div className={s.readActions}>
            <button type="button" className={s.primary} onClick={() => void send("book")} disabled={busy}>
              <Check aria-hidden="true" /> {busy ? "Booking…" : "Yes, book it"}
            </button>
            <button type="button" className={s.ghost} onClick={() => setReadBack(null)} disabled={busy}>
              <ArrowLeft aria-hidden="true" /> Change something
            </button>
          </div>
        </div>
      ) : (
        <form
          className={s.form}
          onSubmit={(e) => {
            e.preventDefault();
            void send("check");
          }}
          noValidate
        >
          <fieldset className={s.group} aria-invalid={invalid("service")}>
            <legend className={s.legend}>
              <Wrench aria-hidden="true" /> What needs fixing
            </legend>
            <div className={s.describe}>
              <label htmlFor="problem" className={s.describeLabel}>
                Describe it in your own words, and AI finds the job and its price in Mike’s price book
              </label>
              <div className={s.describeRow}>
                <textarea
                  id="problem"
                  className={s.describeInput}
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void findJob();
                    }
                  }}
                  rows={2}
                  maxLength={400}
                  placeholder="e.g. my kitchen tap won’t stop dripping"
                />
                <button type="button" className={s.findButton} onClick={() => void findJob()} disabled={matching || problem.trim().length < 3}>
                  <Sparkles aria-hidden="true" /> {matching ? "Finding…" : "Find my job"}
                </button>
              </div>
              {match?.safety ? (
                <p className={s.safety} role="alert">
                  <TriangleAlert aria-hidden="true" />
                  If you smell gas or something is burning, leave the building now and call your gas utility or 911. Don’t book online.
                </p>
              ) : match?.error ? (
                <p className={s.hint}>{match.error}</p>
              ) : match && service ? (
                <p className={s.matched}>
                  <Sparkles aria-hidden="true" />
                  <span>
                    <b>{service.name}</b>, {service.kind === "estimate" ? "an estimate visit" : rangeShort(service)}. {match.why}
                  </span>
                </p>
              ) : null}
            </div>
            <p className={s.orPick}>or pick it yourself</p>
            <ul className={s.choices}>
              {(results.length ? results : COMMON).map((svc) => (
                <li key={svc.code}>
                  <label className={`${s.choice} ${service?.code === svc.code ? s.chosen : ""}`}>
                    <input type="radio" name="service" value={svc.code} checked={service?.code === svc.code} onChange={() => pick(svc)} />
                    <span className={s.choiceName}>{svc.name}</span>
                    <span className={s.choicePrice}>{svc.kind === "estimate" ? "Estimate visit" : rangeShort(svc)}</span>
                  </label>
                </li>
              ))}
            </ul>
            {query.trim().length > 2 && !results.length ? <p className={s.hint}>Nothing in the price book matches that. Try another word, or pick a common job.</p> : null}
            <label className={s.search}>
              <Search aria-hidden="true" />
              <span className={s.srOnly}>Search Mike’s price book</span>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the price book" autoComplete="off" />
            </label>
            {estimate ? (
              <p className={s.note}>
                <Info aria-hidden="true" />
                {service!.name} needs Mike’s in-person estimate first, with no payment. Call Mike’s Plumbing to book an estimate visit.
              </p>
            ) : service ? (
              <p className={s.picked}>
                {service.name}: {rangeShort(service)}. PayPal holds the top of the range.
              </p>
            ) : null}
          </fieldset>

          <fieldset className={s.group}>
            <legend className={s.legend}>
              <MapPin aria-hidden="true" /> Where
            </legend>
            <div className={s.fields}>
              <label className={s.field}>
                <span>First name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={40} aria-invalid={invalid("name")} />
              </label>
              <label className={`${s.field} ${s.wide}`}>
                <span>Street address</span>
                <input value={street} onChange={(e) => setStreet(e.target.value)} autoComplete="address-line1" maxLength={80} placeholder="e.g. 42 Elm St" aria-invalid={invalid("street")} />
              </label>
              <label className={s.field}>
                <span>ZIP code</span>
                <input
                  value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="e.g. 48602"
                  aria-invalid={invalid("zip") ?? (area === "outside" ? true : undefined)}
                  aria-describedby="zip-help"
                />
              </label>
              <label className={`${s.field} ${s.wide}`}>
                <span>Email for updates (optional)</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  maxLength={120}
                  placeholder="So Mike can send extra work to approve and your receipt"
                  aria-invalid={invalid("email")}
                />
              </label>
              <p id="zip-help" className={area === "outside" ? s.zipOut : s.zipHelp}>
                {area === "outside"
                  ? "Sorry, Mike only works in Saginaw, Bay City and Midland, so he can’t book that ZIP."
                  : area === "inside"
                    ? `${townForZip(zip)}: in Mike’s area.`
                    : "Mike works in Saginaw, Bay City and Midland."}
              </p>
            </div>
          </fieldset>

          <fieldset className={s.group} aria-invalid={invalid("slot")}>
            <legend className={s.legend}>
              <Clock aria-hidden="true" /> When suits you
            </legend>
            <div className={s.days} role="radiogroup" aria-label="Day">
              {DAYS.map((d) => (
                <button key={d.date} type="button" role="radio" aria-checked={day === d.date} className={`${s.dayChip} ${day === d.date ? s.chosen : ""}`} onClick={() => setDay(d.date)}>
                  {d.label}
                </button>
              ))}
            </div>
            <div className={s.parts} role="radiogroup" aria-label="Time of day">
              {(["any", "morning", "afternoon"] as const).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={part === p} className={`${s.partChip} ${part === p ? s.chosen : ""}`} onClick={() => setPart(p)}>
                  {p === "any" ? "Any time" : p === "morning" ? "Morning, 8–12" : "Afternoon, 12–6"}
                </button>
              ))}
            </div>
            {slots ? (
              slots.length ? (
                <>
                {!onDay ? <p className={s.hint}>Nothing is open then. The closest windows after it:</p> : null}
                <ul className={s.slots}>
                  {slots.map((w) => (
                    <li key={w.id}>
                      <label className={`${s.slot} ${slot === w.id ? s.chosen : ""}`}>
                        <input type="radio" name="slot" value={w.id} checked={slot === w.id} onChange={() => setSlot(w.id)} />
                        {w.label}
                      </label>
                    </li>
                  ))}
                </ul>
                </>
              ) : (
                <p className={s.hint}>Mike’s week is full at that time. Try another day or time.</p>
              )
            ) : (
              <p className={s.hint}>{slotsError ?? "Loading Mike’s calendar…"}</p>
            )}
          </fieldset>

          <div className={s.footer}>
            {error ? (
              <p className={s.error} role="alert">
                {error.text}
              </p>
            ) : null}
            <button type="submit" className={s.primary} disabled={busy || !service || estimate || area === "outside" || !slots?.length}>
              {busy ? "Checking…" : "Check my booking"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
