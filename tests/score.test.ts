import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RULES_CHECKED } from "@/lib/config";
import { scoreListing } from "@/lib/score";
import type { ListingInput } from "@/lib/types";

function loadFixture(name: string): ListingInput {
  const raw = readFileSync(resolve(__dirname, "../fixtures", name), "utf8");
  return JSON.parse(raw) as ListingInput;
}

describe("scoreListing", () => {
  it("scores a clean mug with transparent working and rulesChecked date", () => {
    const input = loadFixture("clean-mug.json");
    const result = scoreListing(input);
    expect(result.marketplace).toBe("etsy");
    expect(result.max).toBe(100);
    expect(result.total).toBeGreaterThan(70);
    expect(result.working.length).toBeGreaterThan(5);
    expect(result.checks.every((c) => c.rulesChecked === RULES_CHECKED)).toBe(true);
    expect(result.checks.some((c) => c.ruleName.includes("Title length"))).toBe(true);
  });

  it("fails hard limits on overlong title, too many tags, bad charset", () => {
    const input = loadFixture("messy-overlimit.json");
    const result = scoreListing(input);
    expect(result.total).toBeLessThan(50);
    const fails = result.checks.filter((c) => c.severity === "fail");
    expect(fails.length).toBeGreaterThanOrEqual(2);
    expect(result.checks.some((c) => /tag count/i.test(c.ruleName) && c.severity === "fail")).toBe(
      true,
    );
  });

  it("warns underfill and single-word tags on short listing", () => {
    const input = loadFixture("short-tags.json");
    const result = scoreListing(input);
    expect(result.checks.some((c) => /underfill/i.test(c.ruleName) && c.severity === "warn")).toBe(
      true,
    );
    expect(result.checks.some((c) => /single-word|shape|phrase/i.test(c.ruleName))).toBe(true);
  });

  it("is deterministic", () => {
    const input = loadFixture("clean-mug.json");
    const a = scoreListing(input);
    const b = scoreListing(input);
    expect(a.total).toBe(b.total);
    expect(a.working).toEqual(b.working);
  });
});
