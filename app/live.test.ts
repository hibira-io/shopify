import { describe, expect, it } from "vitest";

import {
  addRecent,
  numericId,
  parseRecent,
  productChannel,
  productIdFromChannel,
  RECENT_LIMIT,
  RECENT_MAX_AGE_MS,
  shopSlug,
  storeChannel,
  type Purchase,
} from "./live";

const p = (id: number, at: number): Purchase => ({ id, title: `P${id}`, url: `/products/p${id}`, image: "", at });

describe("channel names", () => {
  it("uses the myshopify subdomain", () => {
    expect(shopSlug("Acme-Store.myshopify.com")).toBe("acme-store");
    expect(storeChannel("acme-store.myshopify.com")).toBe("lv-acme-store");
    expect(productChannel("acme-store.myshopify.com", 123)).toBe("lv-acme-store-p-123");
  });

  it("only valid channel characters", () => {
    expect(shopSlug("we!rd.example.com")).toMatch(/^[a-z0-9-]+$/);
  });

  it("reads the product back, for this shop only", () => {
    expect(productIdFromChannel("acme-store.myshopify.com", "lv-acme-store-p-42")).toBe(42);
    expect(productIdFromChannel("acme-store.myshopify.com", "lv-acme-store")).toBeNull();
    expect(productIdFromChannel("acme.myshopify.com", "lv-acme-store-p-42")).toBeNull();
    expect(productIdFromChannel("acme-store.myshopify.com", "lv-acme-store-p-x")).toBeNull();
  });

  it("numeric ids from GIDs", () => {
    expect(numericId("gid://shopify/Product/987")).toBe(987);
    expect(numericId(5)).toBe(5);
  });
});

describe("recent purchases", () => {
  const now = 1_800_000_000_000;

  it("newest first, one per product, capped", () => {
    let list: Purchase[] = [];
    for (let i = 1; i <= RECENT_LIMIT + 3; i++) list = addRecent(list, p(i, now - 1000 * (20 - i)), now);
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list[0].id).toBe(RECENT_LIMIT + 3);
    list = addRecent(list, p(5, now), now);
    expect(list[0]).toMatchObject({ id: 5, at: now });
    expect(list.filter((x) => x.id === 5)).toHaveLength(1);
  });

  it("drops anything older than 48 hours", () => {
    const list = addRecent([p(1, now - RECENT_MAX_AGE_MS - 1)], p(2, now), now);
    expect(list.map((x) => x.id)).toEqual([2]);
  });

  it("parses stored JSON defensively", () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent("not json")).toEqual([]);
    expect(parseRecent(JSON.stringify([p(1, now), { id: "x" }, null]))).toEqual([p(1, now)]);
    expect(parseRecent([{ id: 1, title: "a", url: "/", at: 1 }])).toEqual([{ id: 1, title: "a", url: "/", at: 1, image: "" }]);
  });
});
