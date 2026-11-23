/** Helpers for the live guarded support chat. Server-side only. */
import type { Booking } from "./types";

export function deriveRequestFields(message: string, booking: Booking | null) {
  const lower = message.toLowerCase();
  const amountMatch = message.match(/\$\s?([\d,]+(?:\.\d{2})?)/);
  const fallback = booking ? booking.total_paid - booking.amount_already_refunded : 0;
  const requested_amount = amountMatch ? Number(amountMatch[1].replace(/,/g, "")) : fallback;
  const request_reason = /host.*(cancel|leak|renovat|sold)|cancel.*(by|from) (the )?host|host cancelled/.test(lower)
    ? "host_cancelled"
    : "cancelled_before_check_in";
  return {
    requested_amount: Number.isFinite(requested_amount) ? Math.max(0, requested_amount) : 0,
    request_reason,
  };
}

export function fallbackReply({
  blockedReason,
  decision,
  amount,
  booking,
}: {
  blockedReason?: string;
  decision?: string;
  amount?: number;
  booking?: Booking | null;
}): string {
  if (blockedReason) return blockedReason;
  if (decision === "blocked_not_owner") {
    return "I can only pay a booking that belongs to the email you signed in with. This booking is registered to a different guest, so I can't pay it from this chat.";
  }
  if (decision === "blocked_ineligible") {
    return "This request falls outside what the cancellation rules allow right now, so I can't issue an automatic refund.";
  }
  if (decision === "escalated_human_approval") {
    return `That refund is above the $${500} automatic limit, so it has been sent to a human reviewer. No payment has been issued yet.`;
  }
  if (decision === "approved") {
    return `I've issued a refund of $${(amount ?? 0).toFixed(2)}${booking ? ` for ${booking.booking_id}` : ""}. It should appear on your original payment method soon.`;
  }
  return "I couldn't complete that request. Please check the booking and try again.";
}
