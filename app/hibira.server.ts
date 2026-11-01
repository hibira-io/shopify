import Pusher from "pusher";

import { productIdFromChannel, productChannel, storeChannel } from "./live";

// One Hibira app serves every installed shop; each shop's channels start
// with lv-<shop>. The key and host are public (the storefront connects with
// them); the secret stays on this server.
export const hibiraKey = process.env.HIBIRA_APP_KEY || "";
export const hibiraHost = process.env.HIBIRA_HOST || "ws.hibira.io";
export const hibiraPort = process.env.HIBIRA_PORT || "443";

let client: Pusher | null = null;

export function hibira(): Pusher | null {
  if (!process.env.HIBIRA_APP_ID || !hibiraKey || !process.env.HIBIRA_APP_SECRET) {
    return null;
  }
  if (!client) {
    const port = hibiraPort;
    client = new Pusher({
      appId: process.env.HIBIRA_APP_ID,
      key: hibiraKey,
      secret: process.env.HIBIRA_APP_SECRET,
      host: hibiraHost,
      port,
      useTLS: port === "443",
    });
  }
  return client;
}

export interface LiveStats {
  /** Visitors on the store right now (Pro: every page; Free: product pages). */
  online: number;
  /** Products with viewers, most viewed first. */
  products: { id: number; viewers: number }[];
}

/** Live counts for a shop, from the Hibira channels API. */
export async function liveStats(shop: string): Promise<LiveStats | null> {
  const c = hibira();
  if (!c) return null;
  const res = await c.get({
    path: "/channels",
    params: { filter_by_prefix: storeChannel(shop), info: "subscription_count" },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as {
    channels?: Record<string, { subscription_count?: number }>;
  };
  const channels = body.channels || {};
  const store = channels[storeChannel(shop)]?.subscription_count || 0;
  const products: LiveStats["products"] = [];
  let productViewers = 0;
  for (const [name, info] of Object.entries(channels)) {
    const id = productIdFromChannel(shop, name);
    const viewers = info.subscription_count || 0;
    if (id && viewers > 0) {
      products.push({ id, viewers });
      productViewers += viewers;
    }
  }
  products.sort((a, b) => b.viewers - a.viewers || a.id - b.id);
  return { online: Math.max(store, productViewers), products: products.slice(0, 10) };
}

export async function publish(shop: string, event: string, data: unknown) {
  const c = hibira();
  if (!c) return false;
  await c.trigger(storeChannel(shop), event, data);
  return true;
}

export { productChannel, storeChannel };
