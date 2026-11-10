# Hibira Live Chat for Shopify

Live chat for a Shopify store, answered from the
[Hibira Live Chat](https://chat.hibira.io/?utm_source=github&utm_medium=readme&utm_campaign=plugins)
inbox. Shoppers get a chat button on every storefront page; the store's staff
reply from the inbox, with AI replies, translation and saved answers on paid
plans.

This is a separate Shopify app from Hibira Live Visitors (the repo root) and
Hibira Waiting Room (`waiting-room/`). Run the Shopify CLI from this folder.

## How it works

```
Shopify admin ── Hibira Live Chat app ──► hibira.io/integrations/shopify/live-chat
                                           creates the store's workspace on chat.hibira.io
                                           writes app-data metafield hibira.live_chat
                 "Open inbox" (new tab) ──► chat.hibira.io/sso/jwt → /inbox
storefront page ── app embed ──► https://chat.hibira.io/w/v1.js data-workspace=ws_…
```

- **The app embed** (`extensions/live-chat-embed`) is Liquid only: it loads
  the Live Chat widget for the workspace named in `hibira.live_chat`, with
  the shopper's storefront language and the button color the merchant picks.
  It renders nothing until the merchant has opened the app once. The widget
  connects only when a shopper opens the chat.
- **The admin page** is served by the Hibira server (hibira-io/pusher-server,
  `internal/shopify`, `NewLiveChat`): the inbox button, whether the embed is
  on in the live theme, this month's usage and the plans.
- **Sign-in.** The inbox opens in a new tab, signed in with the staff
  member's Shopify account (their verified email). Staff join as admins while
  the plan has a free seat; the store's contact email is the owner.
- **Scopes.** `read_themes` only, to show whether the embed is on. No orders,
  customers or products.

## Plans

Live Chat's own plans, charged by Shopify every 30 days on the merchant's
Shopify bill. Same allowances as on chat.hibira.io.

| | Free | Starter | Team | Business |
|---|---|---|---|---|
| Price | $0 | $29 | $79 | $199 |
| Agents | 2 | 3 | 8 | 20 |
| Conversations / month | 100 | 1,000 | 3,000 | 8,000 |
| AI replies / month | – | 300 | 1,000 | 2,000 |

Past the month's conversations the widget takes messages instead of live
chats; nobody is cut off.

## Privacy

`app/uninstalled` turns the workspace off (installing again turns it back
on). `shop/redact` deletes the workspace and its conversations.
`customers/redact` deletes that shopper's conversations by email; for
`customers/data_request` the owner exports them in the inbox (Settings →
Privacy).

## Set up

1. Create the app "Hibira Live Chat" in the Shopify Dev Dashboard, then run
   `npm run config:link` here (or set the repo variable
   `SHOPIFY_LC_CLIENT_ID`).
2. In the Hibira operations console, **Settings → Shopify Live Chat**: the
   app's client ID and secret, switched on. Live Chat must be on
   (`LIVECHAT_ENABLED`).
3. A Shopify service account for this app, its token in the repo secret
   `SHOPIFY_LC_APP_AUTOMATION_TOKEN`. Pushes to `main` that touch `livechat/`
   then deploy it (`.github/workflows/deploy-live-chat.yml`).

## 中文摘要

「Hibira Live Chat」是獨立的第三個 Shopify app。商家打開 app 時，Hibira 伺服器會在 chat.hibira.io 自動建立該店的 Live Chat 工作區，並寫入 metafield `hibira.live_chat`；theme app embed 讀取它，在店面載入聊天按鈕。店員在 Shopify 後台按「打開收件匣」，即以自己的 Shopify 帳號登入收件匣。方案沿用 Live Chat 的 Free / Starter $29 / Team $79 / Business $199，透過 Shopify Billing 每 30 天收費。只要求 `read_themes` 權限。解除安裝時停用工作區，shop/redact 時刪除。
