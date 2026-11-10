import { createHmac } from "node:crypto";

// Signs a pass exactly like pusher-server internal/waitroom (sign / mac).
export function signPass(secret, claims) {
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = createHmac("sha256", secret).update("hibira-waitroom-pass." + payload).digest("base64url");
  return payload + "." + sig;
}

export const NOW = 1764820800;
export const claims = (over = {}) => ({ v: 1, app: "shopify-acme", room: "drop", n: 42, tid: "abc123", iat: NOW, exp: NOW + 1800, ...over });
