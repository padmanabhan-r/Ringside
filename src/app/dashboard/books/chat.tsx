"use client";

// The "Ask your books" drawer: a small chat UI over the AG Studio Agent Framework harness. Studio's own AI panel is
// an edit-mode panel, so in view mode the page drives the harness itself: one thread with the Books agent.
import type { AgAiChatMessage, AgAiChatSession, AgAiHarness } from "ag-studio";
import { BookOpen, Check, ChevronDown, ChevronUp, LoaderCircle, MessageCircle, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PROMPT_STARTERS } from "./studio/ai";
import s from "./books.module.css";

const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const time = (ms: number) => timeFmt.format(ms).toLowerCase();

const TOOL_LABEL: Record<string, string> = { read_books: "Read the books", show_job: "Showed the job" };

function Bubble({ message }: { message: AgAiChatMessage }) {
  if (message.role === "user") {
    const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return (
      <li className={s.msgUser}>
        <p className={s.bubbleUser}>{text}</p>
        <span className={s.msgTime}>{time(message.createdAt)}</span>
      </li>
    );
  }
  // A turn that only called a tool reads as a quiet step under the question, not a reply of its own.
  if (message.parts.every((p) => p.type === "tool_call")) {
    return (
      <li className={s.toolLine}>
        {message.parts.map((part, i) =>
          part.type === "tool_call" ? (
            <span key={i} className={s.toolChip}>
              {part.toolCall.status === "complete" ? <Check aria-hidden="true" /> : <LoaderCircle className={s.spin} aria-hidden="true" />}
              {TOOL_LABEL[part.toolCall.name] ?? part.toolCall.name}
            </span>
          ) : null,
        )}
      </li>
    );
  }
  return (
    <li className={s.msgBot}>
      <span className={s.botAvatar} aria-hidden="true">
        <BookOpen strokeWidth={2.2} />
      </span>
      <div className={s.botBody}>
        {message.parts.map((part, i) => {
          if (part.type === "text" && part.text.trim()) return <p key={i} className={s.bubbleBot}>{part.text}</p>;
          if (part.type === "tool_call") {
            const done = part.toolCall.status === "complete";
            return (
              <span key={i} className={s.toolChip}>
                {done ? <Check aria-hidden="true" /> : <LoaderCircle className={s.spin} aria-hidden="true" />}
                {TOOL_LABEL[part.toolCall.name] ?? part.toolCall.name}
              </span>
            );
          }
          if (part.type === "error") return <p key={i} className={s.chatError}>{part.message}</p>;
          return null;
        })}
        <span className={s.msgTime}>{time(message.createdAt)}</span>
      </div>
    </li>
  );
}

export function AskYourBooks({ harness }: { harness: AgAiHarness | null }) {
  const [open, setOpen] = useState(true);
  const [session, setSession] = useState<AgAiChatSession | null>(null);
  const [, setTick] = useState(0);
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState("");
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (!session) return;
    const onChange = () => setTick((n) => n + 1);
    session.addEventListener("changed", onChange);
    return () => session.removeEventListener("changed", onChange);
  }, [session]);

  const messages = session?.messages ?? [];
  const busy = session?.status === "running";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, busy]);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || !harness || busy) return;
    setFailed("");
    setDraft("");
    try {
      const live = session ?? (await harness.createThread({ agentId: "books", title: "Ask your books" }));
      if (!session) setSession(live);
      live.sendMessage(question);
    } catch {
      setFailed("The books didn't open. Reload the page and try again.");
    }
  }

  return (
    <aside className={`${s.chat} ${open ? "" : s.chatClosed}`} aria-label="Ask your books">
      <header className={s.chatHead}>
        <span className={s.chatIcon} aria-hidden="true">
          <MessageCircle strokeWidth={2.4} />
        </span>
        <h2 className={s.chatTitle}>Ask your books</h2>
        <button type="button" className={s.chatToggle} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Hide the chat" : "Show the chat"}>
          {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        </button>
      </header>
      {open ? (
        <>
          <ol className={s.chatList} ref={listRef} aria-live="polite">
            {messages.length === 0 ? (
              <li className={s.chatEmpty}>
                <p>Ask about this week in plain words. Answers come from the jobs, payments and calls on this page.</p>
                <div className={s.starters}>
                  {PROMPT_STARTERS.map((p) => (
                    <button key={p.label} type="button" className={s.starter} onClick={() => ask(p.prompt)} disabled={!harness}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </li>
            ) : (
              messages.map((m) => <Bubble key={m.id} message={m} />)
            )}
            {busy ? (
              <li className={s.thinking}>
                <LoaderCircle className={s.spin} aria-hidden="true" /> Checking the books…
              </li>
            ) : null}
            {failed ? <li className={s.chatError}>{failed}</li> : null}
          </ol>
          <form
            className={s.chatForm}
            onSubmit={(e) => {
              e.preventDefault();
              void ask(draft);
            }}
          >
            <label className={s.srOnly} htmlFor="ask-books">
              Ask a question
            </label>
            <input
              id="ask-books"
              className={s.chatInput}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={harness ? "Ask a question…" : "Opening the books…"}
              maxLength={300}
              autoComplete="off"
              disabled={!harness}
            />
            <button type="submit" className={s.chatSend} disabled={!harness || busy || !draft.trim()} aria-label="Send">
              <Send aria-hidden="true" />
            </button>
          </form>
          <p className={s.chatFoot}>Answers come from your books. It can read them, never move money.</p>
        </>
      ) : null}
    </aside>
  );
}
