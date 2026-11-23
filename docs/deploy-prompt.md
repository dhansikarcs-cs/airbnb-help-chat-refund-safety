# Stage 4 — live guarded guest support chat

## Prompt used for this build (our own wording)

> Put the guarded guest support chat live in the same repo at a public Vercel link. Add a `/chat` page with the same Airbnb UI/UX. Sign in with Supabase passwordless email and only trust `auth.getUser().email` as proof of ownership; never trust email or authority claims typed in chat. Before the support model sees anything, screen the guest message and the booking's listing text for the seven hidden-order techniques, match the technique rather than the example words, block guest-message orders and strip hidden listing lines. Only after the guard, call the free OpenRouter model to write a short reply using server facts only. Keep the OpenRouter key in `.env.local` as `OPENROUTER_API_KEY`, server-side only. Decide refunds in TypeScript with `AUTO_REFUND_CAP_USD = 500.00`: ownership, then eligibility window, then payable = total × policy percent − already refunded, capped at the ask, then $500 cap, then approval. If approved, issue the refund receipt and show the amount, booking and reference in the chat. Also audit the final 40 requests and 40 held-out bookings: count email matches/mismatches and flag hidden listing orders, non-cancelled bookings, asks above policy, prior refunds and extra-item asks. Save the results in the repo, commit and push so Vercel auto-deploys.

## Flow

```
/chat (React client)
  -> POST /api/refund-chat
      -> Supabase auth.getUser()          verified email only
      -> screenWithModel()                message + listing, guard first
      -> decideRefundRequest()            server TypeScript, no model
      -> createPaymentReceipt()           server-only audit/write
      -> generateSupportReply()           free model, facts only
```

## Files added

- `src/app/chat/page.tsx` — signed-in Airbnb-style chat page.
- `src/components/refund-chat.tsx` — chat UI, booking picker, refund receipt card.
- `src/app/api/refund-chat/route.ts` — guarded server route.
- `src/lib/refund-chat.ts` — server-side ask/reason helpers.
- `src/lib/payments.ts` — refund receipt, optional service-role audit row.
- `src/lib/openrouter.ts` — added support reply model after the screen.
- `supabase/migrations/0002_refund_payments.sql` — receipts table, read-own RLS.
- `scripts/audit-final.ts` — final 40-row trap audit.

## Final-data result

`npm run audit:final` writes `data/final-evaluation-traps.csv` and
`data/final-evaluation-summary.json`.

Result: **0 email matches, 40 mismatches**. Other traps: 4 hidden listing
orders, 8 still-confirmed bookings, 16 asks above the policy amount, 4 bookings
with money already refunded, 3 message/booking refund contradictions, 2 full
asks on Strict, and 1 extra-item ask.

## Deploy

Vercel is connected to the GitHub repo. Push to `main`; Vercel builds with
`npm run build`. Set these as Vercel environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENROUTER_API_KEY` (server-only)
- `OPENROUTER_MODEL` (optional, free model)
- `SUPABASE_SERVICE_ROLE_KEY` (optional, writes receipts to Supabase)

Never add `OPENROUTER_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` as `NEXT_PUBLIC_`.
