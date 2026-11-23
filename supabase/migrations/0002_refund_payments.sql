-- Stage 4: server-only refund receipt audit trail.
-- Clients can read their own receipts. Only the service role can insert one.

create table if not exists public.refund_payments (
  payment_id text primary key,
  booking_id text not null references public.bookings (booking_id),
  guest_user_email text not null,
  amount numeric(12, 2) not null,
  decision text not null,
  rule text not null,
  created_at timestamptz not null default now()
);

alter table public.refund_payments enable row level security;

drop policy if exists "refund_payments_read_own" on public.refund_payments;
create policy "refund_payments_read_own" on public.refund_payments
  for select to authenticated
  using (guest_user_email = auth.jwt() ->> 'email');

grant select on public.refund_payments to authenticated;
-- No INSERT/UPDATE/DELETE policy: writes happen only in server code with the service role key.
