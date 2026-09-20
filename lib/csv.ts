import type { RewrittenListing } from "./types";

function escapeCell(value: string): string {
  const safeValue = /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

/** Spreadsheet columns for the paid unlock. */
export const CSV_HEADERS = [
  "new_title",
  "tags",
  "first_paragraph",
  "keyword_list",
  "brand_words_retained",
  "source_title",
] as const;

export function rewrittenListingsToCsv(rows: RewrittenListing[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      [
        escapeCell(row.newTitle),
        escapeCell(row.tags.join(", ")),
        escapeCell(row.firstParagraph),
        escapeCell(row.keywords.join(", ")),
        escapeCell(row.brandWordsRetained.join(", ")),
        escapeCell(row.sourceTitle),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export function downloadCsvFilename(): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `listing-optimizer-rewrites-${stamp}.csv`;
}
