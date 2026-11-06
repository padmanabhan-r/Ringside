-- The address a phone caller confirmed letter by letter on the call, kept with their job so Mike's later requests on
-- that job (extra work to approve) reach them. Used only for this job's emails; events keep a masked form.
alter table jobs add column if not exists customer_email text;
