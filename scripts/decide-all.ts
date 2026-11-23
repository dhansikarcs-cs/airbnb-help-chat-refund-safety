/**
 * Stage 2 batch run: decide all 50 Help-chat refund requests.
 * Run from the repo root:  npm run decide
 */
import fs from "node:fs";
import path from "node:path";
import { decideRefundRequest, type RefundDecisionCode } from "../src/lib/refund-policy";
import type { Booking, RefundRequest } from "../src/lib/types";

const dataDir = path.join(process.cwd(), "data");

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  const [header, ...data] = rows;
  return data
    .filter((cells) => cells.some((cell) => cell !== ""))
    .map((cells) => Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ""])));
}

const bookingRows = parseCsv(
  fs.readFileSync(path.join(dataDir, "Guest Bookings Export, Aug-Nov 2026.csv"), "utf8"),
);
const requestRows = parseCsv(
  fs.readFileSync(path.join(dataDir, "Guest Refund Requests from the Help Chat, Sep-Nov 2026.csv"), "utf8"),
);

const bookings: Booking[] = bookingRows.map((row) => ({
  booking_id: row.booking_id,
  guest_user_email: row.guest_user_email,
  guest_name: row.guest_name,
  listing_id: row.listing_id,
  listing_title: row.listing_title,
  host_name: row.host_name,
  listing_description: row.listing_description,
  booked_at: row.booked_at,
  check_in: row.check_in,
  check_out: row.check_out,
  nights: Number(row.nights),
  total_paid: Number(row.total_paid),
  cancellation_policy: row.cancellation_policy,
  booking_status: row.booking_status,
  amount_already_refunded: Number(row.amount_already_refunded),
}));

const requests: RefundRequest[] = requestRows.map((row) => ({
  request_id: row.request_id,
  submitted_at: row.submitted_at,
  requester_email: row.requester_email,
  booking_id: row.booking_id,
  request_reason: row.request_reason,
  requested_amount: Number(row.requested_amount),
  message_text: row.message_text,
  channel: row.channel,
}));

const bookingById = new Map(bookings.map((booking) => [booking.booking_id, booking]));

const decisions = requests.map((request) =>
  decideRefundRequest({
    booking: bookingById.get(request.booking_id) ?? null,
    request: {
      request_id: request.request_id,
      booking_id: request.booking_id,
      request_reason: request.request_reason,
      requested_amount: request.requested_amount,
      submitted_at: request.submitted_at,
    },
    // Batch simulation: the signed-in user is the person who submitted the
    // request. Production passes auth.getUser().email instead. The decision
    // function itself never reads request.requester_email.
    signedInEmail: request.requester_email,
  }),
);

if (decisions.length !== 50) {
  throw new Error(`Expected 50 decisions, got ${decisions.length}`);
}
const uniqueIds = new Set(decisions.map((decision) => decision.request_id));
if (uniqueIds.size !== 50) throw new Error("Duplicate request_id in decisions");

const columns = ["request_id", "booking_id", "request_reason", "refund_decision", "amount_usd"];
const csv = [
  columns.join(","),
  ...decisions.map((decision) =>
    columns
      .map((column) =>
        column === "amount_usd" ? decision.amount_usd.toFixed(2) : String(decision[column as keyof typeof decision]),
      )
      .join(","),
  ),
].join("\n") + "\n";
fs.writeFileSync(path.join(dataDir, "refund-decisions.csv"), csv, "utf8");

const counts: Record<RefundDecisionCode, number> = {
  blocked_not_owner: 0,
  blocked_ineligible: 0,
  escalated_human_approval: 0,
  approved: 0,
};
let totalApproved = 0;
let totalEscalated = 0;
for (const decision of decisions) {
  counts[decision.refund_decision] += 1;
  if (decision.refund_decision === "approved") totalApproved += decision.amount_usd;
  if (decision.refund_decision === "escalated_human_approval") totalEscalated += decision.amount_usd;
}
const summary = {
  decisions: decisions.length,
  counts,
  total_approved_usd: Number(totalApproved.toFixed(2)),
  total_escalated_usd: Number(totalEscalated.toFixed(2)),
  cap_usd: 500.0,
};
fs.writeFileSync(
  path.join(dataDir, "refund-decision-summary.json"),
  JSON.stringify(summary, null, 2) + "\n",
  "utf8",
);
console.log(JSON.stringify(summary, null, 2));
