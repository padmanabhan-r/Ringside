import { describe, expect, it } from "vitest";
import { formatJobPush, isPushEndpoint, parseSubscription, type PushJob } from "@/lib/push";

// 10:00 on Nov 5, 2026 in Detroit (EST, UTC-5).
const NOW = new Date("2026-11-05T15:00:00Z");

const job: PushJob = {
  id: "00000000-0000-4000-8000-000000000001",
  demo_session_id: "00000000-0000-4000-8000-000000000002",
  job_code: "MP-4127",
  customer_name: "Dana Whitfield",
  problem: "Dripping kitchen tap",
  slot_start: new Date("2026-11-05T15:00:00Z"),
  slot_end: new Date("2026-11-05T17:00:00Z"),
};

describe("formatJobPush", () => {
  it("says who approved what hold, for which job and window", () => {
    expect(formatJobPush(job, { kind: "hold_approved", amountCents: 25000 }, NOW)).toEqual({
      title: "New booking: hold approved",
      body: "Dana approved the $250.00 hold · Dripping kitchen tap, today 10 am – 12 pm",
      url: "/dashboard/jobs/MP-4127",
      tag: "job-MP-4127",
    });
  });

  it("names the day for a window that isn't today", () => {
    const later = { ...job, slot_start: new Date("2026-11-06T19:00:00Z"), slot_end: new Date("2026-11-06T21:00:00Z") };
    expect(formatJobPush(later, { kind: "hold_approved", amountCents: 25000 }, NOW).body).toBe(
      "Dana approved the $250.00 hold · Dripping kitchen tap, Fri, Nov 6, 2 pm – 4 pm",
    );
  });

  it("falls back when the name, problem or window is missing", () => {
    const bare = { ...job, customer_name: null, problem: null, slot_start: null, slot_end: null };
    expect(formatJobPush(bare, { kind: "hold_approved", amountCents: 9900 }, NOW).body).toBe("The customer approved the $99.00 hold · Plumbing job");
  });

  it("reports paid and declined extra work", () => {
    expect(formatJobPush(job, { kind: "change_paid", amountCents: 8500 }, NOW)).toMatchObject({
      title: "Extra work approved and paid",
      body: "Dana approved and paid $85.00 extra · Dripping kitchen tap, today 10 am – 12 pm",
    });
    expect(formatJobPush(job, { kind: "change_declined", amountCents: 8500 }, NOW)).toMatchObject({
      title: "Extra work declined",
      body: "Dana declined the $85.00 extra · nothing charged, the job carries on at the original hold",
    });
  });

  it("announces a new quote from a call", () => {
    const quoted = { ...job, slot_start: null, slot_end: null };
    expect(formatJobPush(quoted, { kind: "new_quote", holdCents: 25000 }, NOW)).toMatchObject({
      title: "New call: quote sent",
      body: "Dana · Dripping kitchen tap · hold of up to $250.00 on its way",
      url: "/dashboard/jobs/MP-4127",
    });
  });
});

describe("subscription checks", () => {
  const keys = { p256dh: "B".repeat(87), auth: "a".repeat(22) };

  it("accepts the browsers' push services only", () => {
    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc:def")).toBe(true);
    expect(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/QOn3")).toBe(true);
    expect(isPushEndpoint("https://wns2-db5p.notify.windows.com/w/?token=x")).toBe(true);
    expect(isPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isPushEndpoint("https://evilfcm.googleapis.com.example.com/x")).toBe(false);
    expect(isPushEndpoint("https://169.254.169.254/latest")).toBe(false);
    expect(isPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
  });

  it("parses a browser's PushSubscription JSON and rejects malformed keys", () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/abc";
    expect(parseSubscription({ endpoint, expirationTime: null, keys })).toEqual({ endpoint, ...keys });
    expect(parseSubscription({ endpoint, keys: { ...keys, auth: "not base64!" } })).toBeUndefined();
    expect(parseSubscription({ endpoint: "https://example.com/push", keys })).toBeUndefined();
    expect(parseSubscription(null)).toBeUndefined();
  });
});
