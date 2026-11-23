/**
 * Stage 3 batch run: screen the 15-row red-team set with clean controls.
 * Run from the repo root:  npm run screen
 */
import fs from "node:fs";
import path from "node:path";
import { csvCell, parseCsv } from "../src/lib/csv";
import { screenWithModel, type ScreenResult, type ScreenSource } from "../src/lib/injection-screen";

type Row = Record<string, string>;

const dataDir = path.join(process.cwd(), "data");
const inputFile = path.join(dataDir, "Red Team Injection Attack Set with Clean Controls.csv");

function toSource(vector: string): ScreenSource {
  if (vector === "listing_description") return "listing_description";
  if (vector === "refund_call") return "refund_call";
  return "guest_message";
}

async function main() {
  const rows = parseCsv(fs.readFileSync(inputFile, "utf8"));
  if (rows.length !== 15) throw new Error(`Expected 15 red-team rows, got ${rows.length}`);

  const results: Array<ScreenResult & { expected: string; status: string; technique: string; caseType: string }> = [];
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
          technique: row.Technique,
          caseType: row["Case Type"],
        };
      }),
    );
    results.push(...screened);
  }

  const columns = [
    "case_id",
    "case_type",
    "vector",
    "technique",
    "expected_verdict",
    "screen_verdict",
    "status",
    "matched_rules",
    "model_verdict",
    "model_reason",
    "safe_text_preview",
  ];
  const csv = [
    columns.join(","),
    ...results.map((item) =>
      columns
        .map((column) => {
          switch (column) {
            case "case_id":
              return csvCell(item.caseId ?? "");
            case "case_type":
              return csvCell(item.caseType);
            case "vector":
              return csvCell(item.source);
            case "technique":
              return csvCell(item.technique);
            case "expected_verdict":
              return csvCell(item.expected);
            case "screen_verdict":
              return csvCell(item.verdict);
            case "status":
              return csvCell(item.status);
            case "matched_rules":
              return csvCell(item.matchedRules.join("+") || "-");
            case "model_verdict":
              return csvCell(item.modelVerdict);
            case "model_reason":
              return csvCell(item.modelReason);
            case "safe_text_preview":
              return csvCell(item.safeText.slice(0, 120));
            default:
              return "";
          }
        })
        .join(","),
    ),
  ].join("\n") + "\n";

  fs.writeFileSync(path.join(dataDir, "screen-results.csv"), csv, "utf8");

  const counts = {
    clean: results.filter((item) => item.verdict === "clean").length,
    blocked: results.filter((item) => item.verdict === "blocked").length,
    stripped: results.filter((item) => item.verdict === "stripped").length,
  };
  const summary = {
    screened: results.length,
    passed: results.filter((item) => item.status === "pass").length,
    failed: results.filter((item) => item.status === "fail").length,
    counts,
    model: process.env.OPENROUTER_MODEL || "google/gemma-4-26b-a4b-it:free",
    failures: results.filter((item) => item.status === "fail").map((item) => item.caseId),
  };
  fs.writeFileSync(
    path.join(dataDir, "screen-results-summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
    "utf8",
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
