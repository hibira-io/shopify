import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Form, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate, BILLING_TEST, PRO_PRICE, PRO_TRIAL_DAYS } from "../shopify.server";
import { PRO_PLAN, syncConfig } from "../store.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const { appSubscriptions } = await billing.check({ plans: [PRO_PLAN], isTest: BILLING_TEST });
  const sub = appSubscriptions.find((s) => s.name === PRO_PLAN);
  return {
    pro: Boolean(sub),
    trialDays: sub?.trialDays ?? null,
    price: PRO_PRICE,
    freeTrialDays: PRO_TRIAL_DAYS,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing, admin } = await authenticate.admin(request);
  const form = await request.formData();
  if (form.get("intent") === "upgrade") {
    // Redirects to Shopify's approval page and back to the app.
    await billing.request({ plan: PRO_PLAN, isTest: BILLING_TEST });
  }
  if (form.get("intent") === "cancel") {
    const { appSubscriptions } = await billing.check({ plans: [PRO_PLAN], isTest: BILLING_TEST });
    for (const sub of appSubscriptions) {
      await billing.cancel({ subscriptionId: sub.id, isTest: BILLING_TEST, prorate: true });
    }
    await syncConfig(admin);
  }
  return null;
};

export default function Plan() {
  const { pro, price, freeTrialDays } = useLoaderData<typeof loader>();
  const busy = useNavigation().state !== "idle";

  return (
    <s-page heading="Plan">
      <s-section heading={pro ? "Free" : "Free (current plan)"}>
        <s-unordered-list>
          <s-list-item>&quot;N people viewing this now&quot; on product pages</s-list-item>
          <s-list-item>Minimum count, wording and colours in the theme editor</s-list-item>
          <s-list-item>Live view of your most-viewed products in this app</s-list-item>
        </s-unordered-list>
      </s-section>
      <s-section heading={pro ? "Pro (current plan)" : `Pro · $${price.toFixed(2)} / 30 days`}>
        <s-stack direction="block" gap="base">
          <s-unordered-list>
            <s-list-item>Everything in Free</s-list-item>
            <s-list-item>
              &quot;Just bought&quot; popups from real orders, as they happen and
              from the last 48 hours (product only, no customer details)
            </s-list-item>
            <s-list-item>&quot;N people shopping now&quot; across the whole store</s-list-item>
          </s-unordered-list>
          <Form method="post">
            {pro ? (
              <>
                <input type="hidden" name="intent" value="cancel" />
                <s-button type="submit" tone="critical" {...(busy ? { loading: true } : {})}>
                  Cancel Pro
                </s-button>
              </>
            ) : (
              <>
                <input type="hidden" name="intent" value="upgrade" />
                <s-button type="submit" variant="primary" {...(busy ? { loading: true } : {})}>
                  {`Start ${freeTrialDays}-day free trial`}
                </s-button>
              </>
            )}
          </Form>
          <s-paragraph>Billed by Shopify on your store invoice. Cancel any time.</s-paragraph>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
