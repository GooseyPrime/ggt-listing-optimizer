import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { EBAY, EBAY_RULES_CHECKED, EBAY_SOURCES } from "@/lib/rules";
import { rewriteBatch, rewriteListing } from "@/lib/rewrite";
import { scoreListing } from "@/lib/score";
import type { ListingInput } from "@/lib/types";

function load(name: string): ListingInput {
  return JSON.parse(readFileSync(resolve(__dirname, "../fixtures", name), "utf8")) as ListingInput;
}

describe("scoreListing — eBay", () => {
  it("defaults to Etsy when no marketplace given", () => {
    expect(scoreListing(load("clean-mug.json")).marketplace).toBe("etsy");
  });

  it("scores a clean eBay listing 100 with working, dates, and sources", () => {
    const r = scoreListing(load("ebay-clean-mug.json"), "ebay");
    expect(r.marketplace).toBe("ebay");
    expect(r.max).toBe(100);
    expect(r.total).toBe(100);
    expect(r.working.at(-1)).toMatch(/= 100 \/ 100$/);
    expect(r.checks.every((c) => c.rulesChecked === EBAY_RULES_CHECKED)).toBe(true);
    const title = r.checks.find((c) => c.id === "ebay-title-ok");
    expect(title?.sourceUrl).toBe(EBAY_SOURCES.title);
    expect(r.checks.find((c) => c.id === "ebay-subtitle-ok")?.sourceUrl).toBe(EBAY_SOURCES.subtitle);
  });

  it("never runs Etsy tag checks for eBay", () => {
    const r = scoreListing(load("ebay-messy.json"), "ebay");
    expect(r.checks.some((c) => /tag/i.test(c.ruleName))).toBe(false);
    expect(r.breakdown.tagCompleteness).toBe(0);
    expect(r.working.some((w) => /ignored \(eBay listings have no tags\)/.test(w))).toBe(true);
  });

  it("fails messy listing: title >80, subtitle >55, warns empty specifics", () => {
    const input = load("ebay-messy.json");
    expect([...input.title].length).toBeGreaterThan(EBAY.titleMaxChars);
    const r = scoreListing(input, "ebay");
    const ids = r.checks.map((c) => `${c.id}:${c.severity}`);
    expect(ids).toContain("ebay-title-over:fail");
    expect(ids).toContain("ebay-subtitle-over:fail");
    expect(ids).toContain("ebay-specifics-empty:warn");
    // 0 + 0 hard; 1/4 of 30 specifics = 7.5
    expect(r.breakdown.hardLimits).toBe(0);
    expect(r.breakdown.attributes).toBe(7.5);
    expect(r.total).toBeLessThan(40);
  });

  it("fails an empty title", () => {
    const r = scoreListing({ title: "", tags: [], description: "x" }, "ebay");
    expect(r.checks.find((c) => c.id === "ebay-title-empty")?.severity).toBe("fail");
  });

  it("passes exactly 80 chars, fails 81", () => {
    const t80 = "a".repeat(80);
    expect(scoreListing({ title: t80, tags: [], description: "" }, "ebay").checks.some((c) => c.id === "ebay-title-ok")).toBe(true);
    expect(scoreListing({ title: t80 + "b", tags: [], description: "" }, "ebay").checks.some((c) => c.id === "ebay-title-over")).toBe(true);
  });

  it("skips specifics and subtitle when not pasted", () => {
    const r = scoreListing(load("ebay-no-specifics.json"), "ebay");
    expect(r.checks.some((c) => c.id === "ebay-specifics-skipped")).toBe(true);
    expect(r.checks.some((c) => c.id === "ebay-subtitle-skipped")).toBe(true);
  });

  it("is deterministic", () => {
    const a = scoreListing(load("ebay-messy.json"), "ebay");
    const b = scoreListing(load("ebay-messy.json"), "ebay");
    expect(a).toEqual(b);
  });
});

describe("rewrite — eBay", () => {
  it("keeps rewritten titles ≤80 and emits no tags", () => {
    for (const f of ["ebay-messy.json", "ebay-clean-mug.json", "messy-overlimit.json"]) {
      const row = rewriteListing(load(f), "ebay");
      expect([...row.newTitle].length).toBeLessThanOrEqual(EBAY.titleMaxChars);
      expect(row.newTitle.length).toBeGreaterThan(0);
      expect(row.tags).toEqual([]);
    }
  });

  it("batch respects eBay limit", () => {
    const res = rewriteBatch([load("messy-overlimit.json"), load("ebay-messy.json")], "ebay");
    expect(res.rows.every((r) => [...r.newTitle].length <= EBAY.titleMaxChars)).toBe(true);
  });
});
