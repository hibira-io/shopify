import type { ActionFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import { syncConfig } from "../store.server";

// Plan changes (subscribe, cancel, trial end) switch Pro features on the
// storefront on or off through the config metafield.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.webhook(request);
  if (admin) await syncConfig(admin);
  return new Response();
};
