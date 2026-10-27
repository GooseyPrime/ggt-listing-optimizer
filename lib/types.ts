import type { CheckResult } from "./rules";

export type Marketplace = "etsy" | "ebay";

export type ListingAttribute = {
  name: string;
  value: string;
};

export type ListingInput = {
  title: string;
  tags: string[];
  description: string;
  /** eBay only: optional paid subtitle. */
  subtitle?: string;
  attributes?: ListingAttribute[];
  brandWords?: string[];
};

export type ScoreBreakdown = {
  hardLimits: number;
  tagCompleteness: number;
  titleStructure: number;
  descriptionOpen: number;
  attributes: number;
};

export type ListingScore = {
  marketplace: Marketplace;
  total: number;
  max: number;
  breakdown: ScoreBreakdown;
  checks: CheckResult[];
  working: string[];
  input: ListingInput;
};

export type RewrittenListing = {
  newTitle: string;
  tags: string[];
  firstParagraph: string;
  keywords: string[];
  brandWordsRetained: string[];
  sourceTitle: string;
};

export type BatchRewriteResult = {
  rows: RewrittenListing[];
  capped: boolean;
  omitted: number;
};
