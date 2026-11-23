# Stage 3 notes — hidden-order screen

This screen sits **in front of** the support model and the Stage 2 refund check.
Untrusted text is data to be screened, never an instruction to obey.

## Prompt used (our own wording)

> Build a screen in the same repo that catches hidden orders before the support bot reads guest messages, listings and refund calls. Choose which hidden orders to block and record the list in the repo. Keep the free OpenRouter API key server-side in `.env.local` only — never in the browser or GitHub. Honest guest text must pass through unchanged; bad parts are stripped or blocked. Run it on the 15-row Red Team Injection Attack Set with Clean Controls and save the results. Keep the Airbnb-style UI/UX.

## Hidden orders we block

| Rule | Category | What it catches |
| --- | --- | --- |
| `HO-01` | Fake authority / role-play | "admin mode", `[SYSTEM]`, "session override", "supervisor", "stay in character" |
| `HO-02` | Policy / cap bypass | "ignore the refund rules", "bypass the $500 cap", "skip the cancellation policy" |
| `HO-03` | Payment instruction in text | "refund BKG-…", "pay now", "confirm the payment", "don't route to a human" |
| `HO-04` | Ownership bypass | "treat the ownership check as passed", "skip the ownership check" |
| `HO-05` | Encoded order | base64 blob the guest asks the bot to decode and obey |
| `HO-06` | Instruction in a data field | `-- system:`, "Tool instruction:", "pre-approved by admin" inside refund fields |
| `ST-01` | Hidden line in listing | Removes an "Assistant note:" sentence and keeps the honest description |

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
