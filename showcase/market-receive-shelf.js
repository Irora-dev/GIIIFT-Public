/* GIIIFT Marketplace — the receive-page spend shelf (M3, spec §6/§12 surface 4).
 *
 * When a gift carries a storefront ref (payload g.sr -> gift.shopRef), the reveal
 * gets a bare engine strip under the manifest: "[sender]'s picks", the sender's
 * own curation, with their attribution riding every item into the cart. The gift
 * does not just hand value over; it hands taste over.
 *
 * Self-sufficient: box.html stays light. This module lazy-loads its own deps
 * (engine, cards, sources, checkout, storefront lib) the first time it runs, and
 * it NEVER throws into the claim flow: any failure renders nothing.
 *
 * Dark by default: no payload carries g.sr until the wrap/send side stamps it
 * (GIIIFTStorefront.sendPayloadField). A bad/unknown ref falls back to the
 * GIIIFT editorial shelf only when opts.editorialFallback is set; otherwise
 * nothing renders and the claim is exactly what it was before.
 */
(function (global) {
  "use strict";
  var loading = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.async = false;          // preserve order across the dep chain
      s.onload = resolve; s.onerror = function () { reject(new Error("load " + src)); };
      document.head.appendChild(s);
    });
  }
  function ensureDeps() {
    if (global.GIIIFTMarket && global.GIIIFTStorefront && global.GIIIFTMarket.cartApi) return Promise.resolve();
    if (loading) return loading;
    var chain = [];
    if (!global.GIIIFTMarket) chain.push("/showcase/market-engine.js", "/showcase/market-cards.js", "/showcase/market-sources.js");
    if (!global.GIIIFTMarket || !global.GIIIFTMarket.cartApi) chain.push("/showcase/market-checkout.js");
    if (!global.GIIIFTStorefront) chain.push("/market-storefront.js");
    loading = chain.reduce(function (p, src) { return p.then(function () { return loadScript(src); }); }, Promise.resolve());
    return loading;
  }

  /**
   * Mount the shelf. opts: { mount, shopRef?, from?, editorialFallback? }
   * Resolves true when a shelf rendered, false when it (silently) did not.
   */
  async function spendShelf(opts) {
    try {
      var mountEl = opts && opts.mount; if (!mountEl) return false;
      var shopRef = String((opts && opts.shopRef) || "").toLowerCase();
      if (!shopRef && !(opts && opts.editorialFallback)) return false;
      await ensureDeps();
      var GM = global.GIIIFTMarket, SF = global.GIIIFTStorefront;

      var doc = shopRef ? await SF.get(shopRef).catch(function () { return null; }) : null;
      if (doc && doc.status !== "live") doc = null;
      if (!doc && !(opts && opts.editorialFallback)) return false;

      var host = document.createElement("div");
      host.style.marginTop = "26px";
      mountEl.appendChild(host);

      if (doc) {
        var from = (opts && opts.from) || doc.name || doc.handle;
        GM.track("receive_shelf", { handle: doc.handle, demo: !!doc.demo });
        GM.mount(host, Object.assign(SF.viewConfig(doc, {
          eyebrow: from + " picked these",
          title: "Spend it like " + from + " would",
          search: false, sort: false, cart: false, credit: false,
        }), {
          // the reveal strip is ONE row of their first pins; the full storefront is a tap away
          shelves: [{ kind: "row", title: from + "'s picks", note: "from their storefront",
            query: { ids: (doc.shelves[0] || { items: [] }).items.slice(0, 8) } }],
        }));
        var more = document.createElement("a");
        more.href = "/s/" + doc.handle;
        more.textContent = "See all of " + from + "'s picks →";
        more.style.cssText = "display:inline-block;margin-top:4px;color:" + doc.theme.accent + ";font:600 13px Inter,sans-serif;text-decoration:none";
        host.appendChild(more);
      } else {
        GM.track("receive_shelf", { editorial: true });
        GM.mount(host, { bare: true, hero: false, search: false, sort: false, cart: false, credit: false,
          eyebrow: "Spend it well", title: "",
          shelves: [{ kind: "row", title: "Worth a look", note: "from the GIIIFT shop", query: { sort: "editorial", limit: 8 } }] });
      }
      return true;
    } catch (e) {
      return false;                          // never let the shelf break a claim
    }
  }

  global.giiiftMarketReceiveShelf = spendShelf;
})(typeof window !== "undefined" ? window : this);
