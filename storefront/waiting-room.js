/*! Hibira Waiting Room for Shopify | MIT | https://hibira.io */
// Runs in <head> on every storefront page while a drop is on:
//  - no pass yet: send the shopper to the Hibira waiting page, which brings
//    them back with ?hibira_pass=PASS when their turn comes;
//  - with a pass: keep it in a cookie and hand it to checkout as the cart
//    attribute _hibira_wr_pass and as a hidden line item property on product
//    forms ("Buy it now" skips the cart). The checkout validation function
//    checks its signature; this script only reads its claims.
(function () {
  "use strict";
  var el = document.getElementById("hibira-wr-config");
  if (!el) return;
  var c;
  try {
    c = JSON.parse(el.textContent);
  } catch (e) {
    return;
  }
  if (!c || !c.key || !c.room || !c.app) return;
  var now = Date.now() / 1000;
  if ((c.opens && now < c.opens) || (c.closes && now >= c.closes)) return;

  var ATTR = "_hibira_wr_pass";
  var cookieName = "hibira_wr_" + c.room;

  function claims(tok) {
    if (typeof tok !== "string" || tok.length > 1024) return null;
    var dot = tok.indexOf(".");
    if (dot <= 0) return null;
    try {
      var p = tok.slice(0, dot).replace(/-/g, "+").replace(/_/g, "/");
      var x = JSON.parse(atob(p + "===".slice((p.length + 3) % 4)));
      if (!x || x.v !== 1 || x.room !== c.room || x.app !== c.app) return null;
      if (c.since && !(x.iat >= c.since)) return null;
      if (!(x.exp > now)) return null;
      return x;
    } catch (e) {
      return null;
    }
  }

  function readCookie() {
    var parts = document.cookie ? document.cookie.split("; ") : [];
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf("=");
      if (parts[i].slice(0, eq) === cookieName) return decodeURIComponent(parts[i].slice(eq + 1));
    }
    return null;
  }

  var pass = null;
  var fromUrl = null;
  var url;
  try {
    url = new URL(location.href);
    fromUrl = url.searchParams.get("hibira_pass");
  } catch (e) {
    url = null;
  }
  if (fromUrl) {
    var got = claims(fromUrl);
    if (got) {
      pass = fromUrl;
      document.cookie =
        cookieName + "=" + encodeURIComponent(pass) + "; path=/; max-age=" + Math.max(1, Math.floor(got.exp - now)) +
        "; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
    }
    url.searchParams.delete("hibira_pass");
    try {
      history.replaceState(history.state, "", url.pathname + url.search + url.hash);
    } catch (e) {
      /* keep the URL as it is */
    }
  }
  if (!pass) {
    var saved = readCookie();
    if (saved && claims(saved)) pass = saved;
  }

  if (!pass) {
    // A pass that came back unusable (clock far off) must not loop the
    // shopper through the queue again; checkout still enforces it.
    if (fromUrl || !c.protect) return;
    if (/bot|crawl|spider|slurp|facebookexternalhit|preview/i.test(navigator.userAgent || "")) return;
    var wait =
      "https://" + c.host + "/wait/" + encodeURIComponent(c.key) + "/" + encodeURIComponent(c.room) +
      "?return=" + encodeURIComponent(location.href) + (c.lang ? "&lang=" + encodeURIComponent(c.lang) : "");
    location.replace(wait);
    return;
  }

  window.HibiraWaitingRoom = { pass: pass };

  if (c.cartPass !== pass && c.cartUpdate) {
    var body = { attributes: {} };
    body.attributes[ATTR] = pass;
    fetch(c.cartUpdate + ".js", {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    }).catch(function () {});
  }

  var field = "properties[" + ATTR + "]";
  function stamp(form) {
    if (!form || form.tagName !== "FORM") return;
    var action = form.getAttribute("action") || "";
    if (action.indexOf("/cart/add") < 0) return;
    var input = form.querySelector('input[name="' + field + '"]');
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.name = field;
      form.appendChild(input);
    }
    input.value = pass;
  }
  function stampAll() {
    var forms = document.querySelectorAll('form[action*="/cart/add"]');
    for (var i = 0; i < forms.length; i++) stamp(forms[i]);
  }
  document.addEventListener("submit", function (e) { stamp(e.target); }, true);
  // Themes and "Buy it now" read the form when the button is pressed.
  document.addEventListener("click", function (e) {
    var t = e.target;
    var form = t && t.closest ? t.closest("form") : null;
    if (form) stamp(form);
  }, true);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", stampAll);
  else stampAll();
})();
