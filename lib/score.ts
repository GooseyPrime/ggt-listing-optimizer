import { scoreListing as scoreEtsyListing } from "./score-engine";
import { scoreEbayListing } from "./score-ebay";
import type { ListingInput, ListingScore, Marketplace } from "./types";

export { scoreEtsyListing, scoreEbayListing };

/** Score one listing against the selected marketplace's published limits (Etsy default). */
export function scoreListing(input: ListingInput, marketplace: Marketplace = "etsy"): ListingScore {
  return marketplace === "ebay" ? scoreEbayListing(input) : scoreEtsyListing(input);
}
