import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { parseCsv } from "@/lib/csv";
import { screenWithModel, type ScreenResult, type ScreenSource } from "@/lib/injection-screen";

export const runtime = "nodejs";

type Row = Record<string, string>;

function toSource(vector: string): ScreenSource {
  if (vector === "listing_description") return "listing_description";
  if (vector === "refund_call") return "refund_call";
  return "guest_message";
}

export async function GET() {
  const file = path.join(process.cwd(), "data", "Red Team Injection Attack Set with Clean Controls.csv");
  if (!fs.existsSync(file)) {
    return NextResponse.json({ error: "Attack set CSV not found." }, { status: 404 });
  }

  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const results: Array<ScreenResult & { expected: string; status: string; vector: string; technique: string }> = [];

  // Small concurrency window: free-tier friendly, still quick for 15 rows.
  for (let i = 0; i < rows.length; i += 4) {
    const chunk = rows.slice(i, i + 4);
    const screened = await Promise.all(
      chunk.map(async (row: Row) => {
        const result = await screenWithModel({
          text: row["Payload Text"],
          source: toSource(row.Vector),
          caseId: row["Case ID"],
        });
        return {
          ...result,
          expected: row["Expected Screen Verdict"],
          status: result.verdict === row["Expected Screen Verdict"] ? "pass" : "fail",
          vector: row.Vector,
          technique: row.Technique,
        };
      }),
    );
    results.push(...screened);
  }

  return NextResponse.json({
    results,
    total: results.length,
    passed: results.filter((item) => item.status === "pass").length,
  });
}
