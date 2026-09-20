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
