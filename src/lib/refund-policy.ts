/**
 * Stage 2 — server-side refund decision. No model is involved in this file.
 * Policy source: docs/Guest Refund Policy for Automated Refunds (Help Chat).md
 *
 * `message_text` is deliberately absent from the input type. A hidden order in
 * a guest message or host listing description is data to be screened, never an
 * instruction that can reach this function.
 */
import { assertGuestOwnsBooking } from "./ownership";
import type { Booking } from "./types";

export const AUTO_REFUND_CAP_USD = 500.0;
// Reason (build owner, verbatim): "It puts a balanced burden on human and ai
// and also following the refund policy of not making the cap only live in
// model prompt any value above 500 usd goes to oliver's review and 500 usd is
// the payable amount as of now". Therefore this cap lives in server code, not
// in a model prompt; exactly 500 is payable, anything above goes to Oliver's
// human review.

export const RULE_REFUND_OWNERSHIP = "RULE-REFUND-01: booking owner must equal verified session email";
export const RULE_REFUND_ELIGIBILITY = "RULE-REFUND-02: notice must meet the cancellation-policy window";
export const RULE_REFUND_PAYABLE = "RULE-REFUND-03: payable = total_paid × pct − already_refunded, capped at requested_amount";
export const RULE_REFUND_CAP = "RULE-REFUND-04: payable above cap goes to human approval";
export const RULE_REFUND_APPROVAL = "RULE-REFUND-05: 0 < payable ≤ cap is approved";

const CANCELLATION_RULES = {
  Flexible: { noticeHours: 24, refundPercent: 1 },
  Moderate: { noticeHours: 120, refundPercent: 1 },
  Strict: { noticeHours: 168, refundPercent: 0.5 },
} as const;

export type RefundDecisionCode =
  | "blocked_not_owner"
  | "blocked_ineligible"
  | "escalated_human_approval"
  | "approved";

export type RefundDecisionRecord = {
  request_id: string;
  booking_id: string;
  request_reason: string;
  refund_decision: RefundDecisionCode;
  amount_usd: number;
};

/** Extra trace fields are for the reviewer; the CSV uses only the five policy fields. */
export type RefundDecision = RefundDecisionRecord & {
  rule: string;
  details: string;
};

export type RefundDecisionInput = {
  booking: Booking | null | undefined;
  request: {
    request_id: string;
    booking_id: string;
    request_reason: string;
    requested_amount: number;
    submitted_at: string;
  };
  /** Email from the verified Supabase session (auth.getUser()), never from chat text. */
  signedInEmail: string | null | undefined;
};

function roundCents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Notice from submitted_at to 00:00 UTC on the check_in date, in hours. */
function noticeHours(submittedAt: string, checkIn: string): number {
  const checkInDate = new Date(checkIn);
  const midnightUtc = Date.UTC(
    checkInDate.getUTCFullYear(),
    checkInDate.getUTCMonth(),
    checkInDate.getUTCDate(),
  );
  return (midnightUtc - new Date(submittedAt).getTime()) / 3_600_000;
}

function decide(input: RefundDecisionInput) {
  const { booking, request, signedInEmail } = input;
  const base = {
    request_id: request.request_id,
    booking_id: request.booking_id,
    request_reason: request.request_reason,
  };

  // 1. Ownership — first matching row wins.
  if (!booking) {
    return {
      ...base,
      refund_decision: "blocked_not_owner" as const,
      amount_usd: 0,
      rule: RULE_REFUND_OWNERSHIP,
      details: "booking_id not found",
    };
  }
  const ownership = assertGuestOwnsBooking({
    verifiedGuestEmail: signedInEmail,
    bookingOwnerEmail: booking.guest_user_email,
  });
  if (ownership.decision === "DENY") {
    return {
      ...base,
      refund_decision: "blocked_not_owner" as const,
      amount_usd: 0,
      rule: RULE_REFUND_OWNERSHIP,
      details: ownership.reason,
    };
  }

  // 2. Eligibility window. request_reason is recorded but never changes the amount.
  const policy = CANCELLATION_RULES[booking.cancellation_policy as keyof typeof CANCELLATION_RULES];
  const notice = noticeHours(request.submitted_at, booking.check_in);
  if (!policy) {
    return {
      ...base,
      refund_decision: "blocked_ineligible" as const,
      amount_usd: 0,
      rule: RULE_REFUND_ELIGIBILITY,
      details: `unknown cancellation policy: ${booking.cancellation_policy}`,
    };
  }
  if (notice < policy.noticeHours) {
    return {
      ...base,
      refund_decision: "blocked_ineligible" as const,
      amount_usd: 0,
      rule: RULE_REFUND_ELIGIBILITY,
      details: `${booking.cancellation_policy} requires ${policy.noticeHours}h notice, got ${notice.toFixed(1)}h`,
    };
  }

  // 3. Payable amount.
  const ruleAmount = roundCents(booking.total_paid * policy.refundPercent - booking.amount_already_refunded);
  const payable = roundCents(Math.min(ruleAmount, request.requested_amount));
  if (payable <= 0) {
    return {
      ...base,
      refund_decision: "blocked_ineligible" as const,
      amount_usd: 0,
      rule: RULE_REFUND_PAYABLE,
      details: `rule amount ${ruleAmount.toFixed(2)}, payable ${payable.toFixed(2)}`,
    };
  }

  // 4. Cap. Equal to the cap is paid; above it is escalated and not paid.
  if (payable > AUTO_REFUND_CAP_USD) {
    return {
      ...base,
      refund_decision: "escalated_human_approval" as const,
      amount_usd: payable,
      rule: RULE_REFUND_CAP,
      details: `payable ${payable.toFixed(2)} exceeds cap ${AUTO_REFUND_CAP_USD.toFixed(2)}`,
    };
  }

  // 5. Approved.
  return {
    ...base,
    refund_decision: "approved" as const,
    amount_usd: payable,
    rule: RULE_REFUND_APPROVAL,
    details: `payable ${payable.toFixed(2)} within cap`,
  };
}

export function decideRefundRequest(input: RefundDecisionInput): RefundDecision {
  return decide(input);
}
