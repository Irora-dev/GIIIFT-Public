/* GIIIFT Marketplace — payment rails (M4, spec §7). Load AFTER market-engine.js,
 * BEFORE market-checkout.js (checkout consumes GM.railsApi when present).
 *
 * Four rails, registered into the engine's (previously empty) rails registry:
 *   balance         the user's own USDC, their wallet signs (nft-buy / retail handoff /
 *                   partner redirect / internal), cross-chain legs quoted via routing.js
 *   credit          GIIIFT credit, internal grants only — never conflated with Balance
 *   onramp          Coinbase first, MoonPay fallback, both as MoR; bank topup = the
 *                   providers' ACH/SEPA methods INSIDE their widgets; destination is
 *                   ALWAYS the user's own wallet (the standing third-party guardrail)
 *   external-wallet pay from a connected non-Privy wallet via the shipped GIIIFT Pay
 *                   bridge (/wc + src/wallet-bridge.js) — reused, not forked
 *
 * The composite (§7 "balance + top-up"): when balance < total, ONE checkout = an onramp
 * step for the shortfall, then the balance step. plan() quotes both up front and shows
 * one number; execute() walks the steps in order.
 *
 * SHIPS DARK: provider URLs only form when their window globals exist (build.mjs writes
 * GIIIFT_CB_ONRAMP_APP_ID / GIIIFT_MOONPAY_KEY from env); without them every step runs
 * the demo walk — same states, same receipts, nothing dead-ends. GIIIFT never holds
 * funds anywhere in this file: every live leg is the user's own wallet or a MoR widget
 * paying the user's own address.
 */
(function (global) {
  "use strict";
  var GM = global.GIIIFTMarket; if (!GM) return;

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function wallet() { return global.giiiftWalletAddress || null; }
  function railCfg() { var P = GM.pricing() || {}; return P.onramp || { order: ["coinbase", "moonpay"], bankMethods: ["ach", "sepa"] }; }

  // §8: exact-origin allowlist for partner-redirect fulfillment (never an open redirect)
  var REDIRECT_ALLOW = ["https://courtyard.io", "https://magiceden.io", "https://www.collectorcrypt.com"];
  function allowedUrl(u) {
    try { var o = new URL(u).origin; return REDIRECT_ALLOW.indexOf(o) >= 0 ? u : null; } catch (e) { return null; }
  }

  /* ---------------- onramp providers (Coinbase first per UNIT_ECONOMICS; order is
   * config in /market-pricing.json so the owner reorders without code) ---------------- */
  var PROVIDERS = {
    coinbase: {
      key: "coinbase", label: "Coinbase",
      available: function () { return !!global.GIIIFT_CB_ONRAMP_APP_ID; },
      url: function (amountUsd, address) {
        return "https://pay.coinbase.com/buy/select-asset?appId=" + encodeURIComponent(global.GIIIFT_CB_ONRAMP_APP_ID) +
          "&addresses=" + encodeURIComponent(JSON.stringify((function (o) { o[address] = ["base"]; return o; })({}))) +
          "&assets=" + encodeURIComponent('["USDC"]') +
          "&presetFiatAmount=" + encodeURIComponent(Math.ceil(amountUsd)) +
          "&defaultExperience=buy";
      },
    },
    moonpay: {
      key: "moonpay", label: "MoonPay",
      available: function () { return !!global.GIIIFT_MOONPAY_KEY; },
      url: function (amountUsd, address) {
        return "https://buy.moonpay.com/?apiKey=" + encodeURIComponent(global.GIIIFT_MOONPAY_KEY) +
          "&currencyCode=usdc_base&walletAddress=" + encodeURIComponent(address) +
          "&baseCurrencyCode=usd&baseCurrencyAmount=" + encodeURIComponent(Math.ceil(amountUsd));
      },
    },
  };
  function pickProvider() {
    var order = railCfg().order || ["coinbase", "moonpay"];
    for (var i = 0; i < order.length; i++) {
      var p = PROVIDERS[order[i]];
      if (p && p.available()) return p;
    }
    return null;
  }

  /* ---------------- the demo top-up ledger (order-scoped honesty: a demo arrival covers
   * the ORDER's shortfall and is logged; the page's own balance contract is untouched) -- */
  function logDemoTopup(amountUsd, orderId) {
    var l = GM.readJson("giiift-demo-topups", []);
    l.unshift({ usd: amountUsd, order: orderId || null, at: Date.now() });
    GM.writeJson("giiift-demo-topups", l.slice(0, 30));
  }

  /* ---------------- rails ---------------- */

  // balance: the user's own wallet signs; execution routes per line item's fulfillment.
  var balanceRail = {
    key: "balance", label: "Your balance",
    available: function () { return true; },   // demo path always walks
    live: function () { return !!(wallet() && typeof global.giiiftSendTransaction === "function"); },
    // one line item → a settlement step descriptor (executed by execute() below)
    routeLine: function (item) {
      var f = item.fulfillment, ref = item.fulfillmentRef || {};
      if (f === "onchain") {
        var cross = ref.chain && ref.chain !== "Base" ? ref.chain : null;
        return { kind: "onchain", cross: cross, label: cross ? "Buy on " + cross + " (routed from Base)" : "Buy onchain from your wallet" };
      }
      if (f === "shopify") return { kind: "shopify", label: "Hand off to " + (ref.shopifyDomain || "the merchant") + " checkout" };
      if (f === "partner-redirect") return { kind: "partner", label: "Complete with " + (ref.partner || "the partner"), url: ref.url ? allowedUrl(ref.url) : null };
      return { kind: "internal", label: "Delivered to your GIIIFT account" };
    },
    execute: function (order, leg, items, hooks) {
      hooks = hooks || {}; var self = this;
      var live = self.live();
      var persist = hooks.persist || function () {};
      // only the rows that actually sit on the balance leg (credit-priced goods are
      // the credit rail's steps, not ours)
      items = (items || []).filter(function (row) { return !(row.item.price.credit != null && !row.item.price.usd); });
      return items.reduce(function (p, row) {
        return p.then(function () {
          var route = self.routeLine(row.item);
          // M9 2.3: the per-line settlement ledger — a line whose id already carries a
          // ref is SETTLED; resume/replay walks skip it instead of re-buying with real
          // money. Every ref is persisted the moment it exists (before the next line).
          if ((order.refs || []).some(function (r) { return r.id === row.item.id; })) {
            (hooks.onStep || function () {})({ rail: "balance", label: route.label, state: "done" });
            return Promise.resolve();
          }
          (hooks.onStep || function () {})({ rail: "balance", label: route.label, state: "doing" });
          if (live && route.kind === "onchain" && !route.cross && typeof global.giiiftBuyNft === "function" && global.giiiftIsBuyable && global.giiiftIsBuyable(row.item.fulfillmentRef)) {
            return global.giiiftBuyNft(row.item.fulfillmentRef, { qty: row.qty })
              .then(function (res) { (order.refs = order.refs || []).push({ id: row.item.id, tx: res && res.hash }); persist(order); });
          }
          if (live && route.kind === "onchain" && route.cross && typeof global.giiiftRouteQuote === "function") {
            return global.giiiftRouteQuote({ fromChain: "Base", fromToken: "USDC", toChain: route.cross, toToken: row.item.fulfillmentRef.toToken || "USDC", amountUSD: row.item.price.usd * row.qty, wallet: wallet() })
              .then(function (q) {
                if (q && q.executable && typeof global.giiiftRouteExecute === "function") {
                  return global.giiiftRouteExecute(q, wallet()).then(function (res) { (order.refs = order.refs || []).push({ id: row.item.id, bridge: q.provider, tx: res && res.hash }); persist(order); });
                }
                (order.refs = order.refs || []).push({ id: row.item.id, bridge: q && q.provider, quoted: true }); persist(order);
                return sleep(600);   // quote-only scaffold: walk it
              });
          }
          if (route.kind === "shopify" && row.item.fulfillmentRef && shopifyDomainOk(row.item.fulfillmentRef.shopifyDomain) && row.item.fulfillmentRef.variantId) {
            // the retail lane's cart-permalink handoff (reuse, do not fork). M9 2.6: the
            // domain must BE a myshopify.com shop and the segments are encoded — a
            // malicious catalog item can't steer this money-flow click anywhere else.
            var href = "https://" + String(row.item.fulfillmentRef.shopifyDomain).toLowerCase() + "/cart/" +
              encodeURIComponent(String(row.item.fulfillmentRef.variantId)) + ":" + (Math.max(1, row.qty | 0) || 1);
            (order.refs = order.refs || []).push({ id: row.item.id, handoff: href }); persist(order);
            if (live) { try { global.open(href, "_blank", "noopener"); } catch (e) {} }
            return sleep(500);
          }
          if (route.kind === "partner" && route.url) {
            (order.refs = order.refs || []).push({ id: row.item.id, partner: route.url }); persist(order);
            if (live) { try { global.open(route.url, "_blank", "noopener"); } catch (e) {} }
            return sleep(500);
          }
          return sleep(600).then(function () { (order.refs = order.refs || []).push({ id: row.item.id, demo: true }); persist(order); });   // demo settle leaves a ledger row too
        }).then(function () { (hooks.onStep || function () {})({ rail: "balance", label: self.routeLine(row.item).label, state: "done" }); });
      }, Promise.resolve());
    },
  };
  // M9 2.6: exact-shape merchant domains only (mirrors the partner-redirect allowlist posture)
  function shopifyDomainOk(d) { return /^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/i.test(String(d || "")); }

  // credit: internal grants; live spends are server-side (credit_ledger), demo mirrors.
  var creditRail = {
    key: "credit", label: "GIIIFT credit",
    available: function () { return true; },
    execute: function (order, leg, items, hooks) {
      (hooks && hooks.onStep || function () {})({ rail: "credit", label: "GIIIFT credit −" + leg.total + " cr", state: "doing" });
      return sleep(450).then(function () {
        if (!order.live) GM.credit.spend(leg.total, "order", order.id);   // live: server already decremented
        (hooks && hooks.onStep || function () {})({ rail: "credit", label: "GIIIFT credit −" + leg.total + " cr", state: "done" });
      });
    },
  };

  // onramp: MoR widget paying the user's OWN address. Live = open the provider; demo =
  // simulated arrival (logged) so the composite walk completes instead of dead-ending.
  var onrampRail = {
    key: "onramp", label: "Top up",
    provider: pickProvider,
    available: function () { return true; },
    live: function () { return !!(pickProvider() && wallet()); },
    bankMethods: function () { return railCfg().bankMethods || []; },
    topup: function (amountUsd, opts) {
      opts = opts || {};
      var p = pickProvider(), addr = wallet();
      GM.track("market_topup", { usd: amountUsd, provider: p ? p.key : "demo", live: !!(p && addr) });
      if (p && addr) {
        var href = p.url(amountUsd, addr);
        try { global.open(href, "_blank", "noopener"); } catch (e) {}
        return Promise.resolve({ live: true, provider: p.key, label: p.label, url: href });
      }
      return sleep(opts.demoDelayMs != null ? opts.demoDelayMs : 1400).then(function () {
        logDemoTopup(amountUsd, opts.orderId);
        return { live: false, provider: "demo", label: "Demo top-up" };
      });
    },
    execute: function (order, step, _items, hooks) {
      var p = pickProvider();
      // one STABLE label per step (checkout dedupes step lines on it); the dot carries state
      var label = "Top up " + GM.money(step.amountUsd) + (p ? " · " + p.label : " · demo top-up");
      (hooks && hooks.onStep || function () {})({ rail: "onramp", label: label, state: "doing" });
      return onrampRail.topup(step.amountUsd, { orderId: order.id }).then(function (res) {
        // M9 2.4: a LIVE top-up actually WAITS for the funds — the widget opening is not
        // arrival. We resolve on (a) the wallet balance seam reporting the increase, or
        // (b) the user's explicit "I've topped up" confirm; 10 minutes without either
        // throws, parking the order recoverable instead of firing the balance leg short.
        if (!res.live) {
          (order.refs = order.refs || []).push({ topup: step.amountUsd, provider: res.provider });
          (hooks && hooks.onStep || function () {})({ rail: "onramp", label: label, state: "done" });
          return res;
        }
        (hooks && hooks.onStep || function () {})({ rail: "onramp", label: label, state: "await" });
        return waitForFunds(step.amountUsd, 10 * 60_000).then(function (how) {
          (order.refs = order.refs || []).push({ topup: step.amountUsd, provider: res.provider, arrival: how });
          (hooks && hooks.onStep || function () {})({ rail: "onramp", label: label, state: "done" });
          return res;
        });
      });
    },
  };

  // M9 2.4: live-funds arrival detector. Polls the optional `giiiftUsdcBalance` seam
  // (a host-provided () => Promise<number>) for the increase, and listens for the
  // checkout's explicit confirm event. Rejects after the deadline (recoverable park).
  function waitForFunds(amountUsd, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var done = false, t0 = Date.now(), base = null;
      function finish(how) { if (done) return; done = true; global.removeEventListener("giiift:topup-confirmed", onConfirm); resolve(how); }
      function onConfirm() { finish("confirmed"); }
      global.addEventListener("giiift:topup-confirmed", onConfirm);
      (function tick() {
        if (done) return;
        if (Date.now() - t0 > timeoutMs) { done = true; global.removeEventListener("giiift:topup-confirmed", onConfirm); reject(new Error("top-up not seen")); return; }
        var read = typeof global.giiiftUsdcBalance === "function" ? global.giiiftUsdcBalance() : null;
        if (read && read.then) {
          read.then(function (n) {
            if (done) return;
            if (base == null) base = Number(n) || 0;
            else if (Number(n) >= base + amountUsd * 0.95) { finish("balance"); return; }   // 5% provider-fee tolerance
            setTimeout(tick, 5000);
          }).catch(function () { setTimeout(tick, 5000); });
        } else setTimeout(tick, 5000);
      })();
    });
  }

  // external-wallet: the shipped GIIIFT Pay WalletConnect bridge owns this surface.
  var externalRail = {
    key: "external-wallet", label: "External wallet",
    available: function () { return !!(global.GIIIFT_WC_PROJECT_ID || global.giiiftWalletBridge); },
    href: "/wc",
    execute: function (order, leg, _items, hooks) {
      (hooks && hooks.onStep || function () {})({ rail: "external-wallet", label: "Pay from a connected wallet via GIIIFT Pay (/wc)", state: "doing" });
      return sleep(600).then(function () {
        (order.refs = order.refs || []).push({ external: true, bridge: "/wc" });
        (hooks && hooks.onStep || function () {})({ rail: "external-wallet", label: "Pay from a connected wallet via GIIIFT Pay (/wc)", state: "done" });
      });
    },
  };

  GM.registerRail(balanceRail).registerRail(creditRail).registerRail(onrampRail).registerRail(externalRail);

  /* ---------------- the composite planner + executor (§7) ---------------- */

  // plan(): legs + balance → ordered steps + ONE number. shortUsd>0 inserts the onramp
  // step before the balance step ("quote both up front, show one number").
  function plan(q, balanceUsd) {
    var bal = (q.legs || []).filter(function (l) { return l.rail === "balance"; })[0] || null;
    var cr = (q.legs || []).filter(function (l) { return l.rail === "credit"; })[0] || null;
    var steps = [];
    var short = 0;
    if (bal) {
      if (balanceUsd != null && isFinite(balanceUsd)) short = Math.max(0, +(bal.total - balanceUsd).toFixed(2));
      if (short > 0) steps.push({ rail: "onramp", amountUsd: short, label: "Top up " + GM.money(short) });
      steps.push({ rail: "balance", amountUsd: bal.total, label: "Pay " + GM.money(bal.total) + " from balance" });
    }
    if (cr) steps.push({ rail: "credit", amountCredit: cr.total, label: cr.total + " cr from GIIIFT credit" });
    return {
      steps: steps, shortUsd: short, composite: short > 0,
      totalUsd: bal ? bal.total : 0, totalCredit: cr ? cr.total : 0,
      oneNumber: (bal ? GM.money(bal.total) : "") + (bal && cr ? " + " : "") + (cr ? cr.total + " cr" : ""),
      provider: short > 0 ? (pickProvider() || { key: "demo", label: "demo" }).label : null,
      bankMethods: railCfg().bankMethods || [],
    };
  }

  // execute(): walk the plan's steps through their rails, driving the §7 state machine
  // via hooks.onState. Items are the RESOLVED cart rows so rails can route fulfillment.
  function execute(order, q, items, hooks) {
    hooks = hooks || {};
    var sig = GM.sig() || {};
    var p = plan(q, order.balanceUsd != null ? order.balanceUsd : sig.balanceUsd);
    var setState = hooks.onState || function () {};
    setState(order, "quoted");
    var chain = Promise.resolve();
    var creditShort = q.legs.some(function (l) { return l.rail === "credit" && l.total > GM.credit.get(); });
    if (creditShort && !order.live) { setState(order, "failed", { reason: "not enough GIIIFT credit" }); return Promise.resolve(order); }
    if (p.composite) setState(order, "awaiting-funds", { need: p.shortUsd });
    p.steps.forEach(function (step) {
      chain = chain.then(function () {
        var rail = GM.rails[step.rail]; if (!rail) return;
        if (step.rail === "balance" || step.rail === "external-wallet") setState(order, "executing");
        var legForRail = q.legs.filter(function (l) { return l.rail === step.rail; })[0] || step;
        return rail.execute(order, step.rail === "onramp" ? step : legForRail, items, hooks);
      });
    });
    return chain.then(function () { setState(order, "fulfilled", order.live ? {} : { demo: true }); return order; })
      .catch(function (e) { setState(order, "failed", { reason: (e && e.message) || "execution failed" }); return order; });
  }

  // cross-chain UX line for the cart (the "settles silently" note, routing.js shape)
  function crossChainNote(items) {
    var cross = items.filter(function (r) { return r.item.fulfillment === "onchain" && r.item.fulfillmentRef && r.item.fulfillmentRef.chain && r.item.fulfillmentRef.chain !== "Base"; });
    if (!cross.length || typeof global.giiiftRouteQuote !== "function") return Promise.resolve(null);
    var r0 = cross[0];
    return global.giiiftRouteQuote({ fromChain: "Base", fromToken: "USDC", toChain: r0.item.fulfillmentRef.chain, toToken: "USDC", amountUSD: r0.item.price.usd * r0.qty, wallet: wallet() })
      .then(function (qq) { return qq && qq.ok ? { chain: r0.item.fulfillmentRef.chain, feeUSD: qq.feeUSD, etaSeconds: qq.etaSeconds, provider: qq.provider } : null; })
      .catch(function () { return null; });
  }

  GM.railsApi = {
    plan: plan, execute: execute, topup: onrampRail.topup, provider: pickProvider,
    bankMethods: function () { return railCfg().bankMethods || []; },
    crossChainNote: crossChainNote, redirectAllow: REDIRECT_ALLOW.slice(),
  };
  global.GIIIFTMarketRails = GM.railsApi;
})(typeof window !== "undefined" ? window : this);
