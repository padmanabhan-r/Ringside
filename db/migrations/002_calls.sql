-- Every call, phone or browser, whether or not it became a job, linked to the job it booked and to its own cost.
-- Caller IDs are never stored raw: only a salted hash, enough to group repeat callers within a demo session.

create table calls (
  id               uuid primary key default gen_random_uuid(),
  demo_session_id  text        not null,
  conversation_id  text        not null unique,
  channel          text        not null check (channel in ('phone', 'web', 'replay')),
  caller_hash      text,
  job_id           uuid        references jobs (id) on delete set null,
  started_at       timestamptz not null default now(),
  duration_secs    integer     check (duration_secs is null or duration_secs >= 0),
  summary          text,
  outcome          text        not null default 'in_progress'
                   check (outcome in ('in_progress', 'booked_hold', 'quoted', 'no_booking', 'failed')),
  transcript       jsonb       not null default '[]'::jsonb,
  cost_cents       integer     check (cost_cents is null or cost_cents >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index calls_session_idx on calls (demo_session_id, started_at desc);
create index calls_job_idx on calls (job_id);

-- The hold's PayPal order is created before the payer approves it; remember which order belongs to which job code
-- so the approval page and the webhook can find it.
alter table payments add column approval_url text;
alter table payments add column expires_at timestamptz;
