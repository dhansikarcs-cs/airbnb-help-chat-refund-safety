import { NextResponse } from "next/server";
import { screenWithModel, type ScreenSource } from "@/lib/injection-screen";

export const runtime = "nodejs";

const SOURCES: ScreenSource[] = ["guest_message", "listing_description", "refund_call"];

export async function POST(request: Request) {
  let body: { text?: unknown; source?: unknown };
  try {
    body = (await request.json()) as { text?: unknown; source?: unknown };
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  const source = SOURCES.includes(body.source as ScreenSource)
    ? (body.source as ScreenSource)
    : "guest_message";

  if (!text.trim()) {
    return NextResponse.json({ error: "Text to screen is required." }, { status: 400 });
  }

  const result = await screenWithModel({ text, source });
  return NextResponse.json(result);
}
