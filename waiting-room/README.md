# Hibira Waiting Room for Shopify

A virtual waiting room for drops and launches on any Shopify plan. While a
drop is on, shoppers queue on a
[Hibira](https://hibira.io/?utm_source=github&utm_medium=readme&utm_campaign=plugins)
waiting page and come back to the store when their turn comes. A checkout
rule makes sure nobody skips the line by going straight to checkout.

This is a separate Shopify app from Hibira Live Visitors (the repo root). Run
the Shopify CLI from this folder.

## What works without Shopify Plus

Checked against shopify.dev on 2026-11-09.

| Piece | Plans | Notes |
| --- | --- | --- |
| Theme app embed (the redirect) | All Online Store themes | Runs in `<head>` on storefront pages. Cannot run on checkout. |
| Cart and checkout validation Function (the checkout rule) | All plans except Starter, **for apps from the Shopify App Store** | Custom (unlisted) apps with Functions need Plus. So this has to ship as a public app. |
| Network calls from a Function | Plus / enterprise only | Not used: the Function checks the pass's signature itself. |
| Checkout UI extensions on information, shipping or payment steps | Plus only | Not used. |

So on Basic, Shopify and Advanced the whole thing works, as long as the
merchant installs it from the App Store.

## How it works

```
storefront page ── no pass ──► https://ws.hibira.io/wait/KEY/ROOM?return=<page>
   (app embed)                     queue, then back with ?hibira_pass=PASS
                ── with pass ─► cookie hibira_wr_ROOM
                                cart attribute _hibira_wr_pass   (cart checkout)
                                line property  _hibira_wr_pass   ("Buy it now")
checkout ── cart validation Function ── HMAC check of the pass ── block or allow
```

- **The embed** (`extensions/waiting-room-embed`, source
  `storefront/waiting-room.js`, ~2 KB) does nothing outside the drop window,
  in the theme editor, or for crawlers. During the drop a shopper without a
  pass goes to the waiting page (whole store, or only product pages tagged
  with the drop's tags). A pass is checked for room, app, drop and expiry,
  but not its signature (the embed has no secret).
- **The checkout rule** (`extensions/checkout-pass`, Rust) checks the pass's
  HMAC-SHA256 against the room's secret (old and new during a rotation), its
  app and room, and that it was issued for this drop. It only blocks at the
  checkout steps, never when adding to cart, and only for carts holding a
  drop product. About 0.2M instructions (limit 11M); a JavaScript version
  needed 6.5M per secret, which is why it is Rust.
- **Limits.** A Function has no clock, so the rule cannot check a pass's
  exact expiry: the drop window (`localTime`) and "issued since the drop
  started" bound it instead, and the embed checks expiry. A pass can be
  copied to another browser while the drop is on, same as on any waiting
  room without accounts. A shopper with JavaScript off skips the redirect but
  is still stopped at checkout.

## Settings the Hibira server writes

The admin side lives in `hibira-io/pusher-server` (`internal/shopify`).

| Where | Key | Value |
| --- | --- | --- |
| App-data metafield (app installation) | `hibira.waiting_room` | `{key, app, room, host, opens, closes, since, scope, tags}`; times are Unix seconds; `scope` is `store` or `tagged` |
| Validation (from `validationCreate`, function handle `hibira-waiting-room-pass`, `blockOnFailure: false`) | `$app:hibira-waiting-room.config` | `{app, room, secrets, since, tags, message}` |
| Same validation | `$app:hibira-waiting-room.vars` | `{tags, opens, closes}`; `opens`/`closes` in the shop's local time, `YYYY-MM-DDTHH:MM:SS` (input query variables) |

The Hibira room's `return_urls` must include the store's primary domain and
its myshopify domain.

## Develop

```bash
npm install                              # in this folder: Shopify CLI
(cd extensions/checkout-pass && cargo test)
npm --prefix .. run build:waiting-room   # rebuild the embed's asset
npm --prefix .. test                     # embed tests (repo root)
npx shopify app function build --path extensions/checkout-pass
npx shopify app function run --path extensions/checkout-pass --input input.json
```

`extensions/checkout-pass/schema.graphql` comes from Shopify's function
template; `npx shopify app function schema` refreshes it once the app is
linked.

## 中文摘要

給 Shopify 商店用的排隊等候室，非 Plus 方案也能用（Starter 除外），但必須從 App Store 安裝（自訂 app 的 Function 只有 Plus 能用）。
主題 app embed 在開賣期間把沒有 pass 的顧客導到 Hibira 等候頁，輪到後帶 pass 回來，寫進購物車屬性與商品表單；結帳時用 Rust 寫的
cart validation Function 驗 pass 的 HMAC 簽名，沒有就擋下。Function 沒有時鐘，所以用開賣時段與「本次開賣後簽發」來限制 pass。
