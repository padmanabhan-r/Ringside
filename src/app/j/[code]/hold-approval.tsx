"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import s from "./job.module.css";

interface PayPalButtons {
  render(target: HTMLElement): Promise<void>;
  isEligible(): boolean;
}
declare global {
  interface Window {
    paypal?: {
      Buttons(options: {
        style?: Record<string, unknown>;
        createOrder: () => string;
        onApprove: () => Promise<void>;
        onError?: (err: unknown) => void;
      }): PayPalButtons;
    };
  }
}

export function HoldApproval({ code, orderId, clientId, approvalUrl }: { code: string; orderId: string; clientId: string; approvalUrl: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const target = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const [state, setState] = useState<"idle" | "placing" | "error">("idle");
  const [sdkReady, setSdkReady] = useState(false);

  const placeHold = useCallback(async () => {
    setState("placing");
    const res = await fetch(`/api/jobs/${code}/approve-hold`, { method: "POST" });
    if (res.ok) {
      router.replace(`/j/${code}`);
      router.refresh();
    } else {
      setState(res.status === 409 ? "idle" : "error");
    }
  }, [code, router]);

  // Back from PayPal's own page (the redirect fallback): place the hold straight away.
  useEffect(() => {
    if (params.get("paypal") !== "approved") return;
    const timer = setTimeout(() => void placeHold(), 0);
    return () => clearTimeout(timer);
  }, [params, placeHold]);

  useEffect(() => {
    if (!sdkReady || rendered.current || !target.current || !window.paypal) return;
    rendered.current = true;
    const buttons = window.paypal.Buttons({
      style: { layout: "vertical", color: "gold", shape: "rect", label: "paypal", height: 48 },
      createOrder: () => orderId,
      onApprove: placeHold,
      onError: () => setState("error"),
    });
    if (buttons.isEligible()) void buttons.render(target.current);
  }, [sdkReady, orderId, placeHold]);

  return (
    <div className={s.approve}>
      <Script
        src={`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=authorize&components=buttons&commit=false`}
        onReady={() => setSdkReady(true)}
      />
      {state === "placing" ? (
        <p className={s.placing} role="status">
          Placing the hold with PayPal…
        </p>
      ) : (
        <div ref={target} className={s.paypalButtons} aria-label="Approve with PayPal" />
      )}
      {state === "error" && (
        <p className={s.error} role="alert">
          PayPal couldn’t place the hold. Try again, or use PayPal’s page below.
        </p>
      )}
      {approvalUrl && state !== "placing" && (
        <a className={s.fallback} href={approvalUrl}>
          Open PayPal’s page instead
        </a>
      )}
    </div>
  );
}
