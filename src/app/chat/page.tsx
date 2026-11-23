import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Booking } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { RefundChat, type ChatBooking } from "@/components/refund-chat";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/chat");

  const { data } = await supabase
    .from("bookings")
    .select("*")
    .order("check_in", { ascending: true });
  const bookings: ChatBooking[] = ((data ?? []) as Booking[]).map((b) => ({
    booking_id: b.booking_id,
    listing_title: b.listing_title,
    listing_description: b.listing_description,
    check_in: b.check_in,
    total_paid: b.total_paid,
    cancellation_policy: b.cancellation_policy,
    booking_status: b.booking_status,
    amount_already_refunded: b.amount_already_refunded,
  }));

  return (
    <>
      <SiteHeader email={user.email} />
      <RefundChat bookings={bookings} email={user.email ?? "Guest"} />
    </>
  );
}
