"use client";

import { Check, Copy, CreditCard } from "lucide-react";
import { useState } from "react";
import s from "./job.module.css";

// PayPal's published sandbox test Visa (developer.paypal.com/credit-card-number-generator): no PayPal account needed.
const CARD = "4012000033330026";

export function TestCard() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(CARD);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the number is on screen to type */
    }
  };
  return (
    <aside className={s.test} aria-labelledby="testing">
      <span className={s.testIcon} aria-hidden="true">
        <CreditCard />
      </span>
      <div>
        <p id="testing" className={s.testTitle}>
          Testing?
        </p>
        <p className={s.testText}>
          No PayPal account needed. Tap <b>Debit or Credit Card</b> and use the sandbox test card:
        </p>
        <button type="button" className={s.cardNumber} onClick={copy} aria-label={copied ? "Card number copied" : "Copy the test card number 4012 0000 3333 0026"}>
          4012 0000 3333 0026
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </button>
        <p className={s.testText}>Any future expiry (like 12/30), any 3-digit code and a US ZIP such as 48602.</p>
        <p className={s.testText}>Judging? The sandbox PayPal login in your testing instructions works too, if a card is declined.</p>
        <span className={s.srOnly} aria-live="polite">
          {copied ? "Copied" : ""}
        </span>
      </div>
    </aside>
  );
}
