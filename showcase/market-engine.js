/* GIIIFT Marketplace — headless engine. window.GIIIFTMarket.
 * House pattern (GIIIFTBox / GIIIFTFlow / vertical-engine): plain JS, IIFE -> one global,
 * no build step, declarative registries + view-configs. ONE engine, many surfaces:
 *   sources (where items come from) · renderers (how a type draws) · rails (how it's paid)
 *   · surfaces (mount(host, viewConfig)). The core is headless; renderers add the DOM.
 * Spec: docs/MARKETPLACE_ENGINE.md. M1: engine + demo-capable /shop, no checkout yet.
 */
(function (global) {
  "use strict";
  var doc = global.document;

  // ----- registries (§1) -----
  var SOURCES = {}, RENDERERS = {}, RAILS = {};
  function registerSource(a) { if (a && a.key) SOURCES[a.key] = a; return api; }
  function registerRenderer(type, fn) { if (type && fn) RENDERERS[type] = fn; return api; }
  function registerRail(r) { if (r && r.key) RAILS[r.key] = r; return api; }

  // ----- MarketItem normalization (§2): every source maps into this one shape -----
  var ASPECTS = { card: "63 / 88", square: "1 / 1", portrait45: "4 / 5", portrait34: "3 / 4", wide169: "16 / 9", natural: "auto" };
  function aspectRatio(a) { return ASPECTS[a] || ASPECTS.square; }
  function hash(s) { var h = 0, i; for (i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function num(v) { v = +v; return isFinite(v) ? v : 0; }
  function normalize(raw, sourceKey) {
    raw = raw || {};
    var media = (Array.isArray(raw.media) ? raw.media : (raw.image ? [{ url: raw.image }] : [])).map(function (m) {
      m = typeof m === "string" ? { url: m } : (m || {});
      return { url: m.url || "", aspect: m.aspect || "square", kind: m.kind || "image" };
    });
    if (!media.length) media = [{ url: "", aspect: "square", kind: "image" }];
    var p = raw.price || {};
    return {
      id: raw.id ? String(raw.id) : (sourceKey || "x") + ":" + (raw.slug || hash(JSON.stringify(raw))),
      source: sourceKey || raw.source || "?",
      type: raw.type || "product",
      title: raw.title || "", subtitle: raw.subtitle || "", desc: raw.desc || "", brand: raw.brand || "",
      media: media,
      price: {
        usd: num(p.usd != null ? p.usd : raw.usd), compareUsd: p.compareUsd != null ? num(p.compareUsd) : null,
        credit: p.credit != null ? num(p.credit) : null, kind: p.kind || "fixed", availability: p.availability || "live",
      },
      rails: Array.isArray(raw.rails) ? raw.rails : ["balance"],
      fulfillment: raw.fulfillment || "internal", fulfillmentRef: raw.fulfillmentRef || {},
      tags: Array.isArray(raw.tags) ? raw.tags : [], vertical: raw.vertical || null,
      occasions: Array.isArray(raw.occasions) ? raw.occasions : [],
      affiliate: raw.affiliate || { eligible: false }, trust: raw.trust || {}, tone: raw.tone || null,
    };
  }

  // ----- catalog load: run the view-config's sources, normalize, cache. Degrade per §8: a dead
  // source falls back to the LAST-GOOD localStorage snapshot for that source (stale-beats-broken,
  // badge rendered by mount); a source that never loaded simply hides its shelves. -----
  var CACHE = [], SNAP_KEY = "giiift-market-snapshot";
  function loadCatalog(cfg) {
    var keys = (cfg && cfg.sources) || Object.keys(SOURCES);
    var snap = readJson(SNAP_KEY, null);
    var usedSnap = false;
    return Promise.all(keys.map(function (k) {
      var s = SOURCES[k]; if (!s) return [];
      return Promise.resolve().then(function () { return s.fetch ? s.fetch((cfg && cfg.params) || {}) : []; })
        .then(function (raws) { return (raws || []).map(function (r) { return s.item ? s.item(r) : normalize(r, k); }); })
        .catch(function () {
          var cached = snap && snap.items ? snap.items.filter(function (i) { return i.source === k; }) : [];
          if (cached.length) usedSnap = true;
          return cached;
        });
    })).then(function (lists) {
      var all = []; lists.forEach(function (l) { all = all.concat(l); }); CACHE = all;
      api.staleCatalog = usedSnap;
      if (!usedSnap && all.length) writeJson(SNAP_KEY, { at: Date.now(), items: all.slice(0, 160) });
      return all;
    });
  }

  // ----- ranking (§5): a transparent client-side scorer; weights live in the view-config,
  // not code. `SIG` is the mounted surface's signal snapshot (set per render). -----
  var DEFAULT_WEIGHTS = { vertical: 3, occasion: 2, priceFit: 1.5, affinity: 2.5, editorial: 1.5, availability: 1 };
  var SIG = null, WEIGHTS = DEFAULT_WEIGHTS;
  function score(i, sig, w) {
    sig = sig || SIG || {}; w = w || WEIGHTS;
    var s = 0;
    s += w.availability * (i.price.availability === "live" ? 1 : i.price.availability === "low" ? 0.5 : 0);
    s += w.editorial * (i.tags.indexOf("featured") >= 0 ? 2 : 0) + (i.trust && i.trust.graded ? 0.4 : 0);
    var vMatch = sig.vertical && (i.vertical === sig.vertical ||
      ((sig.vertical === "tcg" || sig.vertical === "pokemon" || sig.vertical === "onepiece") && (i.type === "tcg-card" || i.type === "pack")));
    if (vMatch) s += w.vertical;
    if (sig.occasion && i.occasions.indexOf(sig.occasion) >= 0) s += w.occasion;
    if (sig.balanceUsd != null && i.price.usd > 0 && i.price.usd <= sig.balanceUsd) s += w.priceFit;
    s += w.affinity * Math.min(2, affinity.of(i.type, i.brand) / 3);
    return s;
  }
  var SORTS = {
    editorial: function (a, b) { return score(b) - score(a); },
    priceAsc: function (a, b) { return a.price.usd - b.price.usd; },
    priceDesc: function (a, b) { return b.price.usd - a.price.usd; },
    az: function (a, b) { return String(a.title).localeCompare(String(b.title)); },
  };
  function query(items, q) {
    q = q || {}; var out = (items || CACHE).slice();
    // pinned shelves (storefronts, §6): q.ids filters to exactly these items and
    // preserves the hand-set order unless a different sort is explicitly asked for
    if (q.ids && q.ids.length) {
      var pos = {}; q.ids.forEach(function (id, i) { if (pos[String(id)] == null) pos[String(id)] = i; });
      out = out.filter(function (i) { return pos[i.id] != null; });
      if (!q.sort || q.sort === "editorial") {
        out.sort(function (a, b) { return pos[a.id] - pos[b.id]; });
        if (q.limit) out = out.slice(0, q.limit);
        return out;
      }
    }
    if (q.types && q.types.length) out = out.filter(function (i) { return q.types.indexOf(i.type) >= 0; });
    if (q.maxUsd != null) out = out.filter(function (i) { return i.price.usd <= q.maxUsd; });
    if (q.vertical) out = out.filter(function (i) { return !i.vertical || i.vertical === q.vertical; });
    if (q.search) { var s = String(q.search).toLowerCase(); out = out.filter(function (i) { return (i.title + " " + i.brand + " " + i.subtitle + " " + i.tags.join(" ")).toLowerCase().indexOf(s) >= 0; }); }
    out.sort(SORTS[q.sort] || SORTS.editorial);
    if (q.limit) out = out.slice(0, q.limit);
    return out;
  }

  function track(name, data) { try { global.dispatchEvent(new CustomEvent("giiift:track", { detail: { name: name, data: data || {} } })); } catch (e) {} }

  // ----- pricing (§14.5): ONE config, /market-pricing.json, propagates everywhere -----
  // Embedded zeros = the fallback; the fetch overlays the real schedule. Edge fns read the
  // same file, so a number changed there updates client quotes AND server re-quotes.
  var PRICING = { marketplacePct: { "default": 0 }, retailBufferUsd: 0, partnerSharePct: 0, affiliateSharePct: 0, creditPerUsd: 10, quoteTtlSec: 90 };
  var pricingP = null;
  function loadPricing() {
    if (pricingP) return pricingP;
    pricingP = fetch("/showcase/market-pricing.json").then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j) PRICING = Object.assign({}, PRICING, j); return PRICING; })
      .catch(function () { return PRICING; });
    return pricingP;
  }
  function feePctFor(type) { var m = PRICING.marketplacePct || {}; return num(m[type] != null ? m[type] : m["default"]); }

  // ----- storage helpers -----
  function readJson(key, fb) { try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fb : v; } catch (e) { return fb; } }
  function writeJson(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  // ----- GIIIFT credit (§7): the perks currency. NEVER summed with Balance. Demo ledger
  // mirrors credit_ledger semantics (grants/spends with reasons) until the server exists. ---
  var credit = {
    get: function () { var l = readJson("giiift-credit", null); if (!l) { l = { bal: 250, log: [{ delta: 250, reason: "welcome", at: Date.now() }] }; writeJson("giiift-credit", l); } return l.bal; },
    spend: function (n, reason, ref) { var l = readJson("giiift-credit", { bal: 0, log: [] }); if (l.bal < n) return false; l.bal -= n; l.log.push({ delta: -n, reason: reason || "spend", ref: ref || null, at: Date.now() }); writeJson("giiift-credit", l); return true; },
    grant: function (n, reason, ref) { var l = readJson("giiift-credit", { bal: 0, log: [] }); l.bal += n; l.log.push({ delta: n, reason: reason || "grant", ref: ref || null, at: Date.now() }); writeJson("giiift-credit", l); },
  };

  // ----- wishlist hearts (the §5 "card saves" signal; existing giiift-wishlist key) -----
  var wishlist = {
    list: function () { var w = readJson("giiift-wishlist", []); return Array.isArray(w) ? w : []; },
    has: function (id) { return wishlist.list().indexOf(id) >= 0; },
    toggle: function (item) {
      var w = wishlist.list(), i = w.indexOf(item.id), on = i < 0;
      if (on) w.push(item.id); else w.splice(i, 1);
      writeJson("giiift-wishlist", w);
      track("market_save", { id: item.id, on: on });
      if (on) affinity.bump(item.type, item.brand, 2);
      return on;
    },
  };

  // ----- behavior affinity (§5 signal 4): on-device recency-weighted tally, no server -----
  var HALF_LIFE_MS = 7 * 24 * 3600e3;
  var affinity = {
    bump: function (type, brand, w) {
      var a = readJson("giiift-market-affinity", []);
      a.push({ t: type || "", b: brand || "", w: w || 1, at: Date.now() });
      if (a.length > 200) a = a.slice(-200);
      writeJson("giiift-market-affinity", a);
    },
    counts: function () { return readJson("giiift-market-affinity", []).length; },
    of: function (type, brand) {
      var a = readJson("giiift-market-affinity", []), s = 0, now = Date.now();
      for (var i = 0; i < a.length; i++) {
        var decay = Math.pow(0.5, (now - (a[i].at || now)) / HALF_LIFE_MS);
        if (a[i].t === type) s += (a[i].w || 1) * decay;
        if (brand && a[i].b === brand) s += 0.5 * (a[i].w || 1) * decay;
      }
      return s;
    },
    topType: function (types) {
      var best = null, bestS = 0;
      (types || ["tcg-card", "pack", "art", "product", "giiift-good", "digital-asset"]).forEach(function (t) {
        var s = affinity.of(t); if (s > bestS) { bestS = s; best = t; }
      });
      return { type: best, score: bestS };
    },
  };

  // ----- the signal stack (§5): gift context · vertical · balance fit · behavior · taste -----
  var TASTE_TO_TYPES = { cards: ["tcg-card", "pack"], art: ["art"], real: ["product"], crypto: ["digital-asset"] };
  function signals(cfg) {
    cfg = cfg || {};
    var stash = readJson("giiift-shop-context", {}) || {};
    var vertical = (function () { try { var V = global.GIIIFTVertical; return (V && typeof V.current === "function" && V.current()) || stash.vertical || null; } catch (e) { return null; } })();
    var taste = readJson("giiift-taste", null);
    return {
      occasion: stash.occasion || null,
      // cfg.balance renders the wallet chip; cfg.balanceUsd is the SIGNAL-ONLY form for
      // bare surfaces that own their balance chrome (shop.html) — M4 composite needs it
      balanceUsd: cfg.balanceUsd != null ? num(cfg.balanceUsd) : (cfg.balance ? num(cfg.balance.usd) : null),
      vertical: vertical,
      taste: taste && taste.pick && taste.pick !== "dismissed" ? taste.pick : null,
      interactions: affinity.counts(),
    };
  }
  // The dominance rule: the hero lane IS the top type when a signal clears the bar
  // (vertical session, an explicit taste pick, or >=5 interactions); else editorial.
  function dominantTypes(sig) {
    if (sig.taste && TASTE_TO_TYPES[sig.taste]) return { types: TASTE_TO_TYPES[sig.taste], why: "taste" };
    if (sig.vertical === "tcg" || sig.vertical === "pokemon" || sig.vertical === "onepiece") return { types: ["tcg-card", "pack"], why: "vertical" };
    if (sig.interactions >= 5) { var top = affinity.topType(); if (top.type && top.score > 1) return { types: [top.type], why: "behavior" }; }
    return null;
  }

  // ----- rendering helpers -----
  function el(tag, cls, html) { var e = doc.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(usd) { return "$" + (usd >= 100 ? Math.round(usd).toLocaleString() : usd.toFixed(2).replace(/\.00$/, "")); }
  function injectCss() {
    if (doc.getElementById("gmk-css")) return;
    var s = el("style"); s.id = "gmk-css"; s.textContent = CSS; doc.head.appendChild(s);
  }
  function renderCard(item) {
    var fn = RENDERERS[item.type] || RENDERERS.generic;
    var card;
    try { card = fn ? fn(item, api) : defaultCard(item); }
    catch (e) { card = defaultCard(item); }   // §8: one bad renderer never takes down a shelf
    card.style.setProperty("--tone", item.tone || "#00FF9D");
    card.setAttribute("data-aspect", item.media[0].aspect);
    card.addEventListener("click", function () { track("market_item_view", { id: item.id }); affinity.bump(item.type, item.brand, 1); openDetail(item); });
    var vis = card.querySelector(".mk-vis");
    if (vis && !vis.querySelector(".mk-heart")) {   // wishlist heart on every card (§5 save signal)
      var h = el("button", "mk-heart" + (wishlist.has(item.id) ? " on" : ""), "♥"); h.type = "button";
      h.setAttribute("aria-label", "Save to wishlist");
      h.addEventListener("click", function (e) { e.stopPropagation(); h.classList.toggle("on", wishlist.toggle(item)); });
      vis.appendChild(h);
    }
    return card;
  }
  function mediaBox(item) {
    var m = item.media[0], box = el("div", "mk-vis");
    box.style.aspectRatio = aspectRatio(m.aspect);
    if (m.url) { var img = el("img"); img.loading = "lazy"; img.alt = item.title; img.src = m.url; box.appendChild(img); }
    else box.appendChild(el("div", "mk-vis-ph", esc((item.brand || item.title || "·").slice(0, 1).toUpperCase())));
    if (item.price.availability === "soldout") box.appendChild(el("span", "mk-flag", "Sold out"));
    else if (item.price.availability === "low") box.appendChild(el("span", "mk-flag low", "Low stock"));
    else if (item.price.availability === "preview") box.appendChild(el("span", "mk-flag", "Preview"));
    return box;
  }
  function priceHtml(p) {
    if (p.credit != null && !p.usd) return '<b>' + p.credit + ' cr</b>';
    var s = '<b>' + (p.kind === "from" || p.kind === "floor" ? (p.kind === "floor" ? "floor " : "from ") : "") + money(p.usd) + '</b>';
    if (p.compareUsd && p.compareUsd > p.usd) s += ' <s>' + money(p.compareUsd) + '</s>';
    return s;
  }
  function defaultCard(item) {
    var card = el("article", "mk-card");
    card.appendChild(mediaBox(item));
    var body = el("div", "mk-body");
    if (item.brand) body.appendChild(el("div", "mk-brand", esc(item.brand)));
    body.appendChild(el("div", "mk-title", esc(item.title)));
    if (item.subtitle) body.appendChild(el("div", "mk-sub", esc(item.subtitle)));
    var foot = el("div", "mk-foot");
    foot.appendChild(el("div", "mk-price", priceHtml(item.price)));
    var get = el("button", "mk-get", "Get it"); get.type = "button";
    get.addEventListener("click", function (e) { e.stopPropagation(); track("item_get", { id: item.id }); openDetail(item); });
    foot.appendChild(get); body.appendChild(foot);
    card.appendChild(body);
    return card;
  }

  // ----- shelves (§4 primitives) -----
  function shelfGrid(items, kind) {
    var g = el("div", "mk-" + (kind === "row" || kind === "strip" ? "row" : "grid"));
    items.forEach(function (it) { g.appendChild(renderCard(it)); });
    return g;
  }
  function buildShelf(shelf, items) {
    var picked = query(items, shelf.query || {});
    if (!picked.length) return null;   // hidden shelf, never an empty frame
    var wrap = el("section", "mk-shelf mk-shelf-" + (shelf.kind || "grid"));
    if (shelf.title) {
      var head = el("div", "mk-shelf-head");
      head.appendChild(el("h2", "mk-shelf-title", esc(shelf.title)));
      if (shelf.note) head.appendChild(el("span", "mk-shelf-note", esc(shelf.note)));
      wrap.appendChild(head);
    }
    if (shelf.kind === "spotlight" || shelf.kind === "hero") wrap.appendChild(renderCard(picked[0]));
    else wrap.appendChild(shelfGrid(picked, shelf.kind));
    return wrap;
  }

  // ----- the 10-second taste picker (§5 cold-start floor) -----
  function tasteRow(rerender) {
    var row = el("div", "mk-taste");
    row.appendChild(el("span", "mk-taste-q", "What are you into?"));
    [["cards", "Cards"], ["art", "Art"], ["real", "Real things"], ["crypto", "Crypto"]].forEach(function (p) {
      var c = el("button", "mk-fchip", p[1]); c.type = "button";
      c.addEventListener("click", function () { writeJson("giiift-taste", { pick: p[0], at: Date.now() }); track("taste_pick", { pick: p[0] }); rerender(); });
      row.appendChild(c);
    });
    var x = el("button", "mk-taste-x", "✕"); x.type = "button"; x.setAttribute("aria-label", "Dismiss");
    x.addEventListener("click", function () { writeJson("giiift-taste", { pick: "dismissed", at: Date.now() }); rerender(); });
    row.appendChild(x);
    return row;
  }

  // ----- detail sheet (the cart CTA arrives via market-checkout.js) -----
  function openDetail(item) {
    var ov = el("div", "mk-ov"); ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    function close() { ov.classList.remove("on"); setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); }, 220); }
    var sheet = el("div", "mk-detail");
    sheet.appendChild(mediaBox(item));
    var b = el("div", "mk-detail-body");
    if (item.brand) b.appendChild(el("div", "mk-brand", esc(item.brand)));
    b.appendChild(el("div", "mk-detail-title", esc(item.title)));
    if (item.desc || item.subtitle) b.appendChild(el("p", "mk-detail-desc", esc(item.desc || item.subtitle)));
    if (item.trust && (item.trust.graded || item.trust.vaulted || item.trust.odds)) {
      var t = []; if (item.trust.graded) t.push("Graded " + esc(item.trust.graded)); if (item.trust.vaulted) t.push("Vaulted"); if (item.trust.odds) t.push("Odds shown");
      b.appendChild(el("div", "mk-chips", t.map(function (x) { return '<span class="mk-chip">' + x + '</span>'; }).join("")));
    }
    var foot = el("div", "mk-detail-foot");
    foot.appendChild(el("div", "mk-price big", priceHtml(item.price)));
    if (api.cartApi) {   // checkout module loaded: real cart CTAs
      var add = el("button", "mk-get big", "Add to cart"); add.type = "button";
      add.addEventListener("click", function () { api.cartApi.add(item); add.textContent = "Added ✓"; setTimeout(function () { close(); api.cartApi.open(); }, 320); });
      foot.appendChild(add);
    } else {
      var get = el("button", "mk-get big", "Get it for me"); get.type = "button";
      get.addEventListener("click", function () { track("checkout_intent", { id: item.id, demo: true }); get.textContent = "Demo mode — load market-checkout.js"; get.disabled = true; });
      foot.appendChild(get);
    }
    b.appendChild(foot);
    sheet.appendChild(b); ov.appendChild(sheet);
    (doc.body || doc.documentElement).appendChild(ov); requestAnimationFrame(function () { ov.classList.add("on"); });
  }

  // ----- mount: build a surface from a view-config (the "multi-model" mechanism, §12) -----
  function mount(host, cfg) {
    cfg = cfg || {}; injectCss();
    if (typeof host === "string") host = doc.querySelector(host);
    if (!host) return null;
    if (cfg.theme && cfg.theme.accent) host.style.setProperty("--gmk-accent", cfg.theme.accent);
    host.classList.add("gmk"); host.innerHTML = "";
    // bare = embedded mode: the page owns its own hero/aurora/background (the shop.html swap,
    // the wrap-flow picker, the receive shelf); the engine renders just controls + shelves.
    if (cfg.bare) host.classList.add("gmk-bare");
    else host.appendChild(el("div", "mk-aurora"));
    var main = el("div", "mk-main"); host.appendChild(main);

    // signals + weights for this surface (§5); pricing loads in parallel with the catalog
    SIG = signals(cfg); WEIGHTS = Object.assign({}, DEFAULT_WEIGHTS, cfg.weights || {});
    loadPricing();

    // header: balance + credit chips (never conflated, §7) + title + search + sort
    var head = el("header", "mk-head");
    var wallet = el("div", "mk-wallet");
    if (cfg.balance) wallet.appendChild(el("div", "mk-balance", '<span class="mk-balance-lbl">Balance</span><b>' + money(num(cfg.balance.usd)) + '</b>'));
    if (cfg.credit !== false) wallet.appendChild(el("div", "mk-balance mk-credit", '<span class="mk-balance-lbl">GIIIFT credit</span><b>' + credit.get() + ' cr</b>'));
    if (wallet.children.length) head.appendChild(wallet);
    if (cfg.eyebrow) head.appendChild(el("div", "mk-eyebrow", '<span class="mk-pulse"></span>' + esc(cfg.eyebrow)));
    if (cfg.title) head.appendChild(el("h1", "mk-h1", esc(cfg.title)));
    var ctrls = el("div", "mk-ctrls");
    var search = el("input", "mk-search"); search.type = "search"; search.placeholder = cfg.searchPlaceholder || "Search the shop";
    var sort = el("select", "mk-sort"); sort.innerHTML = '<option value="editorial">Featured</option><option value="priceAsc">Price: low to high</option><option value="priceDesc">Price: high to low</option><option value="az">A to Z</option>';
    if (cfg.search !== false) ctrls.appendChild(search);
    if (cfg.sort !== false) ctrls.appendChild(sort);
    if (api.cartApi && cfg.cart !== false) ctrls.appendChild(api.cartApi.button());
    head.appendChild(ctrls);
    main.appendChild(head);

    // facet chips (optional)
    var activeFacet = null, facetRow = null;
    if (cfg.facets && cfg.facets.length) {
      facetRow = el("div", "mk-facets");
      var mkChip = function (label, q) {
        var c = el("button", "mk-fchip", esc(label)); c.type = "button";
        c.addEventListener("click", function () { activeFacet = (activeFacet === q ? null : q); [].forEach.call(facetRow.children, function (x) { x.classList.remove("on"); }); if (activeFacet) c.classList.add("on"); track("facet", { label: label }); render(); });
        return c;
      };
      facetRow.appendChild(mkChip("All", null));
      cfg.facets.forEach(function (f) { facetRow.appendChild(mkChip(f.label, f.query || {})); });
      main.appendChild(facetRow);
    }

    var shelvesEl = el("div", "mk-shelves"); main.appendChild(shelvesEl);
    var loading = el("div", "mk-loading", "Loading the shop…"); shelvesEl.appendChild(loading);

    var ITEMS = [];
    function render() {
      shelvesEl.innerHTML = "";
      var sv = search.value.trim(), sortV = sort.value;
      if (sv || activeFacet || sortV !== "editorial") {
        // browse mode: one filtered grid across everything
        var q = Object.assign({ search: sv, sort: sortV }, activeFacet || {});
        var picked = query(ITEMS, q);
        if (!picked.length) { shelvesEl.appendChild(el("div", "mk-empty", "Nothing matches that yet.")); return; }
        var sec = el("section", "mk-shelf mk-shelf-grid");
        sec.appendChild(el("div", "mk-shelf-head", '<h2 class="mk-shelf-title">' + (sv ? 'Results for "' + esc(sv) + '"' : "Browse") + '</h2>'));
        sec.appendChild(shelfGrid(picked, "grid")); shelvesEl.appendChild(sec);
      } else {
        // curated mode: the §5 dominance rule, then the view-config's shelves.
        // A cleared signal (taste pick / vertical session / >=5 interactions) makes the hero
        // lane THAT type; cold start gets the editorial shelves + the 10-second taste picker.
        SIG = signals(cfg);
        var TYPE_TITLE = { "tcg-card": "Trading cards", pack: "Trading cards", art: "Digital art", product: "Real things", "giiift-good": "GIIIFT goods", "digital-asset": "Crypto" };
        var dom = cfg.hero === false ? null : dominantTypes(SIG);
        if (dom) {
          var heroNode = buildShelf({ kind: "row", title: TYPE_TITLE[dom.types[0]] || "For you", note: "picked for you", query: { types: dom.types, sort: "editorial", limit: 8 } }, ITEMS);
          if (heroNode) { heroNode.classList.add("mk-hero-lane"); shelvesEl.appendChild(heroNode); }
        } else if (cfg.hero !== false && !readJson("giiift-taste", null)) {
          shelvesEl.appendChild(tasteRow(render));
        }
        (cfg.shelves || [{ kind: "grid", title: "Everything" }]).forEach(function (sh) {
          if (dom && sh.query && sh.query.types && String(sh.query.types) === String(dom.types)) return; // hero already shows it
          // §8: one broken shelf config never takes down the page
          try { var node = buildShelf(sh, ITEMS); if (node) shelvesEl.appendChild(node); } catch (e) {}
        });
        if (!shelvesEl.children.length) shelvesEl.appendChild(el("div", "mk-empty", "The shop is warming up."));
        if (api.staleCatalog) shelvesEl.insertBefore(el("div", "mk-stale", "Showing the last good catalog — prices may be stale."), shelvesEl.firstChild);
      }
    }
    var searchT = null;
    search.addEventListener("input", function () {
      render();
      // §10 market_search — debounced, no PII (length + hit count only, never the term)
      clearTimeout(searchT);
      searchT = setTimeout(function () {
        var sv = search.value.trim();
        if (sv) track("market_search", { len: sv.length, results: query(ITEMS, { search: sv }).length });
      }, 600);
    });
    sort.addEventListener("change", function () { track("sort", { sort: sort.value }); render(); });

    // storefront mounts (§6): cfg.ids restricts the whole surface to the curated pins
    // (search/browse then operate within the storefront), and cfg.attribution stamps
    // shopRef/affiliateCode onto every item so checkout lines + orders carry them.
    function prep(items) {
      if (cfg.ids && cfg.ids.length) items = query(items, { ids: cfg.ids });
      if (cfg.attribution) items.forEach(function (it) { it.attribution = cfg.attribution; });
      return items;
    }
    track("shop_view", Object.assign({ surface: cfg.key || "shop" }, cfg.attribution || {}));
    loadCatalog(cfg).then(function (items) { ITEMS = prep(items); render(); }).catch(function () { shelvesEl.innerHTML = ""; shelvesEl.appendChild(el("div", "mk-empty", "Couldn't reach the shop. Try again.")); });
    return { refresh: function () { return loadCatalog(cfg).then(function (i) { ITEMS = prep(i); render(); }); }, items: function () { return ITEMS; } };
  }

  var CSS =
    ".gmk.gmk-bare{background:transparent;min-height:0}.gmk.gmk-bare .mk-main{padding:0;max-width:none}" +
    ".gmk{position:relative;min-height:100vh;--gmk-accent:#00FF9D;--gmk-bg:#0a0a0c;--gmk-ink:#eef0f4;--gmk-dim:#9aa1ad;--gmk-border:rgba(255,255,255,.09);background:var(--gmk-bg);color:var(--gmk-ink);font-family:'Inter',system-ui,-apple-system,sans-serif}" +
    ".mk-aurora{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(60% 50% at 78% 18%,color-mix(in srgb,var(--gmk-accent) 18%,transparent),transparent 60%),radial-gradient(55% 45% at 12% 8%,rgba(123,92,255,.16),transparent 60%),radial-gradient(70% 60% at 50% 110%,rgba(52,214,196,.12),transparent 60%)}" +
    ".mk-main{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:28px 20px 80px}" +
    ".mk-head{margin-bottom:18px}.mk-wallet{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.mk-balance{display:inline-flex;gap:8px;align-items:baseline;padding:7px 13px;border:1px solid var(--gmk-border);border-radius:999px;background:linear-gradient(180deg,rgba(24,26,33,.55),rgba(15,16,21,.64))}.mk-balance-lbl{font:600 10px/1 'Space Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--gmk-dim)}.mk-balance b{font-size:15px;color:var(--gmk-accent)}.mk-credit b{color:#b06bff}" +
    ".mk-heart{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:50%;border:1px solid var(--gmk-border);background:rgba(8,10,12,.72);color:rgba(255,255,255,.4);font-size:13px;line-height:1;cursor:pointer;display:grid;place-items:center;transition:.18s;z-index:2}.mk-heart:hover{color:#fff;transform:scale(1.1)}.mk-heart.on{color:#ff5aa0;border-color:color-mix(in srgb,#ff5aa0 45%,transparent);background:color-mix(in srgb,#ff5aa0 16%,rgba(8,10,12,.72))}" +
    ".mk-taste{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:18px 0 4px;padding:12px 14px;border:1px dashed var(--gmk-border);border-radius:13px}.mk-taste-q{font:600 12px 'Inter';color:var(--gmk-dim);margin-right:2px}.mk-taste-x{margin-left:auto;border:none;background:transparent;color:var(--gmk-dim);cursor:pointer;font-size:12px;padding:4px}.mk-taste-x:hover{color:#fff}" +
    ".mk-hero-lane{padding:16px 16px 10px;border:1px solid color-mix(in srgb,var(--gmk-accent) 22%,var(--gmk-border));border-radius:16px;background:linear-gradient(180deg,color-mix(in srgb,var(--gmk-accent) 7%,transparent),transparent)}.mk-hero-lane .mk-shelf-note{color:var(--gmk-accent)}" +
    ".mk-eyebrow{display:flex;align-items:center;gap:7px;font:600 10px/1 'Space Mono',monospace;letter-spacing:.2em;text-transform:uppercase;color:var(--gmk-accent)}.mk-pulse{width:6px;height:6px;border-radius:50%;background:var(--gmk-accent);box-shadow:0 0 8px var(--gmk-accent);animation:mk-pulse 2.6s infinite ease-in-out}@keyframes mk-pulse{0%,100%{opacity:1}50%{opacity:.35}}" +
    ".mk-h1{font:700 30px/1.1 'Space Grotesk','Inter',sans-serif;margin:8px 0 16px;background:linear-gradient(180deg,#fff,#b8f5dd 72%,#6fe6c0);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}" +
    ".mk-ctrls{display:flex;gap:10px;flex-wrap:wrap}.mk-search,.mk-sort{padding:10px 14px;border:1px solid var(--gmk-border);border-radius:11px;background:rgba(18,20,26,.6);color:var(--gmk-ink);font:500 13px/1 'Inter',sans-serif}.mk-search{flex:1;min-width:200px}.mk-search:focus,.mk-sort:focus{outline:none;border-color:color-mix(in srgb,var(--gmk-accent) 55%,transparent);box-shadow:0 0 0 2px color-mix(in srgb,var(--gmk-accent) 12%,transparent)}" +
    ".mk-facets{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 6px}.mk-fchip{padding:7px 13px;border:1px solid var(--gmk-border);border-radius:999px;background:transparent;color:var(--gmk-dim);font:600 12px/1 'Inter',sans-serif;cursor:pointer;transition:.2s}.mk-fchip:hover{color:var(--gmk-ink);border-color:rgba(255,255,255,.2)}.mk-fchip.on{color:#07120d;background:var(--gmk-accent);border-color:var(--gmk-accent)}" +
    ".mk-shelf{margin:26px 0}.mk-shelf-head{display:flex;align-items:baseline;gap:10px;margin-bottom:13px}.mk-shelf-title{font:700 17px/1.2 'Space Grotesk',sans-serif;margin:0}.mk-shelf-note{font:500 12px/1 'Inter';color:var(--gmk-dim)}" +
    ".mk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(186px,1fr));gap:15px;align-items:start}.mk-row{display:flex;gap:14px;overflow-x:auto;padding-bottom:8px;scroll-snap-type:x mandatory}.mk-row .mk-card{flex:0 0 200px;scroll-snap-align:start}" +
    ".mk-shelf-spotlight>.mk-card,.mk-shelf-hero>.mk-card{max-width:none}.mk-shelf-hero .mk-vis{aspect-ratio:16/9!important}" +
    ".mk-card{position:relative;border:1px solid var(--gmk-border);border-radius:15px;overflow:hidden;background:linear-gradient(180deg,rgba(24,26,33,.55),rgba(15,16,21,.66));cursor:pointer;transition:transform .2s,border-color .2s,box-shadow .2s;--tone:var(--gmk-accent)}.mk-card:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--tone) 45%,var(--gmk-border));box-shadow:0 18px 40px -22px rgba(0,0,0,.8),0 0 30px -10px color-mix(in srgb,var(--tone) 30%,transparent)}" +
    ".mk-vis{position:relative;width:100%;background:radial-gradient(120% 100% at 50% 0%,color-mix(in srgb,var(--tone) 26%,transparent),#0d100f);display:grid;place-items:center;overflow:hidden}.mk-vis img{width:100%;height:100%;object-fit:cover;display:block}.mk-vis-ph{font:700 34px 'Space Grotesk';color:color-mix(in srgb,var(--tone) 70%,#fff)}" +
    ".mk-flag{position:absolute;top:9px;left:9px;padding:3px 8px;border-radius:7px;font:700 9px/1 'Space Mono',monospace;letter-spacing:.08em;text-transform:uppercase;background:rgba(8,10,12,.78);color:#fff;border:1px solid var(--gmk-border)}.mk-flag.low{color:#ffd27a}" +
    ".mk-body{padding:12px 13px 13px}.mk-brand{font:600 10px/1 'Space Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--gmk-dim);margin-bottom:5px}.mk-title{font:600 14px/1.25 'Inter';margin-bottom:2px}.mk-sub{font:500 12px/1.3 'Inter';color:var(--gmk-dim)}" +
    ".mk-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:11px}.mk-price{font:500 14px 'Inter'}.mk-price b{font-weight:700}.mk-price s{color:var(--gmk-dim);font-size:12px;margin-left:3px}.mk-price.big b{font-size:22px}" +
    ".mk-get{padding:8px 13px;border-radius:9px;border:1px solid var(--gmk-border);background:#fff;color:#07120d;font:700 12px/1 'Inter';cursor:pointer;transition:.2s}.mk-get:hover{box-shadow:0 0 16px -4px rgba(255,255,255,.4)}.mk-get.big{padding:12px 18px;font-size:14px}.mk-get:disabled{background:transparent;color:var(--gmk-dim);border-color:var(--gmk-border);cursor:default;box-shadow:none}" +
    ".mk-chips{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.mk-chip{padding:4px 9px;border-radius:7px;font:600 10px/1 'Space Mono',monospace;letter-spacing:.05em;background:color-mix(in srgb,var(--tone,#00FF9D) 14%,transparent);color:color-mix(in srgb,var(--tone,#00FF9D) 85%,#fff);border:1px solid color-mix(in srgb,var(--tone,#00FF9D) 28%,transparent)}" +
    ".mk-loading,.mk-empty{padding:60px 20px;text-align:center;color:var(--gmk-dim);font:500 14px 'Inter'}" +
    ".mk-stale{margin:10px 0 0;padding:8px 12px;border:1px solid rgba(255,210,122,.3);border-radius:10px;color:#ffd27a;font:500 11.5px 'Inter';background:rgba(255,210,122,.06)}" +
    ".mk-ov{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:20px;background:rgba(5,6,8,.6);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);opacity:0;transition:opacity .22s}.mk-ov.on{opacity:1}" +
    ".mk-detail{width:100%;max-width:560px;max-height:90vh;overflow-y:auto;border:1px solid rgba(255,255,255,.14);border-radius:20px;background:linear-gradient(160deg,rgba(20,24,28,.97),rgba(11,13,15,.98));box-shadow:0 33px 75px -23px rgba(0,0,0,.85)}.mk-detail .mk-vis{border-radius:20px 20px 0 0;max-height:46vh}.mk-detail-body{padding:20px}.mk-detail-title{font:700 22px/1.2 'Space Grotesk';margin:4px 0 8px}.mk-detail-desc{color:var(--gmk-dim);font:500 14px/1.5 'Inter';margin:0 0 14px}.mk-detail-foot{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:16px}" +
    "@media(prefers-reduced-motion:reduce){.mk-card,.mk-ov,.mk-pulse{transition:none;animation:none}}";

  var api = {
    registerSource: registerSource, registerRenderer: registerRenderer, registerRail: registerRail,
    normalize: normalize, query: query, score: score, loadCatalog: loadCatalog, mount: mount,
    aspectRatio: aspectRatio, track: track, el: el, esc: esc, money: money, mediaBox: mediaBox, priceHtml: priceHtml,
    openDetail: openDetail, _openDetail: openDetail,
    pricing: function () { return PRICING; }, loadPricing: loadPricing, feePctFor: feePctFor,
    credit: credit, wishlist: wishlist, affinity: affinity, signals: signals, readJson: readJson, writeJson: writeJson,
    cartApi: null,   // market-checkout.js installs the cart here
    sig: function () { return SIG; },   // the mounted surface's signal snapshot (balanceUsd etc.)
    sources: SOURCES, renderers: RENDERERS, rails: RAILS, version: "m4",
    railsApi: null,   // market-rails.js installs the §7 rails + composite planner here
  };
  global.GIIIFTMarket = api;
})(typeof window !== "undefined" ? window : this);
