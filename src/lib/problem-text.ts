/**
 * A job's title from what the caller said. The agent writes the problem as a note ("dripping tap; standard plumbing
 * service visit fallback, credited toward repair."), so the title keeps the first clause, capitalised and short:
 * "Dripping tap". "Estimate visit: outside water leak; caller says…" becomes "Estimate visit: Outside water leak".
 */
export function tidyProblem(text: string | null | undefined, fallback = "Plumbing job"): string {
  let t = (text ?? "").split(/[;\n]/)[0]!.replace(/\s+/g, " ").trim().replace(/[.,:]+$/, "");
  if (!t) return fallback;
  const prefix = /^estimate visit:\s*/i.exec(t)?.[0];
  if (prefix) {
    const rest = t.slice(prefix.length);
    t = rest ? `Estimate visit: ${rest[0]!.toUpperCase()}${rest.slice(1)}` : "Estimate visit";
  }
  if (t.length > 60) t = `${t.slice(0, 58).replace(/\s+\S*$/, "")}…`;
  return t[0]!.toUpperCase() + t.slice(1);
}
