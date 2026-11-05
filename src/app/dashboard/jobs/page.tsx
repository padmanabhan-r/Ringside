import { BriefcaseBusiness, ChevronRight } from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/components/brand";
import { loadAllJobs } from "@/lib/dashboard";
import { currentSession } from "@/lib/session";
import { windowLabel } from "../format";
import s from "../lists.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Jobs" };

export default async function JobsPage() {
  const now = new Date();
  const jobs = await loadAllJobs(await currentSession(), now);
  return (
    <div className={s.page}>
      <h1 className={s.title}>Jobs</h1>
      <p className={s.lead}>Your own bookings first, then Mike’s sample week. Only your own jobs can be charged.</p>
      <ul className={s.list}>
        {jobs.map((job) => {
          const body = (
            <>
              <span className={`${s.icon} ${job.tone === "ok" ? s.iconOk : ""}`}>
                <BriefcaseBusiness aria-hidden="true" />
              </span>
              <span className={s.body}>
                <span className={s.main}>
                  {job.problem} {job.code ? <span className={s.sub}>{job.code}</span> : null}
                </span>
                <span className={s.sub}>
                  {windowLabel(job.start, job.end, now)}
                  {job.customer ? ` · ${job.customer}` : ""}
                  {job.sample ? <span className={s.sample}>Sample</span> : null}
                </span>
              </span>
              <span className={s.end}>
                <StatusPill tone={job.tone}>{job.status}</StatusPill>
                {job.code && !job.sample ? <ChevronRight className={s.go} aria-hidden="true" /> : null}
              </span>
            </>
          );
          return (
            <li key={job.key} className={s.item}>
              {job.code && !job.sample ? (
                <Link className={s.itemLink} href={`/dashboard/jobs/${job.code}`}>
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
