"use client";

import { Bell, BellRing, Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import s from "./shell.module.css";

type Status = "hidden" | "ios-install" | "off" | "on" | "denied";
type Card = "ios" | "denied" | "on" | "error" | null;

const SCOPE = "/dashboard";

function iosInBrowser(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone) return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const current = sub.options.applicationServerKey;
  if (!current) return true;
  const bytes = new Uint8Array(current);
  return bytes.length === key.length && bytes.every((b, i) => b === key[i]);
}

async function postSubscription(sub: PushSubscription): Promise<void> {
  const res = await fetch("/api/dashboard/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn’t turn on notifications. Try again.");
}

/**
 * Notifications on Mike's phone (owner, 2026-11-05): asks for permission only when tapped, subscribes through the
 * dashboard's service worker, and hands the subscription to the server. On an iPhone or iPad, web push only works in
 * the home-screen app, so in Safari it explains that instead. Renders nothing where push can't work or isn't set up.
 */
export function NotifyToggle({ placement }: { placement: "top" | "side" }) {
  const [status, setStatus] = useState<Status>("hidden");
  const [key, setKey] = useState<string | null>(null);
  const [card, setCard] = useState<Card>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ios = iosInBrowser();
      if (!ios && !pushSupported()) return;
      const res = await fetch("/api/dashboard/push/key").catch(() => null);
      const serverKey = res?.ok ? ((await res.json()) as { key: string | null }).key : null;
      if (cancelled || !serverKey) return;
      if (ios) {
        setStatus("ios-install");
        return;
      }
      setKey(serverKey);
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const sub = await (await navigator.serviceWorker.getRegistration(SCOPE))?.pushManager.getSubscription();
      if (cancelled) return;
      if (sub && Notification.permission === "granted" && sameKey(sub, keyBytes(serverKey))) {
        setStatus("on");
        postSubscription(sub).catch(() => {}); // keeps the server's copy tied to this demo session
      } else {
        setStatus("off");
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (card !== "on") return;
    const t = setTimeout(() => setCard((c) => (c === "on" ? null : c)), 6000);
    return () => clearTimeout(t);
  }, [card]);

  if (status === "hidden") return null;

  const turnOn = async () => {
    if (!key) return;
    setBusy(true);
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        if (permission === "denied") setCard("denied");
        return;
      }
      await navigator.serviceWorker.register("/sw.js", { scope: SCOPE });
      const reg = await navigator.serviceWorker.ready;
      const bytes = keyBytes(key);
      let sub = await reg.pushManager.getSubscription();
      if (sub && !sameKey(sub, bytes)) {
        await sub.unsubscribe();
        sub = null;
      }
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      await postSubscription(sub);
      setStatus("on");
      setCard("on");
    } catch (e) {
      setError(e instanceof Error && e.message.startsWith("Couldn’t") ? e.message : "Couldn’t turn on notifications. Try again.");
      setCard("error");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    try {
      const sub = await (await navigator.serviceWorker.getRegistration(SCOPE))?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/dashboard/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
        await sub.unsubscribe();
      }
      setStatus("off");
      setCard(null);
    } finally {
      setBusy(false);
    }
  };

  const onTap = () => {
    if (status === "ios-install") setCard(card === "ios" ? null : "ios");
    else if (status === "denied") setCard(card === "denied" ? null : "denied");
    else if (status === "on") {
      if (placement === "side") void turnOff();
      else setCard(card === "on" ? null : "on");
    } else void turnOn();
  };

  const on = status === "on";
  const label = on ? "Notifications on" : status === "ios-install" ? "Get notifications" : "Turn on notifications";
  const Icon = on ? BellRing : Bell;

  const cardBody =
    card === "ios" ? (
      <>
        <p className={s.iosTitle}>Notifications come through the home-screen app</p>
        <ol className={s.iosSteps}>
          <li>
            Tap <Share aria-label="Share" className={s.iosIcon} /> Share in Safari’s toolbar, then <b>Add to Home Screen</b>.
          </li>
          <li>Open Mike’s app from your home screen and tap the bell.</li>
        </ol>
      </>
    ) : card === "denied" ? (
      <>
        <p className={s.iosTitle}>Notifications are blocked</p>
        <p className={s.notifyText}>Allow notifications for this site in your browser’s settings, then tap the bell again.</p>
      </>
    ) : card === "error" ? (
      <>
        <p className={s.iosTitle}>Notifications aren’t on</p>
        <p className={s.notifyText}>{error}</p>
      </>
    ) : card === "on" ? (
      <>
        <p className={s.iosTitle}>Notifications are on</p>
        <p className={s.notifyText}>This phone buzzes when a customer approves a hold or pays for extra work.</p>
        <button type="button" className={s.notifyOff} onClick={turnOff} disabled={busy}>
          Turn off
        </button>
      </>
    ) : null;

  if (placement === "side") {
    if (status === "ios-install") return <span className={s.notifyNote}>Add the app to your home screen to get notifications.</span>;
    return (
      <div className={s.notifySideWrap}>
        <button type="button" className={s.notifySide} onClick={onTap} aria-pressed={on} disabled={busy} title={on ? "Tap to turn off" : undefined}>
          <Icon aria-hidden="true" /> {busy ? "One moment…" : label}
        </button>
        {status === "denied" ? <span className={s.notifyNote}>Blocked: allow notifications for this site in your browser’s settings.</span> : null}
        {card === "error" ? (
          <span className={s.notifyNote} role="alert">
            {error}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <button type="button" className={s.notifyTop} onClick={onTap} aria-label={label} data-on={on ? "" : undefined} aria-expanded={card !== null} disabled={busy}>
        <Icon aria-hidden="true" />
      </button>
      {cardBody ? (
        <div className={s.iosHint} role="dialog" aria-label={label}>
          <button type="button" className={s.iosClose} onClick={() => setCard(null)} aria-label="Close">
            <X aria-hidden="true" />
          </button>
          {cardBody}
        </div>
      ) : null}
    </>
  );
}
