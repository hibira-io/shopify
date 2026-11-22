# Hibira Live Chat for Shopify

Live chat for a Shopify store, answered from the
[Hibira Live Chat](https://chat.hibira.io/?utm_source=github&utm_medium=readme&utm_campaign=plugins)
inbox. Shoppers get a chat button on every storefront page; the store's staff
reply from the inbox, with AI replies, translation and saved answers on paid
plans.

This is part of the one Shopify app, Hibira: Chat, Visitors & Queue (the repo
root): the theme app embed `extensions/live-chat-embed`. Run the Shopify CLI
from the repo root.

## How it works

```
Shopify admin ── Live Chat page ────────► hibira.io/integrations/shopify/live-chat
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
- **Scopes.** `read_themes`, to show whether the embed is on. The Live Chat
  menu item appears once the store has granted it.

## Plans

Live Chat comes with the app's plans (one Shopify subscription covers Live
Visitors, Live Chat and the waiting room). The Live Chat page shows which
plan includes what and links to the app's Plan page.

| App plan | Live Chat plan | Agents | Conversations / month | AI replies / month |
|---|---|---|---|---|
| Free, Lite | Free | 2 | 100 | – |
| Starter ($29) | Starter | 3 | 1,000 | 300 |
| Growth ($99) | Team | 8 | 3,000 | 1,000 |
| Business ($249) | Business | 20 | 8,000 | 2,000 |

Past the month's conversations the widget takes messages instead of live
chats; nobody is cut off.

## Privacy

`app/uninstalled` turns the workspace off (installing again turns it back
on). `shop/redact` deletes the workspace and its conversations.
`customers/redact` deletes that shopper's conversations by email; for
`customers/data_request` the owner exports them in the inbox (Settings →
Privacy).

## Set up

Nothing of its own: it uses the app's client ID and secret (operations
console, **Settings → Shopify**). Live Chat must be on (`LIVECHAT_ENABLED`).
The embed deploys with the app (`.github/workflows/deploy.yml`).

## 中文摘要

Live Chat 已併入同一個 Shopify app（Hibira: Chat, Visitors & Queue）。商家打開 Live Chat 頁時，Hibira 伺服器會在 chat.hibira.io 自動建立該店的 Live Chat 工作區，並寫入 metafield `hibira.live_chat`；theme app embed 讀取它，在店面載入聊天按鈕。店員按「打開收件匣」，即以自己的 Shopify 帳號登入收件匣。方案跟隨 app 的方案：Starter 含 Live Chat Starter，Growth 含 Team，Business 含 Business。解除安裝時停用工作區，shop/redact 時刪除。
