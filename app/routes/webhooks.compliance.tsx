import type { ActionFunctionArgs } from "react-router";

import db from "../db.server";
import { authenticate } from "../shopify.server";

// Mandatory privacy webhooks. The app stores no customer data: purchase
// popups carry only product details. shop/redact (48 hours after uninstall)
// removes whatever is left for the shop.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  if (topic === "SHOP_REDACT") {
    await db.session.deleteMany({ where: { shop } });
  }
  return new Response();
};
