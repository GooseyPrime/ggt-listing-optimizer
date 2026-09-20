/** Tool registry stub — shop may list id `listing-optimizer`, path `/tools/listing-optimizer`. */
export const TOOL_ID = "listing-optimizer";
export const PRODUCT_ID = "listing-optimizer";
export const TOOL_SLUG = "listing-optimizer";
export const TOOL_PATH = "/tools/listing-optimizer";
export const TOOL_NAME = "Listing Optimizer";
/** Terracotta — Cos accent for this tool. */
export const ACCENT = "#c07a55";

export const LIVE = false;

/** Free path scores one listing. Paid unlock rewrites up to this many. */
export const PAID_LISTING_CAP = 25;

/** Date constant shown on every check (rules last verified). */
export const RULES_CHECKED = "2026-09-20";

const DRAFT_STORAGE_KEY = "ggt-listing-optimizer-draft";
const BATCH_STORAGE_KEY = "ggt-listing-optimizer-batch";

export function draftStorageKey(): string {
  return DRAFT_STORAGE_KEY;
}

export function batchStorageKey(): string {
  return BATCH_STORAGE_KEY;
}

type Env = Record<string, string | undefined>;

function publicEnv(): Env {
  return {
    NEXT_PUBLIC_SHOP_ORIGIN: process.env.NEXT_PUBLIC_SHOP_ORIGIN,
    NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
    NEXT_PUBLIC_SHOP_SALE_PRODUCTS: process.env.NEXT_PUBLIC_SHOP_SALE_PRODUCTS,
    NEXT_PUBLIC_PRICE_CENTS: process.env.NEXT_PUBLIC_PRICE_CENTS,
    NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK: process.env.NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK,
  };
}

export function shopOrigin(env: Env = publicEnv()): string | null {
  const raw = env.NEXT_PUBLIC_SHOP_ORIGIN?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/**
 * Products the shop sale desk currently accepts.
 * Default (when unset): seo-audit|accessibility only. Until `listing-optimizer`
 * appears, checkout must refuse — never fall through (would be priced as SEO).
 */
export function shopSaleProducts(env: Env = publicEnv()): Set<string> {
  const raw = env.NEXT_PUBLIC_SHOP_SALE_PRODUCTS?.trim();
  const list = (raw && raw.length > 0 ? raw : "seo-audit,accessibility")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(list);
}

export function listingOptimizerSaleLive(env: Env = publicEnv()): boolean {
  return shopSaleProducts(env).has(TOOL_ID);
}

export function allowLocalUnlock(env: Env = publicEnv()): boolean {
  return env.NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK === "true";
}

export function publicBasePath(env: Env = publicEnv()): string {
  return env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";
}
