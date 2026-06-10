/* GIIIFT — finalize transition engine
 * ===========================================================================
 * On "Send", goSend() (wrap.html) builds a `ctx` stage kit and calls
 * GIIIFTFinalize.run(ctx). The engine random-picks ONE registered transition
 * whose canRun(ctx) passes (weighted), and plays it. The `iris` transition is
 * the guaranteed no-WebGL fallback, so something always plays.
 *
 * A transition only ever talks to `ctx` (+ window.GIIIFTWormhole). It never
 * reaches into wrap.html internals — so adding a variant is a pure addition to
 * THIS file. Bring your own visual (create elements + inject a <style>, exactly
 * like the wormhole module does) and drive the destination scene with the kit.
 *
 * ── the ctx stage kit (provided by wrap.html) ──────────────────────────────
 *   ctx.box                      live designed box element (clone it for your animation)
 *   ctx.palette                  { c1, c2, accent } from the gift design
 *   ctx.caps                     { webgl, reduceMotion }
 *   ctx.els                      { panel, iris, status, card, roadPkg, delivery }
 *   ctx.revealScene({ van })     drop the studio → show panel + town + aurora.
 *                                  van:true  also places the gift on the road + freezes the van
 *                                  van:false hides the road/van scene entirely
 *   ctx.releaseVan()             let the van drive in + pick up the road gift (van scenes only)
 *   ctx.playStatus(seq, { over }) dreamy char-by-char status. over:'panel'(default)|'wormhole'.
 *                                  -> Promise that resolves after the last line fades out
 *   ctx.revealCard()             reveal the "Your gift is ready" card
 *   ctx.getLanding()             { x, y, size } of the road gift, or null (for "land it" effects)
 *   ctx.mountRoadBox()           clone the designed box onto the road package (revealScene does this for van:true)
 *   ctx.STATUS                   the default three-beat status copy [ [ms, text, accentPhrase], … ]
 *
 * ── the transition contract ────────────────────────────────────────────────
 *   { id, label, weight = 1, canRun(ctx) => bool, play(ctx) => Promise|void }
 *   - weight: relative pick odds among eligible transitions (default 1)
 *   - canRun: return false to exclude on this device (e.g. no WebGL); omit = always eligible
 *   - play:   run the visual; resolve/return when ctx.revealCard() has been called
 *
 * ── add your own (template) ────────────────────────────────────────────────
 *   GIIIFTFinalize.register({
 *     id: 'my-thing', label: 'My thing', weight: 1,
 *     canRun: (ctx) => true,
 *     play: async (ctx) => {
 *       // …your bespoke visual here (own elements + injected <style>)…
 *       ctx.revealScene({ van: false });
 *       await ctx.playStatus(ctx.STATUS, { over: 'panel' });
 *       ctx.revealCard();
 *     }
 *   });
 *
 * QA: append ?fx=<id> to the URL (or set window.__forceFx) to force a specific
 *     transition instead of random — handy while building new ones.
 * =========================================================================== */
(function () {
  'use strict';

  var list = [];

  function eligibleFor(ctx) {
    var out = list.filter(function (t) {
      try { return t.canRun ? !!t.canRun(ctx) : true; } catch (e) { return false; }
    });
    // never leave the user stranded — the iris transition runs everywhere
    if (!out.length) out = list.filter(function (t) { return t.id === 'iris'; });
    return out;
  }

  function weightedPick(pool) {
    if (!pool.length) return null;
    var total = pool.reduce(function (s, t) { return s + (t.weight || 1); }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < pool.length; i++) { r -= (pool[i].weight || 1); if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }

  var GIIIFTFinalize = {
    transitions: list,

    register: function (t) {
      if (!t || !t.id || typeof t.play !== 'function') {
        console.warn('[GIIIFT] ignoring invalid transition', t);
        return GIIIFTFinalize;
      }
      list.push(t);
      return GIIIFTFinalize;
    },

    // pick one eligible transition (weighted random, or forced via ?fx=/__forceFx) and play it
    run: function (ctx) {
      var forced = null;
      try { forced = new URLSearchParams(location.search).get('fx') || window.__forceFx || null; } catch (e) {}

      var pick = null;
      if (forced) pick = list.find(function (t) { return t.id === forced; }) || null;
      if (!pick) pick = weightedPick(eligibleFor(ctx));

      console.info('[GIIIFT] finalize transition →', pick && pick.id, forced ? '(forced)' : '');
      if (!pick) return Promise.resolve();
      try { return Promise.resolve(pick.play(ctx)); }
      catch (e) { console.error('[GIIIFT] transition "' + pick.id + '" threw', e); return Promise.reject(e); }
    },

    // testing helper: which id would be picked (no playback). Used by QA to check the distribution.
    _pick: function (ctx) { var p = weightedPick(eligibleFor(ctx)); return p && p.id; }
  };

  window.GIIIFTFinalize = GIIIFTFinalize;

  /* ─────────────────────────── built-in transitions ─────────────────────── */

  // 1) IRIS → VAN
  //    Animal-Crossing black fade closes over the studio, the road scene is revealed
  //    behind it, the iris opens, the van drives in and picks up your gift while the
  //    dreamy status plays in the panel, then the "gift is ready" card appears.
  GIIIFTFinalize.register({
    id: 'iris',
    label: 'Iris → van pickup',
    weight: 1,
    canRun: function () { return true; },          // the always-safe path (no WebGL)
    play: function (ctx) {
      return new Promise(function (resolve) {
        var iris = ctx.els.iris;
        var ms = ctx.caps.reduceMotion ? 200 : 1200;
        // close to black
        iris.hidden = false;
        iris.classList.remove('iris-opening');
        void iris.offsetWidth;
        iris.classList.add('iris-closing');
        setTimeout(function () {
          ctx.revealScene({ van: true });            // swap the studio for the road scene (covered by black)
          // open the iris on the scene
          iris.classList.remove('iris-closing');
          void iris.offsetWidth;
          iris.classList.add('iris-opening');
          setTimeout(function () {
            iris.hidden = true;
            iris.classList.remove('iris-opening');
            ctx.releaseVan();                        // van drives in + picks up the gift
            ctx.playStatus(ctx.STATUS, { over: 'panel' }).then(function () {
              ctx.revealCard();
              resolve();
            });
          }, ms);
        }, ms);
      });
    }
  });

  // 2) WORMHOLE → VANISH
  //    The present is sucked into the aurora wormhole; the status text plays AROUND
  //    the tunnel; then the present dissolves into the wormhole (getLanding → null)
  //    and the "gift is ready" card appears on the aurora. No van.
  // a longer read so you ride the tunnel a while before the card pops (the tunnel never "ends" —
  // the camera holds and the shader keeps flowing — so extend/trim this freely to taste).
  var WORMHOLE_STATUS = [
    [0,    'Finalizing your GIIIFT',      'Finalizing'],
    [3600, 'Folding space around it',     'Folding space'],
    [7400, 'Your GIIIFT is on its way',   'on its way']
  ];
  // an active vertical can re-voice the tunnel ride (copy.status.wormhole)
  function wormholeStatus() {
    var v = window.GIIIFTVertical && window.GIIIFTVertical.get('copy.status.wormhole');
    return (Array.isArray(v) && v.length) ? v : WORMHOLE_STATUS;
  }
  GIIIFTFinalize.register({
    id: 'wormhole',
    label: 'Sucked into the wormhole',
    weight: 1,
    canRun: function (ctx) { return !!(ctx.caps.webgl && window.GIIIFTWormhole && !ctx.caps.reduceMotion); },
    play: function (ctx) {
      return new Promise(function (resolve) {
        var statusResolve;
        var statusDone = new Promise(function (r) { statusResolve = r; });
        var wh = window.GIIIFTWormhole.play({
          box: ctx.box,
          palette: ctx.palette,
          persist: true,                             // endless cruise; the tunnel stays (blurred) behind the card afterwards
          onPortalFull: function () {                // tunnel fills the screen → reveal the (van-less) scene + text
            ctx.revealScene({ van: false, backdrop: 'wormhole' });
            ctx.playStatus(wormholeStatus(), { over: 'wormhole' }).then(statusResolve);
          },
          getLanding: function () { return null; },  // no landing — the present just rides the endless tunnel
          onArrive: function () {                    // settle() finished the present's fade → pop the card
            ctx.revealCard();
            resolve();
          }
        });
        // ride through the whole status read, THEN end it: the present fades and the card pops up
        // over the blurred tunnel (the camera never reaches an end, so the wormhole feels endless).
        statusDone.then(function () { if (wh && wh.settle) wh.settle(); });
      });
    }
  });
})();
