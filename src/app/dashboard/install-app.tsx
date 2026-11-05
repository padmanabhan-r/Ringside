"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import s from "./shell.module.css";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function subscribeNever() {
  return () => {};
}

function platform(): "standalone" | "ios" | "other" {
  if (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone) return "standalone";
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return iOS ? "ios" : "other";
}

/**
 * Easy install (owner, 2026-11-05): a one-tap button where the browser offers installation (Android, desktop
 * Chrome/Edge), a two-step Share → Add to Home Screen hint on iPhone (Safari has no install API), and on a desk a QR
 * code to put the app on a phone. Hidden once the app runs installed.
 */
export function InstallApp({ placement, qrSvg }: { placement: "top" | "side"; qrSvg?: string }) {
  const kind = useSyncExternalStore(subscribeNever, platform, () => "other" as const);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/dashboard" }).catch(() => {});
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (kind === "standalone") return null;

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice.catch(() => undefined);
    setPrompt(null);
  };

  if (placement === "side") {
    return (
      <div className={s.installSide}>
        {qrSvg ? (
          <>
            <span className={s.qr} dangerouslySetInnerHTML={{ __html: qrSvg }} aria-hidden="true" />
            <span className={s.installText}>Scan to put Mike’s app on your phone</span>
          </>
        ) : null}
        {prompt ? (
          <button type="button" className={s.installSideButton} onClick={install}>
            <Download aria-hidden="true" /> Install on this computer
          </button>
        ) : null}
      </div>
    );
  }

  if (prompt) {
    return (
      <button type="button" className={s.installTop} onClick={install}>
        <Download aria-hidden="true" /> Install
      </button>
    );
  }
  if (kind !== "ios") return null;
  return (
    <>
      <button type="button" className={s.installTop} onClick={() => setHint(true)} aria-expanded={hint}>
        <Download aria-hidden="true" /> Install
      </button>
      {hint ? (
        <div className={s.iosHint} role="dialog" aria-label="Install Mike’s app">
          <button type="button" className={s.iosClose} onClick={() => setHint(false)} aria-label="Close">
            <X aria-hidden="true" />
          </button>
          <p className={s.iosTitle}>Put Mike’s app on your home screen</p>
          <ol className={s.iosSteps}>
            <li>
              Tap <Share aria-label="Share" className={s.iosIcon} /> Share in Safari’s toolbar.
            </li>
            <li>
              Choose <b>Add to Home Screen</b>.
            </li>
          </ol>
        </div>
      ) : null}
    </>
  );
}
