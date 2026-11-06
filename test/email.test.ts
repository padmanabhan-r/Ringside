import { describe, expect, it } from "vitest";
import { changeEmailContent, holdEmailContent, isValidEmail, maskEmail, normaliseEmail, spellEmail } from "../src/lib/email";

describe("caller email", () => {
  it("normalises what speech-to-text hears", () => {
    expect(normaliseEmail("Dana dot Reyes at example dot com")).toBe("dana.reyes@example.com");
    expect(normaliseEmail("  mike_k  at  bay-city dot net ")).toBe("mike_k@bay-city.net");
  });

  it("accepts real addresses and rejects garbled ones", () => {
    expect(isValidEmail("dana.reyes@example.com")).toBe(true);
    expect(isValidEmail("dana@reyes")).toBe(false);
    expect(isValidEmail("dana reyes@example.com")).toBe(false);
    expect(isValidEmail("@example.com")).toBe(false);
  });

  it("spells the address letter by letter, saying common providers as words", () => {
    expect(spellEmail("ringside.demo@gmail.com")).toBe("r, i, n, g, s, i, d, e, dot, d, e, m, o, at, gmail, dot, com");
    expect(spellEmail("mk7@saginawplumb.io")).toBe("m, k, 7, at, s, a, g, i, n, a, w, p, l, u, m, b, dot, io");
  });

  it("masks the address for logs", () => {
    expect(maskEmail("dana.reyes@example.com")).toBe("d***@example.com");
  });

  it("builds the email with the hold amount and the approval link", () => {
    const { subject, text, html } = holdEmailContent({
      to: "dana@example.com",
      jobCode: "MP-7153",
      problem: "Dripping kitchen tap",
      holdCents: 25000,
      rangeText: "$125.00 to $250.00",
      link: "https://ringside-4bup.onrender.com/j/MP-7153",
    });
    expect(subject).toContain("$250.00");
    expect(text).toContain("https://ringside-4bup.onrender.com/j/MP-7153");
    expect(html).toContain("Approve with PayPal");
    expect(html).not.toContain("<script");
  });
});

describe("spelled-out addresses", () => {
  it("joins letters a transcriber wrote with dashes, and keeps real hyphens (2026-11-05 call)", () => {
    expect(normaliseEmail("M-I-K-E-7-7@example.com")).toBe("mike77@example.com");
    expect(normaliseEmail("j-a-n-e.doe@example.com")).toBe("jane.doe@example.com");
    expect(normaliseEmail("mary-jane@example.com")).toBe("mary-jane@example.com");
    expect(normaliseEmail("a-b@example.com")).toBe("a-b@example.com");
  });
});

describe("job codes and extra-work emails (owner, 2026-11-06)", () => {
  it("puts the job code first in the booking email's subject", () => {
    const { subject } = holdEmailContent({ to: "dana@example.com", jobCode: "MP-5404", problem: "Dripping tap", holdCents: 25000, rangeText: "$125.00 to $250.00", link: "https://x/j/MP-5404" });
    expect(subject.startsWith("MP-5404: ")).toBe(true);
  });

  it("tells the customer what Mike added, what it costs and that the hold is unchanged", () => {
    const { subject, text, html } = changeEmailContent({
      to: "dana@example.com",
      jobCode: "MP-5404",
      changeOrderId: "co-1",
      problem: "Dripping tap",
      deltaCents: 11925,
      holdCents: 25000,
      lines: [
        { name: "Shut-off valve", qty: 1, unitPriceCents: 4800 },
        { name: "Labour (15 min)", qty: 3, unitPriceCents: 2375 },
      ],
      link: "https://x/j/MP-5404",
    });
    expect(subject).toBe("MP-5404: Mike found more work, $119.25 to approve");
    expect(text).toContain("Shut-off valve: $48.00");
    expect(text).toContain("Labour (15 min) × 3: $71.25");
    expect(text).toContain("Your $250.00 hold for the repair stays as it is");
    expect(text).toContain("https://x/j/MP-5404");
    expect(html).toContain("Approve or decline");
    expect(html).not.toContain("<script");
  });
});
