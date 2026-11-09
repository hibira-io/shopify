// The waiting-room app embed: its Liquid (rendered with liquidjs) and its
// script (run in jsdom), against passes signed like the Hibira server.
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, ResourceLoader } from "jsdom";
import { Liquid } from "liquidjs";

import { NOW, claims, signPass } from "./helpers.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../waiting-room");
const block = readFileSync(join(root, "extensions/waiting-room-embed/blocks/waiting-room.liquid"), "utf8").replace(
  /\{% schema %\}[\s\S]*?\{% endschema %\}/,
  "",
);
const script = readFileSync(join(root, "storefront/waiting-room.js"), "utf8");
const liquid = new Liquid();
liquid.registerFilter("asset_url", (s) => `https://cdn.shopify.test/${s}`);

const room = { key: "appkey", app: "shopify-acme", room: "drop", host: "ws.hibira.io", opens: NOW - 600, closes: NOW + 3600, since: NOW - 600 };

async function render({ wr = room, product = null, design = false, cartPass = "" } = {}) {
  return liquid.parseAndRender(block, {
    app: { metafields: { hibira: { waiting_room: wr ? { value: wr } : null } } },
    request: { design_mode: design, page_type: product ? "product" : "index", locale: { iso_code: "ja" } },
    product,
    routes: { cart_update_url: "/cart/update" },
    cart: { attributes: { _hibira_wr_pass: cartPass } },
  });
}

function config(html) {
  const m = html.match(/<script id="hibira-wr-config" type="application\/json">([\s\S]*?)<\/script>/);
  return m && JSON.parse(m[1]);
}

/** Runs the script on a page at url with the rendered head; returns what it did. */
function run(html, { url = "https://acme.example/products/tee", cookie = "", ua = "Mozilla/5.0", now = NOW } = {}) {
  const dom = new JSDOM(
    `<!doctype html><html><head>${html.replace(/<script src=[^>]*><\/script>/, "")}</head><body>
      <form action="/cart/add" method="post"><button type="submit">Add</button></form></body></html>`,
    { url, runScripts: "outside-only", resources: new ResourceLoader({ userAgent: ua }) },
  );
  const w = dom.window;
  if (cookie) w.document.cookie = cookie;
  const replaced = [];
  const fetches = [];
  w.Date.now = () => now * 1000;
  w.fetch = vi.fn((u, o) => {
    fetches.push({ u, body: JSON.parse(o.body) });
    return Promise.resolve({});
  });
  // jsdom cannot navigate; record where the script sends the shopper.
  w.eval(`Object.defineProperty(window, "__go", { value: [] });`);
  const src = script.replace("location.replace(wait)", "window.__go.push(wait)");
  w.eval(src);
  replaced.push(...w.__go);
  return { w, replaced, fetches };
}

describe("waiting-room embed Liquid", () => {
  it("renders nothing until the app wrote a room, or in the theme editor", async () => {
    expect(config(await render({ wr: null }))).toBeNull();
    expect(config(await render({ design: true }))).toBeNull();
  });

  it("whole store: every page is protected", async () => {
    expect(config(await render())).toMatchObject({ key: "appkey", room: "drop", protect: true, lang: "ja", cartUpdate: "/cart/update" });
  });

  it("tagged: only product pages with one of the tags", async () => {
    const wr = { ...room, scope: "tagged", tags: ["drop", "limited"] };
    expect(config(await render({ wr })).protect).toBe(false);
    expect(config(await render({ wr, product: { tags: ["basic"] } })).protect).toBe(false);
    expect(config(await render({ wr, product: { tags: ["limited"] } })).protect).toBe(true);
  });
});

describe("waiting-room embed script", () => {
  const pass = signPass("s3cret", claims({ iat: NOW }));

  it("sends a shopper without a pass to the waiting page, coming back to this page", async () => {
    const { replaced } = run(await render());
    expect(replaced).toHaveLength(1);
    const u = new URL(replaced[0]);
    expect(u.origin + u.pathname).toBe("https://ws.hibira.io/wait/appkey/drop");
    expect(u.searchParams.get("return")).toBe("https://acme.example/products/tee");
    expect(u.searchParams.get("lang")).toBe("ja");
  });

  it("does nothing outside the drop window, on unprotected pages, or for crawlers", async () => {
    expect(run(await render(), { now: NOW - 3600 }).replaced).toEqual([]);
    expect(run(await render(), { now: NOW + 7200 }).replaced).toEqual([]);
    expect(run(await render({ wr: { ...room, scope: "tagged", tags: ["x"] } })).replaced).toEqual([]);
    expect(run(await render(), { ua: "Googlebot/2.1" }).replaced).toEqual([]);
  });

  it("back with ?hibira_pass: keeps it, cleans the URL, writes it to the cart and product forms", async () => {
    const { w, replaced, fetches } = run(await render(), { url: `https://acme.example/products/tee?a=1&hibira_pass=${pass}` });
    await new Promise((r) => w.document.readyState === "loading" ? w.document.addEventListener("DOMContentLoaded", r) : r());
    expect(replaced).toEqual([]);
    expect(w.location.href).toBe("https://acme.example/products/tee?a=1");
    expect(w.document.cookie).toContain(`hibira_wr_drop=${encodeURIComponent(pass)}`);
    expect(fetches).toEqual([{ u: "/cart/update.js", body: { attributes: { _hibira_wr_pass: pass } } }]);
    expect(w.document.querySelector('form input[name="properties[_hibira_wr_pass]"]').value).toBe(pass);
  });

  it("a pass in the cookie lets the shopper browse; the cart is not rewritten when it already has it", async () => {
    const { replaced, fetches } = run(await render({ cartPass: pass }), { cookie: `hibira_wr_drop=${encodeURIComponent(pass)}` });
    expect(replaced).toEqual([]);
    expect(fetches).toEqual([]);
  });

  it("ignores an expired pass, a pass for another room, or one from an earlier drop", async () => {
    for (const bad of [
      signPass("s3cret", claims({ iat: NOW - 4000, exp: NOW - 1 })),
      signPass("s3cret", claims({ room: "other" })),
      signPass("s3cret", claims({ iat: NOW - 3600 })),
    ]) {
      expect(run(await render(), { cookie: `hibira_wr_drop=${encodeURIComponent(bad)}` }).replaced).toHaveLength(1);
    }
  });

  it("an unusable pass in the URL never loops the shopper back to the queue", async () => {
    const bad = signPass("s3cret", claims({ room: "other" }));
    expect(run(await render(), { url: `https://acme.example/?hibira_pass=${bad}` }).replaced).toEqual([]);
  });

  it("the built asset is the minified source", () => {
    const built = readFileSync(join(root, "extensions/waiting-room-embed/assets/waiting-room.js"), "utf8");
    expect(built).toContain("Hibira Waiting Room for Shopify");
    expect(built.length).toBeLessThan(4000);
  });
});
