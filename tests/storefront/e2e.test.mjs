// End-to-end: real browsers on a rendered product page against a
// Pusher-protocol server with subscription counts. By default it starts the
// small mock in mock-server.mjs; set HIBIRA_E2E to use a real Hibira server:
//
//   HIBIRA_E2E=localhost:8080 HIBIRA_APP_ID=local-app HIBIRA_APP_KEY=local-key \
//   HIBIRA_APP_SECRET=local-secret-0123456789 npx vitest run tests/storefront/e2e.test.mjs
//
// Set SHOTS_DIR to also save screenshots.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Pusher from "pusher";

import { startMockServer } from "./mock-server.mjs";
import { productPage } from "./render.mjs";

const mock = process.env.HIBIRA_E2E ? null : await startMockServer();
const target = process.env.HIBIRA_E2E || mock.host;
if (mock) {
  process.env.HIBIRA_APP_ID = "mock-app";
  process.env.HIBIRA_APP_KEY = "mock-key";
  process.env.HIBIRA_APP_SECRET = "mock-secret";
}
const assets = join(dirname(fileURLToPath(import.meta.url)), "../../extensions/live-visitors/assets");
const shots = process.env.SHOTS_DIR;
const TOTE =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><rect width="56" height="56" fill="#efe6d8"/><path d="M16 22h24l-2 24H18z" fill="#c9a77c"/><path d="M22 22a6 6 0 0 1 12 0" fill="none" stroke="#8a6a44" stroke-width="2.5"/></svg>',
  );

describe(`storefront against ${mock ? "the mock server" : target}`, () => {
  let http;
  let base;
  let browser;
  const pages = {};
  const [host, port = "443"] = (target || "").split(":");
  const config = (plan) => ({
    key: process.env.HIBIRA_APP_KEY,
    host: target,
    tls: port === "443",
    plan,
  });
  const pusher = new Pusher({
    appId: process.env.HIBIRA_APP_ID || "",
    key: process.env.HIBIRA_APP_KEY || "",
    secret: process.env.HIBIRA_APP_SECRET || "",
    host,
    port,
    useTLS: port === "443",
  });

  beforeAll(async () => {
    // playwright is not a dependency: CI installs it next to its browser.
    const { chromium } = createRequire(import.meta.url)("playwright");
    const recent = [
      { id: 202, title: "Canvas tote bag", url: "/products/tote", image: TOTE, at: Date.now() - 4 * 60_000 },
    ];
    pages["/free"] = await productPage({ config: config("free"), productId: 101 });
    pages["/pro"] = await productPage({
      config: config("pro"),
      productId: 101,
      recent,
      settings: { popup_delay: 2 },
    });
    pages["/ja"] = await productPage({ config: config("free"), productId: 303, locale: "ja" });
    pages["/zh-TW"] = await productPage({ config: config("free"), productId: 404, locale: "zh-TW" });
    pages["/block"] = await productPage({
      config: config("pro"),
      productId: 505,
      block: { scope: "store", min_count: 1 },
    });
    http = createServer((req, res) => {
      const url = req.url.split("?")[0];
      if (url.startsWith("/assets/")) {
        const file = url.slice(8);
        res.setHeader("content-type", file.endsWith(".css") ? "text/css" : "text/javascript");
        return res.end(readFileSync(join(assets, file)));
      }
      if (pages[url]) {
        res.setHeader("content-type", "text/html; charset=utf-8");
        return res.end(pages[url]);
      }
      res.statusCode = 404;
      res.end();
    });
    await new Promise((r) => http.listen(0, r));
    base = `http://127.0.0.1:${http.address().port}`;
    browser = await chromium.launch();
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    http?.close();
    mock?.close();
  });

  const badge = (page) => page.locator(".hibira-lv-badge").first();

  async function open(path, opts = {}) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    await page.goto(base + path);
    return { ctx, page };
  }

  it("shows a single viewer the count, and real counts as tabs open and close", async () => {
    const a = await open("/free");
    await a.page.waitForFunction(() => window.HibiraLiveVisitors?.counts.product === 1, null, { timeout: 10_000 });
    await expect(badge(a.page).textContent()).resolves.toBe("1 person is viewing this right now");

    const b = await open("/free");
    const c = await open("/free", { viewport: { width: 390, height: 844 }, colorScheme: "dark" });
    for (const p of [a.page, b.page, c.page]) {
      await p.waitForFunction(() => window.HibiraLiveVisitors?.counts.product === 3, null, { timeout: 10_000 });
      await expect(badge(p).textContent()).resolves.toBe("3 people are viewing this right now");
    }
    if (shots) {
      await a.page.screenshot({ path: `${shots}/product-badge-en-desktop.png` });
      await c.page.screenshot({ path: `${shots}/product-badge-en-mobile.png` });
    }

    await c.ctx.close();
    await a.page.waitForFunction(() => window.HibiraLiveVisitors?.counts.product === 2, null, { timeout: 10_000 });
    await expect(badge(a.page).textContent()).resolves.toBe("2 people are viewing this right now");
    await b.ctx.close();
    await a.page.waitForFunction(() => window.HibiraLiveVisitors?.counts.product === 1, null, { timeout: 10_000 });
    await expect(badge(a.page).textContent()).resolves.toBe("1 person is viewing this right now");
    await a.ctx.close();
  }, 60_000);

  it("free pages open no store channel and show no popups", async () => {
    const a = await open("/free");
    await a.page.waitForFunction(() => window.HibiraLiveVisitors?.counts.product === 1, null, { timeout: 10_000 });
    await pusher.trigger("lv-acme-store", "purchase", { id: 9, title: "Hat", url: "/products/hat", image: "", at: Date.now() });
    await a.page.waitForTimeout(1500);
    await expect(a.page.locator(".hibira-lv-toast").count()).resolves.toBe(0);
    await expect(a.page.evaluate(() => window.HibiraLiveVisitors.counts.store)).resolves.toBeUndefined();
    await a.ctx.close();
  }, 30_000);

  it("pro shows the recent purchase popup, then live purchases", async () => {
    const a = await open("/pro");
    const toast = a.page.locator(".hibira-lv-toast");
    await toast.waitFor({ timeout: 10_000 });
    await expect(toast.textContent()).resolves.toContain("Canvas tote bag");
    await expect(toast.textContent()).resolves.toContain("4 minutes ago");
    if (shots) await a.page.screenshot({ path: `${shots}/popup-recent-en-desktop.png` });
    await a.page.locator(".hibira-lv-toast-close").click();
    await toast.waitFor({ state: "detached" });

    await a.page.waitForFunction(() => typeof window.HibiraLiveVisitors?.counts.store === "number", null, { timeout: 10_000 });
    await pusher.trigger("lv-acme-store", "purchase", {
      id: 707,
      title: "Merino beanie",
      url: "/products/beanie",
      image: "",
      at: Date.now(),
    });
    await toast.waitFor({ timeout: 10_000 });
    await expect(toast.textContent()).resolves.toContain("Merino beanie");
    await expect(toast.textContent()).resolves.toContain("now");
    await a.ctx.close();
  }, 40_000);

  it("the store-wide block counts every Pro page", async () => {
    const a = await open("/block");
    const b = await open("/pro");
    await a.page.waitForFunction(() => window.HibiraLiveVisitors?.counts.store >= 2, null, { timeout: 10_000 });
    await expect(badge(a.page).textContent()).resolves.toMatch(/^\d+ people shopping now$/);
    await a.ctx.close();
    await b.ctx.close();
  }, 30_000);

  it("uses the shopper's language", async () => {
    const ja = [await open("/ja"), await open("/ja")];
    await ja[0].page.waitForFunction(() => window.HibiraLiveVisitors?.counts.product === 2, null, { timeout: 10_000 });
    await expect(badge(ja[0].page).textContent()).resolves.toBe("2人が今この商品を見ています");
    const tw = [await open("/zh-TW", { viewport: { width: 390, height: 844 } }), await open("/zh-TW")];
    await tw[0].page.waitForFunction(() => window.HibiraLiveVisitors?.counts.product === 2, null, { timeout: 10_000 });
    await expect(badge(tw[0].page).textContent()).resolves.toBe("目前有 2 人正在瀏覽此商品");
    if (shots) {
      await ja[0].page.screenshot({ path: `${shots}/product-badge-ja-desktop.png` });
      await tw[0].page.screenshot({ path: `${shots}/product-badge-zh-TW-mobile.png` });
    }
    for (const x of [...ja, ...tw]) await x.ctx.close();
  }, 40_000);
});
