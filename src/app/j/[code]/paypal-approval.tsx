"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { formatUsd } from "@/lib/money";
import s from "./job.module.css";

interface PayPalButtonsInstance {
  render(target: HTMLElement): Promise<void>;
  isEligible(): boolean;
}
interface PayPalNamespace {
  Buttons(options: {
    style?: Record<string, unknown>;
    createOrder: () => string;
    onApprove: () => Promise<void>;
    onError?: (err: unknown) => void;
  }): PayPalButtonsInstance;
}

type Intent = "authorize" | "capture";

// The SDK's intent must match the order's, so the hold (AUTHORIZE) and the change order (CAPTURE) each load their own
// copy under its own namespace: one page can show both over its life without the two clashing.
const NAMESPACE: Record<Intent, string> = { authorize: "paypal_hold", capture: "paypal_change" };

function sdkSrc(clientId: string, intent: Intent): string {
  const commit = intent === "capture"; // the change order is paid on approval ("Pay Now"); the hold continues
  return `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=${intent}&components=buttons&commit=${commit}`;
}

/** PayPal's own buttons for an order the server already created. The target stays mounted so the buttons survive a retry. */
function usePayPalButtons({ clientId, intent, orderId, onApprove, onError }: { clientId: string; intent: Intent; orderId: string; onApprove: () => Promise<void>; onError: () => void }) {
  const target = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const handlers = useRef({ onApprove, onError });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    handlers.current = { onApprove, onError };
  });

  useEffect(() => {
    const ns = (window as unknown as Record<string, PayPalNamespace | undefined>)[NAMESPACE[intent]];
    if (!ready || rendered.current || !target.current || !ns) return;
    rendered.current = true;
    const buttons = ns.Buttons({
      style: { layout: "vertical", color: "gold", shape: "rect", borderRadius: 12, label: intent === "capture" ? "pay" : "paypal", height: 50 },
      createOrder: () => orderId,
      onApprove: () => handlers.current.onApprove(),
      onError: () => handlers.current.onError(),
    });
    if (buttons.isEligible()) void buttons.render(target.current);
  }, [ready, intent, orderId]);

  const script = <Script src={sdkSrc(clientId, intent)} data-namespace={NAMESPACE[intent]} onReady={() => setReady(true)} />;
  return { target, script };
}

/** Runs `action` once when PayPal's own page sends the customer back with `?paypal=<flag>` (the redirect fallback). */
function useReturnFromPayPal(flag: string, action: () => Promise<void>) {
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("paypal") !== flag) return;
    const timer = setTimeout(() => void action(), 0);
    return () => clearTimeout(timer);
  }, [params, flag, action]);
}

function Working({ children }: { children: ReactNode }) {
  return (
    <p className={s.working} role="status">
      <LoaderCircle aria-hidden="true" />
      {children}
    </p>
  );
}

export function HoldApproval({ code, orderId, clientId, approvalUrl }: { code: string; orderId: string; clientId: string; approvalUrl: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "error">("idle");

  const placeHold = useCallback(async () => {
    setState("working");
    try {
      const res = await fetch(`/api/jobs/${code}/approve-hold`, { method: "POST" });
      if (res.ok) {
        router.replace(`/j/${code}`);
        router.refresh();
        return;
      }
      setState(res.status === 409 ? "idle" : "error");
    } catch {
      setState("error");
    }
  }, [code, router]);

  useReturnFromPayPal("approved", placeHold);
  const { target, script } = usePayPalButtons({ clientId, intent: "authorize", orderId, onApprove: placeHold, onError: () => setState("error") });

  return (
    <div className={s.pay}>
      {script}
      {state === "working" && <Working>Placing the hold with PayPal…</Working>}
      <div ref={target} className={s.paypalButtons} hidden={state === "working"} aria-label="Approve the hold with PayPal" />
      {state === "error" && (
        <p className={s.error} role="alert">
          PayPal couldn’t place the hold. Try again, or use PayPal’s page below.
        </p>
      )}
      {approvalUrl && state !== "working" && (
        <a className={s.fallback} href={approvalUrl}>
          Open PayPal’s page instead
        </a>
      )}
    </div>
  );
}

type ChangeState = "idle" | "paying" | "confirm" | "declining" | "error" | "declineError";

export function ChangeApproval({
  code,
  orderId,
  clientId,
  approvalUrl,
  amountCents,
  holdCents,
}: {
  code: string;
  orderId: string;
  clientId: string;
  approvalUrl: string | null;
  amountCents: number;
  holdCents: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<ChangeState>("idle");
  const busy = state === "paying" || state === "declining";

  const decide = useCallback(
    async (decision: "approve" | "decline") => {
      setState(decision === "approve" ? "paying" : "declining");
      try {
        const res = await fetch(`/api/jobs/${code}/change`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision }),
        });
        if (res.ok || res.status === 404) {
          // Done, or already settled elsewhere: show the job as it now stands.
          router.replace(`/j/${code}`);
          router.refresh();
          return;
        }
        if (decision === "approve") setState(res.status === 409 ? "idle" : "error");
        else setState("declineError");
      } catch {
        setState(decision === "approve" ? "error" : "declineError");
      }
    },
    [code, router],
  );
  const approve = useCallback(() => decide("approve"), [decide]);

  useReturnFromPayPal("change-approved", approve);
  const { target, script } = usePayPalButtons({ clientId, intent: "capture", orderId, onApprove: approve, onError: () => setState("error") });
  const amount = formatUsd(amountCents);

  return (
    <div className={s.pay}>
      {script}
      {state === "paying" && <Working>Taking the {amount} payment with PayPal…</Working>}
      {state === "declining" && <Working>Telling Mike you declined…</Working>}
      <div ref={target} className={s.paypalButtons} hidden={busy} aria-label={`Pay ${amount} with PayPal`} />
      {state === "error" && (
        <p className={s.error} role="alert">
          PayPal couldn’t take the payment, so nothing was charged. Try again, or use PayPal’s page below.
        </p>
      )}
      {approvalUrl && !busy && (
        <a className={s.fallback} href={approvalUrl}>
          Open PayPal’s page instead
        </a>
      )}

      {state === "confirm" ? (
        <div className={s.confirm} role="group" aria-labelledby="decline-q">
          <p id="decline-q" className={s.confirmTitle}>
            Decline the {amount} of extra work?
          </p>
          <p className={s.confirmText}>Nothing is charged. Mike carries on with the original job, within your {formatUsd(holdCents)} hold.</p>
          <div className={s.confirmActions}>
            <button type="button" className={s.btnQuiet} onClick={() => setState("idle")}>
              Go back
            </button>
            <button type="button" className={s.btnDecline} onClick={() => void decide("decline")}>
              Yes, decline
            </button>
          </div>
        </div>
      ) : (
        !busy && (
          <button type="button" className={s.btnSecondary} onClick={() => setState("confirm")}>
            Decline the extra work
          </button>
        )
      )}
      {state === "declineError" && (
        <p className={s.error} role="alert">
          That didn’t go through. Check your connection and try again.
        </p>
      )}
    </div>
  );
}
