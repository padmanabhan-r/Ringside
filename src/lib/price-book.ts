// Mike's Plumbing price book (fictional business; illustrative US-market ranges in USD, owner-approved 2026-11-05).
// Hard rule: the agent quotes only from here. A quote is a range; the PayPal hold is the TOP of the range (the most the
// customer can be charged for that job), and Mike captures the real cost at job done, never more than the hold.

import { type Cents, formatUsd, sumCents } from "./money";

export type Kind =
  | "visit" // service calls, inspections, diagnostics: a fixed fee or narrow range, held at the top
  | "fixed" // ordinary repairs with a published range, held at the top
  | "emergency" // urgent work, its own prices (not a fee stacked on a normal job)
  | "estimate"; // major projects: an estimate visit, no payment until Mike approves the scope

export interface Service {
  code: string;
  section: string;
  name: string;
  lowCents: Cents;
  highCents: Cents;
  kind: Kind;
}

type Row = [name: string, low: number, high: number, plus?: "+"];

const SECTIONS: Record<string, { title: string; kind: Kind; rows: Row[] }> = {
  A: {
    title: "Service calls and inspections",
    kind: "visit",
    rows: [
      ["Standard plumbing service visit", 99, 99],
      ["Plumbing diagnostic and inspection", 99, 149],
      ["Leak detection visit", 125, 199],
      ["Drain inspection", 99, 149],
      ["Sewer camera inspection", 175, 350],
      ["Water pressure inspection", 99, 149],
      ["Whole-home plumbing inspection", 199, 349],
      ["Emergency plumbing dispatch", 199, 299],
      ["After-hours service call", 199, 349],
      ["Weekend or holiday dispatch", 199, 399],
    ],
  },
  B: {
    title: "Drain cleaning and clogged pipes",
    kind: "fixed",
    rows: [
      ["Kitchen sink clog removal", 125, 225],
      ["Bathroom sink clog removal", 125, 200],
      ["Bathtub drain unclogging", 150, 250],
      ["Shower drain unclogging", 150, 250],
      ["Toilet clog removal", 125, 225],
      ["Main sewer line snaking", 200, 450],
      ["Floor drain unclogging", 150, 275],
      ["Laundry drain cleaning", 150, 275],
      ["Drain cleaning with power auger", 200, 400],
      ["Hydro jetting", 350, 800],
      ["Main sewer line hydro jetting", 450, 1000],
      ["Multiple drain cleaning", 250, 500],
    ],
  },
  C: {
    title: "Leak detection and pipe repairs",
    kind: "fixed",
    rows: [
      ["Faucet leak repair", 125, 250],
      ["Sink pipe leak repair", 150, 300],
      ["Under-sink pipe repair", 150, 350],
      ["Toilet water leak repair", 125, 250],
      ["Shower pipe leak repair", 175, 450],
      ["Exposed pipe leak repair", 150, 350],
      ["Copper pipe repair", 175, 450],
      ["PEX pipe repair", 150, 350],
      ["PVC pipe repair", 150, 350],
      ["Burst pipe repair", 300, 1000],
      ["Main water line leak repair", 500, 2000],
      ["Slab leak detection", 250, 500],
      ["Slab leak repair", 500, 3000, "+"],
      ["Pipe replacement (small section)", 250, 600],
      ["Pipe rerouting", 700, 2500, "+"],
      ["Whole-house repiping", 4000, 12000, "+"],
    ],
  },
  D: {
    title: "Toilet repairs and installation",
    kind: "fixed",
    rows: [
      ["Running toilet repair", 125, 225],
      ["Toilet flapper replacement", 100, 175],
      ["Fill valve replacement", 125, 200],
      ["Flush valve replacement", 150, 275],
      ["Toilet handle replacement", 85, 150],
      ["Toilet wax ring replacement", 175, 350],
      ["Toilet tank repair", 125, 250],
      ["Toilet installation", 250, 500],
      ["Toilet replacement", 300, 650],
      ["Dual-flush toilet installation", 300, 600],
      ["Smart toilet installation", 400, 900],
      ["Toilet flange repair", 200, 450],
    ],
  },
  E: {
    title: "Faucets, sinks and kitchen plumbing",
    kind: "fixed",
    rows: [
      ["Kitchen faucet replacement", 175, 350],
      ["Bathroom faucet replacement", 150, 300],
      ["Touchless faucet installation", 200, 450],
      ["Kitchen sink installation", 250, 600],
      ["Bathroom sink installation", 200, 500],
      ["Sink drain replacement", 125, 250],
      ["P-trap replacement", 125, 225],
      ["Garbage disposal repair", 150, 300],
      ["Garbage disposal installation", 200, 450],
      ["Garbage disposal replacement", 250, 600],
      ["Dishwasher water line installation", 150, 300],
      ["Refrigerator water line installation", 125, 250],
      ["Kitchen plumbing rerouting", 400, 1500, "+"],
    ],
  },
  F: {
    title: "Showers, bathtubs and bathrooms",
    kind: "fixed",
    rows: [
      ["Showerhead replacement", 100, 200],
      ["Shower faucet replacement", 175, 400],
      ["Shower valve repair", 175, 400],
      ["Shower cartridge replacement", 150, 300],
      ["Shower drain repair", 175, 350],
      ["Bathtub faucet replacement", 175, 400],
      ["Bathtub drain replacement", 200, 450],
      ["Shower valve installation", 300, 650],
      ["New shower plumbing", 500, 1500, "+"],
      ["Bathtub installation", 1500, 4000, "+"],
      ["Bathroom plumbing renovation", 2000, 8000, "+"],
    ],
  },
  G: {
    title: "Water heaters",
    kind: "fixed",
    rows: [
      ["Water heater inspection", 99, 149],
      ["Water heater flushing", 125, 250],
      ["Thermostat replacement", 150, 300],
      ["Heating element replacement", 175, 350],
      ["Pressure relief valve replacement", 150, 300],
      ["Water heater leak repair", 175, 450],
      ["Expansion tank installation", 200, 400],
      ["Standard tank water heater installation", 900, 2000],
      ["Tank water heater replacement", 1000, 3000],
      ["Tankless water heater installation", 1400, 4000],
      ["Tankless water heater replacement", 1500, 4500],
      ["Water heater maintenance", 125, 250],
    ],
  },
  H: {
    title: "Sewer lines and outdoor plumbing",
    kind: "fixed",
    rows: [
      ["Sewer line cleaning", 200, 500],
      ["Sewer line blockage removal", 200, 500],
      ["Sewer line repair", 1000, 4000, "+"],
      ["Sewer line replacement", 3000, 10000, "+"],
      ["Water main leak repair", 500, 2500, "+"],
      ["Water main replacement", 1500, 5000, "+"],
      ["Outdoor faucet replacement", 125, 275],
      ["Hose bib repair", 100, 225],
      ["Outdoor spigot installation", 150, 300],
      ["Sump pump repair", 250, 600],
      ["Sump pump replacement", 400, 1000],
      ["Sump pump installation", 600, 1500],
      ["French drain installation", 2000, 6000, "+"],
      ["Backflow testing", 75, 200],
      ["Backflow preventer repair", 150, 500],
    ],
  },
  I: {
    title: "Emergency plumbing",
    kind: "emergency",
    rows: [
      ["Emergency clogged toilet", 200, 400],
      ["Emergency drain blockage", 225, 500],
      ["Emergency pipe leak", 250, 600],
      ["Emergency burst pipe", 350, 1000, "+"],
      ["Emergency water heater repair", 250, 750],
      ["Emergency sewer backup", 300, 800],
      ["Emergency main water line repair", 500, 2000, "+"],
    ],
  },
  J: {
    title: "Water filtration and pressure",
    kind: "fixed",
    rows: [
      ["Water pressure regulator repair", 150, 300],
      ["Pressure regulator replacement", 250, 500],
      ["Water softener installation", 500, 1500],
      ["Water filtration installation", 300, 900],
      ["Whole-house water filtration", 800, 2500],
      ["Reverse osmosis system installation", 250, 600],
      ["Water filter replacement", 75, 175],
      ["Water pressure troubleshooting", 99, 199],
      ["Well pump repair", 300, 800],
      ["Well pump replacement", 800, 2000, "+"],
    ],
  },
  K: {
    title: "Gas lines (licensed work)",
    kind: "fixed",
    rows: [
      ["Gas leak diagnostic visit", 125, 200],
      ["Gas line leak repair", 250, 750],
      ["Gas shutoff valve replacement", 150, 350],
      ["Gas line installation", 300, 1000, "+"],
      ["Gas line rerouting", 500, 2000, "+"],
      ["Gas appliance connection", 150, 350],
      ["Gas pressure testing", 100, 250],
    ],
  },
};

/** Above this top price, or with an open-ended "+", a job needs Mike's in-person estimate before any payment. */
const ESTIMATE_THRESHOLD_CENTS = 100_000;

const toCode = (name: string) =>
  name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

export const SERVICES: readonly Service[] = Object.entries(SECTIONS).flatMap(([section, { kind, rows }]) =>
  rows.map(([name, low, high, plus]): Service => {
    const highCents = high * 100;
    const estimate = plus === "+" || highCents > ESTIMATE_THRESHOLD_CENTS;
    return { code: toCode(name), section, name, lowCents: low * 100, highCents, kind: estimate ? "estimate" : kind };
  }),
);

const BY_CODE = new Map(SERVICES.map((s) => [s.code, s]));
if (BY_CODE.size !== SERVICES.length) throw new Error("Duplicate service codes in the price book");

export const SECTION_TITLES = Object.fromEntries(Object.entries(SECTIONS).map(([k, v]) => [k, v.title]));
export const SERVICE_VISIT = BY_CODE.get("standard_plumbing_service_visit")!;

export function findService(code: string): Service | undefined {
  return BY_CODE.get(code);
}

export function rangeText(s: Service): string {
  return s.lowCents === s.highCents ? formatUsd(s.lowCents) : `${formatUsd(s.lowCents)} to ${formatUsd(s.highCents)}`;
}

/** Keyword search the agent uses to find the right catalogue job for what the caller describes. */
export function searchServices(query: string, limit = 6): Service[] {
  const words = query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  if (!words.length) return [];
  const scored = SERVICES.map((s) => {
    const name = s.name.toLowerCase();
    const score = words.reduce((n, w) => n + (name.includes(w) ? 2 : 0) + (name.includes(w.replace(/s$/, "")) ? 1 : 0), 0);
    return { s, score };
  }).filter((x) => x.score > 0);
  scored.sort((a, b) => b.score - a.score || a.s.highCents - b.s.highCents);
  return scored.slice(0, limit).map((x) => x.s);
}

export class PriceBookError extends Error {
  override name = "PriceBookError";
}

export interface Quote {
  services: Service[];
  lowCents: Cents;
  /** The PayPal hold: the top of the range, the most the customer can be charged for the quoted work. */
  holdCents: Cents;
}

/** Prices a set of catalogue codes. Estimate-only jobs can't be quoted for payment; neither can unknown codes. */
export function quote(codes: unknown): Quote {
  if (!Array.isArray(codes) || codes.length === 0) throw new PriceBookError("Give one to three service codes from the price book");
  if (codes.length > 3) throw new PriceBookError("Quote at most three services; anything bigger needs Mike's estimate");
  const services = codes.map((c) => {
    const s = typeof c === "string" ? BY_CODE.get(c) : undefined;
    if (!s) throw new PriceBookError(`"${String(c)}" is not in the price book; search for the job first`);
    if (s.kind === "estimate") throw new PriceBookError(`${s.name} needs Mike's in-person estimate; book an estimate visit instead`);
    return s;
  });
  if (new Set(services.map((s) => s.code)).size !== services.length) throw new PriceBookError("A service appears twice");
  return { services, lowCents: sumCents(services.map((s) => s.lowCents)), holdCents: sumCents(services.map((s) => s.highCents)) };
}
