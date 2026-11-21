import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertGuestOwnsBooking } from "@/lib/ownership";
import type { Booking, RefundRequest } from "@/lib/types";
import { SiteHeader } from "@/components/site-header";
import { DashboardTabs, type BookingCardData, type RequestCardData } from "@/components/dashboard-tabs";
import { AlertIcon, CalendarIcon, ShieldIcon, WalletIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Verified email from the session -- never from chat text or a request body.
  const verifiedEmail = user.email ?? null;

  const [{ data: bookings }, { data: requests }] = await Promise.all([
    supabase.from("bookings").select("*").order("booked_at", { ascending: false }),
    supabase.from("refund_requests").select("*").order("submitted_at", { ascending: false }),
  ]);

  const ownedBookings = (bookings ?? []) as Booking[];
  const sentRequests = (requests ?? []) as RefundRequest[];
  const ownerByBooking = new Map(ownedBookings.map((b) => [b.booking_id, b.guest_user_email]));

  const bookingCards: BookingCardData[] = ownedBookings.map((b) => ({
    booking_id: b.booking_id,
    listing_id: b.listing_id,
    listing_title: b.listing_title,
    host_name: b.host_name,
    guest_user_email: b.guest_user_email,
    check_in: b.check_in,
    check_out: b.check_out,
    nights: b.nights,
    total_paid: b.total_paid,
    cancellation_policy: b.cancellation_policy,
    booking_status: b.booking_status,
  }));

  const requestCards: RequestCardData[] = sentRequests.map((r) => ({
    request_id: r.request_id,
    booking_id: r.booking_id,
    requester_email: r.requester_email,
    requested_amount: r.requested_amount,
    request_reason: r.request_reason,
    message_text: r.message_text,
    channel: r.channel,
    submitted_at: r.submitted_at,
    owns:
      assertGuestOwnsBooking({
        verifiedGuestEmail: verifiedEmail,
        bookingOwnerEmail: ownerByBooking.get(r.booking_id),
      }).decision === "ALLOW",
  }));

  const foreignCount = requestCards.filter((r) => !r.owns).length;
  const firstName = (ownedBookings[0]?.guest_name ?? verifiedEmail ?? "Guest").split(" ")[0];
  const totalSpent = ownedBookings.reduce((sum, b) => sum + b.total_paid, 0);

  return (
    <>
      <SiteHeader email={verifiedEmail} />
      <main className="dashboard">
        <div className="welcome-row">
          <div>
            <p className="eyebrow">GUEST SUPPORT DASHBOARD</p>
            <h1>Welcome back, {firstName}</h1>
            <p className="muted">Here&apos;s everything tied to your verified guest account.</p>
          </div>
          <form action={signOut}>
            <button className="outline-btn" type="submit">Sign out</button>
          </form>
        </div>

        <section className="trust-banner">
          <div className="trust-icon"><ShieldIcon /></div>
          <div>
            <h2>Ownership is checked before any refund</h2>
            <p>
              Your booking is matched to <strong>{verifiedEmail}</strong>, the email Supabase
              verified when you signed in. Text inside a message or listing description is
              never used as proof of ownership.
            </p>
          </div>
          <span className="trust-pill">RULE-OWN-01</span>
        </section>

        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-icon coral"><CalendarIcon /></span>
            <div><strong>{ownedBookings.length}</strong><span>Your stays</span></div>
          </div>
          <div className="stat-card">
            <span className="stat-icon blue"><WalletIcon /></span>
            <div><strong>${totalSpent.toFixed(0)}</strong><span>Total booked</span></div>
          </div>
          <div className="stat-card">
            <span className="stat-icon amber"><AlertIcon /></span>
            <div><strong>{foreignCount}</strong><span>Requests refused</span></div>
          </div>
        </div>

        <DashboardTabs bookings={bookingCards} requests={requestCards} />

        <footer className="dashboard-footer">
          <span>Airbnb Help Chat Refund Safety · Stage 1</span>
          <span>Built for the Guest Support Platform security review</span>
        </footer>
      </main>
    </>
  );
}
