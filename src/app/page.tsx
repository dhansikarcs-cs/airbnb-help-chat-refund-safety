import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertGuestOwnsBooking } from "@/lib/ownership";
import type { Booking, RefundRequest } from "@/lib/types";

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
    supabase
      .from("refund_requests")
      .select("*")
      .order("submitted_at", { ascending: false }),
  ]);

  const ownedBookings = (bookings ?? []) as Booking[];
  const sentRequests = (requests ?? []) as RefundRequest[];
  const ownerByBooking = new Map(ownedBookings.map((b) => [b.booking_id, b.guest_user_email]));

  return (
    <main>
      <h1>Guest support — Stage 1</h1>
      <p className="muted">
        Signed in as <strong>{verifiedEmail}</strong> (verified Supabase session).
      </p>
      <form action={signOut}>
        <button>Sign out</button>
      </form>

      <section className="card">
        <h2>Ownership rule</h2>
        <p>
          <code>guest_user_email</code> proves a booking belongs to the signed-in guest
          because it is compared with the email Supabase verified at sign-in. Chat
          text is never used as evidence of identity.
        </p>
      </section>

      <h2>Your bookings ({ownedBookings.length})</h2>
      <table>
        <thead>
          <tr><th>Booking</th><th>Listing</th><th>Owner email</th><th>Status</th><th>Paid</th></tr>
        </thead>
        <tbody>
          {ownedBookings.map((b) => (
            <tr key={b.booking_id}>
              <td>{b.booking_id}</td>
              <td>{b.listing_title}</td>
              <td>{b.guest_user_email}</td>
              <td>{b.booking_status}</td>
              <td>{b.total_paid.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Refund requests you sent ({sentRequests.length})</h2>
      <p className="muted">
        Each request is tied to its sender via <code>requester_email</code>. A
        request for someone else&apos;s booking is flagged and will be refused by
        the server-side check in Stage 2.
      </p>
      <table>
        <thead>
          <tr><th>Request</th><th>Booking</th><th>Sender</th><th>Amount</th><th>Ownership</th></tr>
        </thead>
        <tbody>
          {sentRequests.map((r) => {
            const decision = assertGuestOwnsBooking({
              verifiedGuestEmail: verifiedEmail,
              bookingOwnerEmail: ownerByBooking.get(r.booking_id),
            });
            const owns = decision.decision === "ALLOW";
            return (
              <tr key={r.request_id}>
                <td>{r.request_id}</td>
                <td>{r.booking_id}</td>
                <td>{r.requester_email}</td>
                <td>{r.requested_amount.toFixed(2)}</td>
                <td className={owns ? "good" : "bad"}>
                  {owns ? "owner (eligible)" : "NOT OWNER — refuse"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
