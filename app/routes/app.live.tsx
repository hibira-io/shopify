import type { LoaderFunctionArgs } from "react-router";

import { loadLive } from "../live.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  return loadLive(session.shop, admin);
};
