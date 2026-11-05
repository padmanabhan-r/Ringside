// AG Studio data sources for Mike's Books: jobs, their payment timeline steps, money by day and calls, as loaded
// server-side from Postgres (./data.ts). Steps belong to jobs, so picking a job in the grid cross-filters the timeline.
import type { AgDataSourcesDefinition, AgFieldDefinition, AgFormat } from "ag-studio";
import type { BooksData } from "../data";
import type { BooksRegistry } from "./widgets";

const TIME_ZONE = "America/Detroit";
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const wholeUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const weekdayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const dayTimeFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE });

const asDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/** "Thu 10 am" in Mike's time zone. */
export function dayTime(value: unknown): string {
  const d = asDate(value);
  return d ? dayTimeFmt.format(d).replace(":00", "").replace(/ (AM|PM)$/, (m) => m.toLowerCase()) : "";
}

const usdField = { createValueFormatter: () => (value: number) => (value ? usd.format(value) : "—"), blankValue: "—" };

type Field = AgFieldDefinition<BooksRegistry>;
type Spec = [id: string, name: string, format: AgFormat, extra?: Partial<Field>];
const fields = (specs: Spec[]): Field[] => specs.map(([id, name, format, extra]) => ({ id, name, format, ...extra }) as Field);

export function buildSources(data: BooksData): AgDataSourcesDefinition<BooksRegistry> {
  // Dates travel from the server as strings; Studio's date fields take Date objects. Days sit at noon UTC so the
  // weekday is the same in every browser's time zone.
  const when = (iso: string | null) => (iso ? new Date(iso) : null);
  const jobs = data.jobs.map((j) => ({ ...j, start: when(j.start) }));
  const steps = data.steps.map((st) => ({ ...st, at: when(st.at) }));
  // The chart sorts its categories as text, so days stay ISO dates ("2026-11-02") and display as weekdays ("Mon").
  const money = data.money;
  const calls = data.calls.map((c) => ({ ...c, at: when(c.at) }));
  return {
    description:
      "Mike's Plumbing (fictional, Saginaw MI) books for the last 7 days, in USD. Jobs marked Sample are the demo's sample week; " +
      "the others are the visitor's own bookings with real PayPal sandbox holds. Charged is money captured; Held is an approved " +
      "authorization not yet captured; Waiting is a hold or change order the customer has not approved yet.",
    sources: [
      {
        id: "jobs",
        name: "Jobs",
        description: "One row per job this week.",
        data: jobs,
        fields: fields([
          ["key", "Job key", "textFormat", { hide: true }],
          ["ref", "Ref", "textFormat"],
          ["job", "Job name", "textFormat"],
          ["label", "Job", "textFormat"],
          ["customer", "Customer", "textFormat"],
          ["town", "Town", "textFormat"],
          ["start", "Day", "dateTimeFormat", { createValueFormatter: () => dayTime }],
          ["status", "Status", "textFormat"],
          ["held", "Held", "currencyFormat", usdField],
          ["waiting", "Waiting", "currencyFormat", usdField],
          ["charged", "Charged", "currencyFormat", usdField],
          ["change", "Change order total", "currencyFormat", usdField],
          ["changeStatus", "Change status", "textFormat"],
          ["changeNote", "Change order", "textFormat"],
          ["receipt", "Receipt", "textFormat"],
          ["callCost", "Call cost", "currencyFormat", usdField],
          ["rank", "Timeline order", "integerFormat", { hide: true }],
        ]),
      },
      {
        id: "steps",
        name: "Payment steps",
        description: "Each job's payment timeline: hold placed, approved, change order, final charge, receipt.",
        data: steps,
        fields: fields([
          ["key", "Step key", "textFormat", { hide: true }],
          ["jobKey", "Job key", "textFormat", { hide: true }],
          ["title", "Timeline job", "textFormat"],
          ["order", "Step", "integerFormat"],
          ["label", "Step name", "textFormat"],
          ["amount", "Step amount", "currencyFormat", usdField],
          ["at", "Step time", "dateTimeFormat", { createValueFormatter: () => dayTime }],
          ["state", "Step state", "textFormat"],
          ["note", "Step note", "textFormat"],
          ["rank", "Step job order", "integerFormat", { hide: true }],
        ]),
      },
      {
        id: "money",
        name: "Money by day",
        description: "Charged and held amounts by visit day. Zero rows keep quiet days on the chart.",
        data: money,
        fields: fields([
          ["key", "Money key", "textFormat", { hide: true }],
          ["day", "Day", "textFormat", { createValueFormatter: () => (value: string) => (value ? weekdayFmt.format(new Date(`${value}T12:00:00Z`)) : "") }],
          ["kind", "Kind", "textFormat"],
          ["amount", "Amount", "currencyFormat", { createValueFormatter: () => (value: number) => (value ? wholeUsd.format(value) : "") }],
        ]),
      },
      {
        id: "calls",
        name: "Calls",
        description: "Calls the voice agent answered this week, with what each cost in voice minutes.",
        data: calls,
        fields: fields([
          ["key", "Call key", "textFormat", { hide: true }],
          ["at", "Call time", "dateTimeFormat", { createValueFormatter: () => dayTime }],
          ["summary", "Call", "textFormat"],
          ["outcome", "Outcome", "textFormat"],
          ["cost", "Call cost", "currencyFormat", usdField],
        ]),
      },
    ],
    relationships: [
      {
        id: "step-job",
        source: { tableId: "steps", fieldId: "jobKey" },
        target: { tableId: "jobs", fieldId: "key" },
        type: "many-to-one",
      },
    ],
  };
}
