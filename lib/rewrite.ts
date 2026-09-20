import { ETSY } from "./rules";
import { PAID_LISTING_CAP } from "./config";
import type { BatchRewriteResult, ListingInput, RewrittenListing } from "./types";

const STOP = new Set([
  "a", "an", "the", "and", "or", "for", "of", "to", "in", "on", "with", "by", "from",
  "your", "our", "this", "that", "is", "are", "be", "as", "at", "it", "its", "you", "we",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function contentWords(text: string): string[] {
  return tokenize(text).filter((w) => w.length > 2 && !STOP.has(w));
}

function charLen(s: string): number {
  return [...s].length;
}

function cleanTag(raw: string): string {
  return raw
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, ETSY.tagMaxChars)
    .trim();
}

function uniquePreserve(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** Prefer phrases; drop tags that share a content word with an earlier kept tag. */
function nonOverlappingTags(candidates: string[], limit: number): string[] {
  const kept: string[] = [];
  const usedWords = new Set<string>();
  for (const raw of candidates) {
    if (kept.length >= limit) break;
    const tag = cleanTag(raw);
    if (!tag || !ETSY.tagCharset.test(tag) || charLen(tag) > ETSY.tagMaxChars) continue;
    const words = contentWords(tag);
    if (words.some((w) => usedWords.has(w))) continue;
    for (const w of words) usedWords.add(w);
    kept.push(tag);
  }
  return kept;
}

function extractKeywords(input: ListingInput): string[] {
  const fromTitle = contentWords(input.title);
  const fromDesc = contentWords(input.description).slice(0, 20);
  const fromTags = input.tags.flatMap((t) => contentWords(t));
  return uniquePreserve([...fromTitle, ...fromTags, ...fromDesc]).slice(0, 24);
}

function buildTitle(input: ListingInput, keywords: string[]): string {
  const brand = (input.brandWords ?? []).filter(Boolean);
  const lead = uniquePreserve([
    ...brand,
    ...keywords.slice(0, 6).map((k) => k.replace(/^\w/, (c) => c.toUpperCase())),
  ]);
  let title = lead.join(" ").trim() || input.title.trim() || "Handmade listing";
  // Keep original title words that still fit if we have room
  if (charLen(title) < 80 && input.title) {
    const extra = input.title
      .split(/\s+/)
      .filter((w) => !title.toLowerCase().includes(w.toLowerCase()))
      .join(" ");
    if (extra) title = `${title} ${extra}`.trim();
  }
  if (charLen(title) > ETSY.titleMaxChars) {
    title = [...title].slice(0, ETSY.titleMaxChars).join("").replace(/\s+\S*$/, "").trim();
  }
  return title;
}

function buildTags(input: ListingInput, keywords: string[]): string[] {
  const phraseCandidates: string[] = [];
  // Two-word phrases from title + description
  const pool = `${input.title} ${input.description}`;
  const toks = contentWords(pool);
  for (let i = 0; i < toks.length - 1; i++) {
    phraseCandidates.push(`${toks[i]} ${toks[i + 1]}`);
  }
  for (const k of keywords) {
    if (k.length <= ETSY.tagMaxChars) phraseCandidates.push(k);
  }
  for (const t of input.tags) phraseCandidates.push(t);

  let tags = nonOverlappingTags(phraseCandidates, ETSY.tagMaxCount);
  // Fill remaining slots with unused keywords as short phrases
  if (tags.length < ETSY.tagMaxCount) {
    const fillers = keywords
      .filter((k) => !tags.some((t) => t.toLowerCase().includes(k)))
      .map((k) => (k.length <= ETSY.tagMaxChars ? k : k.slice(0, ETSY.tagMaxChars)));
    tags = nonOverlappingTags([...tags, ...fillers], ETSY.tagMaxCount);
  }
  return tags.slice(0, ETSY.tagMaxCount);
}

function buildFirstParagraph(input: ListingInput, keywords: string[]): string {
  const existing = input.description.split(/\n\s*\n/)[0]?.trim() ?? "";
  const what = keywords.slice(0, 3).join(" ") || "handmade item";
  const whoBit = /\bfor\b/i.test(existing)
    ? ""
    : " Perfect for anyone looking for a thoughtful handmade gift.";
  const sizeBit = /(\d+(\.\d+)?\s?(cm|mm|in|inch|inches)|size|measures|dimensions)/i.test(
    existing,
  )
    ? ""
    : " Size details: see attributes or message the shop for measurements.";

  if (existing && existing.length >= 40) {
    let para = existing.replace(/\s+/g, " ").trim();
    if (!/\bfor\b/i.test(para)) para += whoBit;
    if (!/(\d+(\.\d+)?\s?(cm|mm|in|inch)|size|measures|dimensions)/i.test(para)) {
      para += sizeBit;
    }
    return para.slice(0, 600);
  }

  return (
    `This is a ${what} made for everyday use and gifting.` +
    whoBit +
    sizeBit
  ).trim();
}

function retainBrandWords(input: ListingInput): string[] {
  const brands = input.brandWords ?? [];
  if (!brands.length) {
    // Heuristic: Title Case tokens that look like a brand (short Capitalized runs)
    const caps = input.title.match(/\b[A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?\b/g) ?? [];
    return uniquePreserve(caps).slice(0, 5);
  }
  const hay = `${input.title} ${input.description} ${input.tags.join(" ")}`.toLowerCase();
  return brands.filter((b) => hay.includes(b.toLowerCase()));
}

/** Deterministic rules-based rewrite for one listing (v1 — no model). */
export function rewriteListing(input: ListingInput): RewrittenListing {
  const keywords = extractKeywords(input);
  return {
    newTitle: buildTitle(input, keywords),
    tags: buildTags(input, keywords),
    firstParagraph: buildFirstParagraph(input, keywords),
    keywords,
    brandWordsRetained: retainBrandWords(input),
    sourceTitle: input.title,
  };
}

export function rewriteBatch(listings: ListingInput[]): BatchRewriteResult {
  const capped = listings.length > PAID_LISTING_CAP;
  const slice = listings.slice(0, PAID_LISTING_CAP);
  return {
    rows: slice.map(rewriteListing),
    capped,
    omitted: Math.max(0, listings.length - PAID_LISTING_CAP),
  };
}
