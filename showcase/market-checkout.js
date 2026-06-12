/* GIIIFT Marketplace — cart + checkout + orders (M2 + M4, spec §7). Load AFTER
 * market-engine.js (and market-rails.js, which installs GM.railsApi — M4).
 *
 * CART model (owner call §14.7): items collect into one cart; the quote splits it into LEGS
 * by currency — a Balance leg (USD, the user's own wallet) and a Credit leg (GIIIFT credit,
 * internal grants) — never conflated. Fees come from /market-pricing.json via the engine, so
 * one config change re-prices every quote.
 *
 * ORDER state machine mirrors §7: created → quoted → awaiting-funds? → executing → fulfilled.
 * M4 replaced the M2 demo dead-end: execution walks the RAILS (balance / credit / onramp /
 * external-wallet), the §7 composite tops up a shortfall mid-checkout instead of stopping,
 * and LIVE orders follow server state only (create → execute-with-evidence → poll; money is
 * never optimistic). SHIPS DEMO/DARK: any server failure falls back to the rails demo walk,
 * with orders persisted to localStorage `giiift-orders` and the same receipts.
 */
(function (global) {
  "use strict";
  var GM = global.GIIIFTMarket; if (!GM) return;
  var el = GM.el, esc = GM.esc, money = GM.money;

  // Privy access token (the intent-client.js pattern); live order calls carry it
  function authHeaders() {
    var h = { "content-type": "application/json" };
    try { var t = localStorage.getItem("privy:token"); if (t) h.authorization = "Bearer " + t; } catch (e) {}
    return h;
  }

  function readCart() { var c = GM.readJson("giiift-cart", []); return Array.isArray(c) ? c : []; }
  function writeCart(c) { GM.writeJson("giiift-cart", c); paintCount(); }
  function resolve(id) { return GM.query(null, {}).filter(function (i) { return i.id === id; })[0] || null; }
  function cartItems() {
    // r.attr = the storefront/affiliate attribution captured at add time (§6/§13b);
    // it persists in the cart row so it survives page hops and re-resolution.
    return readCart().map(function (r) { var it = resolve(r.id); return it ? { item: it, qty: Math.max(1, r.qty | 0), attr: r.attr || it.attribution || null } : null; })
      .filter(Boolean);
  }

  /* ---- quote: legs per currency, fees from the ONE pricing config ---- */
  function localQuote(rows) {
    var P = GM.pricing();
    var legs = { balance: { rail: "balance", lines: [], subtotal: 0, fees: 0, total: 0, currency: "usd" },
                 credit:  { rail: "credit",  lines: [], subtotal: 0, fees: 0, total: 0, currency: "credit" } };
    rows.forEach(function (r) {
      var it = r.item, qty = r.qty;
      if (it.price.credit != null && !it.price.usd) {
        var c = it.price.credit * qty;
        legs.credit.lines.push({ id: it.id, title: it.title, qty: qty, amount: c });
        legs.credit.subtotal += c;
      } else {
        var line = it.price.usd * qty;
        var fee = line * (GM.feePctFor(it.type) / 100) + (it.type === "product" ? (Number(P.retailBufferUsd) || 0) * qty : 0);
        legs.balance.lines.push({ id: it.id, title: it.title, qty: qty, amount: line, fee: fee });
        legs.balance.subtotal += line; legs.balance.fees += fee;
      }
    });
    legs.balance.total = legs.balance.subtotal + legs.balance.fees;
    legs.credit.total = legs.credit.subtotal;
    return { legs: [legs.balance, legs.credit].filter(function (l) { return l.lines.length; }), demo: true, ttlSec: Number(P.quoteTtlSec) || 90 };
  }
  function quote(rows) {
    var payload = { items: rows.map(function (r) { return { id: r.item.id, qty: r.qty }; }) };
    return fetch("/api/market/quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      .then(function (res) { if (!res.ok) throw 0; return res.json(); })
      .then(function (q) { q.demo = false; return q; })
      .catch(function () { return localQuote(rows); });
  }

  /* ---- orders store (demo ledger; live rows come from /api/market/order) ---- */
  function orders() { var o = GM.readJson("giiift-orders", []); return Array.isArray(o) ? o : []; }
  function saveOrder(order) {
    var all = orders().filter(function (o) { return o.id !== order.id; });
    all.unshift(order); GM.writeJson("giiift-orders", all.slice(0, 50));
  }
  function setState(order, state, extra) {
    order.state = state; order.updatedAt = Date.now();
    (order.events = order.events || []).push(Object.assign({ state: state, at: Date.now() }, extra || {}));
    saveOrder(order); GM.track("market_order_state", { id: order.id, state: state });
  }

  /* ---- execution (M4): the rails walk drives the §7 machine end to end ---- */
  // Demo + dark: GM.railsApi.execute routes every line through its rail (balance legs by
  // fulfillment, the composite's onramp step for a shortfall, credit decrements) and the
  // awaiting-funds state RESOLVES instead of dead-ending. Fallback keeps the M2 walk so
  // a page that forgot market-rails.js still completes.
  function walk(order, q, rows, onStep) {
    onStep = onStep || function () {};
    if (GM.railsApi) {
      return GM.railsApi.execute(order, q, rows || [], {
        onState: function (o, state, extra) { setState(o, state, extra); onStep(o); },
        persist: function (o) { saveOrder(o); },   // M9 2.3: refs land in storage the moment they exist
        onStep: function (s) {
          var steps = order.steps = order.steps || [];
          var hit = steps.filter(function (x) { return x.label === s.label; })[0];
          if (hit) hit.state = s.state; else steps.push({ label: s.label, state: s.state });
          saveOrder(order); onStep(order);
        },
      }).then(function () { if (order.state === "fulfilled" && !order.resumed) writeCart([]); return order; });
    }
    var crLeg = q.legs.filter(function (l) { return l.rail === "credit"; })[0];
    setState(order, "quoted"); onStep(order);
    return new Promise(function (done) {
      setTimeout(function () {
        setState(order, "executing"); onStep(order);
        setTimeout(function () {
          // M9 2.11: an insufficient-credit spend FAILS the order (it used to fulfill free)
          if (crLeg && !GM.credit.spend(crLeg.total, "order", order.id)) {
            setState(order, "awaiting-funds", { needCredit: true, demo: true }); onStep(order); done(order); return;
          }
          setState(order, "fulfilled", { demo: true }); onStep(order); writeCart([]); done(order);
        }, 700);
      }, 500);
    });
  }

  /* ---- live execution (M4): server state ONLY, never optimistic ---- */
  // create already happened (order.live). The client rails collect settlement evidence
  // (tx hashes / handoff refs — the user's own wallet signs, the server never moves
  // funds), then POST action=execute hands the evidence over; the poll paints whatever
  // the server says until a terminal state.
  function executeLive(order, q, rows, onStep) {
    onStep = onStep || function () {};
    function paintFromServer(srv) {
      if (!srv || !srv.state) return;
      order.state = srv.state; order.legs = srv.legs || order.legs;
      if (srv.refs) order.refs = srv.refs;
      saveOrder(order); onStep(order);
    }
    function poll(left) {
      if (left <= 0) return Promise.resolve(order);
      return fetch("/api/market/order?id=" + encodeURIComponent(order.id), { headers: authHeaders() })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (srv) {
          paintFromServer(srv);
          if (srv.state === "fulfilled" || srv.state === "failed" || srv.state === "refunded") { if (srv.state === "fulfilled") writeCart([]); return order; }
          return new Promise(function (r) { setTimeout(r, 1200); }).then(function () { return poll(left - 1); });
        })
        .catch(function () { return order; });
    }
    // client-side settlement first (signing/top-up is the USER's action), then hand evidence over
    var pre = GM.railsApi
      ? GM.railsApi.execute(order, q, rows || [], {
          onState: function (o, state, extra) { if (state !== "fulfilled") { setState(o, state, extra); onStep(o); } },
          persist: function (o) { saveOrder(o); },   // M9 2.3
          onStep: function (s) {
            var steps = order.steps = order.steps || [];
            var hit = steps.filter(function (x) { return x.label === s.label; })[0];
            if (hit) hit.state = s.state; else steps.push({ label: s.label, state: s.state });
            saveOrder(order); onStep(order);
          },
        })
      : Promise.resolve(order);
    return pre.then(function () {
      return fetch("/api/market/order", { method: "POST", headers: authHeaders(), body: JSON.stringify({ action: "execute", id: order.id, refs: order.refs || [] }) })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (srv) { paintFromServer(srv); return poll(8); })
        .catch(function () {
          // M9 2.1: a live order NEVER falls back to the demo walk — the rails may
          // already have executed real purchases, and re-walking re-buys them. Park it;
          // resume (Orders page) re-drives the server with the SAME evidence refs.
          setState(order, "executing", { parked: "server-unreachable" });
          order.parked = true; saveOrder(order); onStep(order);
          return order;
        });
    });
  }

  /* ---- UI: cart button, drawer, checkout, receipt ---- */
  var countEl = null;
  function paintCount() { if (countEl) { var n = readCart().reduce(function (s, r) { return s + (r.qty | 0 || 1); }, 0); countEl.textContent = n; countEl.style.display = n ? "" : "none"; } }
  function button() {
    var b = el("button", "mk-cartbtn", "Cart "); b.type = "button";
    countEl = el("span", "mk-cartn", "0"); b.appendChild(countEl); paintCount();
    b.addEventListener("click", open);
    return b;
  }

  function rowHtml(r) {
    return '<div class="mk-crow" data-id="' + esc(r.item.id) + '">' +
      '<span class="mk-crow-t">' + esc(r.item.title) + '<i>' + esc(r.item.brand || "") + '</i></span>' +
      '<span class="mk-crow-q"><button type="button" data-d="-1">−</button><b>' + r.qty + '</b><button type="button" data-d="1">+</button></span>' +
      '<span class="mk-crow-p">' + (r.item.price.credit != null && !r.item.price.usd ? (r.item.price.credit * r.qty) + " cr" : money(r.item.price.usd * r.qty)) + '</span>' +
      '<button type="button" class="mk-crow-x" aria-label="Remove">✕</button></div>';
  }
  function legHtml(l) {
    var cur = l.currency === "credit" ? function (n) { return n + " cr"; } : money;
    return '<div class="mk-leg"><div class="mk-leg-h">' + (l.rail === "credit" ? "GIIIFT credit leg" : "Balance leg · your wallet") + '</div>' +
      '<div class="mk-leg-r"><span>Subtotal</span><b>' + cur(l.subtotal) + '</b></div>' +
      (l.fees ? '<div class="mk-leg-r"><span>Fees</span><b>' + cur(l.fees) + '</b></div>' : "") +
      '<div class="mk-leg-r tot"><span>Leg total</span><b>' + cur(l.total) + '</b></div></div>';
  }
  function receiptHtml(order) {
    var s = '<div class="mk-receipt"><div class="mk-leg-h">Order ' + esc(order.id) + ' · <b class="mk-state mk-state-' + esc(order.state) + '">' + esc(order.state) + '</b>' + (order.demo ? ' <i>(demo)</i>' : "") + '</div>';
    // the rails walk's step lines (M4): top-up → balance → credit, each ticking live
    if (order.steps && order.steps.length) {
      s += '<div class="mk-steps">' + order.steps.map(function (st) {
        return '<div class="mk-step mk-step-' + esc(st.state) + '"><span class="mk-step-dot"></span>' + esc(st.label) +
          (st.state === "await" ? ' <button type="button" class="mk-step-go">I\'ve topped up — continue</button>' : '') + '</div>';
      }).join("") + '</div>';
    }
    (order.legs || []).forEach(function (l) { s += legHtml(l); });
    // settlement evidence (M4): tx hashes / handoff / top-up refs, the §7 receipt fields
    (order.refs || []).forEach(function (r) {
      if (r.tx) s += '<div class="mk-leg-r"><span>Tx</span><b>' + esc(String(r.tx).slice(0, 10)) + '…</b></div>';
      else if (r.handoff) s += '<div class="mk-leg-r"><span>Merchant checkout</span><b>opened</b></div>';
      else if (r.topup) s += '<div class="mk-leg-r"><span>Topped up</span><b>' + money(r.topup) + ' · ' + esc(r.provider || "") + '</b></div>';
    });
    s += '<div class="mk-leg-r"><span>Items</span><b>' + (order.items || []).reduce(function (n, i) { return n + (i.qty || 1); }, 0) + '</b></div>';
    s += '<div class="mk-leg-r"><span>Placed</span><b>' + new Date(order.createdAt).toLocaleString() + '</b></div></div>';
    return s;
  }

  function open() {
    var rows = cartItems();
    GM.track("market_checkout_start", { items: rows.length });
    var ov = el("div", "mk-ov");
    // Part 3 3.4: dialog semantics + Escape-to-close (matches the engine's detail sheet)
    ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Your cart");
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    function close() { document.removeEventListener("keydown", onKey); ov.classList.remove("on"); setTimeout(function () { ov.remove(); }, 220); }
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
    var sheet = el("div", "mk-detail mk-cart"); ov.appendChild(sheet);
    document.body.appendChild(ov); requestAnimationFrame(function () { ov.classList.add("on"); });

    // M9 2.2: a paint GENERATION token — every repaint bumps it, and a quote that
    // resolves for an older generation is dropped, so stale resolutions can never pair
    // old legs with new rows or stack handlers on the live Pay button.
    var gen = 0, paying = false;

    function paint() {
      if (paying) return;   // mid-settlement: the receipt owns the sheet
      gen++;
      rows = cartItems();
      if (!rows.length) { sheet.innerHTML = '<div class="mk-detail-body"><div class="mk-detail-title">Your cart</div><p class="mk-detail-desc">Nothing in here yet.</p></div>'; return; }
      sheet.innerHTML = '<div class="mk-detail-body"><div class="mk-detail-title">Your cart</div>' +
        '<div class="mk-crows">' + rows.map(rowHtml).join("") + '</div>' +
        '<div class="mk-quote"><div class="mk-loading" style="padding:14px">Quoting…</div></div>' +
        '<div class="mk-detail-foot"><a class="mk-help" href="/showcase/faq.html">How buying works →</a><button type="button" class="mk-get big mk-pay" disabled>Pay</button></div></div>';
      sheet.querySelectorAll(".mk-crow").forEach(function (rowEl) {
        var id = rowEl.getAttribute("data-id");
        rowEl.querySelectorAll("[data-d]").forEach(function (b) {
          b.addEventListener("click", function () {
            var c = readCart(), r = c.filter(function (x) { return x.id === id; })[0];
            if (r) { r.qty = Math.max(1, (r.qty | 0 || 1) + (+b.getAttribute("data-d"))); writeCart(c); paint(); }
          });
        });
        rowEl.querySelector(".mk-crow-x").addEventListener("click", function () { writeCart(readCart().filter(function (x) { return x.id !== id; })); paint(); });
      });
      var myGen = gen;
      quote(rows).then(function (q) {
        if (myGen !== gen) return;   // M9 2.2: stale quote — a newer paint owns the sheet
        q.expiresAt = Date.now() + (Number(q.ttlSec) || 90) * 1000;   // M9 2.14: client-side TTL
        var qEl = sheet.querySelector(".mk-quote"); if (!qEl) return;
        var sig = GM.sig() || {};
        var plan = GM.railsApi ? GM.railsApi.plan(q, sig.balanceUsd) : null;
        var planHtml = "";
        if (plan && plan.steps.length) {
          // the §7 composite: quote both up front, show ONE number
          planHtml = '<div class="mk-plan"><div class="mk-leg-h">One payment · ' + esc(plan.oneNumber) + '</div>' +
            plan.steps.map(function (s, i) { return '<div class="mk-plan-s"><b>' + (i + 1) + '</b>' + esc(s.label) + '</div>'; }).join("") +
            (plan.composite ? '<div class="mk-demo-note">Balance is ' + money(plan.shortUsd) + ' short — the top-up runs inside this checkout' +
              (plan.provider ? ' via ' + esc(plan.provider) : "") +
              (plan.bankMethods.length ? ' (card or ' + esc(plan.bankMethods.join("/").toUpperCase()) + ')' : "") + '.</div>' : "") +
            '</div>';
        }
        qEl.innerHTML = q.legs.map(legHtml).join("") + planHtml + (q.demo ? '<div class="mk-demo-note">Demo quote (live pricing engages with the server)</div>' : "");
        if (GM.railsApi) {
          GM.railsApi.crossChainNote(rows).then(function (cc) {
            var box = sheet.querySelector(".mk-plan") || sheet.querySelector(".mk-quote");
            if (cc && box) box.insertAdjacentHTML("beforeend", '<div class="mk-demo-note">Settles silently to ' + esc(cc.chain) + ' · ~' + cc.etaSeconds + 's · ' + money(cc.feeUSD) + ' routing (' + esc(cc.provider) + ')</div>');
          });
        }
        var pay = sheet.querySelector(".mk-pay"); pay.disabled = false;
        if (plan && plan.composite) pay.textContent = "Top up & pay";
        // M9 2.2: single-assignment handler (onclick, never addEventListener) + a busy
        // guard — one click is one order, no matter how many paints have run.
        pay.onclick = function () {
          if (paying) return;
          if (q.expiresAt && Date.now() > q.expiresAt) { paint(); return; }   // M9 2.14: stale sheet re-quotes, never pays old numbers
          paying = true;
          pay.disabled = true;
          var order = { id: "mk_" + Math.random().toString(36).slice(2, 10), idempotencyKey: Math.random().toString(36).slice(2) + Date.now(),
            createdAt: Date.now(), state: "created", demo: q.demo, balanceUsd: sig.balanceUsd,
            items: rows.map(function (r) { var it = { id: r.item.id, title: r.item.title, type: r.item.type, qty: r.qty, usd: r.item.price.usd, credit: r.item.price.credit }; if (r.attr) { if (r.attr.shopRef) it.shopRef = r.attr.shopRef; if (r.attr.affiliateCode) it.affiliateCode = r.attr.affiliateCode; } return it; }),
            legs: q.legs, events: [{ state: "created", at: Date.now() }] };
          saveOrder(order); GM.track("market_order_state", { id: order.id, state: "created" });
          function step(o) {
            var qEl2 = sheet.querySelector(".mk-quote");
            if (qEl2) qEl2.innerHTML = receiptHtml(o) + (o.state === "fulfilled" ? '<a class="mk-orders-link" href="/showcase/orders.html">View your orders →</a>'
              : o.state === "failed" ? '<div class="mk-demo-note">' + esc((o.events.slice(-1)[0] || {}).reason || "Something broke") + ' — resume any time from Orders.</div>' : "");
            if (o.state === "fulfilled" || o.state === "failed") { var p = sheet.querySelector(".mk-pay"); if (p) p.remove(); }
          }
          // live first (ships dark: 503/401/absent => the rails demo walk)
          fetch("/api/market/order", { method: "POST", headers: authHeaders(), body: JSON.stringify({ idempotencyKey: order.idempotencyKey, items: order.items }) })
            .then(function (res) { if (!res.ok) throw 0; return res.json(); })
            .then(function (srv) {
              // M9 2.5: the row re-keys to the server id — drop the client-id ghost
              if (srv.id && srv.id !== order.id) { GM.writeJson("giiift-orders", orders().filter(function (x) { return x.id !== order.id; })); order.id = srv.id; }
              order.demo = false; order.live = true; if (srv.legs) order.legs = srv.legs; saveOrder(order);
              executeLive(order, q, rows, step);
            })
            .catch(function () { walk(order, q, rows, step); });
        };
      });
    }
    paint();
  }

  var cartApi = {
    add: function (item, qty) {
      var c = readCart(), r = c.filter(function (x) { return x.id === item.id; })[0];
      var attr = item.attribution || null;   // storefront/affiliate attribution rides the row
      if (r) { r.qty = (r.qty | 0 || 1) + (qty || 1); if (attr && !r.attr) r.attr = attr; }
      else c.push(attr ? { id: item.id, qty: qty || 1, attr: attr } : { id: item.id, qty: qty || 1 });
      writeCart(c); GM.track("market_cart_add", Object.assign({ id: item.id }, attr || {}));
      GM.affinity.bump(item.type, item.brand, 3);
    },
    remove: function (id) { writeCart(readCart().filter(function (x) { return x.id !== id; })); },
    count: function () { return readCart().length; },
    items: cartItems, open: open, button: button,
  };
  GM.cartApi = cartApi;

  global.GIIIFTMarketCheckout = {
    orders: orders, receiptHtml: receiptHtml, quote: quote, saveOrder: saveOrder, setState: setState,
    resume: function (id, onStep) {   // re-quote + re-execute a stalled order (§8 order resume)
      var o = orders().filter(function (x) { return x.id === id; })[0]; if (!o) return;
      var rows = (o.items || []).map(function (i) { var it = resolve(i.id); return it ? { item: it, qty: i.qty || 1 } : null; }).filter(Boolean);
      if (!rows.length) { setState(o, "failed", { reason: "items gone" }); (onStep || function () {})(o); return; }
      o.resumed = true; o.steps = [];   // a fresh walk paints fresh step lines
      quote(rows).then(function (q) {
        o.legs = q.legs;
        if (o.live) executeLive(o, q, rows, onStep || function () {});
        else walk(o, q, rows, onStep || function () {});
      });
    },
    csv: function () {   // §9: client-generated CSV, the user-side backup
      // M9 2.12: money columns are 2dp (no 59.96999…) and every field is CSV-escaped
      // (a comma/quote in a server-issued id or state can no longer shear the row).
      function cell(v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
      function usd2(n) { n = Number(n); return isFinite(n) ? n.toFixed(2) : "0.00"; }
      var head = "id,created_at,state,items,subtotal_usd,fees_usd,total_usd,total_credit\n";
      return head + orders().map(function (o) {
        var bal = (o.legs || []).filter(function (l) { return l.rail === "balance"; })[0] || { subtotal: 0, fees: 0, total: 0 };
        var cr = (o.legs || []).filter(function (l) { return l.rail === "credit"; })[0] || { total: 0 };
        return [cell(o.id), cell(new Date(o.createdAt).toISOString()), cell(o.state), (o.items || []).length,
          usd2(bal.subtotal), usd2(bal.fees), usd2(bal.total), Number(cr.total) || 0].join(",");
      }).join("\n");
    },
  };

  // M9 2.4: the explicit "I've topped up" confirm — one delegated listener
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest(".mk-step-go") : null;
    if (!b) return;
    b.disabled = true; b.textContent = "Checking…";
    try { global.dispatchEvent(new CustomEvent("giiift:topup-confirmed")); } catch (er) {}
  });

  // checkout CSS rides the engine sheet
  if (!document.getElementById("gmk-cart-css")) {
    var s = el("style"); s.id = "gmk-cart-css";
    s.textContent =
      ".mk-cartbtn{position:relative;padding:10px 16px;border:1px solid var(--gmk-border);border-radius:11px;background:rgba(18,20,26,.6);color:var(--gmk-ink);font:600 13px 'Inter';cursor:pointer}.mk-cartbtn:hover{border-color:rgba(255,255,255,.25)}" +
      ".mk-cartn{display:inline-grid;place-items:center;min-width:18px;height:18px;margin-left:6px;padding:0 5px;border-radius:9px;background:var(--gmk-accent,#00FF9D);color:#07120d;font:700 11px/1 'Inter'}" +
      ".mk-crows{margin:10px 0 14px}.mk-crow{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--gmk-border)}.mk-crow-t{flex:1;font:600 13px 'Inter'}.mk-crow-t i{display:block;font:500 11px 'Inter';color:var(--gmk-dim);font-style:normal}" +
      ".mk-crow-q{display:inline-flex;align-items:center;gap:8px}.mk-crow-q button{width:22px;height:22px;border-radius:6px;border:1px solid var(--gmk-border);background:transparent;color:var(--gmk-ink);cursor:pointer}.mk-crow-p{min-width:64px;text-align:right;font:700 13px 'Inter'}" +
      ".mk-crow-x{border:none;background:transparent;color:var(--gmk-dim);cursor:pointer}.mk-crow-x:hover{color:#ff6b6b}" +
      ".mk-leg{margin:10px 0;padding:10px 12px;border:1px solid var(--gmk-border);border-radius:11px}.mk-leg-h{font:600 10px/1 'Space Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--gmk-dim);margin-bottom:8px}.mk-leg-r{display:flex;justify-content:space-between;font:500 12px 'Inter';color:var(--gmk-dim);padding:2px 0}.mk-leg-r b{color:var(--gmk-ink)}.mk-leg-r.tot{border-top:1px solid var(--gmk-border);margin-top:6px;padding-top:7px}.mk-leg-r.tot b{color:var(--gmk-accent)}" +
      ".mk-demo-note{margin-top:8px;font:500 11px 'Inter';color:var(--gmk-dim)}.mk-orders-link{display:inline-block;margin-top:10px;color:var(--gmk-accent);font:600 12px 'Inter';text-decoration:none}" +
      ".mk-plan{margin:10px 0;padding:10px 12px;border:1px solid color-mix(in srgb,var(--gmk-accent) 30%,var(--gmk-border));border-radius:11px;background:color-mix(in srgb,var(--gmk-accent) 5%,transparent)}.mk-plan-s{display:flex;align-items:center;gap:9px;font:500 12px 'Inter';color:var(--gmk-ink);padding:3px 0}.mk-plan-s b{display:inline-grid;place-items:center;width:17px;height:17px;border-radius:50%;background:color-mix(in srgb,var(--gmk-accent) 22%,transparent);color:var(--gmk-accent);font:700 10px 'Space Mono',monospace}" +
      ".mk-step-go{margin-left:8px;padding:4px 9px;border-radius:7px;border:1px solid color-mix(in srgb,#ffd27a 45%,transparent);background:color-mix(in srgb,#ffd27a 12%,transparent);color:#ffd27a;font:600 10.5px 'Inter';cursor:pointer}" +
      ".mk-step-await{color:#ffd27a}.mk-step-await .mk-step-dot{background:#ffd27a;animation:mk-pulse 1.1s infinite ease-in-out}" +
      ".mk-steps{margin:10px 0 2px}.mk-step{display:flex;align-items:center;gap:8px;font:500 12px 'Inter';color:var(--gmk-dim);padding:3px 0}.mk-step-dot{width:7px;height:7px;border-radius:50%;background:var(--gmk-dim);flex:none}.mk-step-doing{color:#7bdfff}.mk-step-doing .mk-step-dot{background:#7bdfff;animation:mk-pulse 1.1s infinite ease-in-out}.mk-step-done{color:var(--gmk-ink)}.mk-step-done .mk-step-dot{background:var(--gmk-accent);box-shadow:0 0 7px color-mix(in srgb,var(--gmk-accent) 60%,transparent)}" +
      ".mk-state{text-transform:uppercase;font:700 10px 'Space Mono',monospace;letter-spacing:.08em}.mk-state-fulfilled{color:var(--gmk-accent)}.mk-state-awaiting-funds{color:#ffd27a}.mk-state-failed{color:#ff6b6b}.mk-state-executing,.mk-state-quoted{color:#7bdfff}" +
      ".mk-help{font:500 11.5px 'Inter';color:var(--gmk-dim);text-decoration:none}.mk-help:hover{color:var(--gmk-accent)}";
    document.head.appendChild(s);
  }
})(typeof window !== "undefined" ? window : this);
