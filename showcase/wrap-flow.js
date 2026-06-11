/* GIIIFT — wrap-flow engine (GIIIFTFlow).
 *
 * The sender wizard as data: pages register themselves as STEP MODULES and the
 * flow order is one array, so reordering pages is editing that array and
 * plugging a new page in is one register() call. Spec: docs/WRAP_FLOW_ENGINE.md.
 * Same house pattern as vertical-engine / box-templates / GIIIFTFinalize:
 * plain script, no build, window global.
 *
 *   GIIIFTFlow.register({
 *     key:   'fill',
 *     rail:  { label: 'Fill' },     // false → off-rail interstitial (e.g. 'seal')
 *     enter: function (flow) {},    // the step's side-effects (M1: moved goX() body)
 *     exit:  function (flow) {},    // optional
 *     valid: function () {},        // true (or undefined) = may advance past this
 *   })                              //   step; a string = hint shown, advance blocked
 *
 *   GIIIFTFlow.start({
 *     steps: ['name','design','fill','seal','text','send'],   // THE order
 *     rail: '#steps',               // host; engine renders + paints the rail rows
 *     initial: 'name',
 *     runEnter: false,              // boot with markup-initial state (no enter())
 *   })
 *
 *   GIIIFTFlow.next() / .back() / .go(key) — next/back honour valid(); go() is
 *   direct (back-links, interstitial timeouts). current()/order()/index() inspect.
 *
 * Also ships the shared store (spec §2.3) for M2+ subscribers; steps may ignore it:
 *   GIIIFTFlow.ctx().get('cfg') / .set('cfg.brand', v) / .on('change:cfg', fn) / .emit(ev, d)
 */
(function (global) {
  "use strict";

  // ------------------------------------------------------------------ store
  function makeCtx(seed) {
    var data = seed || {};
    var subs = {};   // event -> [fn]
    function fire(ev, detail) {
      var list = subs[ev];
      if (!list) return;
      for (var i = 0; i < list.length; i++) {
        try { list[i](detail); } catch (e) { console.warn("[GIIIFTFlow] subscriber failed for", ev, e); }
      }
    }
    return {
      get: function (path) {
        var node = data, parts = String(path).split(".");
        for (var i = 0; i < parts.length; i++) { if (node == null) return undefined; node = node[parts[i]]; }
        return node;
      },
      set: function (path, value) {
        var parts = String(path).split("."), node = data;
        for (var i = 0; i < parts.length - 1; i++) {
          if (node[parts[i]] == null) node[parts[i]] = {};
          node = node[parts[i]];
        }
        node[parts[parts.length - 1]] = value;
        fire("change:" + path, value);
        if (parts.length > 1) fire("change:" + parts[0], data[parts[0]]);
        return value;
      },
      on: function (ev, fn) { (subs[ev] = subs[ev] || []).push(fn); return fn; },
      off: function (ev, fn) { var l = subs[ev]; if (l) { var i = l.indexOf(fn); if (i > -1) l.splice(i, 1); } },
      emit: fire,
    };
  }

  // ------------------------------------------------------------------ flow
  var steps = {};          // key -> def
  var order = [];          // active flow config (includes off-rail keys)
  var current = null;
  var railHost = null;
  var ctx = null;

  function def(key) {
    var d = steps[key];
    if (!d) throw new Error("[GIIIFTFlow] unknown step '" + key + "'");
    return d;
  }
  function railSteps() {
    return order.filter(function (k) { return steps[k] && steps[k].rail !== false; });
  }

  function renderRail() {
    if (!railHost) return;
    var rows = railSteps();
    var html = [];
    for (var i = 0; i < rows.length; i++) {
      if (i) html.push('<span class="bar"></span>');
      var d = steps[rows[i]];
      var label = (d.rail && d.rail.label) || d.key;
      html.push('<div class="step" data-step="' + d.key + '"><span class="num">' + (i + 1) +
                '</span><span class="lbl">' + label + "</span></div>");
    }
    railHost.innerHTML = html.join("");
  }

  function paintRail() {
    if (!railHost) return;
    var ci = order.indexOf(current);
    var nodes = railHost.querySelectorAll(".step");
    for (var i = 0; i < nodes.length; i++) {
      var k = nodes[i].getAttribute("data-step");
      var oi = order.indexOf(k);
      nodes[i].classList.toggle("active", k === current);
      nodes[i].classList.toggle("done", k !== current && oi > -1 && oi < ci);
    }
  }

  function go(key, opts) {
    var d = def(key);                       // throws on unknown — config typos fail loudly
    var from = current;
    if (from && steps[from] && steps[from].exit) {
      try { steps[from].exit(api, { to: key }); } catch (e) { console.warn("[GIIIFTFlow] exit failed for", from, e); }
    }
    current = key;
    paintRail();
    if (!(opts && opts.runEnter === false) && d.enter) d.enter(api, { from: from });
    if (ctx) ctx.emit("flow:step", { key: key, from: from, index: order.indexOf(key) });
    return api;
  }

  var api = {
    register: function (d) {
      if (!d || !d.key) throw new Error("[GIIIFTFlow] register() needs a key");
      steps[d.key] = d;
      return api;
    },
    start: function (o) {
      order = (o.steps || []).slice();
      order.forEach(def);                   // validate the whole config up front
      railHost = typeof o.rail === "string" ? document.querySelector(o.rail) : o.rail || null;
      ctx = makeCtx(o.ctx);
      renderRail();
      go(o.initial || order[0], { runEnter: o.runEnter !== false ? undefined : false });
      return api;
    },
    go: go,
    next: function () {
      var d = def(current);
      if (d.valid) {
        var v = d.valid();
        if (v !== true && v !== undefined) return api;   // blocked; v may be a hint string
      }
      var i = order.indexOf(current);
      if (i > -1 && i < order.length - 1) go(order[i + 1]);
      return api;
    },
    back: function () {
      var rows = railSteps();
      var i = rows.indexOf(current);
      if (i > 0) go(rows[i - 1]);
      return api;
    },
    current: function () { return current; },
    order: function () { return order.slice(); },
    index: function (k) { return order.indexOf(k || current); },
    ctx: function () { return ctx; },
  };

  global.GIIIFTFlow = api;
})(window);
