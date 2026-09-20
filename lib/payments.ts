import {
  TOOL_ID,
  TOOL_PATH,
  allowLocalUnlock,
  listingOptimizerSaleLive,
  shopOrigin,
} from "./config";

export type SaleRequest = {
  /** Tool page URL (shop path or current origin+path). */
  url: string;
  returnUrl: string;
};

export type SaleResult =
  | { ok: true; checkoutUrl: string; sessionId?: string }
  | {
      ok: false;
      message: string;
      code?: "sku_not_live" | "unconfigured" | "shop_error" | "invalid_return_url";
    };

export type VerifyResult = {
  ok: boolean;
  paid: boolean;
  kind?: string;
  message?: string;
  sessionId?: string;
  paymentStatus?: string;
};

const LOCAL_SESSION = "local";

/**
 * Start checkout via shop POST /api/sale.
 * Body: { url, product: "listing-optimizer", toolId: "listing-optimizer" }
 *
 * NEVER falls through to seo-audit / accessibility. Until the desk allowlist includes
 * listing-optimizer, refuse here.
 */
export async function startSale(input: SaleRequest): Promise<SaleResult> {
  if (!listingOptimizerSaleLive()) {
    return {
      ok: false,
      code: "sku_not_live",
      message:
        "Checkout for Listing Optimizer is not live on the shop sale desk yet. The free one-listing score still works. We will not send you through SEO Audit or Accessibility checkout (that would charge the wrong price).",
    };
  }

  const origin = shopOrigin();
  if (!origin) {
    if (allowLocalUnlock()) {
      const next = buildLocalUnlockUrl(input.returnUrl);
      if (!next) {
        return {
          ok: false,
          code: "invalid_return_url",
          message: "Local unlock return URL must stay on /tools/listing-optimizer.",
        };
      }
      next.searchParams.set("session_id", LOCAL_SESSION);
      return {
        ok: true,
        checkoutUrl: `${next.pathname}${next.search}${next.hash}`,
        sessionId: LOCAL_SESSION,
      };
    }
    return {
      ok: false,
      code: "unconfigured",
      message: "Shop payments are not configured. Set NEXT_PUBLIC_SHOP_ORIGIN.",
    };
  }

  const body = JSON.stringify({
    url: input.url,
    product: TOOL_ID,
    toolId: TOOL_ID,
  });

  const result = await postSale(`${origin}/api/sale`, body);
  if (result.ok) return result;
  return { ok: false, code: "shop_error", message: result.message };
}

/**
 * Verify via shop GET /api/verify?session_id= or POST { sessionId }.
 * Unlock when ok && paid. $0 promo (paymentStatus "no_payment_required") still unlocks.
 */
export async function verifySale(sessionId: string): Promise<VerifyResult> {
  if (!sessionId) {
    return {
      ok: false,
      paid: false,
      kind: "invalid_request",
      message: "Missing checkout session id.",
    };
  }

  const origin = shopOrigin();
  if (!origin) {
    if (allowLocalUnlock() && sessionId === LOCAL_SESSION) {
      return {
        ok: true,
        paid: true,
        sessionId,
        kind: "local_unlock",
        paymentStatus: "no_payment_required",
      };
    }
    return {
      ok: false,
      paid: false,
      kind: "unconfigured",
      message: "Shop verification is not configured.",
    };
  }

  const getUrl = new URL(`${origin}/api/verify`);
  getUrl.searchParams.set("session_id", sessionId);
  getUrl.searchParams.set("product", TOOL_ID);
  getUrl.searchParams.set("toolId", TOOL_ID);

  let shouldTryPost = false;
  try {
    const getRes = await fetch(getUrl.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!getRes.ok) {
      shouldTryPost = true;
    } else {
      const getBody = await readJson(getRes);
      if (isVerifyShape(getBody)) return normalizeVerify(getBody, sessionId);
      return {
        ok: false,
        paid: false,
        kind: "invalid_response",
        message: "The shop did not confirm this sale.",
      };
    }
  } catch {
    shouldTryPost = true;
  }

  if (shouldTryPost) {
    try {
      const postRes = await fetch(`${origin}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          sessionId,
          session_id: sessionId,
          product: TOOL_ID,
          toolId: TOOL_ID,
        }),
      });
      const postBody = await readJson(postRes);
      if (isVerifyShape(postBody)) return normalizeVerify(postBody, sessionId);
    } catch {
      return {
        ok: false,
        paid: false,
        kind: "network_error",
        message: "Could not reach the shop payment desk.",
      };
    }
  }

  return {
    ok: false,
    paid: false,
    kind: "invalid_response",
    message: "The shop did not confirm this sale.",
  };
}

async function postSale(url: string, body: string): Promise<SaleResult> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
    });
    const data = await readJson(res);
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const checkoutUrl =
        asString(record.url) ?? asString(record.checkoutUrl) ?? asString(record.checkout_url);

      if (!res.ok || record.ok === false) {
        return {
          ok: false,
          code: "shop_error",
          message:
            asString(record.message) ??
            "The shop sale desk refused this checkout. Listing Optimizer may not be on the allowlist yet.",
        };
      }

      if (record.ok === true && checkoutUrl) {
        return {
          ok: true,
          checkoutUrl,
          sessionId: asString(record.sessionId) ?? asString(record.session_id),
        };
      }
      return {
        ok: false,
        code: "shop_error",
        message: asString(record.message) ?? "The shop could not start checkout.",
      };
    }
    return { ok: false, code: "shop_error", message: "The shop could not start checkout." };
  } catch {
    return {
      ok: false,
      code: "shop_error",
      message: "Could not reach the shop payment desk.",
    };
  }
}

function isVerifyShape(value: unknown): value is Record<string, unknown> {
  return Boolean(
    value && typeof value === "object" && ("paid" in (value as object) || "ok" in (value as object)),
  );
}

function normalizeVerify(data: Record<string, unknown>, sessionId: string): VerifyResult {
  const paymentStatus = asString(data.paymentStatus) ?? asString(data.payment_status);
  const paidFlag = data.paid === true;
  const zeroPromo = paymentStatus === "no_payment_required";
  const okFlag = data.ok === true;
  const productMatch = hasVerifiedProduct(data);
  const paid = okFlag && productMatch && (paidFlag || zeroPromo);

  return {
    ok: okFlag && productMatch,
    paid,
    kind: asString(data.kind),
    message:
      asString(data.message) ??
      (okFlag && (paidFlag || zeroPromo) && !productMatch
        ? "The shop did not confirm a Listing Optimizer sale."
        : undefined),
    sessionId: asString(data.sessionId) ?? asString(data.session_id) ?? sessionId,
    paymentStatus,
  };
}

function buildLocalUnlockUrl(returnUrl: string): URL | null {
  try {
    const next = new URL(returnUrl, "http://local.test");
    if (next.origin !== "http://local.test") return null;
    const pathname = next.pathname.replace(/\/$/, "") || "/";
    if (pathname !== TOOL_PATH) return null;
    return next;
  } catch {
    return null;
  }
}

function hasVerifiedProduct(data: Record<string, unknown>): boolean {
  const product =
    asString(data.product) ??
    asString(data.productId) ??
    asString(data.product_id) ??
    asString(data.toolId) ??
    asString(data.tool_id);
  return product ? product === TOOL_ID : true;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
