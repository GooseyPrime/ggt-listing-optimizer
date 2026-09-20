import { describe, expect, it } from "vitest";
import { readPriceCents, shopPriceLabel } from "@/lib/prices";

describe("prices", () => {
  it("reads cents and never invents", () => {
    expect(readPriceCents("700")).toBe(700);
    expect(readPriceCents(undefined)).toBeNull();
    expect(readPriceCents("7.00")).toBeNull();
    expect(shopPriceLabel({ NEXT_PUBLIC_PRICE_CENTS: "700" })).toMatch(/\$7/);
    expect(shopPriceLabel({})).toBeNull();
  });
});
