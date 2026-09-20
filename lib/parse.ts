import type { ListingAttribute, ListingInput } from "./types";

/** Split tags on commas or newlines; trim; drop empties; preserve order, first wins on dupes. */
export function parseTags(raw: string): string[] {
  const parts = raw
    .split(/[\n,]+/)
    .map((t) => t.trim().replace(/\s+/g, " "))
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/** Parse optional attributes block: "Name: value" per line. */
export function parseAttributes(raw: string): ListingAttribute[] {
  if (!raw.trim()) return [];
  const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const attrs: ListingAttribute[] = [];
  for (const line of lines) {
    const m = line.match(/^([^:]+):\s*(.*)$/);
    if (m) {
      attrs.push({ name: m[1]!.trim(), value: (m[2] ?? "").trim() });
    } else {
      attrs.push({ name: line, value: "" });
    }
  }
  return attrs;
}

export function parseBrandWords(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function buildListingInput(fields: {
  title: string;
  tagsRaw: string;
  description: string;
  attributesRaw?: string;
  brandWordsRaw?: string;
}): ListingInput {
  return {
    title: fields.title.trim(),
    tags: parseTags(fields.tagsRaw),
    description: fields.description.trim(),
    attributes: fields.attributesRaw ? parseAttributes(fields.attributesRaw) : undefined,
    brandWords: fields.brandWordsRaw ? parseBrandWords(fields.brandWordsRaw) : undefined,
  };
}

/**
 * Paid batch: listings separated by a line that is only `---` (three or more dashes).
 * Each block: first line = title, second line = tags (comma), rest = description.
 * Optional leading `Brand: …` line and `Attr: Name: value` lines are supported lightly.
 */
export function parseBatchListings(raw: string): ListingInput[] {
  const blocks = raw
    .split(/\n-{3,}\n/)
    .map((b) => b.trim())
    .filter(Boolean);
  const listings: ListingInput[] = [];
  for (const block of blocks) {
    const lines = block.split(/\n/);
    let brandWords: string[] | undefined;
    let i = 0;
    if (lines[0]?.toLowerCase().startsWith("brand:")) {
      brandWords = parseBrandWords(lines[0].slice(6));
      i = 1;
    }
    const title = (lines[i] ?? "").trim();
    const tagsRaw = (lines[i + 1] ?? "").trim();
    const rest = lines.slice(i + 2);
    const attrLines: string[] = [];
    const descLines: string[] = [];
    for (const line of rest) {
      if (/^attr:\s*/i.test(line)) {
        attrLines.push(line.replace(/^attr:\s*/i, ""));
      } else {
        descLines.push(line);
      }
    }
    listings.push({
      title,
      tags: parseTags(tagsRaw),
      description: descLines.join("\n").trim(),
      attributes: attrLines.length ? parseAttributes(attrLines.join("\n")) : undefined,
      brandWords,
    });
  }
  return listings;
}
