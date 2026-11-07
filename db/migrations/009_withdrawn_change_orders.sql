-- Mike can withdraw extra work he sent while the customer hasn't answered (otherwise an unanswered request blocks
-- Job done for good).
alter table change_orders drop constraint if exists change_orders_status_check;
alter table change_orders add constraint change_orders_status_check
  check (status in ('pending_owner', 'pending_customer', 'approved', 'declined', 'withdrawn'));
