import {
  EBAY,
  EBAY_SCORE_BUDGET,
  EBAY_SOURCES,
  TOTAL_POINTS,
  withEbayRule,
  type CheckResult,
} from "./rules";
import type { ListingInput, ListingScore, ScoreBreakdown } from "./types";
import {
  charLen,
  contentWords,
  clamp,
  firstParagraph,
  hasSize,
  hasWhat,
  hasWho,
  round2,
} from "./score-helpers";

/**
 * Deterministic eBay score against eBay's published limits.
 * Tags are ignored (eBay listings have none). Breakdown keys are shared with
 * Etsy: `tagCompleteness` is always 0 for eBay and `attributes` holds item specifics.
 */
export function scoreEbayListing(input: ListingInput): ListingScore {
  const checks: CheckResult[] = [];
  const working: string[] = [];
  const breakdown: ScoreBreakdown = {
    hardLimits: 0,
    tagCompleteness: 0,
    titleStructure: 0,
    descriptionOpen: 0,
    attributes: 0,
  };
  const B = EBAY_SCORE_BUDGET;
  const half = B.hardLimits / 2;
  const titleRule = `Title length (eBay ≤${EBAY.titleMaxChars})`;

  // --- Hard limits (35): title ≤80 (17.5) + subtitle ≤55 if used (17.5) ---
  let hard = 0;
  const titleLen = charLen(input.title);
  if (!input.title) {
    checks.push(withEbayRule({ id: "ebay-title-empty", ruleName: titleRule, severity: "fail",
      message: "Title is empty.", pointsMax: half, pointsEarned: 0, sourceUrl: EBAY_SOURCES.title }));
    working.push(`Title length: empty → 0 / ${half.toFixed(2)} (fail)`);
  } else if (titleLen > EBAY.titleMaxChars) {
    checks.push(withEbayRule({ id: "ebay-title-over", ruleName: titleRule, severity: "fail",
      message: `Title is ${titleLen} characters (limit ${EBAY.titleMaxChars}).`,
      detail: `Over by ${titleLen - EBAY.titleMaxChars}.`, pointsMax: half, pointsEarned: 0,
      sourceUrl: EBAY_SOURCES.title }));
    working.push(`Title length: ${titleLen} > ${EBAY.titleMaxChars} → 0 / ${half.toFixed(2)} (fail)`);
  } else {
    hard += half;
    checks.push(withEbayRule({ id: "ebay-title-ok", ruleName: titleRule, severity: "pass",
      message: `Title is ${titleLen} / ${EBAY.titleMaxChars} characters.`, pointsMax: half,
      pointsEarned: half, sourceUrl: EBAY_SOURCES.title }));
    working.push(`Title length: ${titleLen} ≤ ${EBAY.titleMaxChars} → ${half.toFixed(2)} / ${half.toFixed(2)}`);
  }

  const subRule = `Subtitle length (eBay ≤${EBAY.subtitleMaxChars}, optional)`;
  const sub = (input.subtitle ?? "").trim();
  const subLen = charLen(sub);
  if (!sub) {
    hard += half;
    checks.push(withEbayRule({ id: "ebay-subtitle-skipped", ruleName: subRule, severity: "pass",
      message: "No subtitle pasted — skipped (subtitles are optional).", pointsMax: half,
      pointsEarned: half, sourceUrl: EBAY_SOURCES.subtitle }));
    working.push(`Subtitle: not provided → ${half.toFixed(2)} / ${half.toFixed(2)} (skipped)`);
  } else if (subLen > EBAY.subtitleMaxChars) {
    checks.push(withEbayRule({ id: "ebay-subtitle-over", ruleName: subRule, severity: "fail",
      message: `Subtitle is ${subLen} characters (limit ${EBAY.subtitleMaxChars}).`,
      detail: `Over by ${subLen - EBAY.subtitleMaxChars}.`, pointsMax: half, pointsEarned: 0,
      sourceUrl: EBAY_SOURCES.subtitle }));
    working.push(`Subtitle: ${subLen} > ${EBAY.subtitleMaxChars} → 0 / ${half.toFixed(2)} (fail)`);
  } else {
    hard += half;
    checks.push(withEbayRule({ id: "ebay-subtitle-ok", ruleName: subRule, severity: "pass",
      message: `Subtitle is ${subLen} / ${EBAY.subtitleMaxChars} characters.`, pointsMax: half,
      pointsEarned: half, sourceUrl: EBAY_SOURCES.subtitle }));
    working.push(`Subtitle: ${subLen} ≤ ${EBAY.subtitleMaxChars} → ${half.toFixed(2)} / ${half.toFixed(2)}`);
  }
  breakdown.hardLimits = round2(hard);

  // --- Item specifics (30): share of pasted specifics with values ---
  const specRule = "Item specifics (empty values)";
  const attrs = input.attributes;
  if (!attrs || attrs.length === 0) {
    breakdown.attributes = B.itemSpecifics;
    checks.push(withEbayRule({ id: "ebay-specifics-skipped", ruleName: specRule, severity: "pass",
      message: "No item specifics pasted — skipped (not counted against you).",
      pointsMax: B.itemSpecifics, pointsEarned: B.itemSpecifics, sourceUrl: EBAY_SOURCES.itemSpecifics }));
    working.push(`Item specifics: not provided → ${B.itemSpecifics.toFixed(2)} / ${B.itemSpecifics.toFixed(2)} (skipped)`);
  } else {
    const empty = attrs.filter((a) => !a.value.trim());
    const filled = attrs.length - empty.length;
    const pts = (filled / attrs.length) * B.itemSpecifics;
    breakdown.attributes = round2(pts);
    checks.push(withEbayRule({
      id: empty.length ? "ebay-specifics-empty" : "ebay-specifics-ok",
      ruleName: specRule,
      severity: empty.length ? "warn" : "pass",
      message: empty.length
        ? `${empty.length} of ${attrs.length} item specific(s) left empty.`
        : `All ${attrs.length} item specific(s) have values.`,
      detail: empty.length ? empty.map((a) => a.name).join(", ") : undefined,
      pointsMax: B.itemSpecifics, pointsEarned: pts, sourceUrl: EBAY_SOURCES.itemSpecifics }));
    working.push(`Item specifics: ${filled}/${attrs.length} filled → ${pts.toFixed(2)} / ${B.itemSpecifics.toFixed(2)}`);
  }

  // --- Title structure (20): present (8) + key words early (12, UX estimate) ---
  const presentShare = B.titleStructure * 0.4;
  const previewShare = B.titleStructure * 0.6;
  let ts = 0;
  if (input.title) ts += presentShare;
  checks.push(withEbayRule({ id: input.title ? "ebay-title-present" : "ebay-title-present-fail",
    ruleName: "Title present", severity: input.title ? "pass" : "fail",
    message: input.title ? "Title is present." : "Title is missing.",
    pointsMax: presentShare, pointsEarned: input.title ? presentShare : 0 }));
  working.push(`Title present: ${input.title ? presentShare.toFixed(2) : "0.00"} / ${presentShare.toFixed(2)}`);

  const preview = [...input.title].slice(0, EBAY.titlePreviewChars).join("").toLowerCase();
  const descKeys = contentWords(input.description).slice(0, 6);
  const late = descKeys.filter((k) => input.title.toLowerCase().includes(k) && !preview.includes(k));
  const previewRule = `Key words in first ${EBAY.titlePreviewChars} chars (UX estimate)`;
  let pPts = 0;
  if (input.title) {
    const ratio = late.length ? 1 - clamp(late.length / Math.max(descKeys.length, 1), 0, 0.6) : 1;
    pPts = ratio * previewShare;
  }
  ts += pPts;
  checks.push(withEbayRule({ id: "ebay-title-front", ruleName: previewRule,
    severity: !input.title || late.length ? "soft" : "pass",
    message: !input.title
      ? "No title to check."
      : late.length
        ? `Some product words appear late in the title (UX estimate, not a published eBay rule).`
        : `Key product words appear early in the title (UX estimate).`,
    detail: late.length ? `Late: ${late.slice(0, 5).join(", ")}` : undefined,
    pointsMax: previewShare, pointsEarned: pPts }));
  working.push(`Key words early: ${late.length} late → ${pPts.toFixed(2)} / ${previewShare.toFixed(2)}`);
  breakdown.titleStructure = round2(ts);

  // --- Description open (15): what / who / size ---
  const para = firstParagraph(input.description);
  const what = hasWhat(para);
  const who = hasWho(para);
  const size = hasSize(para);
  const hits = [what, who, size].filter(Boolean).length;
  const dPts = (hits / 3) * B.descriptionOpen;
  breakdown.descriptionOpen = round2(dPts);
  const missing = [!what && "what it is", !who && "who it is for", !size && "what size"].filter(Boolean);
  checks.push(withEbayRule({ id: "desc-first-para", ruleName: "First paragraph covers what / who / size",
    severity: missing.length ? "soft" : "pass",
    message: missing.length
      ? `First paragraph soft-check: missing ${missing.join(", ")}.`
      : "First paragraph covers what it is, who it is for, and size (rules check).",
    detail: para ? `Opening: "${para.slice(0, 160)}${para.length > 160 ? "…" : ""}"` : "Description empty.",
    pointsMax: B.descriptionOpen, pointsEarned: dPts }));
  working.push(`Description open: what=${what} who=${who} size=${size} → ${hits}/3 × ${B.descriptionOpen} = ${dPts.toFixed(2)}`);

  if (input.tags.length) {
    working.push(`Tags: ${input.tags.length} pasted — ignored (eBay listings have no tags).`);
  }

  const total = round2(breakdown.hardLimits + breakdown.attributes + breakdown.titleStructure + breakdown.descriptionOpen);
  working.push(
    `Total: ${breakdown.hardLimits} + ${breakdown.attributes} + ${breakdown.titleStructure} + ${breakdown.descriptionOpen} = ${total} / ${TOTAL_POINTS}`,
  );
  return { marketplace: "ebay", total, max: TOTAL_POINTS, breakdown, checks, working, input };
}
