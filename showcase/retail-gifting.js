/* GIIIFT - retail gifting V1 client (the curated menu + the merchant handoff).
 *
 * Pairs with /api/retail-menu and /api/retail-resolve (netlify/edge-functions/retail.ts),
 * the shopify-usdc-base adapter behind the GiftMandate seam. The split mirrors
 * nft-buy.js:
 *   - giiiftRetailMenu()                  -> the curated products (cached fetch)
 *   - giiiftRetailQuote(product)          -> transparent local breakdown of what the
 *                                            SENDER funds: item + buffer (+ fee 0 in V2)
 *   - giiiftRetailSendPayload(product)    -> SEND seam: the gift-payload fragment the wrap
 *                                            flow writes (r:{p}) + fundUSD to fund (= quote)
 *   - giiiftRetailResolve(productId, p)   -> the recipient's handoff step: the merchant's
 *                                            own USDC-on-Base checkout URL, cart prefilled.
 *
 * Posture (do not regress): the server only resolves; the RECIPIENT is the only
 * signer, on the MERCHANT'S checkout (merchant of record). The item is a
 * suggestion: every gift falls back to spendable balance. Variant + address are
 * recipient-side only and never shown to the sender.
 *
 * Rejects use typed reasons ('not-enabled' | 'unknown-product' | 'retail-not-live'
 * | 'product-placeholder' | 'merchant-usdc-unverified' | …) so sheets can fall
 * back gracefully (to the balance, which is always there).
 */
(function () {
  var cache = null;

  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function fail(reason, extra) { var e = new Error(reason); e.reason = reason; if (extra) e.detail = extra; return e; }

  // The curated menu (display + quoting data). Cached for the session.
  async function menu(force) {
    if (cache && !force) return cache;
    var res;
    try { res = await fetch("/api/retail-menu", { headers: { accept: "application/json" } }); }
    catch (e) { throw fail("not-enabled", String(e)); }
    if (!res || !res.ok) throw fail("not-enabled");
    var data = await res.json();
    if (!data || !data.ok || !Array.isArray(data.products)) throw fail("not-enabled");
    cache = { live: !!data.live, products: data.products };
    return cache;
  }

  // What the SENDER funds, computed locally so the UI is honest even offline.
  function quote(product) {
    var item = round2(product && product.priceUSD);
    var buffer = round2(product && product.bufferUSD);
    return {
      itemUSD: item,
      bufferUSD: buffer,
      feeBps: 0, feeUSD: 0,            // V2 handoff: the commerce fee cannot ride (server says the same)
      fundUSD: round2(item + buffer),  // item + shipping/tax headroom the sender funds
      currency: "USD",
      note: "Unspent buffer stays in the recipient's balance.",
    };
  }

  // SEND seam (pairs with quote): turn a chosen menu product into what the wrap/send
  // flow writes into the gift and funds. Pure + side-effect free, so the separately-
  // owned wrap UI can wire it in one line:
  //     var s = giiiftRetailSendPayload(product);   // -> { r:{p}, fundUSD } | null
  //     if (s) { payload.r = s.r; fundAmountUSD = s.fundUSD; }
  // The receive side reads g.r.p (box.html hook -> retail-claim.js). fundUSD is the
  // item + buffer the sender funds (identical to quote().fundUSD). Returns null for a
  // missing/idless product, so the caller just sends a plain spendable-value gift.
  function sendPayload(product) {
    if (!product || product.id == null || product.id === "") return null;
    return { r: { p: String(product.id) }, fundUSD: quote(product).fundUSD };
  }

  // LIVE quote (async): the PRIMARY price-freshness guard. quote() above is the
  // instant menu-based display; quoteLive() hits /api/retail-quote, which reads
  // the merchant's CURRENT price, so the "you fund $X" the sender SIGNS is live,
  // not the cached menu number. Returns the live fund amount + `changed` (surface
  // "price updated to $X" before they commit) + `verified` (false = the store
  // couldn't be reached so fundUSD fell back to the menu price; sending still
  // works). docs/RETAIL_PRICE_FRESHNESS.md has the wrap-UI wiring.
  async function quoteLive(productId, variantId) {
    if (!productId) throw fail("unknown-product");
    var qs = "productId=" + encodeURIComponent(String(productId));
    if (variantId) qs += "&variantId=" + encodeURIComponent(String(variantId));
    var res;
    try { res = await fetch("/api/retail-quote?" + qs, { headers: { accept: "application/json" } }); }
    catch (e) { throw fail("not-enabled", String(e)); }
    if (!res || !res.ok) throw fail("not-enabled");
    var data = await res.json();
    if (!data || !data.ok) throw fail((data && data.reason) || "not-enabled");
    return {
      fundUSD: round2(data.fundUSD),          // fund THIS (live price + buffer)
      livePriceUSD: data.livePriceUSD == null ? null : round2(data.livePriceUSD),
      menuPriceUSD: round2(data.menuPriceUSD),
      bufferUSD: round2(data.bufferUSD),
      changed: !!data.changed,                // true -> show "price updated to $X" before signing
      verified: !!data.verified,              // false -> couldn't confirm; fundUSD is the menu price
      currency: "USD",
    };
  }

  // SEND seam, LIVE variant (async): the gift fragment + the freshly-quoted fund
  // amount, for the wrap UI to write AT COMMIT. Mirrors sendPayload() but fundUSD
  // is the live amount and it carries `changed`/`verified` so the UI can confirm a
  // moved price before the sender signs. Returns null for a missing id.
  async function sendPayloadLive(productId, variantId) {
    if (productId == null || productId === "") return null;
    var q = await quoteLive(productId, variantId);
    return {
      r: { p: String(productId) },
      fundUSD: q.fundUSD,
      changed: q.changed,
      verified: q.verified,
      livePriceUSD: q.livePriceUSD,
      menuPriceUSD: q.menuPriceUSD,
    };
  }

  // Resolve the recipient's claim step: the merchant-checkout handoff.
  // params: { variantId?, variantLabel?, email?, firstName?, lastName?,
  //           address1?, address2?, city?, province?, country?, zip?, mandateId? }
  // Address fields are optional best-effort prefill; the recipient can always
  // just type them on the merchant page.
  async function resolve(productId, params) {
    if (!productId) throw fail("unknown-product");
    var body = { productId: String(productId) };
    var p = params || {};
    ["variantId", "variantLabel", "email", "firstName", "lastName",
      "address1", "address2", "city", "province", "country", "zip", "mandateId"
    ].forEach(function (k) { if (p[k] != null && p[k] !== "") body[k] = String(p[k]); });

    var res;
    try {
      res = await fetch("/api/retail-resolve", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) { throw fail("not-enabled", String(e)); }
    if (!res || !res.ok) throw fail("not-enabled");

    var data = await res.json();
    if (!data || !data.ok) throw fail("not-enabled");
    var step = (data.steps && data.steps[0]) || null;
    if (!step || step.kind !== "handoff" || !step.url) {
      throw fail(data.reason || "order-unavailable", data);
    }
    return {
      ok: true,
      executable: !!data.executable,      // false while dormant: UI shows preview/fallback
      url: step.url,                      // the merchant's own USDC-on-Base checkout
      merchant: step.merchant,
      merchantDomain: step.merchantDomain,
      variant: step.variant,
      payHint: step.payHint,              // "usdc-base"
      breakdown: data.breakdown,
      fallback: data.fallback || "spendable-balance",
      reason: data.reason,
    };
  }

  window.giiiftRetailMenu = menu;
  window.giiiftRetailQuote = quote;
  window.giiiftRetailQuoteLive = quoteLive;
  window.giiiftRetailSendPayload = sendPayload;
  window.giiiftRetailSendPayloadLive = sendPayloadLive;
  window.giiiftRetailResolve = resolve;
})();
