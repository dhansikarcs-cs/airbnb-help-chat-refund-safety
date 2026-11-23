import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { screenWithModel } from "@/lib/injection-screen";
import { decideRefundRequest } from "@/lib/refund-policy";
import { deriveRequestFields, fallbackReply } from "@/lib/refund-chat";
import { createPaymentReceipt, type RefundReceipt } from "@/lib/payments";
import { generateSupportReply } from "@/lib/openrouter";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { booking_id?: string; message?: string };
  try {
    body = (await request.json()) as { booking_id?: string; message?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const bookingId = String(body.booking_id ?? "").trim();
  const message = String(body.message ?? "").trim();
  if (!bookingId || !message) {
    return NextResponse.json({ error: "Choose a booking and write a message." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const signedInEmail = authData.user?.email ?? null;
  if (!signedInEmail) {
    return NextResponse.json({ error: "Sign in with your guest email first." }, { status: 401 });
  }

  const { data: bookingRow, error: bookingError } = await supabase
    .from("bookings")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (bookingError) {
    return NextResponse.json({ error: "Could not load that booking." }, { status: 500 });
  }
  const booking = (bookingRow as Booking | null) ?? null;

  // Guard first. No model reply and no refund decision until this completes.
  const [messageScreen, listingScreen] = await Promise.all([
    screenWithModel({ text: message, source: "guest_message" }),
    screenWithModel({ text: booking?.listing_description ?? "", source: "listing_description" }),
  ]);

  const screens = {
    message: {
      verdict: messageScreen.verdict,
      rules: messageScreen.matchedRules,
      details: messageScreen.details,
    },
    listing: {
      verdict: listingScreen.verdict,
      rules: listingScreen.matchedRules,
      details: listingScreen.details,
    },
  };
  const safeListing = listingScreen.verdict === "stripped" ? listingScreen.safeText : booking?.listing_description ?? "";

  if (messageScreen.verdict === "blocked") {
    return NextResponse.json({
      reply: "I can't act on that message. It contains a hidden order trying to change how support works, so nothing has been paid.",
      blocked: true,
      decision: null,
      receipt: null,
      screens,
      safeListing,
    });
  }

  const { requested_amount, request_reason } = deriveRequestFields(message, booking);
  const decision = decideRefundRequest({
    booking,
    request: {
      request_id: `CHAT-${Date.now()}`,
      booking_id: bookingId,
      request_reason,
      requested_amount,
      submitted_at: new Date().toISOString(),
    },
    signedInEmail,
  });

  let receipt: RefundReceipt | null = null;
  if (decision.refund_decision === "approved") {
    receipt = await createPaymentReceipt({
      booking_id: bookingId,
      guest_user_email: signedInEmail,
      amount_usd: decision.amount_usd,
      rule: decision.rule,
    });
  }

  const fallback = fallbackReply({
    decision: decision.refund_decision,
    amount: decision.amount_usd,
    booking,
  });
  const reply = await generateSupportReply({
    facts: {
      paid: receipt !== null,
      amount_usd: receipt?.amount_usd ?? 0,
      booking_id: bookingId,
      decision: decision.refund_decision,
      reason: request_reason,
      payment_id: receipt?.payment_id ?? "",
    },
    fallback,
  });

  return NextResponse.json({
    reply,
    blocked: false,
    decision,
    receipt,
    screens,
    safeListing,
  });
}
