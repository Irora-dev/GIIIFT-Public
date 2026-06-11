/* GIIIFT — the wrap studio's stage box as a component (GIIIFTStageBox).
 *
 * Spec §2.4 (docs/WRAP_FLOW_ENGINE.md): the 3D preview owns its pose, drag-to-
 * orbit, face painting, template skinning, deposit drop animation and the seal
 * choreography — and reacts to the flow store instead of being poked from step
 * bodies. Steps stop knowing the box exists.
 *
 *   GIIIFTStageBox.mount({
 *     box: '#box', stage: '.box-stage',
 *     ctx: GIIIFTFlow.ctx(),                  // the §2.3 store
 *     deps: { faceBg, logoUrl },              // page-owned pure helpers
 *   })
 *
 * Subscriptions (the whole contract — nothing for steps to call):
 *   change:cfg    → repaint (face backgrounds, typed text, template skins, aurora retint)
 *   contents:add  → the deposit falls into the open box (drop-coin / drop-thing)
 *   flow:seal     → lid closes, pose settles top-down, tape wipes on
 *   flow:step     → 'text' re-ensures drag-to-orbit (parity with the old goText)
 *
 * The finalize scene plumbing (road-box clone, wormhole present) reaches the
 * element through el() / hide() — scene swaps, not step logic.
 * M1 moved the goX() bodies; M2 moves the box. Bodies below are MOVED from
 * wrap.html verbatim apart from the el/cfg/dep indirections.
 */
(function (global) {
  "use strict";

  var els = null;    // { box, stage }
  var ctx = null;    // GIIIFTFlow store
  var deps = null;   // { faceBg(cfg), logoUrl(ticker) }

  // box orientation (drag to rotate) — markup-era default pose
  var rot = { y: -16, x: -20 };
  function applyRot() { els.box.style.transform = "rotateY(" + rot.y + "deg) rotateX(" + rot.x + "deg)"; }

  function cfg() { return ctx.get("cfg") || {}; }

  // ---------- face text writers ----------
  function setRole(role, val) { var el = els.box.querySelector('[data-role="' + role + '"]'); if (el) el.textContent = val; }

  // typewriter renderer - only the characters added since last render animate in,
  // so live typing reads as ink being written onto the box (spaces stay inline so
  // word-wrapping is preserved).
  var typed = {};
  function renderTyped(role, val) {
    var el = els.box.querySelector('[data-role="' + role + '"]');
    if (!el) return;
    val = val == null ? "" : String(val);
    if (typed[role] === val) return;
    var prev = Array.from(typed[role] != null ? typed[role] : "");
    var arr = Array.from(val);
    var common = 0;
    while (common < prev.length && common < arr.length && prev[common] === arr[common]) common++;
    el.textContent = "";
    arr.forEach(function (ch, i) {
      var s = document.createElement("span");
      s.className = "tch";
      s.textContent = ch;
      if (i >= common) { s.classList.add("ink"); s.style.animationDelay = ((i - common) * 0.035) + "s"; }
      el.appendChild(s);
    });
    typed[role] = val;
  }

  // ---------- template face skinning ----------
  function tplName(c) { return (c.labelTo || "").replace(/^to:\s*/i, "").replace(/^someone$/i, "").trim(); }
  function tplFrom(c) { return (c.from || "").replace(/^from:\s*/i, "").replace(/^you$/i, "").trim(); }

  function skinFaces() {
    var c = cfg();
    var TPLS = global.GIIIFTBoxTemplates || null;
    var liveDoc = (c.template && TPLS && global.GIIIFTBox)
      ? TPLS.doc(c.template, { to: tplName(c), from: tplFrom(c), note: c.note,
          // the sender's own Front text must survive a template (it beats the name in title slots)
          title: (c.brand && c.brand !== "Name Here") ? c.brand : "" })
      : null;
    ["front", "right", "left", "back", "bottom"].forEach(function (f) {
      var faceEl = els.box.querySelector(".face." + f);
      if (!faceEl) return;
      var skin = faceEl.querySelector(":scope > .panel-skin");
      var src = liveDoc && liveDoc.faces[f];
      if (!src || !src.panel) {
        if (skin) skin.remove();
        faceEl.classList.remove("has-panel");
        return;
      }
      if (!skin) { skin = document.createElement("div"); skin.className = "panel-skin"; faceEl.appendChild(skin); }
      var svg = global.GIIIFTBox.panelSVG(src.panel, src.panelText || {});
      if (skin.dataset.k !== src.panel + JSON.stringify(src.panelText || {})) {
        skin.dataset.k = src.panel + JSON.stringify(src.panelText || {});
        skin.innerHTML = svg;
      }
      faceEl.classList.add("has-panel");
    });
  }

  // ---------- the full repaint (the old paint() body) ----------
  function repaint() {
    var c = cfg();
    var bg = deps.faceBg(c);
    els.box.style.setProperty("--bg-front", bg.front);
    els.box.style.setProperty("--bg-side2", bg.side2);
    els.box.style.setProperty("--bg-top", bg.top);
    els.box.style.setProperty("--bg-dark", bg.dark);
    els.box.style.setProperty("--bg-size", bg.size);
    els.box.classList.toggle("holo-anim", c.finish === "holo");
    els.box.style.setProperty("--accent", c.accent);
    els.box.style.setProperty("--fragile", c.fragileColor);
    els.box.style.setProperty("--tape", c.accent);

    renderTyped("brand", c.brand);
    renderTyped("sublabel", c.sublabel);
    renderTyped("note", c.note);
    setRole("model", c.model);
    setRole("qty", c.qty);
    setRole("fragile", c.fragileText);
    setRole("labelTo", c.labelTo);
    setRole("labelFrom", c.from);

    var patClass = "front-fx " + (c.pattern && c.pattern !== "none" ? c.pattern : "hidden");
    els.box.querySelectorAll('[data-role="pattern"],[data-role="patternR"]').forEach(function (el) { el.className = patClass; });
    els.box.querySelectorAll('[data-role="sheen"],[data-role="sheenR"]').forEach(function (el) { el.classList.toggle("hidden", !c.sheen); });
    els.box.querySelector('[data-role="fragile"]').classList.toggle("hidden", !c.fragile);
    els.box.querySelector('[data-role="note"]').classList.toggle("hidden", !c.note);
    els.box.querySelector('[data-role="brand"]').parentElement.style.opacity = c.brand ? 1 : 0.5;

    // keep the borealis backdrop matched to the box — eases to the new colours
    if (global.GIIIFTSet && global.GIIIFTSet.setColors) global.GIIIFTSet.setColors(c.cardboard, c.cardboard2, c.accent);

    skinFaces();   // template faces re-render with the live name/note in their slots
  }

  // ---------- deposit drop (the old dropCoin body) ----------
  function dropIn(a) {
    // the deposit falls from the top of the window as the THING it is (digital
    // card / art frame / booster pack via asset-visuals.js; disc fallback), then
    // slips behind the box's open flaps so it reads as dropping inside
    // (see .drop-coin/.drop-thing + @keyframes drop-into)
    var bs = els.stage;
    var bsRect = bs.getBoundingClientRect();
    var bxRect = els.box.getBoundingClientRect();
    var AV = global.GIIIFTAssetVisuals;
    var coin = document.createElement("div");
    if (AV) {
      coin.className = "drop-thing";
      coin.appendChild(AV.build(
        { ticker: a.ticker, amount: a.amount || "", color: a.color, glyph: a.glyph, img: a.img },
        { logo: a.glyph ? null : (a.img || (a.ticker ? deps.logoUrl(a.ticker) : null)) }
      ));
    } else {
      coin.className = "drop-coin";
      var useGlyph = function () {
        coin.textContent = a.glyph || a.ticker[0];
        coin.style.background = "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.45), transparent 55%), " + a.color;
      };
      if (a.glyph) { useGlyph(); }
      else {
        coin.style.background = "#f3f4f2";
        var img = document.createElement("img");
        img.src = a.img || deps.logoUrl(a.ticker); img.alt = "";
        img.addEventListener("error", function () { coin.innerHTML = ""; useGlyph(); });
        coin.appendChild(img);
      }
    }
    // anchor on the box's open mouth (top-centre), relative to the stage
    var anchorTop = (bxRect.top - bsRect.top) + bxRect.height * 0.06;
    coin.style.left = (bxRect.left + bxRect.width / 2 - bsRect.left) + "px";
    coin.style.top = anchorTop + "px";
    // start just above the top of the browser window
    coin.style.setProperty("--start-y", (-(bsRect.top + anchorTop + 40)) + "px");
    bs.appendChild(coin);
    coin.addEventListener("animationend", function () { coin.remove(); });
  }

  // ---------- seal choreography (from the old stepSeal) ----------
  function seal() {
    els.box.classList.remove("is-open");          // lid closes
    rot = { y: -27, x: -26 }; applyRot();          // settle to a top-down 3/4 view so the taped lid shows
    setTimeout(function () { els.box.classList.add("is-sealed"); }, 650);  // tape wipes on
  }

  // ---------- drag to rotate ----------
  function bindDrag() {
    var drag = null, dragging = false;
    els.stage.addEventListener("pointerdown", function (e) {
      // Record the start, but DON'T engage the drag (or pause the idle float / kill the
      // box transition) yet - a plain click shouldn't toggle .dragging, which caused the
      // box to jump for a split second. We only commit to a drag once the pointer moves.
      drag = { x: e.clientX, y: e.clientY, ry: rot.y, rx: rot.x };
    });
    window.addEventListener("pointermove", function (e) {
      if (!drag) return;
      if (!dragging) {
        if (Math.abs(e.clientX - drag.x) < 3 && Math.abs(e.clientY - drag.y) < 3) return; // ignore micro-jitter (it was a click)
        dragging = true;
        els.stage.classList.add("dragging");
      }
      rot.y = drag.ry + (e.clientX - drag.x) * 0.4;
      // clamp the downward tilt so you can't rotate far enough to look inside the open box
      rot.x = Math.max(-32, Math.min(60, drag.rx - (e.clientY - drag.y) * 0.4));
      applyRot();
    });
    window.addEventListener("pointerup", function () {
      if (!drag) return;
      drag = null;
      if (dragging) { dragging = false; els.stage.classList.remove("dragging"); }
    });
  }

  function q(sel) { return typeof sel === "string" ? document.querySelector(sel) : sel; }

  global.GIIIFTStageBox = {
    mount: function (o) {
      els = { box: q(o.box), stage: q(o.stage) };
      ctx = o.ctx;
      deps = o.deps || {};
      bindDrag();
      applyRot();
      els.stage.classList.add("can-drag");
      ctx.on("change:cfg", repaint);
      ctx.on("contents:add", dropIn);
      ctx.on("flow:seal", seal);
      ctx.on("flow:step", function (s) { if (s && s.key === "text") els.stage.classList.add("can-drag"); });
      return global.GIIIFTStageBox;
    },
    // scene plumbing (finalize transitions clone/hide the stage) — not for steps
    el: function () { return els && els.box; },
    hide: function () { if (els) els.stage.style.display = "none"; },
    // a blinking caret on the box while the matching front-text field is focused
    caret: function (role, on) {
      var t = els && els.box.querySelector('[data-role="' + role + '"]');
      if (t) t.classList.toggle("caret", !!on);
    },
  };
})(window);
