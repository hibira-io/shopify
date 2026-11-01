import type { ActionFunctionArgs } from "react-router";

import { publish } from "../hibira.server";
import { numericId, PURCHASE_EVENT, type Purchase } from "../live";
import { authenticate } from "../shopify.server";
import { installation, rememberPurchase } from "../store.server";

interface OrderPayload {
  created_at?: string;
  line_items?: { product_id?: number | null; gift_card?: boolean }[];
}

// "Just bought" popups. Only the product goes out: no customer name, place
// or order details, so the popup never needs protected customer data.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, admin, payload } = await authenticate.webhook(request);
  if (!admin) return new Response();

  const order = payload as OrderPayload;
  const item = (order.line_items || []).find((l) => l.product_id && !l.gift_card);
  if (!item?.product_id) return new Response();

  const inst = await installation(admin);
  if (inst.plan !== "pro") return new Response();

  const res = await admin.graphql(
    `#graphql
    query HibiraPurchasedProduct($id: ID!) {
      product(id: $id) {
        title
        handle
        status
        onlineStoreUrl
        featuredMedia { preview { image { url(transform: { maxWidth: 160, maxHeight: 160 }) } } }
      }
    }`,
    { variables: { id: `gid://shopify/Product/${item.product_id}` } },
  );
  const body = (await res.json()) as {
    data?: {
      product: {
        title: string;
        handle: string;
        status: string;
        onlineStoreUrl: string | null;
        featuredMedia: { preview: { image: { url: string } | null } | null } | null;
      } | null;
    };
  };
  const product = body.data?.product;
  // Only products a shopper can open on the online store.
  if (!product || product.status !== "ACTIVE" || !product.onlineStoreUrl) return new Response();

  const at = order.created_at ? Date.parse(order.created_at) : Date.now();
  const purchase: Purchase = {
    id: numericId(item.product_id),
    title: product.title,
    url: `/products/${product.handle}`,
    image: product.featuredMedia?.preview?.image?.url || "",
    at: Number.isFinite(at) ? at : Date.now(),
  };

  await publish(shop, PURCHASE_EVENT, purchase);
  await rememberPurchase(admin, inst, purchase);
  return new Response();
};
