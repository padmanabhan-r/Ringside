import { Check, Clock, MinusCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import s from "./brand.module.css";

/** Mike's Plumbing mark: a tap and a falling drop inside an open ring. Draws in currentColor. */
export function BrandMark({ size = 44, title }: { size?: number; title?: string }) {
  return (
    <svg className={s.mark} width={size} height={size} viewBox="0 0 64 64" fill="none" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <path d="M52.5 17.5A26 26 0 1 0 54 44" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M26 15h12M32 15v6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M17 31v-4a6 6 0 0 1 6-6h18a8 8 0 0 1 8 8v4h-7v-3a2 2 0 0 0-2-2H23v3z" fill="currentColor" />
      <path d="M45.5 40c-2.4 3.4-3.6 5.6-3.6 7.2a3.6 3.6 0 0 0 7.2 0c0-1.6-1.2-3.8-3.6-7.2z" fill="currentColor" />
    </svg>
  );
}

export function MikesWordmark({ size = 44, href }: { size?: number; href?: string }) {
  const body = (
    <>
      <BrandMark size={size} />
      <span className={s.wordmarkText} style={{ fontSize: Math.round(size * 0.42) }}>
        <span className={s.wordmarkName}>Mike’s Plumbing</span>
        <span className={s.wordmarkPlace}>Saginaw, Michigan</span>
      </span>
    </>
  );
  return href ? (
    <Link className={s.wordmark} href={href} aria-label="Mike’s Plumbing, Saginaw, Michigan">
      {body}
    </Link>
  ) : (
    <span className={s.wordmark}>{body}</span>
  );
}

/** Mike is fictional, so his avatar is his initial, never a photo. */
export function Avatar({ initial = "M", label = "Mike" }: { initial?: string; label?: string }) {
  return (
    <span className={s.avatar} role="img" aria-label={label}>
      {initial}
    </span>
  );
}

export type Tone = "ok" | "wait" | "none" | "info";
const ICONS: Record<Tone, LucideIcon | null> = { ok: Check, wait: Clock, none: MinusCircle, info: null };

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const Icon = ICONS[tone];
  return (
    <span className={`${s.pill} ${s[tone]}`}>
      {Icon ? <Icon aria-hidden="true" strokeWidth={2.4} /> : null}
      {children}
    </span>
  );
}

export function SandboxTag() {
  return (
    <span className={s.sandbox} title="Payments run on the PayPal sandbox; no real money moves">
      PayPal <span>SANDBOX</span>
    </span>
  );
}

export function PoweredByRingside() {
  return (
    <Link className={s.powered} href="/" title="Ringside: the AI front desk for small service businesses">
      Powered by <b>RINGSIDE</b>
    </Link>
  );
}
