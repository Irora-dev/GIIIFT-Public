/* GIIIFT Marketplace — source adapters (M1 demo data; M6 flipped LIVE-FIRST). Each registers
 * a source whose fetch() returns MarketItem-shaped raws (the engine's normalize fills defaults).
 *
 * LIVE-FIRST (M6, the M1 carry-forward): the first adapter to run makes ONE shared request to
 * /api/market/catalog ({items, sources:{key:status}}); every adapter takes its own source's
 * items when that leg reports "live", and falls back to its SAMPLES otherwise (§3/§8 — the
 * samples are the fallback snapshot; the engine's localStorage snapshot sits beneath as the
 * deeper net). On the static demo the request 404s once and everything renders samples,
 * exactly as before. Wraps: catalog.ts (tcg) · nft-buy.ts (art) · retail menu (product) ·
 * giiift goods (credit perks) · send flows (digital assets).
 */
(function (global) {
  "use strict";
  var GM = global.GIIIFTMarket; if (!GM) return;

  // one request, all sources; memoized for the page's lifetime; null = dark/unreachable
  var liveP = null, LIVE = {};   // LIVE[key] = true once that leg answered "live"
  function liveCatalog() {
    if (liveP) return liveP;
    liveP = fetch("/api/market/catalog")
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (cat) { if (cat && cat.sources) for (var k in cat.sources) { if (cat.sources[k] === "live") LIVE[k] = true; } return cat; })
      .catch(function () { return null; });
    return liveP;
  }

  function tile(tone, label) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">' +
      '<defs><radialGradient id="g" cx="50%" cy="20%" r="95%"><stop offset="0" stop-color="' + tone + '"/>' +
      '<stop offset="52%" stop-color="' + tone + '" stop-opacity="0.16"/><stop offset="100%" stop-color="#0b0e0f"/></radialGradient></defs>' +
      '<rect width="400" height="400" fill="#0b0e0f"/><rect width="400" height="400" fill="url(#g)"/>' +
      '<text x="200" y="226" font-family="Space Grotesk,Arial,sans-serif" font-size="132" font-weight="800" fill="#fff" fill-opacity="0.92" text-anchor="middle">' + label + '</text></svg>';
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }
  function m(tone, label, aspect) { return [{ url: tile(tone, label), aspect: aspect || "square", kind: "image" }]; }
  function src(key, types, items) {
    GM.registerSource({
      key: key, types: types,
      fetch: function () {
        return liveCatalog().then(function (cat) {
          if (cat && cat.sources && cat.sources[key] === "live") {
            var mine = (cat.items || []).filter(function (i) { return i.source === key; });
            if (mine.length) return mine;
          }
          return items;   // the §8 fallback snapshot: samples, never a hole
        });
      },
      live: function () { return !!LIVE[key]; },
    });
  }

  // ---- TCG (wraps catalog.js Collector Crypt ingest) ----
  src("tcg", ["tcg-card", "pack"], [
    { id: "tcg:char-base-4", type: "tcg-card", title: "Charizard", subtitle: "Base Set · Holo", brand: "Pokémon", tone: "#ff7a3d",
      media: m("#ff7a3d", "C", "card"), price: { usd: 420, kind: "floor", availability: "live" }, tags: ["featured", "holo", "vintage"],
      trust: { graded: "PSA 8", vaulted: true }, occasions: ["birthday"], affiliate: { eligible: true }, fulfillment: "partner-redirect" },
    { id: "tcg:pika-illus", type: "tcg-card", title: "Pikachu Illustrator", subtitle: "Promo", brand: "Pokémon", tone: "#ffd23d",
      media: m("#ffd23d", "P", "card"), price: { usd: 1200, kind: "floor", availability: "low" }, tags: ["grail"], trust: { graded: "CGC 9" }, fulfillment: "partner-redirect" },
    { id: "tcg:op-luffy", type: "tcg-card", title: "Monkey D. Luffy", subtitle: "OP-01 · Leader", brand: "One Piece", tone: "#e8484f",
      media: m("#e8484f", "L", "card"), price: { usd: 38, availability: "live" }, tags: ["anime"], trust: { graded: "raw" }, fulfillment: "partner-redirect" },
    { id: "tcg:pack-151", type: "pack", title: "151 Booster", subtitle: "Sealed pack · odds shown", brand: "Pokémon", tone: "#3da0ff",
      media: m("#3da0ff", "151", "portrait34"), price: { usd: 12, availability: "live" }, tags: ["sealed", "rip"], trust: { odds: true }, occasions: ["just-because"], fulfillment: "partner-redirect" },
  ]);

  // ---- NFT art (wraps nft-buy.js Reservoir aggregator) ----
  src("nft-art", ["art"], [
    { id: "art:fidenza-9", type: "art", title: "Fidenza #9", subtitle: "Generative", brand: "Tyler Hobbs", tone: "#7b5cff",
      media: m("#7b5cff", "F", "square"), price: { usd: 240, kind: "floor", availability: "live" }, tags: ["featured", "generative"], affiliate: { eligible: true }, fulfillment: "onchain" },
    { id: "art:sunset-22", type: "art", title: "Sunset Study 22", subtitle: "1/1 photograph", brand: "@lumen", tone: "#ff5aa0",
      media: m("#ff5aa0", "S", "natural"), price: { usd: 60, kind: "fixed", availability: "live" }, tags: ["photo"], affiliate: { eligible: true },
      fulfillment: "onchain", fulfillmentRef: { chain: "Solana" } },   // exercises the M4 cross-chain routing note
    { id: "art:glyph-3", type: "art", title: "Glyphwork III", subtitle: "On-chain SVG", brand: "@nodes", tone: "#34d6c4",
      media: m("#34d6c4", "G", "square"), price: { usd: 18, availability: "live" }, tags: ["onchain"], fulfillment: "onchain" },
  ]);

  // ---- Retail (wraps the curated Shopify USDC-on-Base menu) ----
  src("retail", ["product"], [
    { id: "shopify:ember-candle", type: "product", title: "Ember Wick Candle", subtitle: "Hand-poured · 8oz", brand: "Maker Co.", tone: "#ff9248",
      media: m("#ff9248", "E", "portrait45"), price: { usd: 28, availability: "live" }, tags: ["featured", "home"], occasions: ["thank-you"], affiliate: { eligible: true }, fulfillment: "shopify" },
    { id: "shopify:matcha-kit", type: "product", title: "Matcha Starter Kit", subtitle: "Whisk + bowl + tin", brand: "Kura", tone: "#8FAE3C",
      media: m("#8FAE3C", "M", "portrait45"), price: { usd: 54, availability: "live" }, tags: ["food"], fulfillment: "shopify" },
    { id: "shopify:linen-tee", type: "product", title: "Linen Tee", subtitle: "Oatmeal · unisex", brand: "Field+Co", tone: "#cdbeab",
      media: m("#cdbeab", "L", "portrait45"), price: { usd: 42, compareUsd: 58, availability: "low" }, tags: ["apparel"], fulfillment: "shopify" },
  ]);

  // ---- GIIIFT goods (the §13a perks inventory; priced in GIIIFT credit) ----
  src("giiift-goods", ["giiift-good"], [
    { id: "good:premium-box", type: "giiift-good", title: "Premium Box", subtitle: "Designer wrap templates", brand: "GIIIFT", tone: "#00FF9D",
      media: m("#00FF9D", "+", "square"), price: { usd: 0, credit: 200, kind: "fixed", availability: "live" }, rails: ["credit", "balance"], tags: ["featured"], fulfillment: "internal" },
    { id: "good:unlock-gate", type: "giiift-good", title: "Defuse Game Gate", subtitle: "Earn-the-open mini-game", brand: "GIIIFT", tone: "#35e0ff",
      media: m("#35e0ff", "◷", "square"), price: { usd: 0, credit: 120, availability: "live" }, rails: ["credit"], tags: ["game"], fulfillment: "internal" },
    { id: "good:plus-month", type: "giiift-good", title: "GIIIFT Plus · 1 mo", subtitle: "Fee-waived sends + cosmetics", brand: "GIIIFT", tone: "#b06bff",
      media: m("#b06bff", "★", "square"), price: { usd: 0, credit: 500, availability: "live" }, rails: ["credit"], tags: ["membership"], fulfillment: "internal" },
  ]);

  // ---- Digital assets (giftable value from the send flows; Spectrum baskets stay GATED per reg) ----
  src("digital-assets", ["digital-asset"], [
    { id: "asset:eth", type: "digital-asset", title: "Ether", subtitle: "Gift ETH", brand: "ETH", tone: "#627eea",
      media: m("#627eea", "Ξ", "square"), price: { usd: 50, kind: "from", availability: "live" }, tags: ["crypto"], fulfillment: "onchain" },
    { id: "asset:usdc", type: "digital-asset", title: "USDC", subtitle: "Dollar-stable gift", brand: "USDC", tone: "#2775ca",
      media: m("#2775ca", "$", "square"), price: { usd: 25, kind: "from", availability: "live" }, tags: ["crypto", "stable"], fulfillment: "onchain" },
  ]);
})(typeof window !== "undefined" ? window : this);
