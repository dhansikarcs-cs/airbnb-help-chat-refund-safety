/** Creates a refund receipt. Writes an audit row only when a service key exists. */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export type RefundReceipt = {
  payment_id: string;
  booking_id: string;
  amount_usd: number;
  status: "paid";
  rule: string;
  recorded: boolean;
  created_at: string;
};

export async function createPaymentReceipt(input: {
  booking_id: string;
  guest_user_email: string;
  amount_usd: number;
  rule: string;
}): Promise<RefundReceipt> {
  const payment_id = `RFD-${randomUUID().slice(0, 8).toUpperCase()}`;
  const created_at = new Date().toISOString();
  let recorded = false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    try {
      const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
      const { error } = await admin.from("refund_payments").insert({
        payment_id,
        booking_id: input.booking_id,
        guest_user_email: input.guest_user_email,
        amount: input.amount_usd,
        decision: "approved",
        rule: input.rule,
      });
      recorded = !error;
    } catch {
      recorded = false;
    }
  }

  return {
    payment_id,
    booking_id: input.booking_id,
    amount_usd: input.amount_usd,
    status: "paid",
    rule: input.rule,
    recorded,
    created_at,
  };
}
