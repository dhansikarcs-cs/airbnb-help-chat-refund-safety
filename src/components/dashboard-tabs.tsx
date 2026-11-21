"use client";

import { useState } from "react";
import { AlertIcon, CheckIcon, StarIcon } from "@/components/icons";
import { ListingThumb } from "@/components/listing-thumb";

export type BookingCardData = {
  booking_id: string;
  listing_id: string;
  listing_title: string;
  host_name: string;
  guest_user_email: string;
  check_in: string;
  check_out: string;
  nights: number;
  total_paid: number;
  cancellation_policy: string;
  booking_status: string;
};

export type RequestCardData = {
  request_id: string;
  booking_id: string;
  requester_email: string;
  requested_amount: number;
  request_reason: string;
  message_text: string;
  channel: string;
  submitted_at: string;
  owns: boolean;
};

const reasonLabels: Record<string, string> = {
  cancelled_before_check_in: "Cancelled before check-in",
  host_cancelled: "Host cancelled",
  listing_not_as_described: "Listing not as described",
  early_checkout: "Early checkout",
  duplicate_charge: "Duplicate charge",
};

const channelLabels: Record<string, string> = {
  web: "Web chat",
  ios_app: "iOS app",
  android_app: "Android app",
};

function formatDate(value: string) {
  const date = new Date(value.length <= 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function BookingCard({ booking }: { booking: BookingCardData }) {
  return (
    <article className="booking-card">
      <ListingThumb seed={booking.listing_id} className="booking-thumb" />
      <div className="booking-body">
        <div className="card-row">
          <span className={`soft-tag status-${booking.booking_status}`}>{booking.booking_status}</span>
          <span className="card-price">${booking.total_paid.toFixed(2)}</span>
        </div>
        <h3>{booking.listing_title}</h3>
        <p className="muted small">
          {booking.booking_id} · {booking.nights} nights · {formatDate(booking.check_in)} – {formatDate(booking.check_out)}
        </p>
        <p className="muted small">Hosted by {booking.host_name}</p>
        <div className="card-divider" />
        <div className="card-row footnote">
          <span>{booking.cancellation_policy} cancellation</span>
          <span className="owner-chip"><CheckIcon /> Your booking</span>
        </div>
      </div>
    </article>
  );
}

function RequestCard({ request }: { request: RequestCardData }) {
  return (
    <article className={`request-card ${request.owns ? "is-owner" : "is-foreign"}`}>
      <div className="card-row">
        <span className={`verdict ${request.owns ? "verdict-ok" : "verdict-deny"}`}>
          {request.owns ? <CheckIcon /> : <AlertIcon />}
          {request.owns ? "Owner — eligible" : "Not owner — refuse"}
        </span>
        <span className="card-price">${request.requested_amount.toFixed(2)}</span>
      </div>
      <h3>{reasonLabels[request.request_reason] ?? request.request_reason}</h3>
      <p className="muted small">
        {request.request_id} · {formatDate(request.submitted_at)} · {channelLabels[request.channel] ?? request.channel}
      </p>
      <div className="message-box">
        <span className="untrusted-tag">Untrusted message text</span>
        <p>“{request.message_text}”</p>
      </div>
      <div className="card-divider" />
      <div className="card-row footnote">
        <span>Booking {request.booking_id}</span>
        <span>Sender {request.requester_email}</span>
      </div>
    </article>
  );
}

export function DashboardTabs({
  bookings,
  requests,
}: {
  bookings: BookingCardData[];
  requests: RequestCardData[];
}) {
  const [tab, setTab] = useState<"bookings" | "requests">("bookings");

  return (
    <section className="tabs-section">
      <div className="tabs" role="tablist" aria-label="Your support data">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "bookings"}
          className={tab === "bookings" ? "tab active" : "tab"}
          onClick={() => setTab("bookings")}
        >
          Your stays <span className="tab-count">{bookings.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "requests"}
          className={tab === "requests" ? "tab active" : "tab"}
          onClick={() => setTab("requests")}
        >
          Refund requests <span className="tab-count">{requests.length}</span>
        </button>
      </div>

      {tab === "bookings" ? (
        <div role="tabpanel" className="card-grid">
          {bookings.length === 0 ? (
            <div className="empty-state">No bookings found for this guest.</div>
          ) : (
            bookings.map((booking) => <BookingCard key={booking.booking_id} booking={booking} />)
          )}
        </div>
      ) : (
        <div role="tabpanel" className="request-stack">
          <p className="screen-note">
            <StarIcon /> Each request stays tied to the person who sent it. A request for someone
            else&apos;s stay is refused by the server check — message text is never treated as an order.
          </p>
          {requests.length === 0 ? (
            <div className="empty-state">No refund requests sent by this guest.</div>
          ) : (
            requests.map((request) => <RequestCard key={request.request_id} request={request} />)
          )}
        </div>
      )}
    </section>
  );
}
