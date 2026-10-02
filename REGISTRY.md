# Registry stub — Listing Optimizer

| Field | Value |
| --- | --- |
| id | `listing-optimizer` |
| kind | `tool` |
| path | `/tools/listing-optimizer` |
| priceLabel | `$7` (from shop; mirror `NEXT_PUBLIC_PRICE_CENTS=700`) |
| live | `false` |
| accent | Terracotta `#c07a55` (`--ggt-accent`) |

Groundwork adds the shop catalogue row — **do not PR the shop from this repo**.

## Sale desk

Shop `POST /api/sale` body (after allowlist merges):

```json
{ "url": "https://www.goldengoosetools.com/tools/listing-optimizer", "product": "listing-optimizer", "toolId": "listing-optimizer" }
```

When `NEXT_PUBLIC_SHOP_SALE_PRODUCTS` is unset, the app uses the default list of all ten shop products, including `listing-optimizer`. If explicitly set without `listing-optimizer`, the app **refuses checkout**. No fallthrough to SEO Audit pricing. Local unlock / graceful fail OK for development.
