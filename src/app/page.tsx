import {
  AudioLines,
  CalendarDays,
  Check,
  CircleCheck,
  CircleDollarSign,
  DollarSign,
  Lock,
  Phone,
  RefreshCw,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import s from "./landing.module.css";

const BUSINESS_LINE = "+1 (989) 534-9779";

const HOURS = ["8am", "9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm"];
const FIRST_HOUR = 8;

// Demo schedule around the live job. Synthetic, labelled as a demo business on the page.
// Each job sits on its real rows of the hour ruler: start and end are hours of the day.
const JOBS = [
  { id: "job-1", start: 8.5, end: 9.5, time: "8:30 – 9:30am", title: "Water heater", place: "123 Maple Dr" },
  { id: "job-2", start: 10, end: 11.5, time: "10:00 – 11:30am", title: "Bathroom sink", place: "45 Oak Ave" },
  { id: "job-3", start: 16, end: 17.5, time: "4:00 – 5:30pm", title: "Sump pump check", place: "12 Cedar Ln" },
];
const LIVE_SLOT = { start: 14, end: 16 };

const TRANSCRIPT = [
  { who: "ai", at: "1:42 pm", text: "Thanks for calling Mike’s Plumbing, this is Mike’s AI assistant. What’s going on?" },
  { who: "caller", at: "1:43 pm", text: "My kitchen tap won’t stop dripping." },
  { who: "ai", at: "1:44 pm", text: "I can book you this afternoon, 2 to 4 pm. PayPal will hold up to $250.00. Shall I send the link?" },
] as const;

type Step = { id: string; label: string; lines: string[]; state: "done" | "active" | "waiting" | "idle"; icon: typeof Phone };
const STEPS: Step[] = [
  { id: "call", label: "Call", lines: ["In progress"], state: "active", icon: Phone },
  { id: "booked", label: "Booked", lines: ["Today", "2:00 – 4:00 pm"], state: "done", icon: CalendarDays },
  { id: "held", label: "Held", lines: ["$250.00", "with PayPal"], state: "done", icon: Lock },
  { id: "change", label: "Change", lines: ["$119.25", "waiting"], state: "waiting", icon: DollarSign },
  { id: "captured", label: "Captured", lines: ["—"], state: "idle", icon: Check },
];

const RUN = [
  {
    time: "1:42 pm",
    title: "The call",
    text: "The agent answers as the business, says it is an AI, and gathers the problem, the address and how urgent it is. It checks the address is in Mike’s area, quotes the job’s range from the price book and offers a slot.",
    yes: "Customer says yes to the quote",
  },
  {
    time: "1:45 pm",
    title: "The hold",
    text: "The price book says $125 to $250, so the customer approves a PayPal hold for up to $250.00 from the link on their screen. The job lands on the board. Nothing is charged yet.",
    yes: "Customer approves with PayPal",
  },
  {
    time: "2:51 pm",
    title: "The change",
    text: "On site, Mike says: add a shut-off valve and 45 minutes. A model turns it into rate-card lines, Mike confirms, and the customer approves $119.25.",
    yes: "Owner confirms, customer approves",
  },
  {
    time: "3:58 pm",
    title: "The capture",
    text: "Mike says job done and confirms the total. The close-out runs on Render Workflows and captures the hold through PayPal.",
    yes: "Owner says job done",
  },
];

export default function Home() {
  return (
    <div className={s.page}>
      <header className={s.topbar}>
        <Link className={s.wordmark} href="/" aria-label="Ringside home">
          <span className={s.mark} aria-hidden="true">
            R
          </span>
          <span className={s.wordmarkText}>Ringside</span>
        </Link>
        <nav className={s.nav} aria-label="Main">
          <a href="#how">How it works</a>
          <a href="#money">The money</a>
          <Link href="/onsite/demo">Owner view</Link>
          <Link href="/board">Schedule</Link>
          <a href="https://github.com/padmanabhan-r/Ringside">Source</a>
        </nav>
        <span className={s.sandboxTag}>PayPal sandbox</span>
      </header>

      <main className={s.hero}>
        <section className={s.intro} aria-labelledby="headline">
          <h1 id="headline" className={s.headline}>
            <span>Ringside answers</span> <span>the call, books the job</span> <span>and holds the money.</span>
          </h1>
          <p className={s.subhead}>The AI front desk for one-person trades.</p>

          <p className={s.demoLabel}>Demo business: Mike’s Plumbing (fictional)</p>
          <div className={s.actions}>
            <Link className={s.callButton} href="/call">
              <Phone aria-hidden="true" className={s.callIcon} strokeWidth={2.25} />
              Call Mike’s Plumbing
            </Link>
            <Link className={s.skipButton} href="/call?replay=1">
              <AudioLines aria-hidden="true" className={s.skipIcon} strokeWidth={2} />
              <span>
                Skip the call:
                <br />
                hear a recorded one
              </span>
            </Link>
          </div>
          <a className={s.phone} href="tel:+19895349779">
            {BUSINESS_LINE}
          </a>
          <p className={s.notice}>You’ll talk to an AI assistant. The call is recorded.</p>

          <div className={s.introFoot}>
          <ul className={s.tiles} id="money" aria-label="Where the money stands">
            <li className={`${s.tile} ${s.tileHold}`}>
              <div className={s.tileHead}>
                <span className={`${s.disc} ${s.discGreen}`}>
                  <Lock aria-hidden="true" strokeWidth={2.25} />
                </span>
                <span className={s.tileTitle}>
                  <span className={s.tileLabel}>Hold</span>
                  <span className={`${s.tileAmount} ${s.green}`}>$250.00</span>
                </span>
              </div>
              <p className={s.tileText}>
                (faucet leak repair,{" "}
                <br />$125 to $250, held at the top)
              </p>
              <p className={`${s.tileStatus} ${s.green}`}>Held with PayPal</p>
            </li>
            <li className={`${s.tile} ${s.tileChange}`}>
              <div className={s.tileHead}>
                <span className={`${s.disc} ${s.discAmber}`}>
                  <RefreshCw aria-hidden="true" strokeWidth={2.25} />
                </span>
                <span className={s.tileTitle}>
                  <span className={s.tileLabel}>Change order</span>
                  <span className={`${s.tileAmount} ${s.amber}`}>$119.25</span>
                </span>
              </div>
              <p className={s.tileText}>
                (shut-off valve $48{" "}
                <br />+ 45 minutes $71.25,{" "}
                <br />a second PayPal payment)
              </p>
              <p className={`${s.tileStatus} ${s.amber}`}>Waiting for customer</p>
            </li>
            <li className={`${s.tile} ${s.tileCapture}`}>
              <div className={s.tileHead}>
                <span className={`${s.disc} ${s.discGreen}`}>
                  <Check aria-hidden="true" strokeWidth={2.5} />
                </span>
                <span className={s.tileLabelLarge}>Capture</span>
              </div>
              <p className={s.tileText}>
                when the owner says{" "}
                <br />
                job done.
              </p>
              <p className={`${s.tileStatus} ${s.green}`}>Paid out to you</p>
            </li>
          </ul>

          <p className={s.footnote}>PayPal sandbox. Fictional business. No real money moves.</p>
          </div>
        </section>

        <section className={s.board} aria-label="Demo schedule for Mike’s Plumbing">
          <div className={s.boardHead}>
            <span className={s.boardDate}>Today</span>
            <span className={s.boardOwner}>Mike’s day, Saginaw</span>
            <span className={s.legend}>
              <span className={s.legendBooked}>Booked</span>
              <span className={s.legendHeld}>Held</span>
              <span className={s.legendWaiting}>Change waiting</span>
            </span>
          </div>
          <ol className={s.hours} aria-hidden="true">
            {HOURS.map((hour) => (
              <li key={hour}>{hour}</li>
            ))}
          </ol>
          <span className={s.axis} aria-hidden="true" />

          {JOBS.map((job) => (
            <article
              key={job.id}
              className={`${s.job} ${s[job.id.replace("-", "")]}`}
              style={{ "--start": job.start - FIRST_HOUR, "--span": job.end - job.start } as CSSProperties}
            >
              <h3 className={s.jobTitle}>{job.title}</h3>
              <p className={s.jobMeta}>{job.time}</p>
            </article>
          ))}
          <span
            className={s.liveSlot}
            style={{ "--start": LIVE_SLOT.start - FIRST_HOUR, "--span": LIVE_SLOT.end - LIVE_SLOT.start } as CSSProperties}
            aria-hidden="true"
          >
            <span className={s.liveSlotLabel}>2:00 – 4:00 pm</span>
          </span>

          <article className={s.live} aria-label="Live job">
            <div className={s.liveMain}>
              <p className={s.liveHeader}>
                <span className={s.liveDot} aria-hidden="true" />
                <span className={s.liveTag}>Live job</span>
                <span className={s.liveState}>Call in progress</span>
              </p>
              <h2 className={s.liveTitle}>Mike’s Plumbing</h2>
              <p className={s.liveProblem}>Kitchen tap – won’t stop dripping</p>
              <p className={s.livePlace}>42 Elm St</p>

              <h3 className={s.transcriptLabel}>Live transcript</h3>
              <ol className={s.transcript}>
                {TRANSCRIPT.map((line) => (
                  <li key={line.at} className={s.line}>
                    <span className={line.who === "ai" ? s.avatarAi : s.avatarCaller} aria-label={line.who === "ai" ? "AI assistant" : "Caller"}>
                      {line.who === "ai" ? "AI" : <UserRound aria-hidden="true" strokeWidth={2.25} />}
                    </span>
                    <p className={s.lineText}>{line.text}</p>
                    <time className={s.lineTime}>{line.at}</time>
                  </li>
                ))}
              </ol>
              <p className={s.recording}>
                The call is being recorded <span className={s.recordDot} aria-hidden="true" />
              </p>
            </div>

            <ol className={s.track} aria-label="Job status">
              {STEPS.map((step) => {
                const Icon = step.icon;
                return (
                  <li key={step.id} className={`${s.step} ${s[`step_${step.state}`]}`}>
                    <span className={s.stepIcon}>
                      <Icon aria-hidden="true" strokeWidth={2.25} />
                    </span>
                    <span className={s.stepLabel}>{step.label}</span>
                    {step.lines.map((line, i) => (
                      <span key={line} className={i === 0 && line.startsWith("$") ? s.stepAmount : s.stepLine}>
                        {line}
                      </span>
                    ))}
                  </li>
                );
              })}
            </ol>
          </article>

          <dl className={s.stats}>
            <div className={s.stat}>
              <CalendarDays aria-hidden="true" className={s.statIcon} strokeWidth={1.75} />
              <dt>Jobs today</dt>
              <dd className={s.statValue}>4</dd>
              <dd className={s.statSub}>1 live</dd>
            </div>
            <div className={s.stat}>
              <CircleDollarSign aria-hidden="true" className={`${s.statIcon} ${s.green}`} strokeWidth={1.75} />
              <dt>Held</dt>
              <dd className={`${s.statValue} ${s.green}`}>$250.00</dd>
              <dd className={s.statSub}>1 job</dd>
            </div>
            <div className={s.stat}>
              <CircleDollarSign aria-hidden="true" className={`${s.statIcon} ${s.amber}`} strokeWidth={1.75} />
              <dt>Change waiting</dt>
              <dd className={`${s.statValue} ${s.amber}`}>$119.25</dd>
              <dd className={s.statSub}>1 job</dd>
            </div>
            <div className={s.stat}>
              <CircleCheck aria-hidden="true" className={`${s.statIcon} ${s.green}`} strokeWidth={1.75} />
              <dt>Captured</dt>
              <dd className={`${s.statValue} ${s.green}`}>$0.00</dd>
              <dd className={s.statSub}>0 jobs</dd>
            </div>
          </dl>
        </section>
      </main>

      <section className={s.how} id="how" aria-labelledby="how-title">
        <h2 id="how-title" className={s.sectionTitle}>
          How a job runs
        </h2>
        <p className={s.sectionLead}>One job, four moments, and a person says yes before any money moves.</p>
        <ol className={s.ruler}>
          {RUN.map((stop) => (
            <li key={stop.title} className={s.stop}>
              <time className={s.stopTime}>{stop.time}</time>
              <h3 className={s.stopTitle}>{stop.title}</h3>
              <p className={s.stopText}>{stop.text}</p>
              <p className={s.stopYes}>{stop.yes}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={s.money} aria-labelledby="money-title">
        <div className={s.moneyCopy}>
          <h2 id="money-title" className={s.sectionTitle}>
            The money, line by line
          </h2>
          <p className={s.sectionLead}>
            Every price comes from Mike’s price book. The agent quotes the range, reads the hold back and waits for a yes;
            it can never capture or refund.
          </p>
          <ul className={s.rules}>
            <li>
              The hold is a PayPal authorization for the top of the price-book range: the customer’s money is reserved, not
              taken, and they never pay more than they approved.
            </li>
            <li>
              PayPal lets a hold grow by 15% at most, so a bigger change becomes its own payment that the customer approves.
            </li>
            <li>
              The final capture runs only after the owner says “job done”. Every PayPal call carries a request ID, so a retry
              returns the same capture instead of charging twice.
            </li>
          </ul>
        </div>
        <table className={s.ledger}>
          <caption>Mike’s Plumbing, kitchen tap, 42 Elm St (demo)</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Qty</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className={s.ledgerGroup}>
              <th scope="rowgroup" colSpan={3}>
                Hold, approved by the customer on the call
              </th>
            </tr>
            <tr>
              <td>Faucet leak repair, price book $125 to $250</td>
              <td>1</td>
              <td>$250.00</td>
            </tr>
            <tr className={s.ledgerTotal}>
              <td colSpan={2}>Held with PayPal (the top of the range)</td>
              <td className={s.green}>$250.00</td>
            </tr>
            <tr className={s.ledgerGroup}>
              <th scope="rowgroup" colSpan={3}>
                Change order, approved by the customer on site
              </th>
            </tr>
            <tr>
              <td>Shut-off valve</td>
              <td>1</td>
              <td>$48.00</td>
            </tr>
            <tr>
              <td>Labour, 15 minutes</td>
              <td>3</td>
              <td>$71.25</td>
            </tr>
            <tr className={s.ledgerTotal}>
              <td colSpan={2}>Second PayPal payment</td>
              <td className={s.amber}>$119.25</td>
            </tr>
            <tr className={s.ledgerGroup}>
              <th scope="rowgroup" colSpan={3}>
                At job done, Mike charges the real cost
              </th>
            </tr>
            <tr>
              <td>Faucet leak repair, captured from the hold</td>
              <td>1</td>
              <td>$190.00</td>
            </tr>
            <tr>
              <td>Released back to the customer</td>
              <td></td>
              <td>$60.00</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>The customer pays $190.00 + $119.25</td>
              <td>$309.25</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className={s.close} aria-labelledby="close-title">
        <h2 id="close-title" className={s.closeTitle}>
          Call Mike’s Plumbing and watch the money move.
        </h2>
        <div className={s.closeActions}>
          <Link className={s.callButton} href="/call">
            <Phone aria-hidden="true" className={s.callIcon} strokeWidth={2.25} />
            Call Mike’s Plumbing
          </Link>
          <a className={s.closePhone} href="tel:+19895349779">
            or dial {BUSINESS_LINE}
          </a>
        </div>
        <p className={s.closeNote}>
          To approve payments, sign in to the PayPal sandbox as the demo buyer:{" "}
          <span className={s.mono}>sb-glfwp53707955@personal.example.com</span>.
        </p>
      </section>

      <footer className={s.footer}>
        <p>Ringside. PayPal sandbox only; no real money moves. Mike’s Plumbing is a fictional business.</p>
        <p>Built with PayPal, ElevenLabs, Twilio and Render.</p>
        <a href="https://github.com/padmanabhan-r/Ringside">Source on GitHub</a>
      </footer>
    </div>
  );
}
