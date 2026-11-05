import { formatUsd } from "@/lib/money";
import { SECTION_TITLES, SERVICES, rangeText } from "@/lib/price-book";
import { RATE_CARD } from "@/lib/rate-card";
import s from "../lists.module.css";

export const metadata = { title: "Price book" };

export default function PriceBookPage() {
  const sections = Object.entries(SECTION_TITLES).map(([key, title]) => ({ key, title, rows: SERVICES.filter((x) => x.section === key) }));
  const addOns = Object.entries(RATE_CARD).filter(([code]) => code !== "callout");
  return (
    <div className={s.page}>
      <h1 className={s.title}>Price book</h1>
      <p className={s.lead}>
        Every quote the assistant gives comes from here, and PayPal holds the top of the range. Extra work on site uses the add-on prices,
        so its payment is exact.
      </p>
      <details className={s.section} open>
        <summary>
          Add-ons for extra work <span>{addOns.length} items</span>
        </summary>
        <ul className={s.rows}>
          {addOns.map(([code, item]) => (
            <li key={code}>
              {item.name}
              <b>
                {formatUsd(item.unitPriceCents)} <span className={s.estimate}>per {item.unit}</span>
              </b>
            </li>
          ))}
        </ul>
      </details>
      {sections.map((sec) => (
        <details key={sec.key} className={s.section}>
          <summary>
            {sec.title} <span>{sec.rows.length} jobs</span>
          </summary>
          <ul className={s.rows}>
            {sec.rows.map((row) => (
              <li key={row.code}>
                {row.name}
                <b className={row.kind === "estimate" ? s.estimate : undefined}>{row.kind === "estimate" ? `${rangeText(row)} · estimate visit` : rangeText(row)}</b>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
