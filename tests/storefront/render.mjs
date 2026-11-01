// Renders the theme extension's Liquid the way a storefront would, with
// liquidjs and stub Shopify objects, so tests run the real block files.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Liquid } from "liquidjs";

const ext = join(dirname(fileURLToPath(import.meta.url)), "../../extensions/live-visitors");

function translations(locale) {
  const file = locale === "en" ? "en.default.json" : `${locale}.json`;
  return JSON.parse(readFileSync(join(ext, "locales", file), "utf8"));
}

export function engine(locale = "en") {
  const strings = translations(locale);
  const liquid = new Liquid({ root: [join(ext, "snippets")], extname: ".liquid" });
  // liquidjs passes keyword args as [name, value] pairs.
  liquid.registerFilter("t", function (key, ...args) {
    const vars = Object.fromEntries(args.filter(Array.isArray));
    const s = key.split(".").reduce((o, k) => (o ? o[k] : undefined), strings);
    if (typeof s !== "string") return `translation missing: ${key}`;
    return s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? ""));
  });
  liquid.registerTag("schema", {
    parse(_token, remain) {
      this.tokens = [];
      const stream = this.liquid.parser.parseStream(remain);
      stream
        .on("tag:endschema", () => stream.stop())
        .on("template", () => {})
        .on("end", () => {
          throw new Error("schema not closed");
        });
      stream.start();
    },
    render() {
      return "";
    },
  });
  return liquid;
}

export function schema(block) {
  const src = readFileSync(join(ext, "blocks", `${block}.liquid`), "utf8");
  const m = src.match(/\{% schema %\}([\s\S]*?)\{% endschema %\}/);
  return JSON.parse(m[1]);
}

export function defaults(block) {
  return Object.fromEntries(
    schema(block)
      .settings.filter((s) => s.id)
      .map((s) => [s.id, s.default ?? ""]),
  );
}

/** Renders a block file with the given context (block.settings filled with defaults). */
export async function renderBlock(block, ctx, locale = "en") {
  const src = readFileSync(join(ext, "blocks", `${block}.liquid`), "utf8");
  const settings = { ...defaults(block), ...(ctx.settings || {}) };
  return engine(locale).parseAndRender(src, {
    ...ctx,
    block: { settings, shopify_attributes: "" },
  });
}

/** A minimal product page with the app embed (and optionally the block). */
export async function productPage({
  config,
  recent = [],
  productId = 101,
  settings = {},
  block = null,
  locale = "en",
  assetBase = "/assets",
}) {
  const ctx = {
    app: { metafields: { hibira: { config: { value: config }, recent: { value: recent } } } },
    shop: { permanent_domain: "acme-store.myshopify.com" },
    request: { page_type: productId ? "product" : "index" },
    product: productId ? { id: productId } : null,
    settings,
  };
  const embed = await renderBlock("live-visitors", ctx, locale);
  const blockHtml = block ? await renderBlock("viewers", { ...ctx, settings: block }, locale) : "";
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sample product</title>
<link rel="stylesheet" href="${assetBase}/live-visitors.css">
<style>
  body{font-family:system-ui,-apple-system,sans-serif;margin:0;color:#1a1a1a;background:#fafafa}
  header{padding:16px 24px;border-bottom:1px solid #e5e5e5;font-weight:700;letter-spacing:.04em;background:#fff}
  main{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:32px;max-width:960px;margin:32px auto;padding:0 24px}
  .img{aspect-ratio:1;border-radius:12px;background:linear-gradient(135deg,#f3d9c9,#d7b49e)}
  h1{font-size:28px;margin:0 0 8px} .price{font-size:20px;margin:0 0 20px}
  button.add{width:100%;padding:14px;border:0;border-radius:8px;background:#1a1a1a;color:#fff;font-size:16px}
  @media (max-width:640px){main{grid-template-columns:1fr;margin:16px auto}}
</style></head><body>
<header>ACME STORE</header>
<main><div class="img"></div><div>
<h1>Linen overshirt</h1><p class="price">$68.00</p>
${blockHtml}
<form action="/cart/add" method="post"><button class="add" type="button">Add to cart</button></form>
<p>Soft washed linen, relaxed fit.</p>
</div></main>
${embed}
<script src="${assetBase}/live-visitors.js" defer></script>
</body></html>`;
}
