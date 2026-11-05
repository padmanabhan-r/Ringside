import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import type { ReactNode } from "react";
import { Avatar, MikesWordmark, PoweredByRingside, SandboxTag } from "@/components/brand";
import { Nav } from "./nav";
import { InstallApp } from "./install-app";
import s from "./shell.module.css";

export const metadata: Metadata = {
  title: { default: "Mike’s Plumbing", template: "%s · Mike’s Plumbing" },
  description: "Mike’s jobs, holds and payments, run by Ringside. A PayPal sandbox prototype; the business is fictional.",
  appleWebApp: { capable: true, title: "Mike’s Plumbing", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#0b3a8a", viewportFit: "cover" };

/** The dashboard's address for the desk QR code: the live site in production, this server locally. */
async function dashboardUrl(): Promise<string> {
  if (process.env.NODE_ENV === "production" && process.env.APP_BASE_URL) return `${process.env.APP_BASE_URL}/dashboard`;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}/dashboard`;
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const qrSvg = await QRCode.toString(await dashboardUrl(), { type: "svg", margin: 1, color: { dark: "#0b3a8a", light: "#ffffff" } });
  return (
    <div className={`fs ${s.shell}`}>
      <aside className={s.side}>
        <MikesWordmark size={52} href="/dashboard" />
        <Nav variant="side" />
        <div className={s.sideFoot}>
          <SandboxTag />
          <InstallApp placement="side" qrSvg={qrSvg} />
          <PoweredByRingside />
        </div>
      </aside>
      <header className={s.top}>
        <MikesWordmark size={40} href="/dashboard" />
        <div className={s.topEnd}>
          <InstallApp placement="top" />
          <Avatar />
        </div>
      </header>
      <div className={s.main}>
        <div className={s.deskBar}>
          <SandboxTag />
          <span className={s.deskUser}>
            <Avatar /> Mike
          </span>
        </div>
        {children}
        <p className={s.demoNote}>
          Demo: in real use only Mike signs in here. Payments run on the PayPal sandbox; the business is fictional.
        </p>
      </div>
      <Nav variant="tabs" />
    </div>
  );
}
