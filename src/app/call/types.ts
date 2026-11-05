// What the browser call page shows about the job a call created. Shared by the poll route and the page.

export type HoldState = "none" | "awaiting" | "approved" | "closed";

export interface CallJobView {
  code: string;
  /** The rate-card job(s) quoted, e.g. "Faucet leak repair". */
  title: string;
  /** The quoted range, e.g. "$125–$250"; null for an estimate visit. */
  range: string | null;
  zip: string | null;
  city: string | null;
  /** The chosen visit window, e.g. "Today, 10 am – 12 pm". */
  window: string | null;
  /** The PayPal hold amount, e.g. "$250.00". */
  holdText: string | null;
  hold: HoldState;
  /** Where the customer approves the hold: "/j/<code>". */
  link: string | null;
  estimate: boolean;
}

export interface CallView {
  outcome: string;
  job: CallJobView | null;
}
