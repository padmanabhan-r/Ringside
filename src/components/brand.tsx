import { Check, Clock, MinusCircle, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, type ReactNode } from "react";
import s from "./brand.module.css";

/**
 * Mike's Plumbing mark: a solid disc with a tap and a falling drop cut out of it (finish review: the thin outline read
 * as a refresh arrow). Draws in currentColor: a white disc with the background showing through on the blue header, a
 * blue disc on white pages.
 */
export function BrandMark({ size = 44, title }: { size?: number; title?: string }) {
  const id = useId();
  return (
    <svg className={s.mark} width={size} height={size} viewBox="0 0 64 64" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <mask id={id}>
        <rect width="64" height="64" fill="#fff" />
        <path d="M27 15.5h10" stroke="#000" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M32 15.5v6" stroke="#000" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M15 33v-5a7 7 0 0 1 7-7h19a9 9 0 0 1 9 9v4h-8v-3a2.5 2.5 0 0 0-2.5-2.5H23v4.5z" fill="#000" />
        <path d="M46 40.5c-2.6 3.6-3.9 6-3.9 7.7a3.9 3.9 0 0 0 7.8 0c0-1.7-1.3-4.1-3.9-7.7z" fill="#000" />
      </mask>
      <circle cx="32" cy="32" r="30" fill="currentColor" mask={`url(#${id})`} />
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

/** Mike is fictional: his avatar is an AI-generated face of a fictional plumber (owner, 2026-11-05). */
export function Avatar({ label = "Mike (fictional)", size = 40 }: { label?: string; size?: number }) {
  return <Image className={s.avatar} src="/people/mike.jpg" alt={label} width={size} height={size} style={{ width: size, height: size }} />;
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
    <Link className={s.powered} href="/" title="Ringside: call-to-cash for plumbers, electricians, HVAC techs, carpenters and other small service businesses">
      Powered by <b>RINGSIDE</b>
    </Link>
  );
}
