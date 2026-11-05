// "No mic? Watch a recorded call": a scripted run of the browser call, played back with its timings. It is labelled
// as a recording everywhere it shows, and its booking card has no live PayPal link.
import type { CallJobView } from "./types";

export interface Line {
  id: string;
  role: "agent" | "user";
  text: string;
  /** Seconds into the call. */
  at: number;
}

/** Recorded seconds pass this much faster on playback, so the whole call plays in under a minute. */
export const REPLAY_SPEED = 1.6;

export const REPLAY_LINES: readonly Line[] = [
  { id: "r1", role: "agent", at: 1, text: "Hi, you have reached Mike’s Plumbing. I’m an AI assistant answering for Mike, and this call may be recorded and shared with our service providers. What’s going on with your plumbing today?" },
  { id: "r2", role: "user", at: 11, text: "My kitchen tap won’t stop dripping." },
  { id: "r3", role: "agent", at: 14, text: "Sorry to hear that. What’s your ZIP code?" },
  { id: "r4", role: "user", at: 18, text: "48602." },
  { id: "r5", role: "agent", at: 21, text: "Good, that’s in Mike’s area. Can I get your first name and street address?" },
  { id: "r6", role: "user", at: 26, text: "Dana, 42 Elm Street." },
  { id: "r7", role: "agent", at: 31, text: "Thanks, Dana. A faucet leak repair runs $125 to $250. PayPal will hold up to $250; nothing is charged now, and Mike charges only the real cost when the job is done. Want me to book it?" },
  { id: "r8", role: "user", at: 44, text: "Yes, please." },
  { id: "r9", role: "agent", at: 47, text: "I have today 10 am to 12 pm, or 2 to 4 pm. Which works better?" },
  { id: "r10", role: "user", at: 53, text: "Ten to twelve." },
  { id: "r11", role: "agent", at: 57, text: "You’re booked for today, 10 am to 12 pm. Your PayPal link is on your screen now, and your job code is M P, 4 1 2 7." },
  { id: "r12", role: "user", at: 67, text: "Got it, thanks." },
  { id: "r13", role: "agent", at: 70, text: "Approving it places a hold: nothing is charged now, and Mike charges only the real cost after the job, never more than the hold. Thanks for calling Mike’s Plumbing!" },
];

export const REPLAY_END = 80;

const FINAL: CallJobView = {
  code: "MP-4127",
  title: "Faucet leak repair",
  range: "$125–$250",
  zip: "48602",
  city: "Saginaw",
  window: "Today, 10 am – 12 pm",
  holdText: "$250.00",
  hold: "awaiting",
  link: null,
  estimate: false,
};

/** The booking card as it stood at a moment of the recording: ZIP, then the quote, then the window and the hold. */
export function replayJob(seconds: number): CallJobView | null {
  if (seconds < 21) return null;
  const zipOnly = { ...FINAL, title: "", range: null, window: null, holdText: null, hold: "none" as const };
  if (seconds < 31) return zipOnly;
  if (seconds < 57) return { ...zipOnly, title: FINAL.title, range: FINAL.range };
  return FINAL;
}
