import { afterEach, describe, expect, it } from "vitest";
import { startSale } from "@/lib/payments";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("startSale gate", () => {
  it("refuses when listing-optimizer is not on the shop allowlist", async () => {
    process.env.NEXT_PUBLIC_SHOP_ORIGIN = "https://www.goldengoosetools.com";
    process.env.NEXT_PUBLIC_SHOP_SALE_PRODUCTS = "seo-audit,accessibility";
    process.env.NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK = "false";
    const result = await startSale({
      url: "https://example.com/tools/listing-optimizer",
      returnUrl: "https://example.com/tools/listing-optimizer",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("sku_not_live");
    }
  });

  it("local unlock when shop origin unset and allow flag true", async () => {
    delete process.env.NEXT_PUBLIC_SHOP_ORIGIN;
    process.env.NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK = "true";
    process.env.NEXT_PUBLIC_SHOP_SALE_PRODUCTS = "listing-optimizer";
    const result = await startSale({
      url: "https://example.com/tools/listing-optimizer",
      returnUrl: "https://example.com/tools/listing-optimizer",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.checkoutUrl).toContain("session_id=local");
    }
  });
});
