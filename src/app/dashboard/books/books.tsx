"use client";

// Mike's Books on a desk: one themed AG Studio instance in view mode beside the "Ask your books" drawer. Studio only
// mounts in the browser (as PayPal's AG Studio boilerplate does); the server renders a skeleton of the same layout.
// Below 1024px, where the Books tab isn't in the nav, the page shows the figures and a plain list instead.
import { AgStudioAiModule, type AgAiHarness } from "ag-studio";
import { AgStudio, AgStudioProvider } from "ag-studio-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { formatUsd } from "@/lib/money";
import type { BooksData } from "./data";
import { AskYourBooks } from "./chat";
import { booksHarness } from "./studio/ai";
import { REPORT_ROWS, booksReport } from "./studio/report";
import { buildSources, dayTime } from "./studio/sources";
import { booksTheme } from "./studio/theme";
import { booksWidgets } from "./studio/widgets";
import s from "./books.module.css";

const DESK = "(min-width: 1024px)";
const ROW = 18;
const MODULES = [AgStudioAiModule];
// View mode shows no side panels; money columns keep their own names rather than "Held (sum)".
const PANELS = { view: { left: [], right: [] } };
const LOCALE = { aggregationSumFieldName: "${name}" };

function subscribeDesk(onChange: () => void) {
  const mq = window.matchMedia(DESK);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** "server" until hydrated, then whether the screen is a desk. */
function useScreen(): "server" | "desk" | "phone" {
  return useSyncExternalStore(
    subscribeDesk,
    () => (window.matchMedia(DESK).matches ? "desk" : "phone"),
    () => "server",
  );
}

function Figures({ data }: { data: BooksData }) {
  const f = data.figures;
  const items = [
    { label: "Charged this week", value: formatUsd(f.chargedCents), note: `${f.chargedJobs} job${f.chargedJobs === 1 ? "" : "s"}`, tone: s.fig_ok },
    { label: "Held", value: formatUsd(f.heldCents), note: `${f.heldJobs} job${f.heldJobs === 1 ? "" : "s"}`, tone: s.fig_wait },
    { label: "Waiting", value: formatUsd(f.waitingCents), note: `${f.waitingItems} item${f.waitingItems === 1 ? "" : "s"}`, tone: s.fig_wait },
    { label: "Calls", value: String(f.calls), note: `${formatUsd(f.callCostCents)} total`, tone: s.fig_brand },
  ];
  return (
    <ul className={s.phoneFigures}>
      {items.map((i) => (
        <li key={i.label} className={`${s.phoneFigure} ${i.tone}`}>
          <span className={s.figLabel}>{i.label}</span>
          <span className={s.figValue}>{i.value}</span>
          <span className={s.figCaption}>{i.note}</span>
        </li>
      ))}
    </ul>
  );
}

function PhoneBooks({ data }: { data: BooksData }) {
  return (
    <div className={s.phone}>
      <p className={s.phoneNote}>The full books, with the money chart, payment timelines and Ask your books, open on a laptop or desk screen.</p>
      <Figures data={data} />
      <h2 className={s.phoneHeading}>This week’s jobs</h2>
      <ul className={s.phoneList}>
        {data.jobs.map((j) => (
          <li key={j.key} className={s.phoneJob}>
            <span className={s.phoneJobMain}>
              <span className={s.phoneJobName}>
                {j.job} {j.sample ? <span className={s.samplePill}>Sample</span> : <span className={s.refCode}>{j.ref}</span>}
              </span>
              <span className={s.phoneJobMeta}>
                {j.customer}
                {j.town ? `, ${j.town}` : ""} · {dayTime(j.start)}
              </span>
            </span>
            <span className={s.phoneJobMoney}>
              <span>{j.charged ? formatUsd(Math.round(j.charged * 100)) : j.held ? formatUsd(Math.round(j.held * 100)) : j.waiting ? formatUsd(Math.round(j.waiting * 100)) : "—"}</span>
              <span className={s.phoneJobStatus}>{j.status}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Skeleton() {
  return (
    <div className={s.desk} aria-hidden="true">
      <div className={s.studioWrap} style={{ height: REPORT_ROWS * ROW }}>
        <div className={s.skeleton}>
          <div className={s.skelRow}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={s.skelCard} style={{ height: 8 * ROW - 24 }} />
            ))}
          </div>
          <div className={s.skelRow}>
            <span className={s.skelCard} style={{ height: 17 * ROW - 24 }} />
            <span className={s.skelCard} style={{ height: 17 * ROW - 24 }} />
          </div>
          <span className={s.skelCard} style={{ height: 29 * ROW - 24 }} />
        </div>
      </div>
      <div className={s.chat} />
    </div>
  );
}

function DeskBooks({ data, licenseKey }: { data: BooksData; licenseKey?: string }) {
  const sources = useMemo(() => buildSources(data), [data]);
  const [harness, setHarness] = useState<AgAiHarness | null>(null);
  return (
    <div className={s.desk}>
      <div className={s.studioWrap} style={{ height: REPORT_ROWS * ROW }}>
        <AgStudioProvider licenseKey={licenseKey} modules={MODULES}>
          <AgStudio
            style={{ height: "100%", width: "100%" }}
            theme={booksTheme}
            data={sources}
            widgets={booksWidgets}
            initialState={booksReport}
            mode="view"
            panels={PANELS}
            localeText={LOCALE}
            onApiReady={(event) => setHarness((current) => current ?? booksHarness(event.api))}
          />
        </AgStudioProvider>
      </div>
      <AskYourBooks harness={harness} />
    </div>
  );
}

export function Books({ data, licenseKey }: { data: BooksData; licenseKey?: string }) {
  const screen = useScreen();
  if (screen === "server") return <Skeleton />;
  if (screen === "phone") return <PhoneBooks data={data} />;
  return <DeskBooks data={data} licenseKey={licenseKey} />;
}
