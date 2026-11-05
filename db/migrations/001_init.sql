-- Ringside schema v1 (docs/brief.md §7). Money is integer cents; every job belongs to one demo session.

create table jobs (
  id              uuid primary key default gen_random_uuid(),
  demo_session_id text        not null,
  job_code        text        not null unique,
  channel         text        not null check (channel in ('phone', 'web', 'replay')),
  customer_name   text,
  address         text,
  problem         text,
  slot_start      timestamptz,
  slot_end        timestamptz,
  state           text        not null default 'new_call'
                  check (state in ('new_call', 'quoted', 'booked', 'in_progress', 'change_pending',
                                   'completed', 'closed', 'cancelled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (slot_end is null or slot_start is null or slot_end > slot_start)
);
create index jobs_demo_session_idx on jobs (demo_session_id, created_at desc);

create table change_orders (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid        not null references jobs (id) on delete cascade,
  transcript  text        not null,
  delta_cents integer     not null,
  status      text        not null default 'pending_owner'
              check (status in ('pending_owner', 'pending_customer', 'approved', 'declined')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index change_orders_job_idx on change_orders (job_id);

create table line_items (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid        not null references jobs (id) on delete cascade,
  source           text        not null check (source in ('quote', 'change_order')),
  change_order_id  uuid        references change_orders (id) on delete cascade,
  item_code        text        not null,
  qty              integer     not null check (qty > 0),
  unit_price_cents integer     not null check (unit_price_cents >= 0),
  created_at       timestamptz not null default now(),
  check ((source = 'change_order') = (change_order_id is not null))
);
create index line_items_job_idx on line_items (job_id);

create table payments (
  id                      uuid primary key default gen_random_uuid(),
  job_id                  uuid        not null references jobs (id) on delete cascade,
  kind                    text        not null check (kind in ('hold', 'change', 'capture', 'invoice', 'refund')),
  paypal_order_id         text,
  paypal_authorization_id text,
  paypal_capture_id       text,
  paypal_invoice_id       text,
  paypal_request_id       text        not null unique,
  amount_cents            integer     not null check (amount_cents >= 0),
  status                  text        not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index payments_job_idx on payments (job_id);

create table events (
  id         bigserial primary key,
  job_id     uuid        references jobs (id) on delete cascade,
  type       text        not null,
  payload    jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index events_job_idx on events (job_id, created_at);
