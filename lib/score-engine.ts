import { ETSY, SCORE_BUDGET, TOTAL_POINTS, withRulesDate, type CheckResult } from "./rules";
import type { ListingInput, ListingScore, ScoreBreakdown } from "./types";

import {
  tokenize,
  contentWords,
  firstParagraph,
  clamp,
  round2,
  charLen,
  findOverlaps,
  hasWhat,
  hasWho,
  hasSize,
} from "./score-helpers";

export function scoreListing(input: ListingInput): ListingScore {
  const checks: CheckResult[] = [];
  const working: string[] = [];
  const breakdown: ScoreBreakdown = {
    hardLimits: 0,
    tagCompleteness: 0,
    titleStructure: 0,
    descriptionOpen: 0,
    attributes: 0,
  };

  // --- Hard limits (35): title ≤140; tags ≤13; each ≤20; charset ---
  const hardPer = SCORE_BUDGET.hardLimits / 4;
  let hard = 0;

  const titleLen = charLen(input.title);
  if (!input.title) {
    checks.push(
      withRulesDate({
        id: "title-empty",
        ruleName: "Title length (Etsy ≤140)",
        severity: "fail",
        message: "Title is empty.",
        pointsMax: hardPer,
        pointsEarned: 0,
      }),
    );
    working.push(`Title length: empty → 0 / ${hardPer.toFixed(2)} (fail)`);
  } else if (titleLen > ETSY.titleMaxChars) {
    checks.push(
      withRulesDate({
        id: "title-over",
        ruleName: "Title length (Etsy ≤140)",
        severity: "fail",
        message: `Title is ${titleLen} characters (limit ${ETSY.titleMaxChars}).`,
        detail: `Over by ${titleLen - ETSY.titleMaxChars}.`,
        pointsMax: hardPer,
        pointsEarned: 0,
      }),
    );
    working.push(
      `Title length: ${titleLen} > ${ETSY.titleMaxChars} → 0 / ${hardPer.toFixed(2)} (fail)`,
    );
  } else {
    checks.push(
      withRulesDate({
        id: "title-ok",
        ruleName: "Title length (Etsy ≤140)",
        severity: "pass",
        message: `Title is ${titleLen} / ${ETSY.titleMaxChars} characters.`,
        pointsMax: hardPer,
        pointsEarned: hardPer,
      }),
    );
    hard += hardPer;
    working.push(
      `Title length: ${titleLen} ≤ ${ETSY.titleMaxChars} → ${hardPer.toFixed(2)} / ${hardPer.toFixed(2)}`,
    );
  }

  const tagCount = input.tags.length;
  if (tagCount > ETSY.tagMaxCount) {
    checks.push(
      withRulesDate({
        id: "tag-count-over",
        ruleName: "Tag count (Etsy up to 13)",
        severity: "fail",
        message: `${tagCount} tags entered (limit ${ETSY.tagMaxCount}).`,
        pointsMax: hardPer,
        pointsEarned: 0,
      }),
    );
    working.push(
      `Tag count: ${tagCount} > ${ETSY.tagMaxCount} → 0 / ${hardPer.toFixed(2)} (fail)`,
    );
  } else {
    checks.push(
      withRulesDate({
        id: "tag-count-ok",
        ruleName: "Tag count (Etsy up to 13)",
        severity: "pass",
        message: `${tagCount} / ${ETSY.tagMaxCount} tags used.`,
        pointsMax: hardPer,
        pointsEarned: hardPer,
      }),
    );
    hard += hardPer;
    working.push(
      `Tag count: ${tagCount} ≤ ${ETSY.tagMaxCount} → ${hardPer.toFixed(2)} / ${hardPer.toFixed(2)}`,
    );
  }

  const longTags = input.tags.filter((t) => charLen(t) > ETSY.tagMaxChars);
  if (longTags.length) {
    checks.push(
      withRulesDate({
        id: "tag-length",
        ruleName: "Tag length (Etsy ≤20 each)",
        severity: "fail",
        message: `${longTags.length} tag(s) over ${ETSY.tagMaxChars} characters.`,
        detail: longTags.map((t) => `"${t}" (${charLen(t)})`).join("; "),
        pointsMax: hardPer,
        pointsEarned: 0,
      }),
    );
    working.push(
      `Tag length: ${longTags.length} over limit → 0 / ${hardPer.toFixed(2)} (fail)`,
    );
  } else {
    checks.push(
      withRulesDate({
        id: "tag-length-ok",
        ruleName: "Tag length (Etsy ≤20 each)",
        severity: "pass",
        message:
          tagCount === 0
            ? "No tags to check for length."
            : `All ${tagCount} tag(s) are ≤ ${ETSY.tagMaxChars} characters.`,
        pointsMax: hardPer,
        pointsEarned: hardPer,
      }),
    );
    hard += hardPer;
    working.push(
      `Tag length: all ≤ ${ETSY.tagMaxChars} → ${hardPer.toFixed(2)} / ${hardPer.toFixed(2)}`,
    );
  }

  const badCharset = input.tags.filter((t) => t && !ETSY.tagCharset.test(t));
  if (badCharset.length) {
    checks.push(
      withRulesDate({
        id: "tag-charset",
        ruleName: "Tag charset (letters, numbers, spaces)",
        severity: "fail",
        message: `${badCharset.length} tag(s) use characters outside letters/numbers/spaces.`,
        detail: badCharset.map((t) => `"${t}"`).join("; "),
        pointsMax: hardPer,
        pointsEarned: 0,
      }),
    );
    working.push(
      `Tag charset: ${badCharset.length} invalid → 0 / ${hardPer.toFixed(2)} (fail)`,
    );
  } else {
    checks.push(
      withRulesDate({
        id: "tag-charset-ok",
        ruleName: "Tag charset (letters, numbers, spaces)",
        severity: "pass",
        message:
          tagCount === 0
            ? "No tags to check for charset."
            : "All tags use letters, numbers, and spaces only.",
        pointsMax: hardPer,
        pointsEarned: hardPer,
      }),
    );
    hard += hardPer;
    working.push(`Tag charset: clean → ${hardPer.toFixed(2)} / ${hardPer.toFixed(2)}`);
  }
  breakdown.hardLimits = round2(hard);

  // --- Tag completeness (25): fill + non-overlap ---
  const fillShare = SCORE_BUDGET.tagCompleteness * 0.55;
  const overlapShare = SCORE_BUDGET.tagCompleteness * 0.45;
  let tagComp = 0;

  const fillRatio = clamp(tagCount / ETSY.tagMaxCount, 0, 1);
  const fillPts = fillRatio * fillShare;
  tagComp += fillPts;
  if (tagCount < ETSY.tagMaxCount) {
    checks.push(
      withRulesDate({
        id: "tag-underfill",
        ruleName: "Tag underfill (aim for 13)",
        severity: "warn",
        message: `${tagCount} of ${ETSY.tagMaxCount} tag slots used.`,
        pointsMax: fillShare,
        pointsEarned: fillPts,
      }),
    );
  } else {
    checks.push(
      withRulesDate({
        id: "tag-fill-ok",
        ruleName: "Tag underfill (aim for 13)",
        severity: "pass",
        message: `All ${ETSY.tagMaxCount} tag slots filled.`,
        pointsMax: fillShare,
        pointsEarned: fillPts,
      }),
    );
  }
  working.push(
    `Tag fill: ${tagCount}/${ETSY.tagMaxCount} × ${fillShare.toFixed(2)} = ${fillPts.toFixed(2)}`,
  );

  const overlaps = findOverlaps(input.tags);
  const singleWord = input.tags.filter((t) => tokenize(t).length === 1 && t.length > 0);
  if (overlaps.length) {
    const penalty = clamp(overlaps.length / Math.max(tagCount, 1), 0, 1);
    const overlapPts = (1 - penalty) * overlapShare;
    tagComp += overlapPts;
    checks.push(
      withRulesDate({
        id: "tag-overlap",
        ruleName: "Tag overlap (shared words)",
        severity: "warn",
        message: `${overlaps.length} overlapping word pair(s) across tags.`,
        detail: overlaps.slice(0, 8).join("; "),
        pointsMax: overlapShare,
        pointsEarned: overlapPts,
      }),
    );
    working.push(
      `Tag overlap: ${overlaps.length} pair(s) → ${overlapPts.toFixed(2)} / ${overlapShare.toFixed(2)}`,
    );
  } else {
    tagComp += overlapShare;
    checks.push(
      withRulesDate({
        id: "tag-overlap-ok",
        ruleName: "Tag overlap (shared words)",
        severity: "pass",
        message: tagCount
          ? "No shared words across different tags."
          : "No tags to check for overlap.",
        pointsMax: overlapShare,
        pointsEarned: overlapShare,
      }),
    );
    working.push(`Tag overlap: none → ${overlapShare.toFixed(2)} / ${overlapShare.toFixed(2)}`);
  }

  if (singleWord.length) {
    checks.push(
      withRulesDate({
        id: "tag-single-word",
        ruleName: "Tag shape (phrases over single words)",
        severity: "soft",
        message: `${singleWord.length} single-word tag(s) — phrases often perform better (heuristic).`,
        detail: singleWord.slice(0, 8).map((t) => `"${t}"`).join("; "),
        pointsMax: 0,
        pointsEarned: 0,
      }),
    );
  }

  breakdown.tagCompleteness = round2(tagComp);

  // --- Title structure (20): non-empty + key terms in first 60 ---
  let titleStruct = 0;
  const nonEmptyShare = SCORE_BUDGET.titleStructure * 0.4;
  const previewShare = SCORE_BUDGET.titleStructure * 0.6;

  if (input.title) {
    titleStruct += nonEmptyShare;
    checks.push(
      withRulesDate({
        id: "title-present",
        ruleName: "Title present",
        severity: "pass",
        message: "Title is present.",
        pointsMax: nonEmptyShare,
        pointsEarned: nonEmptyShare,
      }),
    );
  } else {
    checks.push(
      withRulesDate({
        id: "title-present-fail",
        ruleName: "Title present",
        severity: "fail",
        message: "Title is missing.",
        pointsMax: nonEmptyShare,
        pointsEarned: 0,
      }),
    );
  }
  working.push(
    `Title present: ${input.title ? nonEmptyShare.toFixed(2) : "0.00"} / ${nonEmptyShare.toFixed(2)}`,
  );

  const preview = [...input.title].slice(0, ETSY.titlePhonePreviewChars).join("");
  const previewLower = preview.toLowerCase();
  const descKeys = contentWords(input.description).slice(0, 6);
  const productMissing = descKeys.filter(
    (k) => input.title.toLowerCase().includes(k) && !previewLower.includes(k),
  );

  if (!input.title) {
    checks.push(
      withRulesDate({
        id: "title-phone-preview",
        ruleName: "Title phone preview (first 60 chars — UX estimate)",
        severity: "soft",
        message: "No title to preview.",
        pointsMax: previewShare,
        pointsEarned: 0,
      }),
    );
    working.push(`Phone preview: no title → 0 / ${previewShare.toFixed(2)}`);
  } else if (productMissing.length) {
    const hitRatio = 1 - clamp(productMissing.length / Math.max(descKeys.length || 1, 1), 0, 0.6);
    const pts = hitRatio * previewShare;
    titleStruct += pts;
    checks.push(
      withRulesDate({
        id: "title-phone-preview",
        ruleName: "Title phone preview (first 60 chars — UX estimate)",
        severity: "soft",
        message: `First ${ETSY.titlePhonePreviewChars} chars may hide key product words (UX estimate, not a published Etsy rule).`,
        detail: `Preview: "${preview}${titleLen > ETSY.titlePhonePreviewChars ? "…" : ""}". Soft-missing: ${productMissing.slice(0, 5).join(", ")}`,
        pointsMax: previewShare,
        pointsEarned: pts,
      }),
    );
    working.push(
      `Phone preview soft: ${productMissing.length} term(s) → ${pts.toFixed(2)} / ${previewShare.toFixed(2)}`,
    );
  } else {
    titleStruct += previewShare;
    checks.push(
      withRulesDate({
        id: "title-phone-preview-ok",
        ruleName: "Title phone preview (first 60 chars — UX estimate)",
        severity: "pass",
        message: `Key product words appear within the first ${ETSY.titlePhonePreviewChars} characters (UX estimate).`,
        detail: `Preview: "${preview}${titleLen > ETSY.titlePhonePreviewChars ? "…" : ""}"`,
        pointsMax: previewShare,
        pointsEarned: previewShare,
      }),
    );
    working.push(`Phone preview: ok → ${previewShare.toFixed(2)} / ${previewShare.toFixed(2)}`);
  }
  breakdown.titleStructure = round2(titleStruct);

  // --- Description open (15): what / who / size in first paragraph ---
  const para = firstParagraph(input.description);
  const what = hasWhat(para);
  const who = hasWho(para);
  const size = hasSize(para);
  const hits = [what, who, size].filter(Boolean).length;
  const descPts = (hits / 3) * SCORE_BUDGET.descriptionOpen;
  breakdown.descriptionOpen = round2(descPts);
  const missingBits = [
    !what ? "what it is" : null,
    !who ? "who it is for" : null,
    !size ? "what size" : null,
  ].filter(Boolean);
  checks.push(
    withRulesDate({
      id: "desc-first-para",
      ruleName: "First paragraph covers what / who / size",
      severity: missingBits.length ? "soft" : "pass",
      message: missingBits.length
        ? `First paragraph soft-check: missing ${missingBits.join(", ")}.`
        : "First paragraph covers what it is, who it is for, and size (rules check).",
      detail: para
        ? `Opening: "${para.slice(0, 160)}${para.length > 160 ? "…" : ""}"`
        : "Description empty.",
      pointsMax: SCORE_BUDGET.descriptionOpen,
      pointsEarned: descPts,
    }),
  );
  working.push(
    `Description open: what=${what} who=${who} size=${size} → ${hits}/3 × ${SCORE_BUDGET.descriptionOpen} = ${descPts.toFixed(2)}`,
  );

  // --- Attributes (5) ---
  const attrs = input.attributes;
  if (!attrs || attrs.length === 0) {
    breakdown.attributes = SCORE_BUDGET.attributes;
    checks.push(
      withRulesDate({
        id: "attrs-skipped",
        ruleName: "Attributes (empty slots)",
        severity: "pass",
        message: "No attributes pasted — skipped (not counted against you).",
        pointsMax: SCORE_BUDGET.attributes,
        pointsEarned: SCORE_BUDGET.attributes,
      }),
    );
    working.push(
      `Attributes: not provided → ${SCORE_BUDGET.attributes.toFixed(2)} / ${SCORE_BUDGET.attributes.toFixed(2)} (skipped)`,
    );
  } else {
    const empty = attrs.filter((a) => !a.value.trim());
    const filledRatio = (attrs.length - empty.length) / attrs.length;
    const attrPts = filledRatio * SCORE_BUDGET.attributes;
    breakdown.attributes = round2(attrPts);
    if (empty.length) {
      checks.push(
        withRulesDate({
          id: "attrs-empty",
          ruleName: "Attributes (empty slots)",
          severity: "warn",
          message: `${empty.length} of ${attrs.length} attribute(s) left empty.`,
          detail: empty.map((a) => a.name).join(", "),
          pointsMax: SCORE_BUDGET.attributes,
          pointsEarned: attrPts,
        }),
      );
    } else {
      checks.push(
        withRulesDate({
          id: "attrs-ok",
          ruleName: "Attributes (empty slots)",
          severity: "pass",
          message: `All ${attrs.length} attribute(s) have values.`,
          pointsMax: SCORE_BUDGET.attributes,
          pointsEarned: attrPts,
        }),
      );
    }
    working.push(
      `Attributes: ${attrs.length - empty.length}/${attrs.length} filled → ${attrPts.toFixed(2)} / ${SCORE_BUDGET.attributes}`,
    );
  }

  const total = round2(
    breakdown.hardLimits +
      breakdown.tagCompleteness +
      breakdown.titleStructure +
      breakdown.descriptionOpen +
      breakdown.attributes,
  );
  working.push(
    `Total: ${breakdown.hardLimits} + ${breakdown.tagCompleteness} + ${breakdown.titleStructure} + ${breakdown.descriptionOpen} + ${breakdown.attributes} = ${total} / ${TOTAL_POINTS}`,
  );

  return {
    marketplace: "etsy",
    total,
    max: TOTAL_POINTS,
    breakdown,
    checks,
    working,
    input,
  };
}
