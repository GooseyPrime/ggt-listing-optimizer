import { afterEach, describe, expect, it, vi } from "vitest";
import { startSale, verifySale } from "@/lib/payments";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  vi.unstubAllGlobals();
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
      returnUrl: "/tools/listing-optimizer",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.checkoutUrl).toBe("/tools/listing-optimizer?session_id=local");
    }
  });

  it("rejects local unlock redirects outside the tool path", async () => {
    delete process.env.NEXT_PUBLIC_SHOP_ORIGIN;
    process.env.NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK = "true";
    process.env.NEXT_PUBLIC_SHOP_SALE_PRODUCTS = "listing-optimizer";
    const result = await startSale({
      url: "https://example.com/tools/listing-optimizer",
      returnUrl: "https://evil.example/tools/listing-optimizer",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_return_url");
    }
  });
});

describe("verifySale", () => {
  it("requires a matching listing-optimizer product before unlocking", async () => {
    process.env.NEXT_PUBLIC_SHOP_ORIGIN = "https://www.goldengoosetools.com";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, paid: true, product: "seo-audit" })),
      ),
    );

    const result = await verifySale("sess_123");

    expect(result.ok).toBe(false);
    expect(result.paid).toBe(false);
    expect(result.message).toBe("The shop did not confirm a Listing Optimizer sale.");
  });

  it("passes product metadata to verify calls and accepts matching paid sessions", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "pending" })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, paid: true, product: "listing-optimizer" })),
      );
    process.env.NEXT_PUBLIC_SHOP_ORIGIN = "https://www.goldengoosetools.com";
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifySale("sess_456");

    expect(result.ok).toBe(true);
    expect(result.paid).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("product=listing-optimizer");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("toolId=listing-optimizer");
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"product":"listing-optimizer"');
    expect(String(fetchMock.mock.calls[1]?.[1]?.body)).toContain('"toolId":"listing-optimizer"');
  });

  it("accepts paid confirmations that omit product metadata", async () => {
    process.env.NEXT_PUBLIC_SHOP_ORIGIN = "https://www.goldengoosetools.com";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, paid: true }))),
    );

    const result = await verifySale("sess_999");

    expect(result.ok).toBe(true);
    expect(result.paid).toBe(true);
  });

  it("returns a structured error when verification fetch fails", async () => {
    process.env.NEXT_PUBLIC_SHOP_ORIGIN = "https://www.goldengoosetools.com";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const result = await verifySale("sess_789");

    expect(result).toMatchObject({
      ok: false,
      paid: false,
      kind: "network_error",
      message: "Could not reach the shop payment desk.",
    });
  });

  it("falls back to POST when GET verification fails", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, paid: true })));
    process.env.NEXT_PUBLIC_SHOP_ORIGIN = "https://www.goldengoosetools.com";
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifySale("sess_post_fallback");

    expect(result.ok).toBe(true);
    expect(result.paid).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("POST");
  });
});
