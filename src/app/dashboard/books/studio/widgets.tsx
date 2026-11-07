"use client";

// Mike's custom AG Studio widgets, registered with createWidgets: the figure tiles and the payment timeline, plus
// cell renderers that turn the jobs grid's status, ref, change order and receipt columns into pills.
import type { AgBaseRegistry, AgBaseWidgetDefinition, AgDefaultRegistry, AgDefaultWidgetDefinition, AgWidgetField, AgWidgetParams, AgWidgetsConfig } from "ag-studio";
import { createWidgets } from "ag-studio-react";
import { Check, CircleDollarSign, Clock, CreditCard, DollarSign, Hourglass, Lock, Phone, ReceiptText, type LucideIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { jobFocus } from "./ai";
import { dayTime } from "./sources";
import s from "../books.module.css";

// --- Types --------------------------------------------------------------------------------------

type FigureTone = "ok" | "wait" | "brand";
type FigureIcon = "dollar" | "clock" | "hourglass" | "phone";

export interface FigureStyle {
  label: string;
  tone: FigureTone;
  icon: FigureIcon;
  /** "sum" shows the total of the value; "count" shows how many rows, with the total as the caption. */
  display: "sum" | "count";
  unit: string;
}

export interface FigureDef {
  type: "figure";
  dataMapping: { key: unknown[]; value: unknown[] };
  format?: { style?: FigureStyle; crossFilter?: "filter" | "highlight" | "none" };
}

export interface TimelineDef {
  type: "payment-timeline";
  dataMapping: { steps: unknown[] };
  format?: { title?: { enabled: boolean; text: string }; crossFilter?: "filter" | "highlight" | "none" };
}

export interface BooksRegistry extends AgBaseRegistry {
  widgets: readonly (AgDefaultWidgetDefinition | AgBaseWidgetDefinition<"figure", FigureDef> | AgBaseWidgetDefinition<"payment-timeline", TimelineDef>)[];
}

// --- Figure tile --------------------------------------------------------------------------------

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const FIGURE_ICONS: Record<FigureIcon, LucideIcon> = { dollar: DollarSign, clock: Clock, hourglass: Hourglass, phone: Phone };
const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;

/** Each tile's look, by widget id: Studio keeps only the format fields a widget declares a shape for. */
export const FIGURES: Record<string, FigureStyle> = {
  "fig-charged": { label: "Charged this week", tone: "ok", icon: "dollar", display: "sum", unit: "job" },
  "fig-held": { label: "Held this week", tone: "wait", icon: "clock", display: "sum", unit: "job" },
  "fig-waiting": { label: "Waiting this week", tone: "wait", icon: "hourglass", display: "sum", unit: "item" },
  "fig-calls": { label: "Calls", tone: "brand", icon: "phone", display: "count", unit: "call" },
};

function FigureTile(params: AgWidgetParams<FigureDef>) {
  const { widgetApi, dataMapping, format, widgetId } = params;
  const style = format?.style ?? FIGURES[widgetId];
  const [figure, setFigure] = useState<{ total: number; count: number } | null>(null);

  useEffect(() => {
    let live = true;
    const key = dataMapping.key ?? [];
    const value = dataMapping.value ?? [];
    if (!key.length || !value.length) {
      widgetApi.setDisplayState("incompleteDataMapping");
      return;
    }
    widgetApi.setDisplayState("loading", { prominent: false });
    widgetApi.getData({ fields: [...key, ...value] }).then((res) => {
      if (!live) return;
      const rows = res.results.rows as Record<string, unknown>[];
      const valueKey = value[0]?.key ?? "";
      const values = rows.map((r) => Number(r[valueKey] ?? 0));
      const total = values.reduce((a, b) => a + b, 0);
      const count = style?.display === "count" ? rows.length : values.filter((v) => v > 0).length;
      setFigure({ total, count });
      widgetApi.setDisplayState("displayed");
    });
    return () => {
      live = false;
    };
  }, [params, dataMapping, widgetApi, style?.display]);

  if (!style) return null;
  const Icon = FIGURE_ICONS[style.icon];
  const big = figure ? (style.display === "count" ? String(figure.count) : usd.format(figure.total)) : "";
  const caption = figure ? (style.display === "count" ? `${usd.format(figure.total)} total` : plural(figure.count, style.unit)) : "";
  return (
    <div className={`${s.figure} ${s[`fig_${style.tone}`]}`}>
      <span className={s.figIcon} aria-hidden="true">
        <Icon strokeWidth={2.4} />
      </span>
      <span className={s.figText}>
        <span className={s.figLabel}>{style.label}</span>
        <span className={s.figValue}>{big}</span>
        <span className={s.figCaption}>{caption}</span>
      </span>
    </div>
  );
}

// --- Payment timeline ---------------------------------------------------------------------------

interface Step {
  jobKey: string;
  title: string;
  order: number;
  label: string;
  amount: number | null;
  at: unknown;
  state: string;
  note: string;
  rank: number;
}

const STEP_ICONS: Record<string, LucideIcon> = {
  "Hold placed": Lock,
  Approved: Check,
  "Change order": CircleDollarSign,
  "Final charge": CreditCard,
  Receipt: ReceiptText,
};

function PaymentTimeline(params: AgWidgetParams<TimelineDef>) {
  const { widgetApi, dataMapping } = params;
  const [rows, setRows] = useState<Step[]>([]);
  const focus = useSyncExternalStore(jobFocus.subscribe, jobFocus.get, () => null);

  useEffect(() => {
    let live = true;
    const fields = dataMapping.steps ?? [];
    const byId = (id: string): AgWidgetField | undefined => fields.find((f) => String(f.fieldId).endsWith(`.${id}`) || f.key.endsWith(`.${id}`));
    const need = ["jobKey", "title", "order", "label", "amount", "at", "state", "note", "rank"] as const;
    const picked = need.map(byId);
    if (picked.some((f) => !f)) {
      widgetApi.setDisplayState("incompleteDataMapping");
      return;
    }
    widgetApi.setDisplayState("loading", { prominent: false });
    widgetApi.getData({ fields: picked as AgWidgetField[] }).then((res) => {
      if (!live) return;
      const rows = (res.results.rows as Record<string, unknown>[]).map((r) => {
        const get = (id: (typeof need)[number]) => r[byId(id)!.key];
        return {
          jobKey: String(get("jobKey")),
          title: String(get("title") ?? ""),
          order: Number(get("order")),
          label: String(get("label") ?? ""),
          amount: get("amount") == null ? null : Number(get("amount")),
          at: get("at"),
          state: String(get("state") ?? "todo"),
          note: String(get("note") ?? ""),
          rank: Number(get("rank")),
        };
      });
      setRows(rows);
      widgetApi.setDisplayState(rows.length ? "displayed" : "noData");
    });
    return () => {
      live = false;
    };
  }, [params, dataMapping, widgetApi]);

  // With no job picked every job's steps come back: show the one the agent pointed at, else the one Mike is on.
  const first = rows.find((r) => r.jobKey === focus) ?? rows.reduce<Step | undefined>((best, r) => (!best || r.rank < best.rank ? r : best), undefined);
  const steps = first ? rows.filter((r) => r.jobKey === first.jobKey).sort((a, b) => a.order - b.order) : [];
  const job = steps[0];
  return (
    <div className={s.timeline}>
      {job ? (
        <p className={s.timelineJob}>
          {job.title}
          {job.jobKey.startsWith("sample-") ? <span className={s.samplePill}>Sample</span> : null}
        </p>
      ) : null}
      {steps.length === 1 && steps[0]?.amount == null ? (
        <p className={s.timelineNote}>{steps[0]?.note || "No payment on this job yet."}</p>
      ) : (
        <ol className={s.steps}>
          {steps.map((step) => {
            const Icon = step.state === "wait" ? Clock : (STEP_ICONS[step.label] ?? Check);
            const when = dayTime(step.at);
            return (
              <li key={step.order} className={`${s.step} ${s[`step_${step.state}`] ?? ""}`}>
                <span className={s.stepDot} aria-hidden="true">
                  <Icon strokeWidth={2.2} />
                </span>
                <span className={s.stepLabel}>{step.label}</span>
                <span className={s.stepAmount}>{step.amount != null ? usd.format(step.amount) : "—"}</span>
                {step.state === "wait" ? <span className={s.waitPill}>{step.note || "Waiting"}</span> : null}
                {step.state === "done" && step.note && step.note !== "None" ? <span className={s.stepNote}>{step.note}</span> : null}
                {when ? <span className={s.stepWhen}>{when}</span> : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// --- Grid cell renderers ------------------------------------------------------------------------

interface CellParams {
  value: unknown;
  valueFormatted?: string | null;
}

const STATUS_TONE: Record<string, string> = {
  Paid: "ok",
  "Hold approved": "info",
  "In progress": "info",
  Waiting: "wait",
  "Change waiting": "wait",
  "Estimate visit": "none",
  Quoted: "none",
  Cancelled: "none",
};

function StatusCell({ value }: CellParams) {
  if (value == null || value === "") return null;
  const text = String(value);
  return <span className={`${s.cellPill} ${s[`tone_${STATUS_TONE[text] ?? "none"}`]}`}>{text}</span>;
}

/** The job, its customer and its ref; clicking it shows the job's payment timeline (grid widgets don't cross-filter). */
function JobCell({ value }: CellParams) {
  const [job = "", meta = "", key = ""] = String(value ?? "").split("\n");
  const [customer = "", ref = ""] = meta.split(" · ");
  const focus = useSyncExternalStore(jobFocus.subscribe, jobFocus.get, () => null);
  const picked = focus === key;
  return (
    <button type="button" className={`${s.jobCell} ${picked ? s.jobPicked : ""}`} onClick={() => key && jobFocus.set(key)} aria-pressed={picked} title="Show this job's payment timeline">
      <span className={s.jobName}>{job}</span>
      <span className={s.jobMeta}>
        {customer}
        {ref === "Sample" ? <span className={s.samplePill}>Sample</span> : <span className={s.refCode}>{ref}</span>}
      </span>
    </button>
  );
}

function ReceiptCell({ value }: CellParams) {
  const text = String(value ?? "—");
  return text === "Sent" ? <span className={s.receiptSent}>Sent</span> : <span className={s.dash}>—</span>;
}

function ChangeCell({ value }: CellParams) {
  const [amount, status] = String(value ?? "").split(" · ");
  if (!amount) return <span className={s.dash}>—</span>;
  return (
    <span className={s.changeCell}>
      {amount}
      {status ? <span className={`${s.cellPill} ${s[`tone_${status === "Waiting" ? "wait" : status === "Approved" ? "ok" : "none"}`]}`}>{status}</span> : null}
    </span>
  );
}

const RENDERERS: Record<string, (p: CellParams) => React.ReactNode> = {
  status: StatusCell,
  label: JobCell,
  receipt: ReceiptCell,
  changeNote: ChangeCell,
};

function rendererFor(field: AgWidgetField) {
  const id = String(field.fieldId ?? field.key);
  if (!id.startsWith("jobs.")) return undefined;
  return RENDERERS[id.slice(5)];
}

// --- Registration -------------------------------------------------------------------------------

const TILE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 15h4M7 10h10"/></svg>';
const TIMELINE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 12h3M14 12h3"/></svg>';

// Studio 3.0's override type resolves to `never` once a registry adds custom widgets, so the grid override is cast.
const gridOverride = { id: "grid", options: { createCellRenderer: rendererFor } } as never;

export function booksWidgets(defaults: AgWidgetsConfig<AgDefaultRegistry>): AgWidgetsConfig<BooksRegistry> {
  return createWidgets<BooksRegistry>({
    overrides: [gridOverride],
    additionalTypes: [
      {
        id: "figure",
        label: "Figure tile",
        icon: TILE_ICON,
        comp: FigureTile,
        dataMapping: {
          key: { type: "field", supportedRoles: ["category"], required: true, aiDescription: "One row per item counted, e.g. a job key." },
          value: { type: "fieldset", supportedRoles: ["numeric"], required: true, aiDescription: "The money summed for the tile." },
        },
        form: (p) => p.createDefaults({ dataMappingItems: [{ key: "key", label: "Count by" }, { key: "value", label: "Value" }] }),
        defaultSize: { width: 240, height: 120 },
        minSize: { width: 180, height: 100 },
        ai: { description: "A figure tile: icon, label, a large money total or count, and a caption." },
      },
      {
        id: "payment-timeline",
        label: "Payment timeline",
        icon: TIMELINE_ICON,
        comp: PaymentTimeline,
        dataMapping: {
          steps: { type: "fieldset", supportedRoles: ["category", "numeric", "temporal"], required: true, aiDescription: "The payment step fields." },
        },
        form: (p) => p.createDefaults({ dataMappingItems: [{ key: "steps", label: "Step fields" }] }),
        defaultSize: { width: 480, height: 300 },
        minSize: { width: 360, height: 220 },
        ai: { description: "One job's payment timeline: hold placed, approved, change order, final charge, receipt. Follows the job picked in the grid." },
      },
    ],
    menu: [...defaults.menu, { label: "Mike's Plumbing", widgetIds: ["figure", "payment-timeline"] }],
  });
}
