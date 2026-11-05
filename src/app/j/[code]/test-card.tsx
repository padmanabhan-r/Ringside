"use client";

import { Check, Copy } from "lucide-react";
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
    <div className={s.testCard}>
      <p className={s.testCardTitle}>Testing? No PayPal account needed</p>
      <p className={s.testCardText}>
        Tap <b>Debit or Credit Card</b> and use PayPal’s sandbox test card:
      </p>
      <button type="button" className={s.testCardNumber} onClick={copy} aria-label="Copy the test card number">
        <span>4012 0000 3333 0026</span>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </button>
      <p className={s.testCardText}>Any future expiry (like 12/30), any 3-digit code, any name and a US ZIP such as 48602.</p>
    </div>
  );
}
