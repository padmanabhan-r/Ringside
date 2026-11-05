-- Quotes come from the price book as ranges: the held price is the top of the range (unit_price_cents) and the bottom
-- is kept for display and for the owner's final capture. Change-order add-ons stay exact (no range).
alter table line_items add column price_low_cents integer check (price_low_cents is null or price_low_cents >= 0);
alter table line_items add column name text;
alter table jobs add column zip text;
