-- Change orders get their own second payment, and a finished job records what was really charged.
alter table payments add column if not exists change_order_id uuid references change_orders (id) on delete cascade;
create index if not exists payments_change_order_idx on payments (change_order_id);
alter table jobs add column if not exists final_cents integer check (final_cents >= 0);
