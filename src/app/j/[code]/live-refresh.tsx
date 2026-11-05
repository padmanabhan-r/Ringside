"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * While the customer waits on Mike (extra work to approve, or the job to finish), re-reads the job every few seconds so
 * a change order appears without a reload. Pauses while the tab is hidden.
 */
export function LiveRefresh({ everyMs = 5000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, everyMs]);
  return null;
}
