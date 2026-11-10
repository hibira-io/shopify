# Changelog

## Hibira Waiting Room 0.1.0 (unreleased, `waiting-room/`)

- New separate app: a theme app embed sends shoppers to the Hibira waiting page during a drop and hands their pass to checkout; a Rust cart and checkout validation Function blocks checkout without a valid pass. Works on every plan except Starter when installed from the App Store.

## 0.1.0 (unreleased)

- The "Minimum count to show" default is now 1, so a shopper alone on a product page sees the counter (App Store review feedback: with the old default of 2, a single reviewer saw nothing). The setting id changed from `min_viewers` to `min_count` so themes that saved the old default of 2 pick up the new one.
- The backend moved into the Hibira server (hibira-io/pusher-server, `internal/shopify`); this repository now holds the theme extension and the app configuration only.

- "N people viewing this right now" on product pages, from live subscriber counts.
- Pro: "just bought" popups from real orders (product only) and a store-wide "N people shopping now" block.
- Admin home with live viewers per product and recent purchases; Pro plan through Shopify billing with a 7-day trial.
- Storefront text in English, Japanese, Traditional and Simplified Chinese and Korean.
