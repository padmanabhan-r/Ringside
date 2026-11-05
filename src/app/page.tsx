import { ArrowRight, Check, Clock, Info, LayoutDashboard, Mail, MapPin, Mic, Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Avatar, MikesWordmark, StatusPill } from "@/components/brand";
import { BUSINESS_LINE } from "@/lib/business";
import { PayPalMonogram, PayPalWordmark, RingsideMark } from "./_landing/marks";
import s from "./landing.module.css";

const GITHUB = "https://github.com/padmanabhan-r/ringside";

// One screen on any desk (owner, 2026-11-05): before the first paint, scale the page down just enough to fit the window,
// never below 80% so text stays readable (a very short window scrolls instead). Phones keep their natural flow.
const FIT_SCRIPT = `(function(){var m=document.getElementById("landing-main");if(!m)return;function fit(){m.style.zoom="";if(innerWidth<1024)return;var top=m.getBoundingClientRect().top+scrollY,need=document.documentElement.scrollHeight-top,z=(innerHeight-top)/need;if(z<1)m.style.zoom=String(Math.max(0.8,z*0.995));}fit();addEventListener("resize",fit);})();`;

export default function Home() {
  return (
    <div className={`fs ${s.page}`}>
      <p className={s.notice}>
        <Info aria-hidden="true" className={s.noticeIcon} strokeWidth={2.25} />
        <span>Prototype built for the PayPal AI Hackathon</span>
        <span className={s.noticeSep} aria-hidden="true" />
        <span>Payments run on the PayPal sandbox</span>
        <span className={s.noticeSep} aria-hidden="true" />
        <span>Mike’s Plumbing and its customers are fictional</span>
      </p>

      <header className={s.topbar}>
        <div className={s.topbarInner}>
          <Link className={s.brand} href="/" aria-label="Ringside home">
            <RingsideMark size={44} />
            <span className={s.brandName}>Ringside</span>
          </Link>
          <nav className={s.nav} aria-label="Main">
            <a href="#how">How it works</a>
            <a href={GITHUB}>GitHub</a>
          </nav>
          <span className={s.sandboxTag}>PayPal sandbox demo</span>
        </div>
      </header>

      <main className={s.main} id="landing-main" suppressHydrationWarning>
        <section className={s.hero} aria-labelledby="headline">
          <div className={s.heroText}>
            <h1 id="headline" className={s.headline}>
              <span>Your phone, answered.</span> <span>Your job, paid.</span>
            </h1>
            <p className={s.lede}>
              <span className={s.ledeLine}>
                <b>Ringside is AI front-desk software for small service businesses.</b>
              </span>{" "}
              It answers their calls, quotes from their price book, holds the payment with <b className={s.paypal}>PayPal</b>,
              and charges the real cost when the job is done.
            </p>
            <p className={s.forWho}>
              For plumbers, electricians, HVAC techs, handymen, cleaners and locksmiths: anyone who quotes a job, does it,
              then gets paid.
            </p>
          </div>
        </section>

        <div className={s.demoBox}>
          <span className={s.demoLogo}>
            <MikesWordmark size={46} />
          </span>
          <span className={s.demoDivider} aria-hidden="true" />
          <span className={s.demoFace}>
            <Avatar size={52} label="Mike, the owner (fictional)" />
          </span>
          <div className={s.demoText}>
            <span className={s.demoTag}>Demo business · fictional</span>
            <p>Mike is a one-person plumber in Saginaw, Michigan, running his business on Ringside. Be his customer, or be Mike.</p>
          </div>
        </div>

        <section className={s.doors} aria-label="Try Ringside with the demo business">
          <article className={`${s.door} ${s.doorCall}`}>
            <span className={s.doorIcon} aria-hidden="true">
              <Phone strokeWidth={2.4} />
            </span>
            <div className={s.doorText}>
              <h2 className={s.doorTitle}>Call Mike’s Plumbing</h2>
              <p className={s.doorBody}>
                Be the customer. Talk to the AI in your browser, or ring{" "}
                <a className={s.number} href={BUSINESS_LINE.tel}>
                  {BUSINESS_LINE.display}
                </a>
                .
              </p>
            </div>
            <Link className={`${s.button} ${s.buttonCall}`} href="/call">
              Start a call
            </Link>
            <p className={s.doorNote}>You’ll talk to an AI assistant, and the call is recorded.</p>
          </article>

          <article className={`${s.door} ${s.doorDash}`}>
            <span className={s.doorIcon} aria-hidden="true">
              <LayoutDashboard strokeWidth={2.4} />
            </span>
            <div className={s.doorText}>
              <h2 className={s.doorTitle}>Open Mike’s dashboard</h2>
              <p className={s.doorBody}>Be Mike. See today’s bookings, add charges, finish a job.</p>
            </div>
            <Link className={`${s.button} ${s.buttonDash}`} href="/dashboard">
              Open dashboard
            </Link>
            <p className={s.doorNote}>In real use only Mike signs in here; it’s open so you can look around.</p>
          </article>
        </section>

        <section className={s.how} id="how" aria-labelledby="how-title">
          <h2 id="how-title" className={s.srOnly}>
            How it works: one job, from the call to the charge
          </h2>
          <ol className={s.steps}>
            <li className={`${s.step} ${s.stepCall}`}>
              <h3 className={s.stepHead}>
                <span className={`${s.num} ${s.numBlue}`}>1</span>
                <span>
                  <b className={s.blue}>The call:</b> the AI books the job
                </span>
              </h3>
              <div className={s.callBody}>
                <Image className={s.robot} src="/landing/robot.webp" alt="" width={120} height={120} priority />
                <div className={s.jobCard}>
                  <p className={s.jobTime}>
                    <Clock aria-hidden="true" strokeWidth={2.25} />
                    Today, 10:00 am
                  </p>
                  <p className={s.jobTitle}>Dripping kitchen tap</p>
                  <p className={s.jobPlace}>
                    <MapPin aria-hidden="true" strokeWidth={2.25} />
                    42 Elm St, Saginaw
                  </p>
                </div>
              </div>
            </li>

            <li className={`${s.step} ${s.stepHold}`}>
              <span className={s.arrow} aria-hidden="true">
                <ArrowRight strokeWidth={2.5} />
              </span>
              <h3 className={s.stepHead}>
                <span className={`${s.num} ${s.numAmber}`}>2</span>
                <span>
                  <b className={s.amber}>The hold:</b> the customer approves up to $250.00 with PayPal
                </span>
              </h3>
              <div className={s.holdCard}>
                <PayPalMonogram size={46} />
                <span className={s.holdDivider} aria-hidden="true" />
                <span className={s.holdState}>
                  <StatusPill tone="ok">Hold approved</StatusPill>
                  <span className={s.holdAmount}>up to $250.00</span>
                </span>
              </div>
            </li>

            <li className={`${s.step} ${s.stepCharge}`}>
              <span className={s.arrow} aria-hidden="true">
                <ArrowRight strokeWidth={2.5} />
              </span>
              <div className={s.chargeText}>
                <h3 className={s.stepHead}>
                  <span className={`${s.num} ${s.numGreen}`}>3</span>
                  <b className={s.green}>The charge:</b>
                </h3>
                <p className={s.chargeBody}>Mike says job done; PayPal charges $180.00 and sends the receipt</p>
              </div>
              <div className={s.receipt}>
                <span className={s.chargeCheck} aria-hidden="true">
                  <Check strokeWidth={3} />
                </span>
                <PayPalWordmark className={s.receiptBrand} />
                <span className={s.receiptLabel}>Charged</span>
                <span className={s.receiptAmount}>$180.00</span>
                <span className={s.receiptSent}>
                  <Mail aria-hidden="true" strokeWidth={2.25} />
                  Receipt sent
                </span>
              </div>
            </li>
          </ol>

          <div className={s.change}>
            <span className={s.changeIcon} aria-hidden="true">
              <Mic strokeWidth={2.4} />
            </span>
            <p className={s.changeText}>
              <b>If the job grows,</b> Mike just says it: “add a shut-off valve and 45 minutes.” Ringside prices it from
              the price book, and the customer approves <b>$119.25</b> in PayPal before the work goes on.
            </p>
            <dl className={s.changeLines}>
              <div>
                <dt>Shut-off valve</dt>
                <dd>$48.00</dd>
              </div>
              <div>
                <dt>45 minutes</dt>
                <dd>$71.25</dd>
              </div>
              <div className={s.changeTotal}>
                <dt className={s.srOnly}>Change order</dt>
                <dd>
                  <StatusPill tone="ok">Approved $119.25</StatusPill>
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </main>
      <script dangerouslySetInnerHTML={{ __html: FIT_SCRIPT }} />

      <footer className={s.footer}>
        <p>
          The business and customers are fictional. Payments run on the <b className={s.paypal}>PayPal</b> sandbox.
        </p>
        <a href={GITHUB}>GitHub</a>
      </footer>
    </div>
  );
}
