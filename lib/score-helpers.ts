import { ETSY, SCORE_BUDGET, TOTAL_POINTS, withRulesDate, type CheckResult } from "./rules";
import type { ListingInput, ListingScore, ScoreBreakdown } from "./types";

export const STOP = new Set([
  "a", "an", "the", "and", "or", "for", "of", "to", "in", "on", "with", "by", "from",
  "your", "our", "this", "that", "is", "are", "be", "as", "at", "it", "its",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function contentWords(text: string): string[] {
  return tokenize(text).filter((w) => w.length > 2 && !STOP.has(w));
}

export function firstParagraph(description: string): string {
  const parts = description.split(/\n\s*\n/);
  return (parts[0] ?? description).trim();
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function charLen(s: string): number {
  return [...s].length;
}

export function findOverlaps(tags: string[]): string[] {
  const wordToTags = new Map<string, string[]>();
  for (const tag of tags) {
    const ws = [...new Set(tokenize(tag).filter((w) => w.length > 2 && !STOP.has(w)))];
    for (const w of ws) {
      const list = wordToTags.get(w) ?? [];
      list.push(tag);
      wordToTags.set(w, list);
    }
  }
  const out: string[] = [];
  for (const [w, list] of wordToTags) {
    const unique = [...new Set(list)];
    if (unique.length >= 2) {
      out.push(`"${w}" in ${unique.map((t) => `"${t}"`).join(" & ")}`);
    }
  }
  return out;
}

export function hasWhat(para: string): boolean {
  if (!para) return false;
  const lower = para.toLowerCase();
  if (/(this is|these are|handmade|handcrafted|made of|made from|a set of|features)\b/.test(lower)) {
    return true;
  }
  return contentWords(para).length >= 4;
}

export function hasWho(para: string): boolean {
  if (!para) return false;
  return /\b(for|gift for|perfect for|ideal for|designed for|suited for|who)\b/i.test(para);
}

export function hasSize(para: string): boolean {
  if (!para) return false;
  return /(\d+(\.\d+)?\s?(cm|mm|in|inch|inches|ft|"|')|\bsize\b|\bmeasures?\b|\bdimensions?\b|\bsmall\b|\bmedium\b|\blarge\b)/i.test(
    para,
  );
}
