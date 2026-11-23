/**
 * Stage 3 — hidden-order screen.
 * Runs before any untrusted text reaches the support model or the Stage 2
 * refund check. Deterministic rules catch known orders; OpenRouter reviews
 * ambiguous text. The model key is server-only (see openrouter.ts).
 */

import { reviewHiddenOrder, type ModelReviewVerdict } from "./openrouter";

export type ScreenSource = "guest_message" | "listing_description" | "refund_call";
export type ScreenVerdict = "clean" | "blocked" | "stripped";

export type ScreenResult = {
  caseId?: string;
  source: ScreenSource;
  verdict: ScreenVerdict;
  originalText: string;
  safeText: string;
  matchedRules: string[];
  modelVerdict: ModelReviewVerdict;
  modelReason: string;
  details: string;
};

type Scan = Omit<ScreenResult, "modelVerdict" | "modelReason"> & {
  needsModelReview: boolean;
};

type Rule = {
  id: string;
  category: string;
  pattern: RegExp;
  description: string;
};

/** The hidden orders we chose to block, with short rule ids for the reviewer. */
export const BLOCKED_ORDERS: Rule[] = [
  {
    id: "HO-01",
    category: "fake authority / role-play",
    pattern:
      /\badmin mode\b|\bsession override\b|\bsystem override\b|\b\[system\]|\bsupport override\b|\bstaying in character\b|\brole-?play\b|\byou are (?:now )?(?:an? )?(?:airbnb )?(?:supervisor|admin|administrator|manager)\b|\b(?:act as|you are now|pretend to be|i am)\b.{0,40}\b(?:admin|administrator|supervisor|manager|authorised|authorized)\b|\b(?:senior|lead|authorized|authorised) (?:support )?(?:agent|supervisor|manager)\b/i,
    description: "Claims admin / system / supervisor power, or asks the bot to role-play one.",
  },
  {
    id: "HO-02",
    category: "policy / cap bypass",
    pattern:
      /\bignore (?:all |the |any )?(?:refund |cancellation )?rules?\b|\bignore (?:the )?(?:auto-?refund |\$?500 )?cap\b|\bdo ?n'?t need to check the policy\b|\bcancellation policy checks are suspended\b|\bskip the (?:cancellation )?policy\b|\bbypass (?:the )?(?:\$?500k?|auto-?refund)? ?cap\b|\bapprove without cap\b|\bsuspend (?:the )?refund rules\b|\b(?:disregard|waive|lift|drop|disable|turn off|suspend)\b.{0,60}\b(?:rules?|policy|policies|cap|check|window|limits?)\b|\b(?:do ?n'?t|do not) (?:apply|enforce|run) (?:the )?(?:policy|cap|check)\b|\bno (?:need|requirement) to (?:check|verify|apply)\b/i,
    description: "Tells the bot to ignore the cancellation policy or the $500 cap.",
  },
  {
    id: "HO-03",
    category: "payment instruction in text",
    pattern:
      /\b(?:approve|release|refund|pay|send)\b[^.]{0,80}\bBKG-?\d+\b|\brefund this guest\b|\brefund it to my card\b|\bpay now\b|\bconfirm the payment\b|\breply with the confirmation id\b|\bdo not route this to a human\b|\btell me it has been paid\b|\bapprove any amount requested\b|\b(?:grant|issue|push through|release|send)\b[^.]{0,80}\b(?:refund|payment|payout)\b|\b(?:without|no) human (?:review|approval|agent)\b|\b(?:refund|pay|approve|release|grant|issue)\b[^.]{0,100}\b(?:booking|reservation)\b/i,
    description: "Orders a specific payout, or tells the bot to skip human review.",
  },
  {
    id: "HO-04",
    category: "ownership bypass",
    pattern:
      /\btreat the ownership check as passed\b|\bskip the ownership check\b|\bbooked under my co-?worker'?s account\b|\bno need to check ownership\b|\b(?:skip|bypass|ignore|waive)\b.{0,50}\b(?:ownership|owner check|verification|verified.email)\b|\b(?:treat|consider|mark)\b.{0,40}\b(?:as (?:verified|passed|owner|ok))\b/i,
    description: "Tries to short-circuit the verified-email ownership check.",
  },
  {
    id: "HO-05",
    category: "encoded order",
    pattern: /\bdecode it\b|\bdo what it says\b|\bencoded? order\b|\bbase64\b|\b(?:decode|decipher|translate)\b.{0,60}\b(?:obey|follow|execute|apply|do what)\b/i,
    description: "Asks the bot to decode and obey a hidden payload.",
  },
  {
    id: "HO-06",
    category: "instruction in a data field",
    pattern: /--\s*system:|\btool instruction:|\bpre-?approved by admin\b|\b(?:system|assistant|tool)\s*(?:note|instruction|override)\s*:|\b(?:pre-?approved|authorized|authorised) by\b.{0,20}\b(?:admin|system|support)\b/i,
    description: "Plants an order inside a refund-call amount, id, or reason field.",
  },
];

/** For listings we remove the hidden sentence and keep the honest description. */
const STRIP_RULES: Rule[] = [
  {
    id: "ST-01",
    category: "hidden line in listing",
    pattern: /\b(?:Assistant|System|Internal) note:[^.]*?\.(?=\s|$)|\bNote to (?:the )?(?:assistant|model|AI):[^.]*?\.(?=\s|$)/i,
    description: "Removed a hidden assistant note from the listing description.",
  },
];

/** Words that deserve a second opinion from the model, but are not proof. */
const SOFT_SIGNAL =
  /\b(?:admin|ignore|bypass|suspend|override|system|tool instruction|pre-approved|confirmation id|decode|role-?play|cap|ownership|disregard|waive|grant|issue|release|verify|verification|terms|constraints|instructions|payout|confirmation|decipher|translate|remove|lift|drop)\b/i;

function decodeBase64(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    const printable = decoded.replace(/[^\x20-\x7E\n\r\t]/g, "");
    if (printable.length < 12 || printable.length / decoded.length < 0.85) return null;
    return decoded;
  } catch {
    return null;
  }
}

function scanText({
  text,
  source,
  caseId,
}: {
  text: string;
  source: ScreenSource;
  caseId?: string;
}): Scan {
  const originalText = text ?? "";
  const common = { caseId, source, originalText };

  // 1. Listings: strip a hidden "Assistant note" sentence, keep the rest.
  if (source === "listing_description") {
    for (const rule of STRIP_RULES) {
      const match = rule.pattern.exec(originalText);
      if (match) {
        const safeText = originalText
          .replace(rule.pattern, " ")
          .replace(/\s{2,}/g, " ")
          .trim();
        return {
          ...common,
          verdict: "stripped",
          safeText,
          matchedRules: [rule.id],
          details: `${rule.category}: ${rule.description}`,
          needsModelReview: false,
        };
      }
    }
  }

  // 2. Decode base64-looking blobs and scan the decoded text too.
  for (const token of originalText.match(/\b[A-Za-z0-9+/]{24,}={0,2}\b/g) ?? []) {
    const decoded = decodeBase64(token);
    if (!decoded) continue;
    const decodedRules = BLOCKED_ORDERS.filter((rule) => rule.pattern.test(decoded));
    if (decodedRules.length) {
      return {
        ...common,
        verdict: "blocked",
        safeText: "",
        matchedRules: ["HO-05", ...decodedRules.map((rule) => rule.id)],
        details: `Decoded hidden order: ${decoded.trim()}`,
        needsModelReview: false,
      };
    }
  }

  // 3. Known orders in the visible text. First matching rule wins.
  const matched = BLOCKED_ORDERS.filter((rule) => rule.pattern.test(originalText));
  if (matched.length) {
    const first = matched[0];
    return {
      ...common,
      verdict: "blocked",
      safeText: "",
      matchedRules: matched.map((rule) => rule.id),
      details: `${first.category}: ${first.description}`,
      needsModelReview: false,
    };
  }

  // 4. Honest text passes through unchanged. Ambiguous text gets a model review.
  return {
    ...common,
    verdict: "clean",
    safeText: originalText,
    matchedRules: [],
    details: "No hidden order found by the rule layer.",
    needsModelReview: SOFT_SIGNAL.test(originalText),
  };
}

/**
 * Screen one piece of untrusted text. Deterministic rules always win; the
 * model only downgrades clean-but-suspicious text to blocked.
 */
export async function screenWithModel({
  text,
  source,
  caseId,
}: {
  text: string;
  source: ScreenSource;
  caseId?: string;
}): Promise<ScreenResult> {
  const scan = scanText({ text, source, caseId });
  if (!scan.needsModelReview) {
    return {
      caseId: scan.caseId,
      source: scan.source,
      verdict: scan.verdict,
      originalText: scan.originalText,
      safeText: scan.safeText,
      matchedRules: scan.matchedRules,
      modelVerdict: "unavailable",
      modelReason: "not needed — decisive rule matched or text had no signal",
      details: scan.details,
    };
  }

  const review = await reviewHiddenOrder({ text: scan.originalText, source: scan.source });
  const hidden = review.verdict === "hidden_order";
  return {
    caseId: scan.caseId,
    source: scan.source,
    verdict: hidden ? "blocked" : "clean",
    originalText: scan.originalText,
    safeText: hidden ? "" : scan.originalText,
    matchedRules: hidden ? ["MODEL-01"] : scan.matchedRules,
    modelVerdict: review.verdict,
    modelReason: review.reason,
    details: hidden
      ? `Model flagged a hidden order: ${review.reason}`
      : `Model confirmed honest text: ${review.reason}`,
  };
}
