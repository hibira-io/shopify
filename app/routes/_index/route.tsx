import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Hibira Live Visitors</h1>
        <p className={styles.text}>
          Real &quot;N people viewing this&quot; counts and &quot;just bought&quot;
          popups for your Shopify store. Every number is a real shopper.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Honest counts</strong>. Each open product page is counted
            live; nothing is invented, and the counter hides below your
            minimum.
          </li>
          <li>
            <strong>Just bought popups</strong>. Real orders as they happen,
            with the product only: never a customer name or place.
          </li>
          <li>
            <strong>No speed cost</strong>. One small script and one
            connection, closed when the tab is in the background.
          </li>
        </ul>
      </div>
    </div>
  );
}
