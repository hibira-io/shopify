import { useEffect, useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { syncConfig } from "../store.server";
import { loadLive, type LiveData } from "../live.server";

const EMBED_HANDLE = "live-visitors";
const POLL_MS = 10_000;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const inst = await syncConfig(admin);
  const live = await loadLive(session.shop, admin);
  const apiKey = process.env.SHOPIFY_API_KEY || "";
  return {
    shop: session.shop,
    plan: inst.plan,
    recent: inst.recent,
    live,
    embedUrl: `https://${session.shop}/admin/themes/current/editor?context=apps&activateAppId=${apiKey}/${EMBED_HANDLE}`,
    blockUrl: `https://${session.shop}/admin/themes/current/editor?template=product&addAppBlockId=${apiKey}/viewers&target=mainSection`,
  };
};

function ago(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} h ago`;
}

export default function Index() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<LiveData>();
  const [now, setNow] = useState(() => Date.now());
  const live = fetcher.data || data.live;

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") fetcher.load("/app/live");
      setNow(Date.now());
    }, POLL_MS);
    return () => clearInterval(t);
    // fetcher identity changes on every render; poll on a fixed timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <s-page heading="Live visitors">
      <s-section heading="Right now">
        {live.connected ? (
          <s-stack direction="block" gap="base">
            <s-heading>
              {live.online === 1 ? "1 person" : `${live.online} people`}{" "}
              {data.plan === "pro" ? "on your store" : "on product pages"}
            </s-heading>
            {live.products.length > 0 ? (
              <s-table>
                <s-table-header-row>
                  <s-table-header>Product</s-table-header>
                  <s-table-header format="numeric">Viewing now</s-table-header>
                </s-table-header-row>
                <s-table-body>
                  {live.products.map((p) => (
                    <s-table-row key={p.id}>
                      <s-table-cell>{p.title}</s-table-cell>
                      <s-table-cell>{p.viewers}</s-table-cell>
                    </s-table-row>
                  ))}
                </s-table-body>
              </s-table>
            ) : (
              <s-paragraph>
                Nobody is on a product page at the moment. Counts update every
                few seconds.
              </s-paragraph>
            )}
          </s-stack>
        ) : (
          <s-banner tone="warning">
            Live counts are unavailable right now. Shoppers still see the
            counter; try again in a minute.
          </s-banner>
        )}
      </s-section>

      <s-section heading="Recent purchases">
        {data.plan !== "pro" ? (
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Pro shows shoppers a small &quot;just bought&quot; popup for each
              real order, with the product only: never a customer name or
              place.
            </s-paragraph>
            <s-button href="/app/plan">See Pro</s-button>
          </s-stack>
        ) : data.recent.length ? (
          <s-unordered-list>
            {data.recent.map((p) => (
              <s-list-item key={`${p.id}-${p.at}`}>
                {p.title} · {ago(p.at, now)}
              </s-list-item>
            ))}
          </s-unordered-list>
        ) : (
          <s-paragraph>
            The next order will show here and as a popup on your store.
          </s-paragraph>
        )}
      </s-section>

      <s-section slot="aside" heading="Set up">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            1. Turn on <s-text type="strong">Hibira Live Visitors</s-text> in
            App embeds and press Save.
          </s-paragraph>
          <s-button href={data.embedUrl} target="_top" variant="primary">
            Open app embeds
          </s-button>
          <s-paragraph>
            2. Optional: place the &quot;Viewing now&quot; block where you want
            it on product pages. Without it, the count shows under the Add to
            cart button.
          </s-paragraph>
          <s-button href={data.blockUrl} target="_top">
            Add block to product page
          </s-button>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Honest counts">
        <s-paragraph>
          Every number is a real, open browser tab on your store, counted by
          Hibira. Nothing is invented or rounded up, and the counter hides
          itself below the minimum you set in the theme editor.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
