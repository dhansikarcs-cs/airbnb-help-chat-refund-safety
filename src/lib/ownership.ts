/**
 * Stage 1 ownership rule.
 *
 * `guest_user_email` proves that a booking belongs to the signed-in guest
 * because the email arrives from the *verified Supabase session*, not from the
 * conversation: passwordless sign-in only issues a session after the guest
 * proves control of that inbox. The booking export recorded the same email at
 * booking time. Matching the two therefore ties the row to the person holding
 * the session.
 *
 * The comparison MUST use the verified session email. An email typed in chat
 * or supplied in a request body is only a claim and is never accepted here.
 */
export const OWNERSHIP_RULE =
  "RULE-OWN-01: booking.guest_user_email must equal the verified Supabase session email" as const;

export type OwnershipDecision =
  | { decision: "ALLOW"; rule: typeof OWNERSHIP_RULE }
  | { decision: "DENY"; rule: typeof OWNERSHIP_RULE; reason: string };

function normalize(email: string | null | undefined): string | null {
  const value = email?.trim().toLowerCase();
  return value ? value : null;
}

export function assertGuestOwnsBooking(input: {
  /** Email from auth.getUser() / the verified JWT -- never from message text. */
  verifiedGuestEmail: string | null | undefined;
  /** bookings.guest_user_email for the booking being acted on. */
  bookingOwnerEmail: string | null | undefined;
}): OwnershipDecision {
  const sessionEmail = normalize(input.verifiedGuestEmail);
  const ownerEmail = normalize(input.bookingOwnerEmail);

  if (!sessionEmail) {
    return {
      decision: "DENY",
      rule: OWNERSHIP_RULE,
      reason: "No verified Supabase session email is available.",
    };
  }
  if (!ownerEmail) {
    return {
      decision: "DENY",
      rule: OWNERSHIP_RULE,
      reason: "The booking has no owner email on record.",
    };
  }
  if (sessionEmail !== ownerEmail) {
    return {
      decision: "DENY",
      rule: OWNERSHIP_RULE,
      reason: "The signed-in guest is not the owner of this booking.",
    };
  }
  return { decision: "ALLOW", rule: OWNERSHIP_RULE };
}
