import { liveStats } from "./hibira.server";

export interface LiveProduct {
  id: number;
  title: string;
  viewers: number;
}

export interface LiveData {
  connected: boolean;
  online: number;
  products: LiveProduct[];
}

/** Live counts for the home page, polled every few seconds. */
export async function loadLive(
  shop: string,
  admin: { graphql: (q: string, o?: { variables?: Record<string, unknown> }) => Promise<Response> },
): Promise<LiveData> {
  const stats = await liveStats(shop).catch(() => null);
  if (!stats) return { connected: false, online: 0, products: [] };
  let titles: Record<number, string> = {};
  if (stats.products.length) {
    const res = await admin.graphql(
      `#graphql
      query HibiraLiveProducts($ids: [ID!]!) {
        nodes(ids: $ids) { ... on Product { id title } }
      }`,
      { variables: { ids: stats.products.map((p) => `gid://shopify/Product/${p.id}`) } },
    );
    const body = (await res.json()) as { data?: { nodes: ({ id: string; title: string } | null)[] } };
    titles = Object.fromEntries(
      (body.data?.nodes || [])
        .filter((n): n is { id: string; title: string } => Boolean(n?.id))
        .map((n) => [Number(n.id.split("/").pop()), n.title]),
    );
  }
  return {
    connected: true,
    online: stats.online,
    products: stats.products
      .filter((p) => titles[p.id])
      .map((p) => ({ id: p.id, title: titles[p.id], viewers: p.viewers })),
  };
}
