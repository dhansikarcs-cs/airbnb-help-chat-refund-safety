# Airbnb Help Chat Refund Safety — Stage 1 + Stage 2

Guest sign-in, owner-scoped data load, and a server-side refund check for the
guarded support-chat project. Built in TypeScript with Next.js (App Router) and
Supabase. The Airbnb-inspired UI/UX from Stage 1 stays in place.

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

## Stage 1 sign-off

Deliverable clause for this stage (what the build was asked to hand back):

- Row counts after the seed load: **40 guests, 60 listings, 120 bookings,
  50 refund requests**.
- RLS enabled on all four tables (4 policies). The `anon` role sees **0** bookings;
  a simulated `guest03@example.com` session sees only that guest's 6 bookings and
  2 requests, with no other owner's rows visible.
- Ownership proof: **1** refund request is from the booking owner, **49** are from
  senders who do not own the booking. Those 49 are refused by `RULE-OWN-01`.
- GitHub repo with README pushed:
  https://github.com/dhansikarcs-cs/airbnb-help-chat-refund-safety
- `.env.local` is gitignored (`git check-ignore` confirmed); only `.env.example`
  with placeholders is committed. No keys are in the repo.
- `npm run typecheck` and `npm run build` both pass.

## Stage 2 — refund check outside the model

The bot can chat, but it never approves a refund. `src/lib/refund-policy.ts` is a
pure TypeScript function in server code. Its input type deliberately excludes
`message_text`, so no planted line in a guest message or host listing can
influence a decision. Source policy:
`docs/Guest Refund Policy for Automated Refunds (Help Chat).md`.

Checks applied in order — **first matching row wins**:

1. **Ownership** — booking must exist and `guest_user_email` must equal the
   verified Supabase session email (`auth.getUser()` in production). Failure →
   `blocked_not_owner`, `0.00`.
2. **Eligibility** — notice from `submitted_at` to 00:00 UTC on `check_in`:
   Flexible ≥ 24h → 100%, Moderate ≥ 120h → 100%, Strict ≥ 168h → 50%.
   Less notice → `blocked_ineligible`, `0.00`. `request_reason` is recorded but
   never changes the amount.
3. **Payable** — `(total_paid × pct) − amount_already_refunded`, capped at
   `requested_amount`, rounded to cents. `≤ 0` → `blocked_ineligible`, `0.00`.
4. **Cap** — payable above US$500.00 → `escalated_human_approval`, amount
   recorded but not paid (Oliver Brandt's human review). Exactly US$500.00 is
   paid automatically.
5. **Approval** — owner + eligible + `0 < payable ≤ 500` → `approved`.

**Auto-refund cap: `AUTO_REFUND_CAP_USD = 500.00`.** Reason (verbatim from the
build owner):

> It puts a balanced burden on human and ai and also following the refund policy of not making the cap only live in model prompt any value above 500 usd goes to oliver's review and 500 usd is the payable amount as of now

The cap is a server-code constant, not a model-prompt line. Full notes and the
decision-record format are in `docs/stage-2-notes.md`.

### Run the 50 requests

```bash
npm run decide
```

This runs `scripts/decide-all.ts` over all 50 requests (`RR-5001`–`RR-5050`),
passing each `requester_email` as the simulated signed-in email (production
uses `auth.getUser()`), and writes exactly one five-field record per request:

`request_id, booking_id, request_reason, refund_decision, amount_usd`

Outputs: `data/refund-decisions.csv` and `data/refund-decision-summary.json`.

### Stage 2 decision summary (verified)

| Decision | Count |
| --- | ---: |
| `blocked_not_owner` | 49 |
| `blocked_ineligible` | 1 |
| `escalated_human_approval` | 0 |
| `approved` | 0 |

`total_approved_usd = 0`, `total_escalated_usd = 0`, cap = 500. The one owner
request, `RR-5029` (`guest40@example.com`, `BKG-10083`), is
`blocked_ineligible`: submitted 2026-10-12T16:29:47Z for a 2026-10-16 check-in
(≈79.5h notice), short of Moderate's 120h window. Its chat text claims "9 days",
but untrusted text never changes the amount. The other 49 requests fail
ownership before any amount is considered.

`npm run typecheck` and `npm run build` pass with Stage 2 included.

## Stage 2 prompt used (for the record)

These are the instructions actually given to Claude Code for this stage. The
course's suggested prompt was **not** used — only our own wording plus the
build owner's cap rationale, verbatim.

**Prompt 1 — build the check**

> Read `docs/Guest Refund Policy for Automated Refunds (Help Chat).md` (copied
> from the source export). In this same repo, write a TypeScript function in
> server code, outside the model, that decides a refund request. Do not add the
> course's suggested prompt text; use our own way. Use the signed-in Supabase
> session email (`auth.getUser()`) to check ownership against the booking's
> `guest_user_email` — never `requester_email`, `message_text`, or role claims.
> Apply the notice windows (Flexible ≥24h → 100%, Moderate ≥120h → 100%, Strict
> ≥168h → 50%), the payable formula `(total_paid × pct) − amount_already_refunded`
> capped at `requested_amount` and rounded to cents, and a cap constant
> `AUTO_REFUND_CAP_USD = 500.00` in server code. Cap reason, verbatim: "It puts a
> balanced burden on human and ai and also following the refund policy of not
> making the cap only live in model prompt any value above 500 usd goes to
> oliver's review and 500 usd is the payable amount as of now". Return exactly
> one `refund_decision` per request from `blocked_not_owner`,
> `blocked_ineligible`, `escalated_human_approval`, `approved` — first matching
> row wins. Save five-field decision records (`request_id`, `booking_id`,
> `request_reason`, `refund_decision`, `amount_usd`). Put notes in
> `docs/stage-2-notes.md` and keep the Airbnb-style UI/UX untouched.

**Prompt 2 — run all 50**

> Run that function on all 50 refund requests, `RR-5001` to `RR-5050`, from
> `data/Guest Refund Requests from the Help Chat, Sep-Nov 2026.csv`, looking up
> bookings in `data/Guest Bookings Export, Aug-Nov 2026.csv`. For this batch
> only, pass each `requester_email` as the simulated signed-in email; production
> passes `auth.getUser().email`. Save exactly one decision record per request
> with `request_id`, `booking_id`, `request_reason`, `refund_decision`,
> `amount_usd` to `data/refund-decisions.csv`, plus a summary JSON. Verify the
> counts and that `RR-5029` is `blocked_ineligible` (≈79.5h notice < 120h
> Moderate window).

**Hand-back clause**

> At the end, hand back: the checks list, cap value with the verbatim reason,
> decision counts, the `RR-5029` explanation, the run command and output files,
> confirmation that `typecheck`/`build`/`decide` pass, the GitHub URL with the
> README pushed, and confirmation that `.env.local` is gitignored.

## Boundaries for later stages

- **Stage 3**: untrusted-input screen in front of the model, then promptfoo
  red-team suite against the deployed app.

Stage 1 contains no refund write endpoint and no model call; Stage 2 adds a
server-only decision function but still no model-controlled write path.
