-- Web push subscriptions for Mike's installed dashboard: one row per browser that turned notifications on, tied to the
-- demo session it was turned on in, so a job's events reach only the dashboards that can see that job.
create table if not exists push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  demo_session_id text        not null,
  endpoint        text        not null unique,
  p256dh          text        not null,
  auth            text        not null,
  created_at      timestamptz not null default now()
);
create index if not exists push_subscriptions_session_idx on push_subscriptions (demo_session_id);
