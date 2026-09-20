import { describe, expect, it } from "vitest";
import { ETSY } from "@/lib/rules";
import { rewriteBatch, rewriteListing } from "@/lib/rewrite";
import { rewrittenListingsToCsv } from "@/lib/csv";
import type { ListingInput } from "@/lib/types";

const sample: ListingInput = {
  title: "ClayBird Speckled Mug Coffee Cup Gift",
  tags: ["mug", "ceramic mug", "coffee mug", "gift"],
  description:
    "Handmade mug for coffee drinkers. ClayBird studio piece. Measures 12 oz.",
  brandWords: ["ClayBird"],
};

describe("rewriteListing", () => {
  it("keeps title within limit and builds non-overlapping tags", () => {
    const row = rewriteListing(sample);
    expect([...row.newTitle].length).toBeLessThanOrEqual(ETSY.titleMaxChars);
    expect(row.tags.length).toBeGreaterThan(0);
    expect(row.tags.length).toBeLessThanOrEqual(ETSY.tagMaxCount);
    for (const tag of row.tags) {
      expect([...tag].length).toBeLessThanOrEqual(ETSY.tagMaxChars);
      expect(ETSY.tagCharset.test(tag)).toBe(true);
    }
    expect(row.firstParagraph.length).toBeGreaterThan(20);
    expect(row.brandWordsRetained).toContain("ClayBird");
    expect(row.keywords.length).toBeGreaterThan(0);
  });

  it("caps batch at 25", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...sample,
      title: `${sample.title} ${i}`,
    }));
    const result = rewriteBatch(many);
    expect(result.rows).toHaveLength(25);
    expect(result.capped).toBe(true);
    expect(result.omitted).toBe(5);
  });

  it("csv includes required columns", () => {
    const row = rewriteListing(sample);
    const csv = rewrittenListingsToCsv([row]);
    expect(csv.split("\n")[0]).toContain("new_title");
    expect(csv).toContain("brand_words_retained");
    expect(csv).toContain(row.newTitle);
  });
});
