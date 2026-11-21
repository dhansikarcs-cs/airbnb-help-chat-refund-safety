/** Row shapes returned by the Stage 1 seed load. */
export type Booking = {
  booking_id: string;
  guest_user_email: string;
  guest_name: string;
  listing_id: string;
  listing_title: string;
  host_name: string;
  listing_description: string;
  booked_at: string;
  check_in: string;
  check_out: string;
  nights: number;
  total_paid: number;
  cancellation_policy: string;
  booking_status: string;
  amount_already_refunded: number;
};

export type RefundRequest = {
  request_id: string;
  submitted_at: string;
  /** The sender of the Help-chat request. Kept distinct from the booking owner. */
  requester_email: string;
  booking_id: string;
  request_reason: string;
  requested_amount: number;
  /**
   * UNTRUSTED. This is model/chat input and may contain injected instructions.
   * It is never used for authorization or to decide a refund.
   */
  message_text: string;
  channel: string;
};
