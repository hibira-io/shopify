# Changelog

## 0.2.0 (unreleased)

- One app: Live Chat and the waiting room are now part of this app (renamed "Hibira: Chat, Visitors & Queue"), instead of two separate apps. Their extensions moved to `extensions/` (`live-chat-embed`, `waiting-room-embed`, `checkout-pass`) and deploy with the app; the app asks for `read_themes` and `write_validations` as well.
- One subscription covers all three: Free, Lite $9.99 (the old Pro), Starter $29, Growth $99 and Business $249 every 30 days, plus the $49 event pass. The backend is hibira-io/pusher-server#933.

## Hibira Live Chat 0.1.0 (unreleased, `livechat/`)

- New separate app: a theme app embed puts the Hibira Live Chat button on the storefront; the admin page opens the store's inbox on chat.hibira.io with the staff member's Shopify account, shows whether the embed is on and the month's usage, and sells Live Chat's plans (Starter $29, Team $79, Business $199) through Shopify Billing.

## Hibira Waiting Room 0.1.0 (unreleased, `waiting-room/`)

- New separate app: a theme app embed sends shoppers to the Hibira waiting page during a drop and hands their pass to checkout; a Rust cart and checkout validation Function blocks checkout without a valid pass. Works on every plan except Starter when installed from the App Store.

## 0.1.0 (unreleased)

- The "Minimum count to show" default is now 1, so a shopper alone on a product page sees the counter (App Store review feedback: with the old default of 2, a single reviewer saw nothing). The setting id changed from `min_viewers` to `min_count` so themes that saved the old default of 2 pick up the new one.
- The backend moved into the Hibira server (hibira-io/pusher-server, `internal/shopify`); this repository now holds the theme extension and the app configuration only.

- "N people viewing this right now" on product pages, from live subscriber counts.
- Pro: "just bought" popups from real orders (product only) and a store-wide "N people shopping now" block.
- Admin home with live viewers per product and recent purchases; Pro plan through Shopify billing with a 7-day trial.
- Storefront text and theme editor settings in English, Japanese, Korean, Traditional and Simplified Chinese, Thai and Vietnamese.
