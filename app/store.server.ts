import { hibiraHost, hibiraKey, hibiraPort } from "./hibira.server";
import { addRecent, parseRecent, type Purchase } from "./live";

// The storefront reads its settings from app-data metafields on the app
// installation (app.metafields.hibira.* in Liquid), so a page view never
// calls this server.
export const NAMESPACE = "hibira";
export const PRO_PLAN = "Pro";

export type Plan = "free" | "pro";

interface GraphQLClient {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
}

async function gql<T>(admin: GraphQLClient, query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await admin.graphql(query, variables ? { variables } : undefined);
  const body = (await res.json()) as { data?: T; errors?: unknown };
  if (!body.data) throw new Error(`Shopify GraphQL error: ${JSON.stringify(body.errors)}`);
  return body.data;
}

interface Installation {
  id: string;
  plan: Plan;
  config: string | null;
  recent: Purchase[];
}

export async function installation(admin: GraphQLClient): Promise<Installation> {
  const data = await gql<{
    currentAppInstallation: {
      id: string;
      activeSubscriptions: { name: string; status: string }[];
      config: { value: string } | null;
      recent: { value: string } | null;
    };
  }>(
    admin,
    `#graphql
    query HibiraInstallation {
      currentAppInstallation {
        id
        activeSubscriptions { name status }
        config: metafield(namespace: "hibira", key: "config") { value }
        recent: metafield(namespace: "hibira", key: "recent") { value }
      }
    }`,
  );
  const inst = data.currentAppInstallation;
  const pro = inst.activeSubscriptions.some((s) => s.name === PRO_PLAN && s.status === "ACTIVE");
  return {
    id: inst.id,
    plan: pro ? "pro" : "free",
    config: inst.config?.value ?? null,
    recent: parseRecent(inst.recent?.value ?? null),
  };
}

export function configValue(plan: Plan) {
  // Port 443 is TLS on the default port; anything else (a local Hibira
  // server in development) is plain ws:// on host:port.
  const tls = hibiraPort === "443";
  const host = tls ? hibiraHost : `${hibiraHost}:${hibiraPort}`;
  return JSON.stringify({ key: hibiraKey, host, tls, plan });
}

async function setMetafields(
  admin: GraphQLClient,
  ownerId: string,
  fields: { key: string; value: string }[],
) {
  const data = await gql<{
    metafieldsSet: { userErrors: { field: string[]; message: string }[] };
  }>(
    admin,
    `#graphql
    mutation HibiraSetMetafields($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) { userErrors { field message } }
    }`,
    {
      metafields: fields.map((f) => ({
        ownerId,
        namespace: NAMESPACE,
        key: f.key,
        type: "json",
        value: f.value,
      })),
    },
  );
  const errors = data.metafieldsSet.userErrors;
  if (errors.length) throw new Error(`metafieldsSet: ${errors.map((e) => e.message).join("; ")}`);
}

/**
 * Writes the storefront config (Hibira key, host, plan) when it changed.
 * Free shops also lose their recent purchases, so popups stop at once.
 */
export async function syncConfig(admin: GraphQLClient): Promise<Installation> {
  const inst = await installation(admin);
  const want = configValue(inst.plan);
  if (!sameJSON(inst.config, want)) {
    const fields = [{ key: "config", value: want }];
    if (inst.plan === "free" && inst.recent.length) fields.push({ key: "recent", value: "[]" });
    await setMetafields(admin, inst.id, fields);
  }
  return { ...inst, config: want };
}

/** Prepends a purchase to the shop's recent list (Pro only). */
export async function rememberPurchase(admin: GraphQLClient, inst: Installation, p: Purchase) {
  const recent = addRecent(inst.recent, p);
  await setMetafields(admin, inst.id, [{ key: "recent", value: JSON.stringify(recent) }]);
  return recent;
}

function sameJSON(a: string | null, b: string) {
  if (a === null) return false;
  try {
    return JSON.stringify(JSON.parse(a)) === b;
  } catch {
    return false;
  }
}
