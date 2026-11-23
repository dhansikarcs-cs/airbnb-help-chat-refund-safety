# Stage 3 notes — hidden-order screen

This screen sits **in front of** the support model and the Stage 2 refund check.
Untrusted text is data to be screened, never an instruction to obey.

## Prompt used (our own wording)

> Build a screen in front of the free OpenRouter model, in the same repo. Block exactly seven kinds of hidden orders: **(1)** fake authority / role-play — claiming power as admin, system, supervisor, or a character who can override rules; **(2)** rule or cap bypass — waiving or suspending a policy, the $500 cap, or a required check; **(3)** payment order in text — telling the bot to approve, pay, refund, confirm, or skip human review; **(4)** ownership-check bypass — telling the bot to skip or treat the verified-email ownership check as passed; **(5)** encoded order — asking the bot to decode and obey a hidden payload; **(6)** instruction in a refund field — planting an order in amount, booking-id, or reason fields; **(7)** hidden line in a listing — strip an "Assistant note" style order but keep the real description. **Match the technique, not the quoted example phrases.** A reworded claim of power, a reworded waiver of a check, or a reworded order to pay must still be caught. Honest text — including normal words like "admin" or "ignore my last message" — must pass through unchanged. Keep the key server-side in `.env.local` only — never in the browser or GitHub. Run it on the 15-row Red Team Injection Attack Set with Clean Controls, save the results, and keep the Airbnb-style UI/UX.

## Hidden orders we block

| Rule | Category | Technique it catches (quoted words are only examples) |
| --- | --- | --- |
| `HO-01` | Fake authority / role-play | Claiming power or a special role: "admin mode", `[SYSTEM]`, "supervisor", "stay in character" |
| `HO-02` | Policy / cap bypass | Waiving or suspending a rule, window, or dollar cap: "ignore the rules", "bypass the $500 cap" |
| `HO-03` | Payment instruction in text | Ordering a payout or skipping human review: "refund BKG-…", "pay now", "confirm the payment" |
| `HO-04` | Ownership bypass | Telling the bot to skip or pass the verified-email check: "treat ownership as passed" |
| `HO-05` | Encoded order | Hiding an order in an encoded blob the guest asks the bot to decode and obey |
| `HO-06` | Instruction in a data field | Planting an order in amount, booking-id or reason fields: `-- system:`, "Tool instruction:" |
| `ST-01` | Hidden line in listing | Strip a hidden "Assistant note" style order and keep the honest description |

Notes:
- For `listing_description` the hidden sentence is **stripped**, so the real
  property description still reaches the guest.
- For messages and refund calls the request is **blocked**; no text is passed on.
- `message_text` and listing text never reach the Stage 2 refund function anyway.

## Model and key handling

- Key: `OPENROUTER_API_KEY` in `.env.local` (gitignored). Never `NEXT_PUBLIC_`.
- Model: `OPENROUTER_MODEL`, default `google/gemma-4-26b-a4b-it:free` (a free model).
- Free providers get rate-limited, so the client falls back to other free models.
- The browser only calls our own API routes (`/api/screen`, `/api/screen/batch`).
  It never sees the key or calls OpenRouter directly.

## How the screen works

1. Deterministic rules run first. A matching known order decides immediately.
2. Base64-looking blobs are decoded and scanned too.
3. Honest text passes through unchanged. Text with a soft signal (e.g. the word
   "admin" used honestly) gets a second opinion from the free model.
4. The model can only downgrade clean-but-suspicious text to blocked; it cannot
   override a rule or change a refund amount.

## Run it

```bash
npm run screen
```

Outputs: `data/screen-results.csv` and `data/screen-results-summary.json`.
In the UI, open `/screen` and press **Run all 15 rows**.

Result: **15/15 matched** — 9 blocked, 1 stripped (`ATK-07`), 5 clean controls.
