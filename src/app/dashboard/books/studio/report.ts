// The Books page as AG Studio report state: four figure tiles, money by day, the payment timeline and the week's
// jobs grid. Positions are canvas tracks: 24 columns wide, rows of studioCanvasRowHeight (18px).
import type { AgReportState, AgWidgetLayoutState } from "ag-studio";
import type { BooksRegistry } from "./widgets";

const at = (xTrack: number, yTrack: number, xSpan: number, ySpan: number): AgWidgetLayoutState => ({ xTrack, yTrack, xSpan, ySpan });
const sum = (id: string) => ({ id, aggregation: "sum" as const });

const figure = (key: string, value: string) => ({
  type: "figure" as const,
  dataMapping: { key: [{ id: key }], value: [sum(value)] },
  // The week's figures stay the week's figures when a job is picked in the grid. The look is FIGURES[widgetId].
  format: { crossFilter: "none" as const },
});

/** Canvas rows the report uses, for sizing Studio's container. */
export const REPORT_ROWS = 8 + 17 + 29;

export const booksReport: AgReportState<BooksRegistry> = {
  selectedPageId: "week",
  panels: { filters: { collapsed: true } },
  pages: [
    {
      id: "week",
      widgets: {
        "fig-charged": figure("jobs.key", "jobs.charged"),
        "fig-held": figure("jobs.key", "jobs.held"),
        "fig-waiting": figure("jobs.key", "jobs.waiting"),
        "fig-calls": figure("calls.key", "calls.cost"),
        "money-chart": {
          type: "column-chart-stacked",
          dataMapping: {
            categoryKey: [{ id: "money.day" }],
            valueKey: [sum("money.amount")],
            legendKey: [{ id: "money.kind" }],
          },
          format: {
            title: { enabled: true, text: "Money this week" },
            crossFilter: "none",
            style: {
              theme: {
                common: { legend: { enabled: true, position: "top" } },
                bar: { series: { label: { enabled: true, fontSize: 11, fontWeight: "bold", color: "#ffffff" } } },
              },
            },
          },
        },
        timeline: {
          type: "payment-timeline",
          dataMapping: {
            steps: ["jobKey", "title", "order", "label", "amount", "at", "state", "note", "rank"].map((f) => ({ id: `steps.${f}` })),
          },
          format: { title: { enabled: true, text: "Payment timeline" }, crossFilter: "filter" },
        },
        "jobs-grid": {
          type: "grid",
          dataMapping: {
            cols: [
              { id: "jobs.label" },
              { id: "jobs.start" },
              { id: "jobs.status" },
              sum("jobs.held"),
              sum("jobs.charged"),
              { id: "jobs.changeNote" },
              { id: "jobs.receipt" },
              sum("jobs.callCost"),
            ],
          },
          sort: [{ field: { id: "jobs.start" }, direction: "desc" }],
          format: {
            title: { enabled: true, text: "This week’s jobs" },
            subtitle: { enabled: true, text: "Click a job to see its payment timeline." },
            crossFilter: "none",
            style: { grandTotalRow: { enabled: true }, columnAutoSize: true },
          },
        },
      },
      widgetLayout: {
        "fig-charged": at(0, 0, 7, 8),
        "fig-held": at(7, 0, 6, 8),
        "fig-waiting": at(13, 0, 6, 8),
        "fig-calls": at(19, 0, 5, 8),
        "money-chart": at(0, 8, 11, 17),
        timeline: at(11, 8, 13, 17),
        "jobs-grid": at(0, 25, 24, 29),
      },
    },
  ],
};
