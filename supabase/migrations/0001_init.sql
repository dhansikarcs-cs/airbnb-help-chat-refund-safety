-- Stage 1 schema: guests, listings, bookings, refund requests.
-- Run this in the Supabase SQL Editor before supabase/seed.sql.

create extension if not exists pgcrypto;

create table if not exists public.guests (
  email text primary key,
  full_name text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  listing_id text primary key,
  title text not null,
  host_name text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  booking_id text primary key,
  guest_user_email text not null references public.guests (email),
  listing_id text not null references public.listings (listing_id),
  guest_name text not null,
  listing_title text not null,
  host_name text not null,
  listing_description text not null,
  booked_at timestamptz not null,
  check_in date not null,
  check_out date not null,
  nights integer not null,
  total_paid numeric(12, 2) not null,
  cancellation_policy text not null,
  booking_status text not null,
  amount_already_refunded numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.refund_requests (
  request_id text primary key,
  submitted_at timestamptz not null,
  requester_email text not null references public.guests (email),
  booking_id text not null references public.bookings (booking_id),
  request_reason text not null,
  requested_amount numeric(12, 2) not null,
  message_text text not null,
  channel text not null,
  created_at timestamptz not null default now()
);

create index if not exists bookings_guest_user_email_idx on public.bookings (guest_user_email);
create index if not exists refund_requests_requester_email_idx on public.refund_requests (requester_email);
create index if not exists refund_requests_booking_id_idx on public.refund_requests (booking_id);

alter table public.guests enable row level security;
alter table public.listings enable row level security;
alter table public.bookings enable row level security;
alter table public.refund_requests enable row level security;

-- The ownership key is the VERIFIED email in the Supabase JWT. It is issued only
-- after passwordless sign-in proves control of the inbox; it can never be
-- supplied by chat text or by a request body.
drop policy if exists "guests_read_own" on public.guests;
create policy "guests_read_own" on public.guests
  for select to authenticated
  using (email = auth.jwt() ->> 'email');

drop policy if exists "bookings_read_owned" on public.bookings;
create policy "bookings_read_owned" on public.bookings
  for select to authenticated
  using (guest_user_email = auth.jwt() ->> 'email');

-- Each refund request is tied to its sender (requester_email), not to the
-- booking owner. A sender may be a stranger; the Stage 2 server check rejects it.
drop policy if exists "refund_requests_read_sent" on public.refund_requests;
create policy "refund_requests_read_sent" on public.refund_requests
  for select to authenticated
  using (requester_email = auth.jwt() ->> 'email');

-- Listing descriptions are read as context by the chat and are UNTRUSTED input.
drop policy if exists "listings_read_authenticated" on public.listings;
create policy "listings_read_authenticated" on public.listings
  for select to authenticated
  using (true);

-- Deliberately no INSERT/UPDATE/DELETE policies for clients: the refund write
-- path stays in server code (Stage 2) and is never reachable from the model.

-- security_invoker keeps the underlying RLS policies in force for this view.
create or replace view public.refund_requests_review
with (security_invoker = true) as
select
  r.request_id,
  r.submitted_at,
  r.requester_email,
  r.booking_id,
  r.request_reason,
  r.requested_amount,
  r.message_text,
  r.channel,
  b.guest_user_email as booking_owner_email,
  r.requester_email = b.guest_user_email as sender_owns_booking
from public.refund_requests r
join public.bookings b on b.booking_id = r.booking_id;

grant select on public.guests, public.listings, public.bookings,
  public.refund_requests, public.refund_requests_review to authenticated;
