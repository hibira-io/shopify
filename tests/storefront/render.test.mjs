import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { productPage, schema } from "./render.mjs";

const ext = join(dirname(fileURLToPath(import.meta.url)), "../../extensions/live-visitors");
const config = { key: "k", host: "ws.hibira.io", tls: true, plan: "free" };

function configOf(html) {
  return JSON.parse(html.match(/<script id="hibira-lv-config" type="application\/json">([\s\S]*?)<\/script>/)[1]);
}

describe("app embed", () => {
  it("renders nothing until the app wrote its config", async () => {
    const html = await productPage({ config: null });
    expect(html).not.toContain("hibira-lv-config");
  });

  it("free: product channel only, no popups or recent purchases", async () => {
    const c = configOf(await productPage({ config, recent: [{ id: 1 }] }));
    expect(c).toMatchObject({ key: "k", shop: "acme-store", product: 101, plan: "free", popups: false, recent: [] });
  });

  it("pro: popups with recent purchases", async () => {
    const recent = [{ id: 1, title: "A", url: "/products/a", image: "", at: 1 }];
    const c = configOf(await productPage({ config: { ...config, plan: "pro" }, recent }));
    expect(c).toMatchObject({ plan: "pro", popups: true, recent });
  });

  it("a lone shopper sees the count by default", async () => {
    const c = configOf(await productPage({ config }));
    expect(c.min).toBe(1);
    for (const name of ["live-visitors", "viewers"]) {
      expect(schema(name).settings.find((s) => s.id === "min_viewers").default, name).toBe(1);
    }
  });

  it("not a product page: no product", async () => {
    const c = configOf(await productPage({ config, productId: null }));
    expect(c.product).toBeNull();
  });

  it("custom wording replaces the translation", async () => {
    const c = configOf(await productPage({ config, settings: { viewing_text: "{count} here now" } }));
    expect(c.texts.viewing_other).toBe("{count} here now");
  });
});

describe("locales", () => {
  const files = readdirSync(join(ext, "locales"));
  const keys = (o, pre = "") =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? keys(v, `${pre}${k}.`) : [`${pre}${k}`])).sort();

  it("every storefront locale has the same keys", () => {
    const base = keys(JSON.parse(readFileSync(join(ext, "locales/en.default.json"), "utf8")));
    for (const f of files.filter((f) => !f.includes("schema"))) {
      expect(keys(JSON.parse(readFileSync(join(ext, "locales", f), "utf8"))), f).toEqual(base);
    }
  });

  it("every schema locale has the same keys, and every t: label exists", () => {
    const base = keys(JSON.parse(readFileSync(join(ext, "locales/en.default.schema.json"), "utf8")));
    for (const f of files.filter((f) => f.includes("schema"))) {
      expect(keys(JSON.parse(readFileSync(join(ext, "locales", f), "utf8"))), f).toEqual(base);
    }
    const used = JSON.stringify([schema("live-visitors"), schema("viewers")]).match(/t:[\w.]+/g);
    for (const t of used) expect(base, t).toContain(t.slice(2));
  });
});
