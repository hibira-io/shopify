// Shared, dependency-free helpers for channel names and the recent purchase
// list. The theme extension (extensions/live-visitors/assets/live-visitors.js)
// builds the same channel names in the browser; keep the two in step.

/** A purchase as stored in the `hibira.recent` metafield and sent live. */
export interface Purchase {
  /** Numeric product ID. */
  id: number;
  title: string;
  /** Storefront path, such as /products/red-shoes. */
  url: string;
  /** Small product image URL, or empty. */
  image: string;
  /** Order time, epoch milliseconds. */
  at: number;
}

export const PURCHASE_EVENT = "purchase";
export const RECENT_LIMIT = 10;
export const RECENT_MAX_AGE_MS = 48 * 60 * 60 * 1000;

/** "acme-store.myshopify.com" -> "acme-store". */
export function shopSlug(shop: string): string {
  return shop
    .toLowerCase()
    .replace(/\.myshopify\.com$/, "")
    .replace(/[^a-z0-9-]/g, "-");
}

/** The store-wide channel: every storefront page on Pro, purchase events. */
export function storeChannel(shop: string): string {
  return `lv-${shopSlug(shop)}`;
}

/** One channel per product page; its subscriber count is "N viewing". */
export function productChannel(shop: string, productId: number | string): string {
  return `${storeChannel(shop)}-p-${productId}`;
}

/** Product ID from a product channel name of this shop, or null. */
export function productIdFromChannel(shop: string, channel: string): number | null {
  const prefix = `${storeChannel(shop)}-p-`;
  if (!channel.startsWith(prefix)) return null;
  const id = Number(channel.slice(prefix.length));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** "gid://shopify/Product/123" or 123 -> 123. */
export function numericId(id: string | number): number {
  if (typeof id === "number") return id;
  const n = Number(id.split("/").pop());
  return Number.isSafeInteger(n) ? n : 0;
}

/**
 * Adds a purchase to the recent list: newest first, one entry per product
 * (the newest), at most RECENT_LIMIT entries, none older than 48 hours.
 */
export function addRecent(list: Purchase[], p: Purchase, now = Date.now()): Purchase[] {
  const out = [p, ...list.filter((x) => x && x.id !== p.id)]
    .filter((x) => now - x.at <= RECENT_MAX_AGE_MS)
    .sort((a, b) => b.at - a.at);
  return out.slice(0, RECENT_LIMIT);
}

/** Parses a stored recent list, dropping anything malformed. */
export function parseRecent(raw: unknown): Purchase[] {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  return v.filter(
    (x): x is Purchase =>
      x !== null &&
      typeof x === "object" &&
      typeof x.id === "number" &&
      typeof x.title === "string" &&
      typeof x.url === "string" &&
      typeof x.at === "number",
  ).map((x) => ({ ...x, image: typeof x.image === "string" ? x.image : "" }));
}
