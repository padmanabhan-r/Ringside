"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { CalendarCheck, Mic, MicOff, Phone, PhoneOff, RotateCcw, SkipForward, Sparkles, Square, FileText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookForm } from "./book-form";
import { BookingCard } from "./booking-card";
import { REPLAY_END, REPLAY_LINES, REPLAY_SPEED, replayJob, type Line } from "./replay";
import type { CallJobView, CallView } from "./types";
import s from "./call.module.css";
import { BUSINESS_LINE } from "@/lib/business";

type Phase = "idle" | "starting" | "connected" | "ended" | "replaying" | "replayed";

/** 72 → "1:12". */
export function clock(seconds: number): string {
  const sec = Math.max(0, Math.floor(seconds));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** Seconds since a Date.now() stamp; 0 before it is set. */
function secondsSince(stamp: number): number {
  return stamp ? (Date.now() - stamp) / 1000 : 0;
}

/** Transcript text without expressive audio tags such as "[friendly]" (the SDK strips them too). */
function cleanText(text: string): string {
  return text.replace(/\[[a-z][a-z ]{0,30}\]\s*/gi, "").trim();
}

function friendlyError(message: string): string {
  if (/permission|notallowed|denied|microphone|getusermedia|device/i.test(message)) {
    return "Your browser blocked the microphone. Allow it from the address bar and try again, or watch the recorded call.";
  }
  if (/limit|concurren|quota|busy|capacity/i.test(message)) {
    return "Mike’s line is busy right now: the demo takes two calls at a time. Try again in a minute, or watch the recorded call.";
  }
  return "The call couldn’t connect. Try again in a moment, or watch the recorded call.";
}

/** The browser call. The microphone stays muted until the conversation is registered to this visit. */
export function CallScreen() {
  const [registered, setRegistered] = useState(false);
  const [userMuted, setUserMuted] = useState(false);
  return (
    <ConversationProvider isMuted={!registered || userMuted}>
      <Call registered={registered} setRegistered={setRegistered} userMuted={userMuted} setUserMuted={setUserMuted} />
    </ConversationProvider>
  );
}

const BARS = 16;

function Call({
  registered,
  setRegistered,
  userMuted,
  setUserMuted,
}: {
  registered: boolean;
  setRegistered: (v: boolean) => void;
  userMuted: boolean;
  setUserMuted: (v: boolean) => void;
}) {
  const conv = useConversation();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [job, setJob] = useState<CallJobView | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [pollTick, setPollTick] = useState(0);
  // "No mic? Book without calling": the booking form in place of the transcript.
  const [booking, setBooking] = useState(false);
  const startedAt = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const convRef = useRef(conv);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    convRef.current = conv;
  });
  const go = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  // ---- live call --------------------------------------------------------------------------------------------
  const start = useCallback(async () => {
    go("starting");
    setBooking(false);
    setError(null);
    setLines([]);
    setJob(null);
    setConversationId(null);
    setRegistered(false);
    setUserMuted(false);
    setElapsed(0);
    startedAt.current = 0;
    let token: string;
    try {
      const res = await fetch("/api/call/session", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!res.ok || !body.token) throw new Error(body.error ?? "The call couldn’t connect. Try again in a moment, or watch the recorded call.");
      token = body.token;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      go("idle");
      return;
    }
    convRef.current.startSession({
      conversationToken: token,
      connectionType: "webrtc",
      stripAudioTags: true,
      onConnect: ({ conversationId: id }) => {
        startedAt.current = Date.now();
        setConversationId(id);
        go("connected");
        void fetch("/api/call/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId: id }) })
          .then(async (res) => {
            if (res.ok) return setRegistered(true);
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(body.error ?? "We couldn’t connect your call to this page.");
          })
          .catch((e: unknown) => {
            setError(`${e instanceof Error ? e.message : String(e)} Please try again.`);
            convRef.current.endSession();
          });
      },
      onMessage: ({ message, role, event_id }) => {
        const text = cleanText(message);
        // Silence comes through as "..." from speech recognition: not a line worth showing.
        if (!/[\p{L}\p{N}]/u.test(text)) return;
        setLines((prev) => [...prev, { id: `${role}-${event_id}-${prev.length}`, role, text, at: secondsSince(startedAt.current) }]);
      },
      onAgentResponseCorrection: (c) => {
        setLines((prev) => {
          const i = prev.findLastIndex((l) => l.role === "agent" && l.text === cleanText(c.original_agent_response));
          if (i < 0) return prev;
          const next = prev.slice();
          next[i] = { ...prev[i]!, text: cleanText(c.corrected_agent_response) };
          return next;
        });
      },
      onAgentToolResponse: () => setPollTick((n) => n + 1),
      onError: (message) => {
        if (phaseRef.current === "starting") setError(friendlyError(message));
      },
      onDisconnect: (details) => {
        const was = phaseRef.current;
        if (details.reason === "error" && was !== "connected") setError(friendlyError(details.message));
        if (was === "connected") {
          setElapsed(secondsSince(startedAt.current));
          go("ended");
        } else if (was === "starting") {
          go("idle");
        }
      },
    });
  }, [go, setRegistered, setUserMuted]);

  const end = useCallback(() => convRef.current.endSession(), []);

  // A failed start (mic refused before connecting) leaves the SDK disconnected without a disconnect event.
  useEffect(() => {
    if (phase !== "starting") return;
    const t = setTimeout(() => {
      if (phaseRef.current === "starting" && convRef.current.status === "disconnected") {
        setError((e) => e ?? friendlyError("connect"));
        go("idle");
      }
    }, 20_000);
    return () => clearTimeout(t);
  }, [phase, go]);

  // Elapsed clock while connected.
  useEffect(() => {
    if (phase !== "connected") return;
    const t = setInterval(() => setElapsed(secondsSince(startedAt.current)), 500);
    return () => clearInterval(t);
  }, [phase]);

  // Voice level for the meter and the mic halo: the caller's voice while listening, the assistant's while speaking.
  useEffect(() => {
    if (phase !== "connected") return;
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 80) return;
      last = now;
      const c = convRef.current;
      try {
        const v = c.isSpeaking ? c.getOutputVolume() : c.getInputVolume();
        setLevel(Math.min(1, Math.max(0, v * 1.6)));
      } catch {
        setLevel(0);
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      setLevel(0);
    };
  }, [phase]);

  // The booking card: poll the job this conversation created. Every 2 s on the call (and straight after each tool
  // result), then every 5 s for 15 minutes so the card turns green when the hold is approved in the other tab.
  const holdApproved = job?.hold === "approved";
  useEffect(() => {
    if (!conversationId || !registered) return;
    if (phase !== "connected" && phase !== "ended") return;
    if (phase === "ended" && holdApproved) return;
    let stopped = false;
    const until = Date.now() + 15 * 60_000;
    const load = async () => {
      try {
        const res = await fetch(`/api/call/${conversationId}`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const view = (await res.json()) as CallView;
        if (!stopped && view.job) setJob(view.job);
      } catch {
        // The next tick tries again.
      }
    };
    void load();
    const t = setInterval(() => {
      if (Date.now() > until) return clearInterval(t);
      void load();
    }, phase === "connected" ? 2000 : 5000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [conversationId, registered, phase, holdApproved, pollTick]);

  // ---- recorded call ----------------------------------------------------------------------------------------
  const replay = useCallback(
    (fromEnd = false) => {
      if (phaseRef.current === "connected" || phaseRef.current === "starting") return;
      setBooking(false);
      setError(null);
      setConversationId(null);
      startedAt.current = Date.now() - (fromEnd ? (REPLAY_END / REPLAY_SPEED) * 1000 : 0);
      setLines([]);
      setJob(null);
      setElapsed(0);
      go("replaying");
    },
    [go],
  );

  useEffect(() => {
    if (phase !== "replaying") return;
    const tick = () => {
      const t = secondsSince(startedAt.current) * REPLAY_SPEED;
      const shown = REPLAY_LINES.filter((l) => l.at <= t);
      setLines((prev) => (prev.length === shown.length ? prev : shown.slice()));
      setJob(replayJob(t));
      setElapsed(Math.min(t, REPLAY_END));
      if (t >= REPLAY_END) go("replayed");
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [phase, go]);

  // ?replay opens the recorded call straight away (and ?replay=end at its last frame), ?book the booking form: for links
  // from the landing.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("replay");
    const book = params.has("book");
    if (p === null && !book) return;
    const t = setTimeout(() => (book ? setBooking(true) : replay(p === "end")), 0);
    return () => clearTimeout(t);
  }, [replay]);

  const openBooking = useCallback(() => {
    if (phaseRef.current === "replaying") go("idle");
    setError(null);
    setBooking(true);
  }, [go]);

  // Keep the newest line in view, unless the reader has scrolled up. A jump of several lines (skip to end) always
  // lands on the last one.
  const shownCount = useRef(0);
  useEffect(() => {
    const el = listRef.current;
    const jump = lines.length - shownCount.current > 1;
    shownCount.current = lines.length;
    if (!el) return;
    if (jump || el.scrollHeight - el.scrollTop - el.clientHeight < 200) el.scrollTo({ top: el.scrollHeight, behavior: jump ? "auto" : "smooth" });
  }, [lines.length]);

  const isReplay = phase === "replaying" || phase === "replayed";
  const live = phase === "connected";
  const connecting = phase === "starting" || (live && !registered);
  const muted = userMuted;
  const speaking = live && conv.isSpeaking;
  const lit = Math.round(level * BARS);

  return (
    <>
      <section className={`${s.card} ${s.bar}`} aria-label="Call">
        {isReplay ? (
          <>
            <span className={`${s.disc} ${s.discReplay}`} aria-hidden="true">
              <FileText strokeWidth={2.2} />
            </span>
            <div className={s.status}>
              <p className={s.statusTitle}>
                {phase === "replayed" ? "Replay finished" : "Replaying a past call (transcript only)"}
                <span className={phase === "replayed" ? `${s.recTag} ${s.recDone}` : s.recTag}>{phase === "replayed" ? "Replayed" : "Replay"}</span>
              </p>
              <p className={s.statusNote}>A past test call, played back. Not live: nothing here dials Mike or touches PayPal.</p>
              <div className={s.progress} aria-hidden="true">
                <span style={{ width: `${Math.min(100, (elapsed / REPLAY_END) * 100)}%` }} />
              </div>
            </div>
            <span className={s.divider} aria-hidden="true" />
            <div className={s.actions}>
              {phase === "replaying" ? (
                <div className={s.buttons}>
                  <button type="button" className={s.ghost} onClick={() => replay(true)}>
                    <SkipForward aria-hidden="true" /> Skip to end
                  </button>
                  <button type="button" className={s.ghost} onClick={() => go("idle")}>
                    <Square aria-hidden="true" /> Stop
                  </button>
                </div>
              ) : (
                <>
                  <div className={s.buttons}>
                    <button type="button" className={s.ghost} onClick={() => replay()}>
                      <RotateCcw aria-hidden="true" /> Watch again
                    </button>
                    <button type="button" className={s.primary} onClick={() => void start()}>
                      <Phone aria-hidden="true" /> Start a live call
                    </button>
                  </div>
                  {!booking ? (
                    <button type="button" className={s.bookLink} onClick={openBooking}>
                      <CalendarCheck aria-hidden="true" /> No mic? Book without calling
                    </button>
                  ) : null}
                </>
              )}
            </div>
            <Elapsed seconds={elapsed} label={phase === "replayed" ? "Call length" : "Replay"} />
          </>
        ) : live || phase === "starting" ? (
          <>
            <button
              type="button"
              className={`${s.disc} ${muted ? s.discMuted : ""}`}
              style={{ ["--lvl" as string]: muted || connecting ? 0 : level }}
              onClick={() => setUserMuted(!muted)}
              disabled={connecting}
              aria-pressed={muted}
              aria-label={muted ? "Unmute your microphone" : "Mute your microphone"}
            >
              {muted ? <MicOff strokeWidth={2.2} /> : <Mic strokeWidth={2.2} />}
            </button>
            <div className={s.status} aria-live="polite">
              <p className={s.statusTitle}>{connecting ? "Connecting…" : muted ? "Muted" : speaking ? "Assistant speaking…" : "Listening…"}</p>
              {phase === "starting" ? <p className={s.statusNote}>Allow the microphone when your browser asks.</p> : null}
              <div className={`${s.meter} ${speaking ? s.meterAgent : ""}`} aria-hidden="true">
                {Array.from({ length: BARS }, (_, i) => (
                  <span key={i} className={i < lit && !muted && !connecting ? s.on : undefined} />
                ))}
              </div>
            </div>
            <span className={s.divider} aria-hidden="true" />
            <div className={s.actions}>
              <div className={s.buttons}>
                <button type="button" className={s.end} onClick={end} disabled={phase === "starting"}>
                  <PhoneOff aria-hidden="true" /> End call
                </button>
              </div>
            </div>
            <Elapsed seconds={elapsed} label="Elapsed" />
          </>
        ) : (
          <>
            <span className={`${s.disc} ${phase === "ended" ? s.discEnded : ""}`} aria-hidden="true">
              {phase === "ended" ? <PhoneOff strokeWidth={2.2} /> : <Mic strokeWidth={2.2} />}
            </span>
            <div className={s.status}>
              <p className={s.statusTitle}>{phase === "ended" ? "Call ended" : "Talk to Mike’s assistant"}</p>
              <p className={s.disclosure}>
                You’ll talk to an AI assistant; the call is recorded. It runs on ElevenLabs and its AI model provider.
              </p>
              <p className={s.altPhone}>
                Prefer the phone? Call{" "}
                <a className={s.number} href={BUSINESS_LINE.tel}>
                  {BUSINESS_LINE.display}
                </a>
              </p>
              <button type="button" className={`${s.link} ${s.barReplay}`} onClick={() => replay()}>
                <FileText aria-hidden="true" /> No mic? Read a recorded call.
              </button>
            </div>
            <span className={s.divider} aria-hidden="true" />
            <div className={s.actions}>
              <div className={s.buttons}>
                <button type="button" className={s.primary} onClick={() => void start()}>
                  <Phone aria-hidden="true" /> {phase === "ended" ? "Call again" : "Start the call"}
                </button>
              </div>
              {!booking ? (
                <button type="button" className={s.bookLink} onClick={openBooking}>
                  <CalendarCheck aria-hidden="true" /> No mic? Book without calling
                </button>
              ) : null}
            </div>
            {phase === "ended" ? <Elapsed seconds={elapsed} label="Call length" /> : null}
          </>
        )}
      </section>

      {error ? (
        <p className={s.error} role="alert">
          {error}
        </p>
      ) : null}

      {booking ? <BookForm onClose={() => setBooking(false)} /> : null}

      <div className={s.grid} style={booking ? { display: "none" } : undefined}>
        <section className={`${s.card} ${s.transcript}`} aria-labelledby="transcript-title">
          <h2 id="transcript-title" className={s.cardTitle}>
            {isReplay ? "Recorded transcript" : live ? "Live transcript" : "Transcript"}
          </h2>
          {lines.length ? (
            <ol className={s.lines} ref={listRef}>
              {lines.map((l) => (
                <li key={l.id} className={s.line}>
                  <span className={l.role === "agent" ? s.iconAgent : s.iconCaller} aria-hidden="true">
                    {l.role === "agent" ? <Sparkles strokeWidth={2.2} /> : <Phone strokeWidth={2.2} />}
                  </span>
                  <span className={l.role === "agent" ? s.whoAgent : s.whoCaller}>{l.role === "agent" ? "Assistant:" : "Caller:"}</span>
                  <p className={s.said}>{l.text}</p>
                  <time className={s.at}>{clock(l.at)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <div className={s.empty}>
              <p className={s.emptyLead}>{phase === "starting" || live ? "The assistant is picking up…" : "What you and the assistant say shows up here as you talk."}</p>
              <p className={s.emptyHint}>
                Try: “My kitchen tap won’t stop dripping. I’m in Saginaw, 48602.” The assistant quotes from Mike’s price book,
                asks when suits you, and puts a PayPal hold link on this page.
              </p>
            </div>
          )}
          {!live && phase !== "starting" && !isReplay ? (
            <div className={s.noMic}>
              <button type="button" className={s.link} onClick={() => replay()}>
                <FileText aria-hidden="true" /> No mic? Read a recorded call.
              </button>
            </div>
          ) : null}
        </section>

        <div className={s.side}>
          <BookingCard job={job} recording={isReplay} />
        </div>
      </div>
    </>
  );
}

function Elapsed({ seconds, label }: { seconds: number; label: string }) {
  return (
    <p className={s.elapsed}>
      <span className={s.elapsedNum}>{clock(seconds)}</span>
      <span className={s.elapsedLabel}>{label}</span>
    </p>
  );
}
