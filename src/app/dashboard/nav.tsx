"use client";

import { BookOpen, BriefcaseBusiness, CalendarDays, Phone, Table2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import s from "./shell.module.css";

const ITEMS = [
  { href: "/dashboard", label: "Today", icon: CalendarDays, exact: true },
  { href: "/dashboard/calls", label: "Calls", icon: Phone },
  { href: "/dashboard/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/dashboard/books", label: "Books", icon: Table2, desktopOnly: true },
  { href: "/dashboard/price-book", label: "Price book", icon: BookOpen },
];

/** Bottom tabs on a phone, the sidebar list on a desk. Books (AG Studio) is a desk view only. */
export function Nav({ variant }: { variant: "tabs" | "side" }) {
  const path = usePathname();
  return (
    <nav className={variant === "tabs" ? s.tabs : s.sideNav} aria-label="Mike’s dashboard">
      {ITEMS.filter((i) => variant === "side" || !i.desktopOnly).map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} className={active ? s.active : undefined} aria-current={active ? "page" : undefined}>
            <Icon aria-hidden="true" strokeWidth={2} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
