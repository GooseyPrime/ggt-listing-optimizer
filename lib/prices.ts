/** Read cents from env that mirrors shop config. Never invent amounts. */
export function readPriceCents(raw: string | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/**
 * Single SKU price mirrored from shop via NEXT_PUBLIC_PRICE_CENTS.
 * Cos brief: $7 = 700 cents. If unset, the UI shows the paywall without inventing a figure.
 */
export function shopPriceCents(env?: Record<string, string | undefined>): number | null {
  const source = env ?? {
    NEXT_PUBLIC_PRICE_CENTS: process.env.NEXT_PUBLIC_PRICE_CENTS,
  };
  return readPriceCents(source.NEXT_PUBLIC_PRICE_CENTS);
}

export function shopPriceLabel(env?: Record<string, string | undefined>): string | null {
  const cents = shopPriceCents(env);
  if (cents == null) return null;
  return formatUsdFromCents(cents);
}
