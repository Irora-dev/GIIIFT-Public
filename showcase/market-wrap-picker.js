/* GIIIFT Marketplace — the wrap-flow "add to box" picker step (M6, spec §12 surface 3)
 * + the pick-one gift composer (§6 / §13b "I picked these 3, pick one").
 *
 * A GIIIFTFlow STEP MODULE the 🧵 wrap lane mounts with ONE script tag — wrap.html is
 * not touched from this lane. Loading this file on a page that has GIIIFTFlow registers
 * the step `shop`; the wrap lane then either adds 'shop' to their steps array (on-rail)
 * or wires any button to `GIIIFTFlow.go('shop')` (a DETOUR — the engine anchors it over
 * the step it left, and Close returns there). Pages without GIIIFTFlow get a no-op
 * registration and can still use the standalone API.
 *
 * Two sender modes, one sheet:
 *   ADD TO GIFT      tap an item → it joins the gift contents. Store writes:
 *                    ctx.emit('contents:add', {kind:'market-item', id, title, type,
 *                    usd, credit}) + ctx.set('market.adds', [...]) — the manifest /
 *                    fill step can render or ignore the new contents kind.
 *   LET THEM PICK    sender selects up to 3 items; the RECIPIENT chooses one at the
 *                    reveal. Store: ctx.set('market.pickOne', [ids]). The send builder
 *                    stamps the payload via GIIIFTMarketPicker.payloadFields(ctx) →
 *                    { p1: [ids] } (the g.sr precedent; box.html + the receive shelf
 *                    render the choice — marketplace M6 receive side).
 *
 * Self-sufficient + dark-safe: lazy-loads its own engine deps the first time the step
 * enters (the market-receive-shelf.js pattern); any failure renders a quiet empty state
 * and never blocks the wrap flow (valid() is always true).
 */
(function (global) {
  "use strict";

  var PAYLOAD_KEY = "p1";
  var PICK_MAX = 3;
  var ID_RE = /^[a-z0-9][a-z0-9:_-]{2,47}$/i;   // mirrors the receive-side validation

  var loading = null;
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.async = false;
      s.onload = res; s.onerror = function () { rej(new Error("load " + src)); };
      document.head.appendChild(s);
    });
  }
  function ensureDeps() {
    if (global.GIIIFTMarket) return Promise.resolve();
    if (loading) return loading;
    loading = ["/showcase/market-engine.js", "/showcase/market-cards.js", "/showcase/market-sources.js"]
      .reduce(function (p, src) { return p.then(function () { return loadScript(src); }); }, Promise.resolve());
    return loading;
  }

  // ---- state (one picker per page: sheet and/or one W5 embed share it) ----
  var ov = null, emb = null, mounted = false, mode = "add", picks = [], returnTo = null, cbs = {};
  var LOCAL_ADDS = [];     // ctx-less pages (no GIIIFTFlow): adds tracked here so totals() still works
  var lastMount = null;    // the latest engine mount handle; prices pick-one ids in totals()
  function roots() { var r = []; if (ov) r.push(ov); if (emb) r.push(emb); return r; }

  function flowCtx() {
    try { return global.GIIIFTFlow && global.GIIIFTFlow.ctx && global.GIIIFTFlow.ctx(); } catch (e) { return null; }
  }
  function track(name, data) {
    try { global.dispatchEvent(new CustomEvent("giiift:track", { detail: { name: name, data: data || {} } })); } catch (e) {}
  }

  function css() {
    if (document.getElementById("gmk-picker-css")) return;
    var s = document.createElement("style"); s.id = "gmk-picker-css";
    s.textContent =
      ".mkp-ov{position:fixed;inset:0;z-index:70;display:none;background:rgba(5,6,8,.66);-webkit-backdrop-filter:blur(9px);backdrop-filter:blur(9px);opacity:0;transition:opacity .22s}" +
      ".mkp-ov.on{opacity:1}.mkp-ov.show{display:block}" +
      ".mkp-sheet{position:absolute;inset:4vh 0 0 0;margin:0 auto;max-width:1080px;width:calc(100% - 28px);border:1px solid rgba(255,255,255,.13);border-radius:22px 22px 0 0;background:linear-gradient(165deg,rgba(17,20,25,.98),rgba(10,12,14,.99));box-shadow:0 -20px 80px -20px rgba(0,0,0,.9);display:flex;flex-direction:column;overflow:hidden}" +
      ".mkp-head{display:flex;align-items:center;gap:12px;padding:16px 18px 12px;border-bottom:1px solid rgba(255,255,255,.07)}" +
      ".mkp-title{font:700 17px 'Space Grotesk','Inter',sans-serif;color:#eef0f4;margin-right:4px}" +
      ".mkp-modes{display:flex;gap:6px}" +
      ".mkp-mode{padding:7px 13px;border:1px solid rgba(255,255,255,.13);border-radius:999px;background:transparent;color:rgba(238,240,244,.6);font:600 12px 'Inter';cursor:pointer;transition:.18s}" +
      ".mkp-mode.on{color:#07120d;background:#00FF9D;border-color:#00FF9D}" +
      ".mkp-x{margin-left:auto;width:32px;height:32px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:transparent;color:rgba(238,240,244,.65);font-size:15px;cursor:pointer}.mkp-x:hover{color:#fff;border-color:rgba(255,255,255,.3)}" +
      ".mkp-body{flex:1;overflow-y:auto;padding:4px 18px 18px}" +
      ".mkp-foot{display:flex;align-items:center;gap:12px;padding:12px 18px;border-top:1px solid rgba(255,255,255,.07);background:rgba(10,12,14,.92)}" +
      ".mkp-note{font:500 12px 'Inter';color:rgba(238,240,244,.55)}" +
      ".mkp-cta{margin-left:auto;padding:11px 17px;border-radius:11px;border:none;background:#fff;color:#07120d;font:700 13px 'Inter';cursor:pointer}.mkp-cta:disabled{opacity:.45;cursor:default}" +
      ".mkp-badge{display:inline-grid;place-items:center;min-width:19px;height:19px;padding:0 5px;border-radius:10px;background:#00FF9D;color:#07120d;font:700 11px 'Inter'}" +
      "@media(max-width:640px){.mkp-sheet{inset:3vh 0 0 0;width:100%;border-radius:18px 18px 0 0}}" +
      // W5 embed: the same panel living INSIDE a host element (the wrap lane's two-panel
      // Gift step). No overlay, no backdrop, fills the host, never closes; the host owns
      // the outer chrome + the running-total bar (fed by GIIIFTMarketPicker.totals()).
      ".mkp-embed{position:relative;display:flex;flex-direction:column;height:100%;min-height:320px;overflow:hidden}" +
      ".mkp-embed .mkp-head{padding:10px 4px 10px}" +
      ".mkp-embed .mkp-body{padding:4px 4px 10px}" +
      ".mkp-embed .mkp-foot{padding:10px 4px;background:transparent}" +
      ".mkp-embed .mkp-cta{display:none}";   // embedded: ctx updates on every tap; the host's own continue applies
    document.head.appendChild(s);
  }

  function picked(id) { return picks.indexOf(id) >= 0; }

  // the sheet's engine mount: compact strips, search on, cart off — the §12.3 config
  function mountEngine(body) {
    var GM = global.GIIIFTMarket;
    var host = document.createElement("div");
    body.appendChild(host);
    lastMount = GM.mount(host, {
      key: "wrap-picker",
      bare: true, hero: false, sort: false, cart: false, credit: false,
      searchPlaceholder: "Search cards, art, real things…",
      onPickLabel: mode === "pick" ? "Pick this for them" : "Add to gift",
      onPick: function (item, ui) { return onPick(item, ui); },
      shelves: [
        { kind: "row", title: "Worth gifting", note: "hand-picked", query: { sort: "editorial", limit: 8 } },
        { kind: "row", title: "Trading cards", query: { types: ["tcg-card", "pack"], limit: 8 } },
        { kind: "row", title: "Real things", note: "shipped to them", query: { types: ["product"], limit: 8 } },
        { kind: "row", title: "Digital art", query: { types: ["art"], limit: 8 } },
      ],
    });
  }

  function onPick(item, ui) {
    var ctx = flowCtx();
    if (mode === "pick") {
      // pick-one composer: toggle selection up to PICK_MAX
      var i = picks.indexOf(item.id);
      if (i >= 0) picks.splice(i, 1);
      else if (picks.length < PICK_MAX) picks.push(item.id);
      else { if (ui && ui.button) { ui.button.textContent = PICK_MAX + " max — remove one first"; } return false; }
      if (ctx) { ctx.set("market.pickOne", picks.slice()); ctx.emit("market:pickone", picks.slice()); }
      if (cbs.onPickOne) try { cbs.onPickOne(picks.slice()); } catch (e) {}
      track("pickone_select", { n: picks.length });
      paintFoot();
      fireChange();
      if (ui && ui.button) ui.button.textContent = picked(item.id) ? "Picked ✓ (tap to remove)" : "Pick this for them";
      return false;   // keep the sheet open; selection is multi-tap
    }
    // add-to-gift: one tap, one contents entry
    var entry = { kind: "market-item", id: item.id, title: item.title, type: item.type, usd: item.price.usd || 0, credit: item.price.credit || null };
    if (ctx) {
      var adds = (ctx.get("market.adds") || []).slice(); adds.push(entry);
      ctx.set("market.adds", adds);
      ctx.emit("contents:add", entry);
    } else LOCAL_ADDS.push(entry);
    if (cbs.onAdd) try { cbs.onAdd(entry); } catch (e) {}
    track("picker_add", { id: item.id, type: item.type });
    paintFoot();
    fireChange();
    return true;   // engine shows "Done ✓" + closes the detail sheet
  }

  function fireChange() { if (cbs.onChange) try { cbs.onChange(totals()); } catch (e) {} }

  function paintFoot() {
    var ctx = flowCtx();
    roots().forEach(function (root) {
      var note = root.querySelector(".mkp-note"), cta = root.querySelector(".mkp-cta");
      if (!note || !cta) return;
      if (mode === "pick") {
        note.innerHTML = "They open the gift and choose <b>one</b> · <span class='mkp-badge'>" + picks.length + "</span>/" + PICK_MAX + " picked";
        cta.textContent = picks.length ? "Attach pick-one (" + picks.length + ")" : "Pick up to " + PICK_MAX;
        cta.disabled = !picks.length;
      } else {
        var n = ctx ? (ctx.get("market.adds") || []).length : LOCAL_ADDS.length;
        note.innerHTML = n ? "<span class='mkp-badge'>" + n + "</span> item" + (n > 1 ? "s" : "") + " added to the gift" : "Tap anything to add it to the gift";
        cta.textContent = "Done";
        cta.disabled = false;
      }
    });
  }

  function setMode(m) {
    mode = m;
    roots().forEach(function (root) {
      var btns = root.querySelectorAll(".mkp-mode");
      for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("on", btns[i].getAttribute("data-m") === m);
      var body = root.querySelector(".mkp-body");
      if (body && global.GIIIFTMarket) { body.innerHTML = ""; mountEngine(body); }   // re-mount: onPick label/behavior follows the mode
    });
    paintFoot();
    track("picker_mode", { mode: m });
  }

  function build() {
    if (ov) return;
    css();
    ov = document.createElement("div"); ov.className = "mkp-ov";
    // Part 3 3.4: dialog semantics; Escape closes while the sheet is shown
    ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Add from the shop");
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && ov && ov.classList.contains("show")) close(); });
    ov.innerHTML =
      '<div class="mkp-sheet">' +
      '<div class="mkp-head"><span class="mkp-title">Add from the shop</span>' +
      '<div class="mkp-modes">' +
      '<button type="button" class="mkp-mode on" data-m="add">Add to gift</button>' +
      '<button type="button" class="mkp-mode" data-m="pick">Let them pick one</button>' +
      "</div>" +
      '<button type="button" class="mkp-x" aria-label="Close">✕</button></div>' +
      '<div class="mkp-body"></div>' +
      '<div class="mkp-foot"><span class="mkp-note"></span><button type="button" class="mkp-cta">Done</button></div>' +
      "</div>";
    document.body.appendChild(ov);
    ov.querySelector(".mkp-x").addEventListener("click", close);
    ov.querySelector(".mkp-cta").addEventListener("click", function () {
      if (mode === "pick" && picks.length) {
        var ctx = flowCtx();
        if (ctx) ctx.set("market.pickOne", picks.slice());
        track("pickone_attach", { n: picks.length });
      }
      close();
    });
    var modes = ov.querySelectorAll(".mkp-mode");
    for (var i = 0; i < modes.length; i++) (function (b) { b.addEventListener("click", function () { setMode(b.getAttribute("data-m")); }); })(modes[i]);
  }

  function open(opts) {
    opts = opts || {};
    // merge, don't replace: a live W5 embed keeps its onChange when the sheet detours open
    cbs = { onAdd: opts.onAdd || cbs.onAdd, onPickOne: opts.onPickOne || cbs.onPickOne, onChange: opts.onChange || cbs.onChange };
    build();
    var ctx = flowCtx();
    if (ctx) picks = (ctx.get("market.pickOne") || []).slice();   // resume a started pick-list
    ov.classList.add("show");
    requestAnimationFrame(function () { ov.classList.add("on"); });
    track("market_view", { surface: "wrap-picker" });
    ensureDeps().then(function () { setMode(mode); mounted = true; })
      .catch(function () { var b = ov.querySelector(".mkp-body"); b.innerHTML = '<div style="padding:48px 16px;text-align:center;color:rgba(238,240,244,.5);font:500 13px Inter">The shop is unavailable right now — the gift works without it.</div>'; paintFoot(); });
  }
  function close() {
    if (!ov) return;
    ov.classList.remove("on");
    setTimeout(function () { ov.classList.remove("show"); }, 220);
    // a DETOUR returns to the step it came from; on-rail mounts just hide the sheet
    var F = global.GIIIFTFlow;
    if (F && returnTo && F.current() === "shop" && F.order().indexOf("shop") < 0 && F.order().indexOf(returnTo) > -1) {
      F.go(returnTo, { runEnter: false });
    }
  }

  // ---- the GIIIFTFlow step module ----
  function registerStep() {
    var F = global.GIIIFTFlow;
    if (!F || !F.register) return false;
    F.register({
      key: "shop",
      rail: { label: "Shop" },
      enter: function (_api, info) { returnTo = info && info.from || returnTo; open(); },
      exit: function () { if (ov) { ov.classList.remove("on"); setTimeout(function () { ov && ov.classList.remove("show"); }, 220); } },
      valid: function () { return true; },   // the picker never blocks the flow
    });
    return true;
  }

  // payload stamping for the wrap lane's send builder (the GIIIFTStorefront.sendPayloadField precedent)
  function payloadFields(ctx) {
    ctx = ctx || flowCtx();
    var ids = (ctx && ctx.get("market.pickOne")) || picks || [];
    ids = ids.filter(function (id) { return ID_RE.test(String(id)); }).slice(0, PICK_MAX);
    var out = {};
    if (ids.length) out[PAYLOAD_KEY] = ids;
    return out;
  }

  // ---- W5 seams: the two-panel Gift step (wrap lane) hosts the picker INSIDE its own
  // panel and renders its running-total bar off totals(). wrap.html stays untouched
  // from this lane; the wrap side calls embed() + totals()/onChange and owns all chrome.

  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  /** Running-total math for the host's bar. Adds + the pick-one funding (max picked
   * price, so any choice is covered — the wishlist fund-a-pick-one precedent) + the
   * marketplace fee per item type off the ONE pricing config. Goods only: transfers
   * and the wrap itself are the wrap lane's rows. `priced:false` = pick-one ids exist
   * but the engine's items aren't loaded yet (render "—", call again on onChange). */
  function totals(ctx) {
    ctx = ctx || flowCtx();
    var GM = global.GIIIFTMarket;
    var adds = (ctx ? ctx.get("market.adds") : null) || (ctx ? [] : LOCAL_ADDS.slice());
    var addsUsd = 0, addsCredit = 0, feeUsd = 0;
    adds.forEach(function (a) {
      var usd = Number(a.usd) || 0;
      addsUsd += usd;
      if (a.credit != null) addsCredit += Number(a.credit) || 0;
      if (GM && usd) feeUsd += usd * ((Number(GM.feePctFor(a.type)) || 0) / 100);
    });
    var ids = ((ctx && ctx.get("market.pickOne")) || picks || []).slice(0, PICK_MAX);
    var pickFund = 0, priced = true;
    if (ids.length) {
      var pool = lastMount ? lastMount.items() : [];
      var best = null;
      ids.forEach(function (id) {
        var it = pool.filter(function (p) { return p.id === id; })[0];
        if (!it) { priced = false; return; }
        if (!best || (it.price.usd || 0) > (best.price.usd || 0)) best = it;
      });
      if (best) {
        pickFund = best.price.usd || 0;
        if (GM && pickFund) feeUsd += pickFund * ((Number(GM.feePctFor(best.type)) || 0) / 100);
      } else priced = false;
    }
    var goods = round2(addsUsd + pickFund);
    return {
      adds: adds, addsUsd: round2(addsUsd), addsCredit: addsCredit,
      pickOneIds: ids, pickOneFundUsd: round2(pickFund),
      goodsUsd: goods, feeUsd: round2(feeUsd), totalUsd: round2(goods + feeUsd),
      priced: priced,
    };
  }

  /** Remove an add by index or id (first match). The host's manifest panel calls this
   * for its ✕ rows; emits contents:remove (additive — hosts may ignore it) and keeps
   * ctx/local state + the foot + onChange in sync. Returns the removed entry or null. */
  function removeAdd(ref, ctx) {
    ctx = ctx || flowCtx();
    var adds = ctx ? ((ctx.get("market.adds") || []).slice()) : LOCAL_ADDS;
    var i = typeof ref === "number" ? ref : (function () {
      for (var j = 0; j < adds.length; j++) if (adds[j] && adds[j].id === ref) return j;
      return -1;
    })();
    if (i < 0 || i >= adds.length) return null;
    var gone = adds.splice(i, 1)[0];
    if (ctx) { ctx.set("market.adds", adds); ctx.emit("contents:remove", gone); }
    track("picker_remove", { id: gone && gone.id });
    paintFoot();
    fireChange();
    return gone || null;
  }

  /** Mount the picker INSIDE a host element (the W5 two-panel Gift step). Same state,
   * modes and store writes as the sheet; no overlay, no backdrop, never closes — the
   * host owns layout, chrome and continue. opts: { mode?: 'add'|'pick', onAdd?,
   * onPickOne?, onChange? (fires with totals() after every add/pick/remove) }.
   * One embed per page (a re-call replaces it). Returns a handle or null. */
  function embed(host, opts) {
    opts = opts || {};
    if (typeof host === "string") host = document.querySelector(host);
    if (!host) return null;
    css();
    if (emb && emb.parentNode) emb.parentNode.removeChild(emb);
    cbs = { onAdd: opts.onAdd, onPickOne: opts.onPickOne, onChange: opts.onChange };
    if (opts.mode === "pick" || opts.mode === "add") mode = opts.mode;
    emb = document.createElement("div"); emb.className = "mkp-embed";
    emb.innerHTML =
      '<div class="mkp-head"><span class="mkp-title"></span>' +
      '<div class="mkp-modes">' +
      '<button type="button" class="mkp-mode" data-m="add">Add to gift</button>' +
      '<button type="button" class="mkp-mode" data-m="pick">Let them pick one</button>' +
      "</div></div>" +
      '<div class="mkp-body"></div>' +
      '<div class="mkp-foot"><span class="mkp-note"></span><button type="button" class="mkp-cta">Done</button></div>';
    emb.querySelector(".mkp-title").textContent = "Add from the shop";
    host.appendChild(emb);
    var modes = emb.querySelectorAll(".mkp-mode");
    for (var i = 0; i < modes.length; i++) (function (b) { b.addEventListener("click", function () { setMode(b.getAttribute("data-m")); }); })(modes[i]);
    var ctx = flowCtx();
    if (ctx) picks = (ctx.get("market.pickOne") || []).slice();   // resume a started pick-list
    track("market_view", { surface: "wrap-picker-embed" });
    ensureDeps().then(function () { setMode(mode); mounted = true; fireChange(); })
      .catch(function () {
        var b = emb && emb.querySelector(".mkp-body");
        if (b) b.innerHTML = '<div style="padding:48px 16px;text-align:center;color:rgba(238,240,244,.5);font:500 13px Inter">The shop is unavailable right now — the gift works without it.</div>';
        paintFoot();
      });
    return {
      el: emb,
      setMode: setMode,
      mode: function () { return mode; },
      totals: totals,
      refresh: function () { setMode(mode); },
      destroy: function () { if (emb && emb.parentNode) emb.parentNode.removeChild(emb); emb = null; },
    };
  }

  global.GIIIFTMarketPicker = {
    PAYLOAD_KEY: PAYLOAD_KEY, PICK_MAX: PICK_MAX,
    registerStep: registerStep, open: open, close: close,
    embed: embed, totals: totals, removeAdd: removeAdd,   // the W5 two-panel seams
    payloadFields: payloadFields,
    adds: function (ctx) { ctx = ctx || flowCtx(); return (ctx && ctx.get("market.adds")) || (ctx ? [] : LOCAL_ADDS.slice()); },
    picks: function () { return picks.slice(); },
  };
  registerStep();   // auto-register when the flow engine is already on the page
})(typeof window !== "undefined" ? window : this);
