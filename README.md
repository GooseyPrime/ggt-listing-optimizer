# Golden Goose Tools — Listing Optimizer

Free Etsy listing score against published marketplace limits. Paid unlock: up to twenty-five rewritten listings as a downloadable spreadsheet.

Accent: Terracotta `#c07a55`. Registry id: `listing-optimizer`. Shop path: `/tools/listing-optimizer`.

**The shop registry `live` flag stays false until Brandon says otherwise.** This app can ship as a draft; it must not appear in the catalogue until a stranger can complete the product-brief acceptance test end to end.

## One-command local run

```bash
npm i && npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For the shop path without `basePath`, use [http://localhost:3000/tools/listing-optimizer](http://localhost:3000/tools/listing-optimizer).

Copy `.env.example` to `.env.local` if you want shop origin, mirrored price, or local unlock.

## What it does

1. Paste one Etsy listing (title, tags, description, optional attributes / brand words).
2. Free result: score out of 100 with arithmetic working. Every check names the rule and shows `rulesChecked` (`2026-09-20`).
3. Paid result (after the shop confirms the sale): rewrite up to 25 listings → CSV with new title, non-overlapping tags, first paragraph, keyword list, brand words retained.

Checks (Etsy only in free v1):

- Title ≤ 140 characters (fail if over/empty)
- First 60 characters phone preview soft warn (UX estimate)
- Up to 13 tags; each ≤ 20 chars; letters/numbers/spaces only
- Tag overlap, single-word soft warn, underfill warn
- First paragraph covers what / who / size (soft)
- Empty attributes warn when attributes are pasted

Never promises placement or sales. Not affiliated with Etsy. No Etsy logos.

## Design kit

Chrome comes only from [`ggt-design-kit`](https://github.com/GooseyPrime/ggt-design-kit):

```json
"ggt-design-kit": "github:GooseyPrime/ggt-design-kit"
```

Fonts: Fraunces, IBM Plex Sans, IBM Plex Mono via `next/font`. `--ggt-accent: #c07a55`. No Tailwind. No other UI library.

## Shop payment handshake

This repository holds **no Stripe secrets**. Money stays in [GoldenGooseTools](https://github.com/GooseyPrime/GoldenGooseTools).

1. Paywall POSTs this app’s `/api/sale`, which forwards to `{SHOP}/api/sale` with `toolId` / `product` `listing-optimizer`.
2. The shop returns a checkout URL. The browser goes there.
3. On return, this page POSTs `/api/verify` (proxied to `{SHOP}/api/verify`) with `session_id`.
4. If the shop says `paid: true`, the spreadsheet unlock opens. Draft stays in `sessionStorage`.

Price is read from env that **mirrors shop config**:

| Env | Role | Cos example only |
| --- | --- | --- |
| `NEXT_PUBLIC_SHOP_ORIGIN` | Shop origin | `https://www.goldengoosetools.com` |
| `NEXT_PUBLIC_PRICE_CENTS` | Price in cents | `700` ($7) |

If the price key is unset, the page does not invent a dollar figure.

Until `listing-optimizer` is on the shop sale allowlist (`NEXT_PUBLIC_SHOP_SALE_PRODUCTS`), checkout **refuses** rather than falling through to SEO Audit pricing.

Local development without a shop: set `NEXT_PUBLIC_ALLOW_LOCAL_UNLOCK=true`. Checkout then returns with `session_id=local`. Do not enable that in production.

## Subpath deploy

- Standalone / local: leave `NEXT_PUBLIC_BASE_PATH` empty. `/` and `/tools/listing-optimizer` both render the tool.
- Shop subpath: set `NEXT_PUBLIC_BASE_PATH=/tools/listing-optimizer`.

Keep registry `live: false` until Brandon turns it on.

## Checks

```bash
npm run typecheck
npm test
npm run build
```

CI runs those three on every pull request.

Fixtures under `fixtures/`: clean mug, messy over-limit listing, short/underfilled tags.

The score engine and rewrite rules live in `lib/` as deterministic TypeScript. The page only renders them.

Draft pull requests only. Brandon merges.
