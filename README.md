# Hibira Live Visitors for Shopify

[![ci](https://github.com/hibira-io/shopify/actions/workflows/ci.yml/badge.svg)](https://github.com/hibira-io/shopify/actions/workflows/ci.yml)

A Shopify app that shows shoppers real social proof, counted live on
[Hibira](https://hibira.io/?utm_source=github&utm_medium=readme&utm_campaign=plugins),
a hosted realtime service that speaks the Pusher Channels protocol:

- **"3 people are viewing this right now"** on product pages. Each number is a
  real open tab on that product; it updates within a second and hides itself
  below the minimum the merchant sets (2 by default, which includes the
  shopper).
- **"Someone just bought …" popups** (Pro) from real orders, live and from
  the last 48 hours. Only the product is shown: never a customer name, place
  or order detail.
- **"12 people shopping now"** across the whole store (Pro), as a theme block.
- **Live now** in the Shopify admin: visitors on the store and the most
  viewed products, refreshed every 10 seconds.

Fake visitor counters are common on Shopify; this app never invents a number.

| Product page | Popup (Pro) | 繁體中文, phone |
|---|---|---|
| ![Viewing now badge](docs/images/product-badge-en-desktop.png) | ![Just bought popup](docs/images/popup-recent-en-desktop.png) | ![zh-TW](docs/images/product-badge-zh-TW-mobile.png) |

Storefront text ships in English, 日本語, 繁體中文, 简体中文 and 한국어, and follows
the shopper's storefront language. Merchants can replace the wording.

## How it works

```
storefront tab ──wss──▶ Hibira ◀── Hibira server (internal/shopify) ◀── Shopify webhooks
  subscribes to lv-<shop>-p-<product>      orders/create → "purchase" event
  (+ lv-<shop> on Pro)                     channel counts → admin "Live now"
```

- **Every shop gets its own Hibira app**, created the first time it opens
  the app, with its own limits: 100 connections on Free, 1,000 on Pro.
  Channels are named after the shop's myshopify subdomain: `lv-acme` (store)
  and `lv-acme-p-123` (product 123).
- **Counts are Hibira subscriber counts** (`pusher_internal:subscription_count`,
  sent at most once a second per channel), so there is no presence auth and
  no per-shopper data at all.
- **Page views never call this server.** The theme app embed reads its
  settings (Hibira key, plan, recent purchases) from app-data metafields that
  the app writes on install, on plan changes and on each order.
- **One small script** (`live-visitors.js`, about 6.5 KB, 2.7 KB gzipped, no
  dependencies) speaks the Pusher protocol directly. It connects only where
  there is something to show, and disconnects after 30 seconds in a
  background tab.

| Channel | Event | Sent when |
|---|---|---|
| `lv-{shop}-p-{productId}` | `pusher_internal:subscription_count` | viewers of the product change |
| `lv-{shop}` | `pusher_internal:subscription_count` | shoppers on the store change (Pro) |
| `lv-{shop}` | `purchase` `{id, title, url, image, at}` | an order is created (Pro) |

## Plans

| | Free | Pro ($9.99 / 30 days, 7-day trial) |
|---|---|---|
| "N viewing this now" on product pages | ✓ | ✓ |
| Live now in the admin | ✓ | ✓ |
| "Just bought" popups | | ✓ |
| Store-wide "N shopping now" block | | ✓ |

Billing goes through the Shopify Billing API (development stores get test
charges).

## Repository layout

This repository holds what Shopify hosts: the theme app extension and the
app's configuration. The backend (embedded admin page, billing, webhooks) is
part of the Hibira server, [hibira-io/pusher-server](https://github.com/hibira-io/pusher-server)
`internal/shopify` (see its `docs/shopify.md`), so there is no app server to
run.

| Path | What |
|---|---|
| `shopify.app.toml` | App configuration: URLs on `hibira.io/integrations/shopify`, scopes, webhooks |
| `extensions/live-visitors/` | Theme app extension: app embed + "Viewing now" block, locales |
| `storefront/live-visitors.js` | Source of the storefront script; `npm run build:storefront` minifies it into the extension |
| `tests/storefront/` | Renders the real Liquid blocks and runs them in Chromium |

## Develop

Needs Node 22.12+ and access to the app in the Shopify Dev Dashboard.

```shell
npm install
npm run config:link       # once: fills client_id in shopify.app.toml
npm run dev               # theme extension preview on a development store
npm run deploy            # pushes the configuration and the extension
```

The Hibira side is set up once by an operator: in the operations console
(**Settings → Shopify**), enter the app's client ID and secret and switch
the integration on.

Then in the store: **Online Store → Themes → Customize → App embeds →
Hibira Live Visitors**, or press **Open app embeds** on the app's home page.

## Test

```shell
npm test                 # Liquid rendering
npm run test:e2e         # Chromium against a bundled mock Pusher server
HIBIRA_E2E=localhost:8080 HIBIRA_APP_ID=… HIBIRA_APP_KEY=… HIBIRA_APP_SECRET=… \
  npm run test:e2e       # the same against a real Hibira server
npm run lint
npx @shopify/cli theme check --path extensions/live-visitors
```

The end-to-end test opens several real browser tabs on a rendered product
page and checks the count goes 1 (hidden) → 3 → 2 → 1 (hidden), that free
stores get no popups or store channel, that Pro shows the recent and a live
purchase, the store-wide block, and the Japanese and Chinese wording.

## Privacy

- Shoppers: no cookies, no IDs, nothing stored. A tab holds one WebSocket
  connection to Hibira while it is open; the popup "seen" list lives in
  `sessionStorage`.
- Merchants: the app reads orders only to learn which product was bought.
  It needs no protected customer data fields, stores no customer data, and
  answers the mandatory `customers/*` and `shop/redact` webhooks.

## Deploy

`npm run deploy` releases a new app version with the configuration and the
theme extension. The backend ships with the Hibira server's releases.

CI does the same on every push to `main` that changes `shopify.app.toml` or
`extensions/` (`.github/workflows/deploy.yml`, also runnable by hand). It
needs the repo secret `SHOPIFY_APP_AUTOMATION_TOKEN`, the app's CLI automation token
(Dev Dashboard → the app → Settings); without it the deploy is skipped with a warning.

## License

MIT.

## 中文摘要

Hibira Live Visitors 是 Shopify 應用程式，用 Hibira 的即時訂閱人數，在商品頁顯示真實的「目前有 N
人正在瀏覽此商品」，Pro 方案再加上來自真實訂單的「有人剛剛購買了…」彈窗（只顯示商品，不含任何顧客資料）
與全店「N 人正在逛商店」區塊。所有數字都是真實開著的分頁，不會造假。商店頁面不會呼叫本伺服器：設定放在 app
metafield，店面腳本約 2.7 KB（gzip）、無相依套件，背景分頁 30 秒後自動斷線。Pro 每 30 天 9.99 美元、試用 7
天，透過 Shopify Billing 收費。每家商店會自動有自己的 Hibira app，額度各自獨立（Free 100 連線、Pro 1,000 連線）。後端（嵌入式管理頁、收費、webhook）已併入 Hibira 伺服器（hibira-io/pusher-server 的 `internal/shopify`），本倉庫只放主題擴充與 app 設定，不需要另外架伺服器。部署用 `npm run deploy`，或合併到 main 後由 CI 自動部署（需設定 `SHOPIFY_APP_AUTOMATION_TOKEN`），測試用 `npm test` 與 `npm run test:e2e`。
