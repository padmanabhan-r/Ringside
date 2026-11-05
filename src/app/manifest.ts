import type { MetadataRoute } from "next";

/** Mike's dashboard installs as "Mike's Plumbing" and opens full screen on Today (owner, 2026-11-05: an easy-to-install PWA). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "Mike’s Plumbing",
    short_name: "Mike’s",
    description: "Mike’s jobs, holds and payments, run by Ringside. A PayPal sandbox prototype; the business is fictional.",
    start_url: "/dashboard",
    scope: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2f5f9",
    theme_color: "#0b3a8a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
