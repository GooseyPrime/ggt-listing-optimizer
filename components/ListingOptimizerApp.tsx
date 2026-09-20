"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ACCENT,
  LIVE,
  PAID_LISTING_CAP,
  RULES_CHECKED,
  TOOL_NAME,
  TOOL_PATH,
  batchStorageKey,
  draftStorageKey,
  listingOptimizerSaleLive,
  publicBasePath,
} from "@/lib/config";
import { rewrittenListingsToCsv, downloadCsvFilename } from "@/lib/csv";
import { buildListingInput, parseBatchListings } from "@/lib/parse";
import { shopPriceLabel } from "@/lib/prices";
import { rewriteListing, rewriteBatch } from "@/lib/rewrite";
import { scoreListing } from "@/lib/score";
import type { ListingScore, RewrittenListing } from "@/lib/types";

type DraftFields = {
  title: string;
  tagsRaw: string;
  description: string;
  attributesRaw: string;
  brandWordsRaw: string;
};

const EMPTY: DraftFields = {
  title: "",
  tagsRaw: "",
  description: "",
  attributesRaw: "",
  brandWordsRaw: "",
};

export function ListingOptimizerApp() {
  const [draft, setDraft] = useState<DraftFields>(EMPTY);
  const [score, setScore] = useState<ListingScore | null>(null);
  const [batchRaw, setBatchRaw] = useState("");
  const [rewrites, setRewrites] = useState<RewrittenListing[] | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockNote, setUnlockNote] = useState("");
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);

  const saleLive = useMemo(() => listingOptimizerSaleLive(), []);
  const priceLabel = useMemo(() => shopPriceLabel(), []);
  const basePath = useMemo(() => publicBasePath(), []);

  const persistDraft = useCallback((next: DraftFields) => {
    try {
      sessionStorage.setItem(draftStorageKey(), JSON.stringify(next));
    } catch {
      /* private mode / quota */
    }
  }, []);

  const persistBatch = useCallback((raw: string) => {
    try {
      sessionStorage.setItem(batchStorageKey(), raw);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(draftStorageKey());
      if (raw) setDraft({ ...EMPTY, ...(JSON.parse(raw) as DraftFields) });
      const batch = sessionStorage.getItem(batchStorageKey());
      if (batch) setBatchRaw(batch);
    } catch {
      /* ignore */
    }

    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id") || params.get("sessionId");
    if (!sessionId) return;

    void (async () => {
      try {
        const res = await fetch(`${basePath}/api/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const result = (await res.json()) as {
          paid?: boolean;
          kind?: string;
          message?: string;
        };
        if (result.paid) {
          setUnlocked(true);
          setUnlockNote(
            result.kind === "local_unlock"
              ? "Local unlock (dev only)."
              : "Payment verified by the shop desk. Spreadsheet unlock is open for this browser session.",
          );
        } else if (result.message) {
          setError(result.message);
        }
      } catch {
        setError("Could not verify the checkout session.");
      }
    })();
  }, []);

  function updateField<K extends keyof DraftFields>(key: K, value: DraftFields[K]) {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      persistDraft(next);
      return next;
    });
    setError("");
  }

  function onScore() {
    setError("");
    setRewrites(null);
    const input = buildListingInput({
      title: draft.title,
      tagsRaw: draft.tagsRaw,
      description: draft.description,
      attributesRaw: draft.attributesRaw || undefined,
      brandWordsRaw: draft.brandWordsRaw || undefined,
    });
    if (!input.title && input.tags.length === 0 && !input.description) {
      setScore(null);
      setError("Paste a title, tags, and description to score.");
      return;
    }
    setScore(scoreListing(input));
    persistDraft(draft);
  }

  function onRewriteOne() {
    if (!unlocked) {
      setError("Spreadsheet unlock requires a verified shop purchase.");
      return;
    }
    const input = buildListingInput({
      title: draft.title,
      tagsRaw: draft.tagsRaw,
      description: draft.description,
      attributesRaw: draft.attributesRaw || undefined,
      brandWordsRaw: draft.brandWordsRaw || undefined,
    });
    setRewrites([rewriteListing(input)]);
  }

  function onRewriteBatch() {
    if (!unlocked) {
      setError("Spreadsheet unlock requires a verified shop purchase.");
      return;
    }
    setError("");
    const listings = parseBatchListings(batchRaw);
    if (!listings.length) {
      setError(
        "Paste up to 25 listings separated by a line with only --- (title, then tags, then description).",
      );
      return;
    }
    const result = rewriteBatch(listings);
    setRewrites(result.rows);
    if (result.capped) {
      setError(`Batch capped at ${PAID_LISTING_CAP} listings (${result.omitted} omitted).`);
    }
    persistBatch(batchRaw);
  }

  function onDownloadCsv() {
    if (!rewrites?.length) {
      setError("Generate rewrites first.");
      return;
    }
    if (!unlocked) {
      setError("CSV download requires a verified shop purchase.");
      return;
    }
    const csv = rewrittenListingsToCsv(rewrites);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = downloadCsvFilename();
    a.click();
    URL.revokeObjectURL(href);
  }

  async function onBuy() {
    setError("");
    setPaying(true);
    persistDraft(draft);
    persistBatch(batchRaw);
    try {
      const returnUrl = TOOL_PATH;
      const toolUrl = new URL(window.location.pathname || "/", window.location.origin).toString();
      const res = await fetch(`${basePath}/api/sale`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: toolUrl, returnUrl }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        url?: string;
        message?: string;
      };
      if (!res.ok || !data.ok || !data.url) {
        throw new Error(data.message || "Checkout failed.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
      setPaying(false);
    }
  }

  return (
    <main className="ggt-root" style={{ ["--ggt-accent" as string]: ACCENT }}>
      <div className="ggt-wrap">
        <header className="ggt-hero">
          <p className="ggt-eyebrow">Golden Goose Tools</p>
          <h1>{TOOL_NAME}</h1>
          <p className="ggt-lede">
            Paste one Etsy listing. Get a transparent score against published marketplace limits.
            Unlock up to {PAID_LISTING_CAP} rules-based rewrites as a spreadsheet
            {priceLabel ? ` (${priceLabel})` : ""}. We never promise sales or ranking.
          </p>
        </header>

        <p className="ggt-disclaimer">
          Checks follow Etsy&apos;s published listing limits (rules checked {RULES_CHECKED}).
          Golden Goose Tools is not affiliated with Etsy and does not use Etsy logos. Free v1
          scores Etsy only — eBay and Shopify are deferred. Registry live={String(LIVE)}.
        </p>

        <div className="ggt-field">
          <label className="ggt-label" htmlFor="lo-title">
            Title
          </label>
          <input
            id="lo-title"
            className="ggt-input"
            value={draft.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="Handmade ceramic mug — speckled glaze, 12 oz"
            aria-label="Listing title"
          />
        </div>

        <div className="ggt-field">
          <label className="ggt-label" htmlFor="lo-tags">
            Tags (comma or newline, up to 13)
          </label>
          <textarea
            id="lo-tags"
            className="ggt-input ggt-textarea"
            value={draft.tagsRaw}
            onChange={(e) => updateField("tagsRaw", e.target.value)}
            placeholder={"ceramic mug\nspeckled glaze\ncoffee lover gift"}
            aria-label="Listing tags"
          />
        </div>

        <div className="ggt-field">
          <label className="ggt-label" htmlFor="lo-desc">
            Description
          </label>
          <textarea
            id="lo-desc"
            className="ggt-input ggt-textarea"
            value={draft.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="What it is, who it is for, and the size…"
            aria-label="Listing description"
          />
        </div>

        <div className="ggt-field">
          <label className="ggt-label" htmlFor="lo-attrs">
            Attributes (optional — Name: value per line)
          </label>
          <textarea
            id="lo-attrs"
            className="ggt-input ggt-textarea"
            value={draft.attributesRaw}
            onChange={(e) => updateField("attributesRaw", e.target.value)}
            placeholder={"Primary color: Speckled cream\nCapacity: "}
            aria-label="Listing attributes"
          />
        </div>

        <div className="ggt-field">
          <label className="ggt-label" htmlFor="lo-brand">
            Brand words to keep (optional)
          </label>
          <input
            id="lo-brand"
            className="ggt-input"
            value={draft.brandWordsRaw}
            onChange={(e) => updateField("brandWordsRaw", e.target.value)}
            placeholder="ClayBird, Studio North"
            aria-label="Brand words"
          />
        </div>

        <div className="ggt-actions ggt-input-row">
          <button className="ggt-btn" type="button" onClick={onScore}>
            Score listing
          </button>
        </div>

        {error ? (
          <p className="ggt-error" role="alert">
            {error}
          </p>
        ) : null}

        {score ? (
          <section className="ggt-result" aria-live="polite">
            <div className="ggt-score">
              <strong>
                {score.total}/{score.max}
              </strong>
              <span className="ggt-pill">Etsy score · rules {RULES_CHECKED}</span>
            </div>

            <h2>Checks</h2>
            <ul className="ggt-list">
              {score.checks.map((c) => (
                <li key={c.id}>
                  <div className="ggt-part-head">
                    <span className="ggt-pill">{c.severity}</span>
                    <strong>{c.ruleName}</strong>
                    <span className="ggt-help">
                      {c.pointsEarned.toFixed(1)}/{c.pointsMax.toFixed(1)} · checked{" "}
                      {c.rulesChecked}
                    </span>
                  </div>
                  <p className="ggt-note">{c.message}</p>
                  {c.detail ? <p className="ggt-help">{c.detail}</p> : null}
                </li>
              ))}
            </ul>

            <h2>Working</h2>
            <pre className="ggt-working">{score.working.join("\n")}</pre>
          </section>
        ) : null}

        <aside className={`ggt-tally${unlocked ? "" : " ggt-tally--locked"}`}>
          <h2>{unlocked ? "Paid unlock open" : "Paid unlock"}</h2>
          <ul>
            <li>Up to {PAID_LISTING_CAP} rewritten listings</li>
            <li>
              CSV columns: new title · non-overlapping tags · first paragraph · keywords · brand
              words kept
            </li>
            <li>Rules-based rewrite (deterministic) for v1</li>
            {priceLabel ? (
              <li>Price mirrored from shop config: {priceLabel}</li>
            ) : (
              <li>
                Price shown once shop publishes NEXT_PUBLIC_PRICE_CENTS (Cos brief $7 / 700¢)
              </li>
            )}
          </ul>
          {unlockNote ? <p className="ggt-note">{unlockNote}</p> : null}
          {!unlocked ? (
            <section className="ggt-paywall">
              {priceLabel ? <p className="ggt-price">{priceLabel}</p> : null}
              <button
                className="ggt-btn"
                type="button"
                onClick={onBuy}
                disabled={paying || !saleLive}
              >
                {paying
                  ? "Starting checkout…"
                  : saleLive
                    ? priceLabel
                      ? `Unlock spreadsheet · ${priceLabel}`
                      : "Unlock spreadsheet"
                    : "Checkout not live on shop desk yet"}
              </button>
              {!saleLive ? (
                <p className="ggt-help">
                  Free scoring still works. Checkout stays gated until{" "}
                  <code>listing-optimizer</code> is on the shop sale allowlist (no fallthrough to
                  SEO Audit pricing).
                </p>
              ) : null}
            </section>
          ) : (
            <>
              <div className="ggt-actions">
                <button className="ggt-btn" type="button" onClick={onRewriteOne}>
                  Rewrite this listing
                </button>
              </div>
              <div className="ggt-field">
                <label className="ggt-label" htmlFor="lo-batch">
                  Or paste up to {PAID_LISTING_CAP} listings (separate with ---)
                </label>
                <textarea
                  id="lo-batch"
                  className="ggt-input ggt-textarea"
                  value={batchRaw}
                  onChange={(e) => {
                    setBatchRaw(e.target.value);
                    persistBatch(e.target.value);
                  }}
                  placeholder={
                    "Title one\ntag a, tag b\nDescription…\n---\nTitle two\ntag c\nDescription…"
                  }
                />
              </div>
              <div className="ggt-actions">
                <button className="ggt-btn" type="button" onClick={onRewriteBatch}>
                  Rewrite batch
                </button>
                <button
                  className="ggt-btn"
                  type="button"
                  onClick={onDownloadCsv}
                  disabled={!rewrites?.length}
                >
                  Download CSV
                </button>
              </div>
              {rewrites?.length ? (
                <p className="ggt-note">
                  Ready: {rewrites.length} rewritten listing
                  {rewrites.length === 1 ? "" : "s"}.
                </p>
              ) : null}
            </>
          )}
        </aside>

        <p className="ggt-trust">
          Paid once. Yours to keep. No account required for the free score. Listing text stays in
          this browser until you unlock and download.
        </p>
      </div>
    </main>
  );
}
