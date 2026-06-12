/* GIIIFT Marketplace — per-type card renderers (M1, §4). Each item type owns its card shape;
 * all build on the engine's helpers so the glass/tone language stays uniform. The engine's
 * defaultCard remains the `generic` fallback so unknown future types never break a shelf.
 * Load AFTER market-engine.js.
 */
(function (global) {
  "use strict";
  var GM = global.GIIIFTMarket; if (!GM) return;
  var el = GM.el, esc = GM.esc;

  function base(item, mediaFirst) {
    var card = el("article", "mk-card mk-t-" + item.type);
    if (mediaFirst !== false) card.appendChild(GM.mediaBox(item));
    var body = el("div", "mk-body"); card.appendChild(body);
    return { card: card, body: body };
  }
  function foot(item, body, cta) {
    var f = el("div", "mk-foot");
    f.appendChild(el("div", "mk-price", GM.priceHtml(item.price)));
    var get = el("button", "mk-get", cta || "Get it"); get.type = "button";
    get.addEventListener("click", function (e) { e.stopPropagation(); GM.track("item_get", { id: item.id }); card_open(item); });
    f.appendChild(get); body.appendChild(f);
  }
  // open the engine detail sheet without re-triggering the card click
  function card_open(item) { var fn = GM._openDetail; if (fn) fn(item); }
  function chips(body, list, tone) {
    if (!list.length) return;
    var row = el("div", "mk-chips");
    list.forEach(function (c) { row.appendChild(el("span", "mk-chip", esc(c))); });
    body.appendChild(row);
  }

  // ---- TCG single: portrait 63:88, grade/set front and centre (the trust spine) ----
  GM.registerRenderer("tcg-card", function (item) {
    var b = base(item);
    if (item.brand) b.body.appendChild(el("div", "mk-brand", esc(item.brand)));
    b.body.appendChild(el("div", "mk-title", esc(item.title)));
    if (item.subtitle) b.body.appendChild(el("div", "mk-sub", esc(item.subtitle)));
    var t = [];
    if (item.trust.graded && item.trust.graded !== "raw") t.push(item.trust.graded);
    if (item.trust.vaulted) t.push("Vaulted");
    chips(b.body, t);
    foot(item, b.body);
    return b.card;
  });

  // ---- Sealed pack: 3:4, odds up front ----
  GM.registerRenderer("pack", function (item) {
    var b = base(item);
    if (item.brand) b.body.appendChild(el("div", "mk-brand", esc(item.brand)));
    b.body.appendChild(el("div", "mk-title", esc(item.title)));
    if (item.subtitle) b.body.appendChild(el("div", "mk-sub", esc(item.subtitle)));
    chips(b.body, item.trust.odds ? ["Odds shown", "Sealed"] : ["Sealed"]);
    foot(item, b.body, "Rip it");
    return b.card;
  });

  // ---- Art: creator attribution leads ----
  GM.registerRenderer("art", function (item) {
    var b = base(item);
    b.body.appendChild(el("div", "mk-brand", "by " + esc(item.brand || "unknown")));
    b.body.appendChild(el("div", "mk-title", esc(item.title)));
    if (item.subtitle) b.body.appendChild(el("div", "mk-sub", esc(item.subtitle)));
    foot(item, b.body, "Collect");
    return b.card;
  });

  // ---- Real product: merchant + the "real thing" badge ----
  GM.registerRenderer("product", function (item) {
    var b = base(item);
    var vis = b.card.querySelector(".mk-vis");
    if (vis) vis.appendChild(el("span", "mk-flag real", "Real thing"));
    if (item.brand) b.body.appendChild(el("div", "mk-brand", esc(item.brand)));
    b.body.appendChild(el("div", "mk-title", esc(item.title)));
    if (item.subtitle) b.body.appendChild(el("div", "mk-sub", esc(item.subtitle)));
    foot(item, b.body);
    return b.card;
  });

  // ---- GIIIFT good: credit-priced perk; live box-engine mini preview when available ----
  GM.registerRenderer("giiift-good", function (item) {
    var b = base(item, !(global.GIIIFTBox && item.fulfillmentRef && item.fulfillmentRef.boxDoc));
    if (global.GIIIFTBox && item.fulfillmentRef && item.fulfillmentRef.boxDoc) {
      var vis = el("div", "mk-vis mk-vis-box"); vis.style.aspectRatio = "1 / 1";
      try { global.GIIIFTBox.render(vis, item.fulfillmentRef.boxDoc, { mode: "view", size: "84%", burst: false }); }
      catch (e) { vis.appendChild(el("div", "mk-vis-ph", "+")); }
      b.card.insertBefore(vis, b.card.firstChild);
    }
    b.body.appendChild(el("div", "mk-brand", "GIIIFT"));
    b.body.appendChild(el("div", "mk-title", esc(item.title)));
    if (item.subtitle) b.body.appendChild(el("div", "mk-sub", esc(item.subtitle)));
    chips(b.body, ["GIIIFT credit"]);
    foot(item, b.body, "Redeem");
    return b.card;
  });

  // ---- Digital asset: ticker-led ----
  GM.registerRenderer("digital-asset", function (item) {
    var b = base(item);
    b.body.appendChild(el("div", "mk-brand", esc(item.brand)));
    b.body.appendChild(el("div", "mk-title", esc(item.title)));
    if (item.subtitle) b.body.appendChild(el("div", "mk-sub", esc(item.subtitle)));
    foot(item, b.body, "Gift it");
    return b.card;
  });

  // a touch of type-specific CSS on top of the engine sheet
  if (!global.document.getElementById("gmk-cards-css")) {
    var s = el("style"); s.id = "gmk-cards-css";
    s.textContent =
      ".mk-flag.real{top:auto;bottom:9px;left:9px;color:#9ff5cf;border-color:color-mix(in srgb,#00FF9D 35%,transparent)}" +
      ".mk-t-tcg-card .mk-vis{background:radial-gradient(130% 110% at 50% -8%,color-mix(in srgb,var(--tone) 34%,transparent),#0c0f0e)}" +
      ".mk-vis-box{display:grid;place-items:center;background:radial-gradient(120% 100% at 50% 0%,color-mix(in srgb,var(--tone) 22%,transparent),#0d100f)}";
    global.document.head.appendChild(s);
  }
})(typeof window !== "undefined" ? window : this);
