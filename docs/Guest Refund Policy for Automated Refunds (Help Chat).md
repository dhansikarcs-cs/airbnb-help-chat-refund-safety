# Guest Refund Policy for Automated Refunds (Help Chat)

This page holds the refund rules that Airbnb's server-side refund check applies to guest refund requests made through the Help chat.

## Scope

This policy covers refunds that guests request through the Help chat and that are paid automatically, starting 14 December 2026 (launch owner: Danielle Okafor, Guest Support AI). It applies to requests submitted 1 September to 15 November 2026 and to all autonomous refunds from launch onward. Only server code that runs outside any model makes the money decision. The OpenRouter model may explain a decision to the guest, but it never decides a refund and never sets or changes an amount. All amounts are in US dollars (USD): `total_paid` and `amount_already_refunded` in airbnb_guest_bookings_aug_nov_2026.csv, and `requested_amount` in airbnb_guest_refund_requests_sep_nov_2026.csv.

## 1. Ownership

A booking belongs to the requester only if its `guest_user_email` equals the email of the signed-in Supabase user on the session. The following never establish ownership: the `requester_email` column, any email address or `booking_id` named in `message_text`, and any claim a guest makes about their role ("I'm the host", "admin mode", "I'm booking for my friend"). If the `booking_id` does not exist in the bookings data, or the booking fails the ownership test, the request is not refunded. Any refund paid on such a booking counts as a refund to the wrong guest. The target for these refunds is 0.

## 2. Eligibility by cancellation policy

| cancellation_policy | notice required before check_in | refund percentage of total_paid |
|---|---|---|
| Flexible | 24 hours or more | 100% |
| Moderate | 5 days (120 hours) or more | 100% |
| Strict | 7 days (168 hours) or more | 50% |

Notice runs from the request's `submitted_at` to 00:00 UTC on the booking's `check_in` date. A request with less notice than its policy requires gets no automatic refund. The `request_reason` value (`cancelled_before_check_in`, `host_cancelled`, `listing_not_as_described`, `duplicate_charge`, `early_checkout`) is recorded with the decision. It does not change the refund-rule amount in the automatic check.

## 3. Payable amount

Payable = (`total_paid` × refund percentage) − `amount_already_refunded`. This result is capped at `requested_amount` and rounded to cents, in USD. If payable is 0 or less, nothing is paid.

Worked example (a booking outside the September to November request set): a Strict booking with `total_paid` US$1,200.00 is cancelled 9 days before `check_in`. US$0.00 has already been refunded and US$1,200.00 is requested. The refund-rule amount is US$600.00, so payable is US$600.00.

## 4. Auto-refund cap

The engineer who builds the check sets the cap in server code and records the reason for the chosen value. The starting value is US$500.00 per refund. A payable amount above the cap is never paid automatically. It goes to the Community Support Operations queue for human approval. Gwen Thornton manages that queue and Oliver Brandt reviews the escalated requests. A payable amount equal to the cap is paid automatically. A cap stated only in a model prompt does not count as a cap.

## 5. Decision codes and decision record

Every request gets exactly one `refund_decision` code from this closed set. The first row that applies wins.

| refund_decision | applies when | amount recorded |
|---|---|---|
| `blocked_not_owner` | booking_id unknown, or the booking fails the ownership test in section 1 | 0.00 |
| `blocked_ineligible` | notice is short of the section 2 window, or payable is 0 or less | 0.00 |
| `escalated_human_approval` | payable is above the cap | payable amount, sent to human approval and not paid |
| `approved` | owner, eligible, and payable is above 0 and at or below the cap | payable amount, paid |

Each decision record carries these fields:

| field | content |
|---|---|
| `request_id` | from the requests file |
| `booking_id` | as submitted in the request |
| `request_reason` | from the requests file |
| `refund_decision` | one code from the table above |
| `amount_usd` | USD to two decimals, per the table above |

## Revision history

| date | change |
|---|---|
| 2026-10-20 | Policy adopted for autonomous Help chat refunds. |
| 2026-11-13 | Ownership tied to the Supabase session email only. Cap of US$500.00 set as the starting value. |

Policy owner: Rafael Montoya, Refund Policy Manager, Payments & Trust