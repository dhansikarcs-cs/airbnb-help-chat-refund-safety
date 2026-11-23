# Stage 2 notes — server-side refund check

These notes sit next to the source policy in `docs/Guest Refund Policy for Automated Refunds (Help Chat).md`. Read that file first; this one records how we implemented it.

## Checks the policy requires (in order — first match wins)

1. **Ownership (section 1).** The booking must exist and its `guest_user_email` must equal the **verified Supabase session email**. `requester_email`, an email or booking id inside `message_text`, and role claims ("admin mode", "I'm the host") never establish ownership. Failure → `blocked_not_owner`, `0.00`.
2. **Eligibility window (section 2).** Notice is measured from the request's `submitted_at` to **00:00 UTC on the booking's `check_in` date**:
   - Flexible: ≥ 24 hours → 100%
   - Moderate: ≥ 120 hours (5 days) → 100%
   - Strict: ≥ 168 hours (7 days) → 50%
   - Less notice than required → `blocked_ineligible`, `0.00`.
   - `request_reason` is recorded but never changes the automatic amount.
3. **Payable amount (section 3).** `payable = (total_paid × refund percentage) − amount_already_refunded`, then capped at `requested_amount`, then rounded to cents. If payable ≤ 0 → `blocked_ineligible`, `0.00`.
4. **Auto-refund cap (section 4).** Payable above the cap → `escalated_human_approval`, amount recorded but **not paid** (goes to Community Support Operations). Payable equal to the cap → paid automatically.
5. **Approval (section 5).** Owner + eligible + `0 < payable ≤ cap` → `approved`, amount paid.

## The cap and why we chose 500.00

`AUTO_REFUND_CAP_USD = 500.00`

**Reason given by the build owner (verbatim):**

> It puts a balanced burden on human and ai and also following the refund policy of not making the cap only live in model prompt any value above 500 usd goes to oliver's review and 500 usd is the payable amount as of now

In plain terms: the AI handles the routine refunds up to US$500.00, and anything above that goes to Oliver Brandt for human review in the Community Support Operations queue. The cap is a TypeScript constant in server code (`AUTO_REFUND_CAP_USD` in `src/lib/refund-policy.ts`), not text in a model prompt, so chat text cannot talk around it. A payable amount of exactly US$500.00 is still paid automatically; only amounts **above** the cap are escalated.

## Decision record

Exactly five columns, one row per request:

`request_id, booking_id, request_reason, refund_decision, amount_usd`

Output: `data/refund-decisions.csv`. A machine-readable summary is in `data/refund-decision-summary.json`.

## Where the model sits

Nowhere in this path. `src/lib/refund-policy.ts` is a pure function that takes a booking, the request fields it needs, and a **verified session email**. It does not read `message_text` at all — the type of its input deliberately excludes it — so a hidden order in a guest message or a host listing description cannot influence a decision. The future chat model may only *explain* a decision; it never writes one.

## Batch-run assumption

In production the session email comes from `supabase.auth.getUser()` in `src/lib/supabase/server.ts`. For the 50-request training batch there is no interactive sign-in, so the runner passes each request's `requester_email` as the simulated signed-in email — i.e. "the person who submitted this request, signed in". The decision function itself never looks at `requester_email`; it only trusts its `signedInEmail` argument. This is why the 49 requests sent by non-owners come back `blocked_not_owner`.
