import { Globe, Phone } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/components/brand";
import { callsToday, loadCalls } from "@/lib/dashboard";
import { currentSession } from "@/lib/session";
import { localDate } from "@/lib/slots";
import { centsShort, dayPrefix, durationLabel, hourLabel } from "../format";
import s from "../lists.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calls" };

const OUTCOME: Record<string, { tone: "ok" | "info" | "none" | "wait"; label: string }> = {
  booked_hold: { tone: "ok", label: "Booked" },
  quoted: { tone: "info", label: "Quoted" },
  no_booking: { tone: "none", label: "No booking" },
  in_progress: { tone: "wait", label: "In progress" },
  failed: { tone: "none", label: "Dropped" },
};

export default async function CallsPage() {
  const now = new Date();
  const calls = await loadCalls(await currentSession(), now);
  const today = callsToday(calls, now);
  const todays = calls.filter((c) => localDate(c.at) === localDate(now));
  const earlier = calls.filter((c) => localDate(c.at) !== localDate(now));
  const render = (list: typeof calls) => (
    <ul className={s.list}>
      {list.map((c) => {
        const Icon = c.channel === "web" ? Globe : Phone;
        const o = OUTCOME[c.outcome] ?? OUTCOME.no_booking!;
        const body = (
          <>
            <span className={`${s.icon} ${c.channel === "web" ? "" : s.iconOk}`}>
              <Icon aria-hidden="true" />
            </span>
            <span className={s.body}>
              <span className={s.main}>{c.summary}</span>
              <span className={s.sub}>
                {localDate(c.at) === localDate(now) ? hourLabel(c.at) : `${dayPrefix(c.at, now)} ${hourLabel(c.at)}`} · {c.channel === "web" ? "Browser" : "Phone"}
                {c.durationSecs !== null ? ` · ${durationLabel(c.durationSecs)}` : ""}
                <StatusPill tone={o.tone}>{o.label}</StatusPill>
                {c.sample ? <span className={s.sample}>Sample</span> : null}
              </span>
            </span>
            <span className={s.end}>
              {c.costCents !== null ? centsShort(c.costCents) : "—"}
              <small>call cost</small>
            </span>
          </>
        );
        return (
          <li key={c.key} className={s.item}>
            {c.jobCode ? (
              <Link className={s.itemLink} href={`/dashboard/jobs/${c.jobCode}`}>
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
  return (
    <div className={s.page}>
      <h1 className={s.title}>Calls</h1>
      <p className={s.lead}>
        Every call the assistant answered, phone or browser, with what came of it and what it cost: {today.count} today, {centsShort(today.costCents)}.
      </p>
      <h2 className={s.group}>Today</h2>
      {render(todays)}
      {earlier.length ? (
        <>
          <h2 className={s.group}>Earlier</h2>
          {render(earlier)}
        </>
      ) : null}
    </div>
  );
}
