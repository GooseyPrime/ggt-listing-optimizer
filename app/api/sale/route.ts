import { startSale } from "@/lib/payments";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Proxies to shop POST /api/sale with
 * { url, product: "listing-optimizer", toolId: "listing-optimizer" }.
 * Refuses when listing-optimizer is not on the shop allowlist (no fallthrough).
 */
export async function POST(request: Request) {
  let body: { url?: unknown; returnUrl?: unknown };
  try {
    body = (await request.json()) as { url?: unknown; returnUrl?: unknown };
  } catch {
    return NextResponse.json({ ok: false, message: "Send a JSON body." }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const returnUrl = typeof body.returnUrl === "string" ? body.returnUrl.trim() : "";

  if (!returnUrl) {
    return NextResponse.json({ ok: false, message: "Missing return URL." }, { status: 400 });
  }

  const result = await startSale({
    url: url || "https://www.goldengoosetools.com/tools/listing-optimizer",
    returnUrl,
  });

  if (!result.ok) {
    const status = result.code === "sku_not_live" ? 503 : 400;
    return NextResponse.json(
      { ok: false, message: result.message, code: result.code },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    url: result.checkoutUrl,
    sessionId: result.sessionId,
  });
}
