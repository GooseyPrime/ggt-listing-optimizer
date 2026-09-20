import { describe, expect, it } from "vitest";
import { buildListingInput, parseBatchListings, parseTags } from "@/lib/parse";

describe("parse", () => {
  it("parses tags from commas and newlines", () => {
    expect(parseTags("a, b\nc, a")).toEqual(["a", "b", "c"]);
  });

  it("builds listing input", () => {
    const input = buildListingInput({
      title: " Mug ",
      tagsRaw: "ceramic mug, gift",
      description: "A mug for tea drinkers. Size 10 oz.",
      attributesRaw: "Color: blue\nSize: ",
      brandWordsRaw: "ClayBird",
    });
    expect(input.title).toBe("Mug");
    expect(input.tags).toEqual(["ceramic mug", "gift"]);
    expect(input.attributes?.[1]?.value).toBe("");
    expect(input.brandWords).toEqual(["ClayBird"]);
  });

  it("parses batch blocks", () => {
    const listings = parseBatchListings(
      "Brand: ClayBird\nTitle One\ntag a, tag b\nDesc one\n---\nTitle Two\ntag c\nDesc two",
    );
    expect(listings).toHaveLength(2);
    expect(listings[0]?.brandWords).toEqual(["ClayBird"]);
    expect(listings[0]?.title).toBe("Title One");
    expect(listings[1]?.tags).toEqual(["tag c"]);
  });
});
