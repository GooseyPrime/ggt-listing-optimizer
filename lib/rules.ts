import { RULES_CHECKED } from "./config";

/** Published Etsy listing limits used by the free scorer (v1 marketplace = Etsy only). */
export const ETSY = {
  titleMaxChars: 140,
  titlePhonePreviewChars: 60,
  tagMaxCount: 13,
  tagMaxChars: 20,
  /** Letters, numbers, spaces only. */
  tagCharset: /^[A-Za-z0-9 ]+$/,
} as const;

export type CheckSeverity = "pass" | "warn" | "fail" | "soft";

export type CheckResult = {
  id: string;
  ruleName: string;
  severity: CheckSeverity;
  message: string;
  detail?: string;
  pointsMax: number;
  pointsEarned: number;
  rulesChecked: string;
  /** Official page the limit was verified against (eBay rules). */
  sourceUrl?: string;
};

export function withRulesDate(
  partial: Omit<CheckResult, "rulesChecked">,
): CheckResult {
  return { ...partial, rulesChecked: RULES_CHECKED };
}

/** Suggested 100-point split from MARKETPLACE_LIMITS_DRAFT.md */
export const SCORE_BUDGET = {
  hardLimits: 35,
  tagCompleteness: 25,
  titleStructure: 20,
  descriptionOpen: 15,
  attributes: 5,
} as const;

export const TOTAL_POINTS =
  SCORE_BUDGET.hardLimits +
  SCORE_BUDGET.tagCompleteness +
  SCORE_BUDGET.titleStructure +
  SCORE_BUDGET.descriptionOpen +
  SCORE_BUDGET.attributes;

/** Date the eBay limits below were verified against eBay's own pages. */
export const EBAY_RULES_CHECKED = "2026-10-27";

/**
 * Published eBay limits used by the eBay scorer. Each carries the official
 * eBay page it was checked against. eBay listings have no tags, so Etsy tag
 * checks never run for eBay.
 */
export const EBAY = {
  titleMaxChars: 80,
  subtitleMaxChars: 55,
  titlePreviewChars: 60,
} as const;

export const EBAY_SOURCES = {
  title:
    "https://www.ebay.com/help/selling/listings/listing-tips/optimizing-listings-best-match?id=4166",
  subtitle: "https://developer.ebay.com/api-docs/sell/inventory/types/slr:Product",
  itemSpecifics: "https://www.ebay.com/help/selling/listings/creating-listing?id=4105",
} as const;

export function withEbayRule(
  partial: Omit<CheckResult, "rulesChecked">,
): CheckResult {
  return { ...partial, rulesChecked: EBAY_RULES_CHECKED };
}

/** eBay 100-point split: no tags, so item specifics carry that weight. */
export const EBAY_SCORE_BUDGET = {
  hardLimits: 35,
  itemSpecifics: 30,
  titleStructure: 20,
  descriptionOpen: 15,
} as const;
