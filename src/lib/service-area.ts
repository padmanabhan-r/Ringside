// Mike's Plumbing serves the Saginaw Tri-Cities, Michigan. Outside it: no booking and no payment.

export const SERVICE_AREA_NAME = "the Saginaw Tri-Cities: Saginaw, Bay City and Midland, Michigan";

const ZIPS = new Set(["48601", "48602", "48603", "48604", "48605", "48606", "48607", "48608", "48609", "48706", "48708", "48640", "48642"]);
const CITIES = new Set(["saginaw", "bay city", "midland"]);

export type AreaAnswer = "inside" | "outside" | "unknown";

/** Checks a ZIP code first, then a city name; anything else is unknown, so the agent asks for the ZIP. */
export function checkServiceArea(input: { zip?: string; city?: string }): AreaAnswer {
  const zip = input.zip?.match(/\b\d{5}\b/)?.[0];
  if (zip) return ZIPS.has(zip) ? "inside" : "outside";
  const city = input.city?.toLowerCase().replace(/,?\s*(mi|michigan)\.?$/, "").trim();
  if (city) return CITIES.has(city) ? "inside" : "outside";
  return "unknown";
}
