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
import s from "./landing.module.css";

const BUSINESS_LINE = "+1 (989) 534-9779";

const HOURS = ["8am", "9am", "10am", "11am", "12pm", "1pm", "2pm", "3pm", "4pm", "5pm", "6pm", "7pm", "8pm"];
const BANDS = ["8am – 12pm", "12pm – 4pm", "4pm – 8pm"];

// Demo schedule around the live job. Synthetic, labelled as a demo business on the page.
const JOBS = [
  { id: "job-1", time: "8:30 – 9:30am", title: "Water heater install", place: "123 Maple Dr" },
  { id: "job-2", time: "10:00 – 11:30am", title: "Bathroom sink leak", place: "45 Oak Ave" },
  { id: "job-3", time: "4:00 – 5:30pm", title: "Sump pump check", place: "12 Cedar Ln" },
  { id: "job-4", time: "6:00 – 7:30pm", title: "Outside hose bib leaking", place: "9 Birch Ct" },
];

const TRANSCRIPT = [
  { who: "ai", at: "1:42 pm", text: "Thanks for calling Mike’s Plumbing, this is Mike’s AI assistant. How can I help you today?" },
  { who: "caller", at: "1:43 pm", text: "My kitchen tap won’t stop dripping." },
  { who: "ai", at: "1:44 pm", text: "I can book you Thursday 2 to 4 pm. The hold is $174.00. Shall I send the link?" },
] as const;

type Step = { id: string; label: string; lines: string[]; state: "done" | "active" | "waiting" | "idle"; icon: typeof Phone };
const STEPS: Step[] = [
  { id: "call", label: "Call", lines: ["In progress"], state: "active", icon: Phone },
  { id: "booked", label: "Booked", lines: ["Thu, May 22", "2:00 – 4:00 pm"], state: "done", icon: CalendarDays },
  { id: "held", label: "Held", lines: ["$174.00", "with PayPal"], state: "done", icon: Lock },
  { id: "change", label: "Change", lines: ["$119.25", "waiting"], state: "waiting", icon: DollarSign },
  { id: "captured", label: "Captured", lines: ["—"], state: "idle", icon: Check },
];

const RUN = [
  {
    time: "1:42 pm",
    title: "The call",
    text: "The agent answers as the business, says it is an AI, and gathers the problem, the address and how urgent it is. It quotes from the rate card and offers a slot.",
    yes: "Customer says yes to the quote",
  },
  {
    time: "1:45 pm",
    title: "The hold",
    text: "The customer approves a $174.00 PayPal hold from the link on their screen. The job lands on the board. Nothing is charged yet.",
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

          <ul className={s.tiles} id="money" aria-label="Where the money stands">
            <li className={`${s.tile} ${s.tileHold}`}>
              <div className={s.tileHead}>
                <span className={`${s.disc} ${s.discGreen}`}>
                  <Lock aria-hidden="true" strokeWidth={2.25} />
                </span>
                <span className={s.tileLabel}>Hold</span>
              </div>
              <p className={`${s.tileAmount} ${s.green}`}>$174.00</p>
              <p className={s.tileText}>
                (call-out $79 +{" "}
                <br />1 hour labour $95)
              </p>
              <p className={`${s.tileStatus} ${s.green}`}>Held with PayPal</p>
            </li>
            <li className={`${s.tile} ${s.tileChange}`}>
              <div className={s.tileHead}>
                <span className={`${s.disc} ${s.discAmber}`}>
                  <RefreshCw aria-hidden="true" strokeWidth={2.25} />
                </span>
                <span className={s.tileLabel}>Change order</span>
              </div>
              <p className={`${s.tileAmount} ${s.amber}`}>$119.25</p>
              <p className={s.tileText}>
                (shut-off valve $48 +{" "}
                <br />
                45 minutes $71.25,{" "}
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
                when the owner{" "}
                <br />
                says job done.
              </p>
              <p className={`${s.tileStatus} ${s.green}`}>Paid out to you</p>
            </li>
          </ul>

          <p className={s.footnote}>PayPal sandbox. Fictional business. No real money moves.</p>
        </section>

        <section className={s.board} aria-label="Demo schedule for Mike’s Plumbing">
          <div className={s.boardHead}>
            <span className={s.boardDate}>Thu, May 22</span>
            {BANDS.map((band) => (
              <span key={band} className={s.band}>
                {band}
              </span>
            ))}
          </div>
          <ol className={s.hours} aria-hidden="true">
            {HOURS.map((hour) => (
              <li key={hour}>{hour}</li>
            ))}
          </ol>
          <span className={s.axis} aria-hidden="true" />

          {JOBS.map((job) => (
            <article key={job.id} className={`${s.job} ${s[job.id.replace("-", "")]}`}>
              <p className={s.jobTime}>{job.time}</p>
              <h3 className={s.jobTitle}>{job.title}</h3>
              <p className={s.jobPlace}>{job.place}</p>
            </article>
          ))}

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
              <dd className={s.statValue}>6</dd>
            </div>
            <div className={s.stat}>
              <CircleDollarSign aria-hidden="true" className={`${s.statIcon} ${s.green}`} strokeWidth={1.75} />
              <dt>Held</dt>
              <dd className={`${s.statValue} ${s.green}`}>$174.00</dd>
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
            Every price comes from the owner’s rate card. The agent quotes, reads the amount back and waits for a yes; it can
            never capture or refund.
          </p>
          <ul className={s.rules}>
            <li>The hold is a PayPal authorization: the customer’s money is reserved, not taken.</li>
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
              <td>Call-out</td>
              <td>1</td>
              <td>$79.00</td>
            </tr>
            <tr>
              <td>Labour, 15 minutes</td>
              <td>4</td>
              <td>$95.00</td>
            </tr>
            <tr className={s.ledgerTotal}>
              <td colSpan={2}>Held with PayPal</td>
              <td className={s.green}>$174.00</td>
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
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Job total when Mike says job done</td>
              <td>$293.25</td>
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
