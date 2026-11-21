# Airbnb Help Chat Refund Safety — Stage 1

Guest sign-in and owner-scoped data load for the guarded support-chat project.
Built in TypeScript with Next.js (App Router) and Supabase.

## What Stage 1 delivers

1. Passwordless Supabase guest sign-in (magic link / 6-digit email OTP).
2. Keys read from `.env.local`; that file is in `.gitignore` and is never pushed.
3. The ownership rule, implemented in server code: **`guest_user_email` proves a
   booking belongs to the signed-in guest**.
4. The two exports loaded into Supabase — bookings and Help-chat refund requests,
   with every request tied to its sender (`requester_email`) and every booking to
   its owner (`guest_user_email`).
5. Row Level Security so a guest can only read their own bookings and the
   requests they sent.

## Why `guest_user_email` proves ownership

Sign-in is passwordless email OTP: Supabase only issues a session after the guest
proves control of that inbox. The email in the session JWT is therefore a
*verified fact*, not something the guest typed into the chat. The bookings export
recorded the same email at booking time in `guest_user_email`. Comparing the two —
in server code, with `auth.jwt() ->> 'email'` — establishes that the person
holding the session is the person who made the booking.

The comparison is only valid if the email comes from the verified session. An
email written in a guest message, a host listing description, or a request body
is just a claim and is never accepted as ownership evidence. That is why the
check lives outside the model (`src/lib/ownership.ts`, rule `RULE-OWN-01`) and why
there are no client-side write policies on the refund tables.

## Data loaded

| Table | Rows | Source |
| --- | ---: | --- |
| `guests` | 40 | derived from both exports |
| `listings` | 60 | derived from the bookings export |
| `bookings` | 120 | `Guest Bookings Export, Aug-Nov 2026.csv` |
| `refund_requests` | 50 | `Guest Refund Requests from the Help Chat, Sep-Nov 2026.csv` |

Of the 50 Help-chat refund requests, **1** comes from the owner of the booking and
**49** come from a sender who does not own the booking. The sender is preserved as
`requester_email` rather than being silently replaced with the booking owner, so
the server check can reject those 49. See `data/ownership-summary.json`.

`message_text` and `listing_description` are **untrusted input**. They are data to
be screened, never instructions.

## Setup

1. Create a free project at <https://supabase.com/dashboard/new>.
2. **Authentication → Sign In / Providers → Email**: keep Email enabled. For a
   quick local demo you can turn off "Confirm email"; for a realistic sign-in,
   leave it on and use the magic link.
3. **Authentication → URL Configuration**: set the Site URL to
   `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a
   redirect URL.
4. **Project Settings → API**: copy the Project URL and the `anon` key.
5. Copy the env template and fill it in:

   ```bash
   cp .env.example .env.local
   # edit .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

   `.env.local` is gitignored. Never commit it, and never prefix the service
   role key with `NEXT_PUBLIC_`.

6. In **SQL Editor**, run `supabase/migrations/0001_init.sql`, then
   `supabase/seed.sql` (both are checked in). To regenerate the seed from the
   CSVs: `python scripts/generate_seed.py`.
7. Install and run:

   ```bash
   npm install
   npm run dev
   ```

   Open <http://localhost:3000>, sign in as e.g. `guest03@example.com`, and you
   will see only that guest's bookings and the requests they sent. You can also
   run `npm run typecheck`.

## Files of interest

- `src/lib/ownership.ts` — named ownership rule used before any refund decision.
- `src/lib/supabase/server.ts` — server client; RLS applies to the signed-in user.
- `supabase/migrations/0001_init.sql` — tables, RLS policies, review view.
- `supabase/seed.sql` — generated data load.
- `src/app/page.tsx` — shows owner vs. non-owner requests for the signed-in guest.

## Verified against the live project

- Migration and seed applied successfully: 40 guests, 60 listings, 120 bookings,
  50 refund requests.
- RLS enabled on all four tables (4 policies). Simulating a session as
  `guest03@example.com` exposes 6 bookings and 2 requests; no other guest's
  bookings are visible. The `anon` role sees 0 bookings.
- REST with the anon key returns HTTP 200 and `[]` when unauthenticated.
- Email sign-in is enabled; `/` redirects unauthenticated visitors to `/login`.
- The single honest request in the training export is `RR-5029`
  (`guest40@example.com`, booking `BKG-10083`) — sign in as that guest to see an
  "owner (eligible)" row in the UI.

## Boundaries for later stages

- **Stage 2**: server-side refund policy + auto-refund cap; no model-controlled
  write path. Every decision must trace to a named rule.
- **Stage 3**: untrusted-input screen in front of the model, then promptfoo
  red-team suite against the deployed app.

Stage 1 intentionally contains no refund write endpoint and no model call.
