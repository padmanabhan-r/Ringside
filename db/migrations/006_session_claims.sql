-- A phone caller's job lives in the phone call's own demo session; typing its job code into Mike's dashboard
-- attaches it to the visitor's browser session too, so they can run the rest of the job from there.
create table if not exists session_claims (
  demo_session_id text        not null,
  job_id          uuid        not null references jobs (id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (demo_session_id, job_id)
);
