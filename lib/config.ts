/** Tool registry stub — shop may list id `listing-optimizer`, path `/tools/listing-optimizer`. */
export const TOOL_ID = "listing-optimizer";
export const PRODUCT_ID = "listing-optimizer";
export const TOOL_SLUG = "listing-optimizer";
export const TOOL_PATH = "/tools/listing-optimizer";
export const TOOL_NAME = "Listing Optimizer";
/** Citron accent (theme id `citron` in ggt-design-kit src/themes.css, applied on <html> in app/layout.tsx). */
export const ACCENT = "#b8b94e";

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

const DEFAULT_SALE_PRODUCTS =
  "seo-audit,accessibility,fix-it,a11y-statement,quote-invoice,chat-to-pdf,cottage-food-labels,maker-label-pack,listing-optimizer,domain-ssl-report";

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
 * Products the shop sale desk accepts (mirrors SALE_PRODUCT_IDS in the shop).
 * Override with NEXT_PUBLIC_SHOP_SALE_PRODUCTS; if it omits `listing-optimizer`,
 * checkout refuses rather than falling through to another product's price.
 */
export function shopSaleProducts(env: Env = publicEnv()): Set<string> {
  const raw = env.NEXT_PUBLIC_SHOP_SALE_PRODUCTS?.trim();
  const list = (raw && raw.length > 0 ? raw : DEFAULT_SALE_PRODUCTS)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(list);
}

export function listingOptimizerSaleLive(env: Env = publicEnv()): boolean {
  return shopSaleProducts(env).has(TOOL_ID);
}

export function allowLocalUnlock(env: Env = publicEnv()): boolean {
  // Development only: never honoured in a production build.
  return process.env.NODE_ENV !== "production" && env.NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK === "true";
}

export function publicBasePath(env: Env = publicEnv()): string {
  return env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";
}
