// The live-chat app embed's Liquid (rendered with liquidjs): it loads the
// Hibira Live Chat widget for the workspace the app wrote, and nothing else.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { Liquid } from "liquidjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../livechat");
const source = readFileSync(
  join(root, "extensions/live-chat-embed/blocks/live-chat.liquid"),
  "utf8",
);
const block = source.replace(/\{% schema %\}[\s\S]*?\{% endschema %\}/, "");
const liquid = new Liquid();

const config = {
  workspace: "ws_acme123",
  src: "https://chat.hibira.io/w/v1.js",
};

function render({ lc = config, color = "#e5484d", lang = "ja" } = {}) {
  return liquid.parseAndRender(block, {
    app: { metafields: { hibira: { live_chat: lc ? { value: lc } : null } } },
    block: { settings: { color } },
    request: { locale: { iso_code: lang } },
  });
}

function scriptOf(html) {
  const el = new JSDOM(
    `<!doctype html><body>${html}</body>`,
  ).window.document.querySelector("script");
  if (!el) return null;
  return Object.fromEntries(
    [...el.attributes].map((a) => [a.name, a.value === "" ? true : a.value]),
  );
}

describe("live chat embed", () => {
  it("loads the widget for the store's workspace", async () => {
    const s = scriptOf(await render());
    expect(s).toMatchObject({
      src: config.src,
      "data-workspace": "ws_acme123",
      "data-lang": "ja",
      "data-color": "#e5484d",
      async: true,
    });
  });

  it("renders nothing before the app wrote its settings", async () => {
    expect(scriptOf(await render({ lc: null }))).toBeNull();
    expect(
      scriptOf(await render({ lc: { workspace: "", src: config.src } })),
    ).toBeNull();
  });

  it("only loads the widget from chat.hibira.io", async () => {
    const s = scriptOf(
      await render({
        lc: { workspace: "ws_acme123", src: "https://evil.example/x.js" },
      }),
    );
    expect(s.src).toBe("https://chat.hibira.io/w/v1.js");
  });

  it("escapes what it puts in attributes", async () => {
    const html = await render({
      lc: { workspace: 'ws"><img src=x onerror=alert(1)>', src: config.src },
    });
    expect(html).not.toContain("<img");
  });

  it("leaves the color to the widget when none is set", async () => {
    expect(scriptOf(await render({ color: "" }))["data-color"]).toBeUndefined();
  });

  it("has the schema strings in every language", () => {
    const schema = JSON.parse(
      source.match(/\{% schema %\}([\s\S]*?)\{% endschema %\}/)[1],
    );
    expect(schema.target).toBe("body");
    const color = schema.settings.find((x) => x.id === "color");
    expect(color.default).toBeUndefined();
    for (const l of ["en.default", "ja", "zh-TW", "zh-CN", "ko", "th", "vi"]) {
      const loc = JSON.parse(
        readFileSync(
          join(root, `extensions/live-chat-embed/locales/${l}.schema.json`),
          "utf8",
        ),
      );
      expect(Object.keys(loc.embed).sort()).toEqual(["color", "color_info", "info", "name"]);
    }
  });
});
