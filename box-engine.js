/* GIIIFT Box Engine — declarative box documents + one shared renderer.
 *
 * A box is a DOCUMENT, not a flat config: a shape, a palette, six position-aware
 * faces (each a z-stacked canvas of layered elements), optional receive-side
 * feature gates, and the gift items. The same engine powers create (wrap), receive
 * (box), the hero, and the lab — `mode:"edit"` vs `"view"`.
 *
 *   const h = GIIIFTBox.render(el, doc, { mode:"view" });  // -> { el, doc, open, destroy }
 *   GIIIFTBox.normalize(doc)        // safe, complete doc (whitelists everything)
 *   GIIIFTBox.fromLegacy(cfg)       // migrate the old flat cfg/design -> a box doc
 *
 * SECURITY: box docs ride inside attacker-controllable gift links, so normalize()
 * whitelists every value that becomes CSS / HTML / a URL (hex colours, font keys,
 * pattern/shape/finish enums, clamped 0..1 coords, capped text, host-allowlisted art).
 * Text always renders via textContent.
 */
(function (global) {
  "use strict";

  /* ----------------------------- allowlists ----------------------------- */
  var FACES = ["front", "back", "left", "right", "top", "bottom"];
  var SHAPES = { mailer: 1, present: 1, cube: 1, envelope: 1 };
  var FINISHES = { gradient: 1, holo: 1, matte: 1, solid: 1 };
  var PATTERNS = { none: 1, stripes: 1, dots: 1, grid: 1, chevron: 1, crosshatch: 1, waves: 1, checker: 1, rings: 1, plus: 1, diagonal: 1, weave: 1 };
  var FONTS = { display: "var(--font-serif, 'EB Garamond', serif)", mono: "var(--font-mono, 'VT323', monospace)", logo: "var(--font-logo, 'Bowlby One', sans-serif)", body: "var(--font-main, 'Inter', sans-serif)", marker: "'Caveat', 'Comic Sans MS', cursive" };
  var ALIGN = { left: 1, center: 1, right: 1 };
  var ELTYPES = { text: 1, stamp: 1, note: 1, graffiti: 1, label: 1, barcode: 1, seal: 1, postmark: 1, sticker: 1, art: 1, decal: 1 };
  // curated flat-SVG decal/sticker library (defined in box-stickers.js, loaded before this file)
  var STICKERS = (typeof window !== "undefined" && window.GIIIFTBoxStickers) || {};
  // full-face panel/wrap library (defined in box-panels.js, loaded before this file)
  var PANELS = (typeof window !== "undefined" && window.GIIIFTBoxPanels) || {};
  var MAX_LAYERS = 16;     // per face
  var MAX_TEXT = 160;
  // art sources: https URLs, ipfs, or our own generative svg data-uri
  var ART_OK = /^(https:\/\/[^\s"'<>]+|ipfs:\/\/[^\s"'<>]+)$/i;
  // per-position shading so a single palette still reads as a lit 3D box
  var SHADE = { front: 0, right: 0.05, top: 0.12, left: -0.12, back: -0.12, bottom: -0.08 };

  /* ----------------------------- validators ----------------------------- */
  function isHex(v) { return typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v); }
  function hex(v, fb) { return isHex(v) ? v : fb; }
  function num(v, fb, lo, hi) { v = Number(v); if (!isFinite(v)) return fb; if (lo != null) v = Math.max(lo, v); if (hi != null) v = Math.min(hi, v); return v; }
  function enumv(map, v, fb) { return (typeof v === "string" && map[v]) ? v : fb; }
  function str(v, max) { return String(v == null ? "" : v).slice(0, max || MAX_TEXT); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ------------------------- colour / face fills ------------------------ */
  function shadeHex(h, pct) {
    var n = parseInt(String(h).replace("#", ""), 16);
    if (!isFinite(n)) return h;
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.round(Math.min(255, Math.max(0, r + 255 * pct)));
    g = Math.round(Math.min(255, Math.max(0, g + 255 * pct)));
    b = Math.round(Math.min(255, Math.max(0, b + 255 * pct)));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  // background string for a face, given its fill + position (for lit shading)
  function faceBackground(fill, pos) {
    var f = SHADE[pos] || 0, c1 = fill.c1, c2 = fill.c2 || c1, a = fill.angle, fin = fill.finish;
    if (fin === "holo") {
      var holo = "linear-gradient(125deg,#bfa9ff 0%,#ffc6e9 30%,#b8f0ff 60%,#cdbcff 100%)";
      var tint = "linear-gradient(rgba(0,0,0," + (0.12 - f).toFixed(2) + "),rgba(0,0,0," + (0.12 - f).toFixed(2) + "))";
      return { bg: tint + ", " + holo, size: "300% 300%" };
    }
    if (fin === "gradient") return { bg: "linear-gradient(" + a + "deg, " + shadeHex(c1, f) + ", " + shadeHex(c2, f) + ")", size: "auto" };
    return { bg: shadeHex(c1, f), size: "auto" }; // matte / solid
  }

  /* ------------------------------ defaults ------------------------------ */
  function defPalette() { return { c1: "#7c3aed", c2: "#ec4899", accent: "#fde68a", angle: 135, finish: "gradient" }; }
  function emptyFaces() { var o = {}; FACES.forEach(function (p) { o[p] = { pos: p, layers: [] }; }); return o; }

  /* --------------------------- normalization ---------------------------- */
  function normPalette(p, fb) {
    p = p || {}; fb = fb || defPalette();
    return { c1: hex(p.c1, fb.c1), c2: hex(p.c2, fb.c2), accent: hex(p.accent, fb.accent), angle: num(p.angle, fb.angle, 0, 360), finish: enumv(FINISHES, p.finish, fb.finish) };
  }
  function normElement(e, palette) {
    if (!e || !ELTYPES[e.t]) return null;
    var base = { t: e.t, x: num(e.x, 0.5, 0, 1), y: num(e.y, 0.5, 0, 1), w: num(e.w, 0.7, 0.02, 1), rotate: num(e.rotate, 0, -180, 180) };
    switch (e.t) {
      case "text":
      case "graffiti":
        base.value = str(e.value, MAX_TEXT);
        base.font = enumv(FONTS, e.font, e.t === "graffiti" ? "marker" : "display");
        base.size = num(e.size, 0.1, 0.02, 0.4);          // fraction of box size
        base.weight = num(e.weight, 600, 100, 900);
        base.color = hex(e.color, "#ffffff");
        base.align = enumv(ALIGN, e.align, "center");
        base.italic = !!e.italic;
        break;
      case "stamp":
        base.value = str(e.value, 40); base.color = hex(e.color, palette.accent); base.size = num(e.size, 0.07, 0.03, 0.16);
        break;
      case "note":
        base.label = str(e.label, 24); base.value = str(e.value, 120); base.color = hex(e.color, palette.accent); base.w = num(e.w, 0.62, 0.2, 1);
        break;
      case "label":
        base.title = str(e.title, 18) || "PRIORITY"; base.to = str(e.to, 40); base.from = str(e.from, 40); base.w = num(e.w, 0.5, 0.25, 1);
        break;
      case "art":
        if (e.ref && e.ref.contract) base.ref = { contract: str(e.ref.contract, 60), tokenId: str(e.ref.tokenId, 40), chain: str(e.ref.chain, 16) };
        base.src = (typeof e.src === "string" && ART_OK.test(e.src)) ? e.src : (typeof e.src === "string" && /^data:image\/svg\+xml/i.test(e.src) ? e.src.slice(0, 4000) : "");
        base.fit = e.fit === "contain" ? "contain" : "cover";
        base.w = num(e.w, 0.6, 0.1, 1); base.h = num(e.h, 0.6, 0.1, 1); base.radius = num(e.radius, 0.03, 0, 0.5);
        break;
      case "sticker":
        base.value = str(e.value, 8); base.size = num(e.size, 0.12, 0.04, 0.3);
        break;
      case "decal":
        base.id = (typeof e.id === "string" && STICKERS[e.id]) ? e.id : (Object.keys(STICKERS)[0] || "");
        base.w = num(e.w, 0.34, 0.05, 1); base.h = num(e.h, 0.34, 0.05, 1);
        break;
      case "barcode": base.color = hex(e.color, palette.accent); base.w = num(e.w, 0.5, 0.1, 1); break;
      case "seal": case "postmark": base.value = str(e.value, 40); base.color = hex(e.color, palette.accent); base.size = num(e.size, 0.22, 0.08, 0.5); break;
    }
    return base;
  }
  function normFace(face, pos, palette) {
    face = face || {};
    var out = { pos: pos };
    if (face.fill) out.fill = normPalette(face.fill, palette);
    if (typeof face.panel === "string" && PANELS[face.panel]) out.panel = face.panel;
    if (out.panel && face.panelText && typeof face.panelText === "object") {
      var pdef = PANELS[out.panel], pt = {};
      if (pdef && pdef.fields) pdef.fields.forEach(function (f) { var v = face.panelText[f.key]; if (typeof v === "string") pt[f.key] = v.slice(0, f.max || 60); });
      if (Object.keys(pt).length) out.panelText = pt;
    }
    out.pattern = enumv(PATTERNS, face.pattern, "none");
    var layers = Array.isArray(face.layers) ? face.layers : [];
    out.layers = layers.slice(0, MAX_LAYERS).map(function (e) { return normElement(e, palette); }).filter(Boolean);
    return out;
  }
  function normFeatures(f) {
    f = f || {}; var out = {};
    if (f.lock && /^(pin|pattern|riddle)$/.test(f.lock.type)) out.lock = { type: f.lock.type, prompt: str(f.lock.prompt, 80), hint: str(f.lock.hint, 80), answer: str(f.lock.answer, 64) };
    if (f.minigame && /^(memory|slide|trivia)$/.test(f.minigame.type)) out.minigame = { type: f.minigame.type, prompt: str(f.minigame.prompt, 80) };
    if (f.selfDestruct) out.selfDestruct = { type: "defuse", attempts: num(f.selfDestruct.attempts, 3, 1, 9), timerMs: num(f.selfDestruct.timerMs, 15000, 3000, 120000) };
    return out;
  }
  function normalize(doc) {
    doc = doc || {};
    var palette = normPalette(doc.palette);
    var faces = {};
    var inFaces = doc.faces || {};
    FACES.forEach(function (p) { faces[p] = normFace(inFaces[p], p, palette); });
    return {
      v: 2,
      shape: enumv(SHAPES, doc.shape, "mailer"),
      palette: palette,
      faces: faces,
      features: normFeatures(doc.features),
      items: Array.isArray(doc.items) ? doc.items.slice(0, 24) : [],
      meta: { brand: str(doc.meta && doc.meta.brand, 40), serial: str(doc.meta && doc.meta.serial, 16) }
    };
  }

  /* ----------------- migrate the old flat cfg/design -> doc ----------------- */
  function fromLegacy(c) {
    c = c || {};
    var palette = { c1: hex(c.cardboard, "#7c3aed"), c2: hex(c.cardboard2 || c.cardboard, "#ec4899"), accent: hex(c.accent, "#fde68a"), angle: num(c.angle, 135, 0, 360), finish: enumv(FINISHES, c.finish, "gradient") };
    var pat = enumv(PATTERNS, c.pattern, "dots");
    var to = String(c.labelTo || c.to || "").replace(/^to:\s*/i, "").trim();
    var faces = emptyFaces();
    // FRONT — branded hero face
    faces.front.pattern = pat;
    faces.front.layers = [
      { t: "text", value: c.brand || c.msg || "A gift", x: 0.5, y: 0.4, w: 0.78, font: "display", size: 0.13, weight: 600, color: palette.accent, italic: true, align: "center" },
      { t: "text", value: c.sublabel || "A GIFT FOR YOU", x: 0.5, y: 0.55, w: 0.7, font: "mono", size: 0.05, weight: 500, color: palette.accent, align: "center" },
      { t: "text", value: (c.model || "Model: GF-001") + "      " + (c.qty || "Qty: 1"), x: 0.5, y: 0.74, w: 0.82, font: "mono", size: 0.045, weight: 500, color: palette.accent, align: "center" }
    ];
    if (c.note) faces.front.layers.push({ t: "graffiti", value: c.note, x: 0.5, y: 0.9, w: 0.7, font: "marker", size: 0.07, color: palette.accent });
    if (c.fragile) faces.front.layers.push({ t: "stamp", value: c.fragileText || "Fragile", x: 0.8, y: 0.14, rotate: 8, color: hex(c.fragileColor, "#d94f2a"), size: 0.06 });
    // RIGHT — shipping label + one stamp per asset
    faces.right.pattern = pat;
    faces.right.layers = [{ t: "label", title: "PRIORITY", to: to ? "To: " + to : "To: someone", from: c.from || "", x: 0.34, y: 0.5, w: 0.5, rotate: -5 }];
    (c.items || []).slice(0, 6).forEach(function (it, i) {
      faces.right.layers.push({ t: "sticker", value: (it.glyph || (it.ticker ? it.ticker[0] : "•")), x: 0.78, y: 0.26 + i * 0.12, size: 0.1, rotate: -7 });
    });
    // LEFT / BACK / BOTTOM — care + return + seal
    faces.left.pattern = pat;
    faces.left.layers = [{ t: "text", value: "HANDLE WITH CARE", x: 0.5, y: 0.5, w: 0.8, font: "mono", size: 0.05, weight: 700, color: palette.accent, align: "center" }];
    faces.back.pattern = pat;
    faces.back.layers = [
      { t: "text", value: "FROM", x: 0.3, y: 0.2, w: 0.4, font: "mono", size: 0.04, color: palette.accent, align: "left" },
      { t: "text", value: (c.from || "GIIIFT").toUpperCase(), x: 0.34, y: 0.27, w: 0.55, font: "body", size: 0.05, weight: 800, color: palette.accent, align: "left" },
      { t: "postmark", value: "WRAPPED WITH CARE", x: 0.74, y: 0.42, size: 0.28, color: palette.accent }
    ];
    faces.bottom.pattern = pat;
    faces.bottom.layers = [
      { t: "seal", value: "✦", x: 0.5, y: 0.4, size: 0.3, color: palette.accent },
      { t: "text", value: "SECURELY SEALED · MADE WITH ♥", x: 0.5, y: 0.66, w: 0.8, font: "mono", size: 0.044, color: palette.accent, align: "center" }
    ];
    faces.top.pattern = pat;
    return normalize({ shape: "mailer", palette: palette, faces: faces, items: c.items || [], meta: { brand: c.brand || "" } });
  }

  /* ------------------------------- CSS ---------------------------------- */
  var CSS = [
    ".gbx-scene{position:relative;transform-style:preserve-3d}",
    ".gbx-box{--gbx-size:clamp(280px,32vw,420px);position:relative;width:var(--gbx-size);height:var(--gbx-size);transform-style:preserve-3d;transform:rotateY(-24deg) rotateX(13deg);transition:transform 1s cubic-bezier(.5,.02,.2,1)}",
    ".gbx-box.gbx-opened{transform:rotateY(-14deg) rotateX(8deg)}",
    ".gbx-face{position:absolute;width:var(--gbx-size);height:var(--gbx-size);overflow:hidden;border:1px solid rgba(255,255,255,0.05);border-radius:9px;background-size:var(--gbx-bg-size,auto)}",
    ".gbx-face:not(.gbx-front)::after{content:'';position:absolute;inset:0;pointer-events:none;background-image:repeating-linear-gradient(0deg,rgba(0,0,0,0.05) 0 2px,transparent 2px 6px);opacity:.55}",
    ".gbx-back{transform:translateZ(calc(var(--gbx-size)/-2)) rotateY(180deg)}",
    ".gbx-left{transform:rotateY(-90deg) translateZ(calc(var(--gbx-size)/2))}",
    ".gbx-right{transform:rotateY(90deg) translateZ(calc(var(--gbx-size)/2))}",
    ".gbx-bottom{transform:rotateX(-90deg) translateZ(calc(var(--gbx-size)/2))}",
    ".gbx-front{transform:translateZ(calc(var(--gbx-size)/2));z-index:2}",
    ".gbx-cavity{position:absolute;inset:7%;background:radial-gradient(circle at 50% 38%,#20242a,#06080a 80%);box-shadow:inset 0 10px 30px rgba(0,0,0,0.9);transform:rotateX(90deg) translateZ(calc(var(--gbx-size)/-2 + 16px));border-radius:7px}",
    ".gbx-glow{position:absolute;top:50%;left:50%;width:85%;height:85%;transform:translate(-50%,-50%) translateZ(-12px);background:radial-gradient(circle,var(--gbx-accent,#00FF9D) 0%,transparent 70%);filter:blur(16px);opacity:0;transition:opacity .7s .35s}",
    ".gbx-box.gbx-opened .gbx-glow{opacity:.6}",
    /* open-reveal burst (beam + particles + assets popping out) */
    ".gbx-beam{position:absolute;top:50%;left:50%;width:calc(var(--gbx-size)*0.55);height:calc(var(--gbx-size)*2.4);opacity:0;pointer-events:none;transform-origin:bottom center;transform:translate(-50%,-100%);background:linear-gradient(to top,color-mix(in srgb,var(--gbx-accent,#00FF9D) 80%,transparent) 0%,transparent 78%);filter:blur(24px)}",
    ".gbx-box.gbx-opened .gbx-beam{animation:gbx-beam 1.3s .45s forwards}",
    "@keyframes gbx-beam{from{opacity:0;height:0}to{opacity:.8;height:calc(var(--gbx-size)*2.4)}}",
    ".gbx-particles{position:absolute;top:50%;left:50%;width:var(--gbx-size);height:var(--gbx-size);transform:translate(-50%,-50%);transform-style:preserve-3d;pointer-events:none}",
    ".gbx-particle{position:absolute;bottom:34%;width:5px;height:5px;border-radius:50%;background:#fff;box-shadow:0 0 8px 2px var(--gbx-accent,#00FF9D);opacity:0}",
    ".gbx-box.gbx-opened .gbx-particle{animation:gbx-particle 3.2s linear infinite}",
    ".gbx-particle:nth-child(1){left:30%;animation-delay:.6s}.gbx-particle:nth-child(2){left:68%;width:7px;height:7px;animation-delay:1s}.gbx-particle:nth-child(3){left:46%;animation-delay:1.4s}.gbx-particle:nth-child(4){left:58%;width:3px;height:3px;animation-delay:.8s}.gbx-particle:nth-child(5){left:22%;animation-delay:1.7s}.gbx-particle:nth-child(6){left:78%;animation-delay:1.2s}",
    "@keyframes gbx-particle{0%{transform:translateY(0) scale(0);opacity:0}20%{opacity:.9}100%{transform:translateY(-240px) translateX(18px) scale(.4);opacity:0}}",
    ".gbx-pop{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);transform-style:preserve-3d;pointer-events:none;z-index:3}",
    ".gbx-coin{position:absolute;left:0;top:0;width:calc(var(--gbx-size)*0.2);height:calc(var(--gbx-size)*0.2);border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:calc(var(--gbx-size)*0.085);box-shadow:inset 0 -3px 5px rgba(0,0,0,0.3),inset 0 3px 5px rgba(255,255,255,0.25),0 8px 18px rgba(0,0,0,0.5);text-shadow:0 1px 1px rgba(0,0,0,0.3);opacity:0;transform:translate(-50%,-50%)}",
    ".gbx-coin img{width:100%;height:100%;object-fit:cover}",
    ".gbx-box.gbx-opened .gbx-coin{animation:gbx-pop 1.1s cubic-bezier(.2,.8,.25,1) forwards}",
    "@keyframes gbx-pop{0%{opacity:0;transform:translate(-50%,-50%) translateY(40px) scale(0.3)}35%{opacity:1}100%{opacity:1;transform:translate(-50%,-50%) translateY(var(--pop-y,-150px)) translateX(var(--pop-x,0px)) scale(1) rotate(var(--pop-r,0deg))}}",
    /* lid + flaps */
    ".gbx-lid{position:absolute;width:var(--gbx-size);height:var(--gbx-size);transform:rotateX(90deg) translateZ(calc(var(--gbx-size)/2));transform-style:preserve-3d;pointer-events:none}",
    ".gbx-flap{position:absolute;border:1px solid rgba(0,0,0,0.18);border-radius:7px;transition:transform 1s cubic-bezier(.5,.02,.2,1);box-shadow:0 0 8px rgba(0,0,0,0.25);background-size:var(--gbx-bg-size,auto)}",
    ".gbx-fl-back{top:0;left:0;width:100%;height:50%;transform-origin:center top;transform:translateZ(.6px)}",
    ".gbx-fl-front{bottom:0;left:0;width:100%;height:50%;transform-origin:center bottom;transform:translateZ(.6px)}",
    ".gbx-fl-left{top:0;left:0;width:50%;height:100%;transform-origin:left center;transform:translateZ(-.6px)}",
    ".gbx-fl-right{top:0;right:0;width:50%;height:100%;transform-origin:right center;transform:translateZ(-.6px)}",
    ".gbx-box.gbx-opened .gbx-fl-back{transform:translateZ(.6px) rotateX(-124deg)}",
    ".gbx-box.gbx-opened .gbx-fl-front{transform:translateZ(.6px) rotateX(124deg)}",
    ".gbx-box.gbx-opened .gbx-fl-left{transform:translateZ(-.6px) rotateY(-124deg)}",
    ".gbx-box.gbx-opened .gbx-fl-right{transform:translateZ(-.6px) rotateY(124deg)}",
    ".gbx-tape{position:absolute;left:0;width:100%;top:39%;height:22%;transform:translateZ(2px);pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,0.12) 0 5px,transparent 5px 11px),linear-gradient(180deg,var(--gbx-tape,#d6b88c),color-mix(in srgb,var(--gbx-tape,#d6b88c) 70%,transparent));border-top:1px solid rgba(255,255,255,0.3);border-bottom:1px solid rgba(0,0,0,0.24);transition:opacity .4s}",
    ".gbx-box.gbx-opened .gbx-tape{opacity:0}",
    /* layered content elements */
    ".gbx-layer{position:absolute;transform:translate(-50%,-50%) rotate(var(--rot,0deg));transform-origin:center;z-index:3}",
    ".gbx-text{line-height:1.05;overflow-wrap:break-word;text-shadow:0 1px 2px rgba(0,0,0,0.25)}",
    ".gbx-graffiti{line-height:1;text-shadow:0 1px 3px rgba(0,0,0,0.3)}",
    ".gbx-stamp{border:calc(var(--gbx-size)*0.006) solid currentColor;border-radius:6px;padding:.28em .5em;font-family:var(--font-mono,'VT323',monospace);text-transform:uppercase;letter-spacing:.08em;font-weight:700;line-height:1;text-align:center}",
    ".gbx-note{background:rgba(0,0,0,0.18);border-left:calc(var(--gbx-size)*0.01) solid currentColor;border-radius:4px;padding:.5em .6em;backdrop-filter:blur(2px)}",
    ".gbx-note .gbx-note-l{display:block;font-family:var(--font-mono,monospace);font-size:.7em;letter-spacing:.14em;text-transform:uppercase;opacity:.7;margin-bottom:.2em}",
    ".gbx-note .gbx-note-t{font-family:var(--font-serif,serif);font-style:italic;line-height:1.25}",
    ".gbx-label{background:#e8e6e0;color:#111;padding:8%;box-shadow:0 4px 14px rgba(0,0,0,0.5);font-family:var(--font-main,sans-serif)}",
    ".gbx-label .gbx-lb-t{font-weight:800;letter-spacing:.06em;font-size:1em}",
    ".gbx-label .gbx-lb-to{font-size:.9em;margin-top:.2em;color:#333}",
    ".gbx-label .gbx-lb-bar{height:.9em;margin-top:.5em;background:repeating-linear-gradient(90deg,#111 0 2px,#e8e6e0 2px 4px)}",
    ".gbx-sticker{border-radius:50%;border:calc(var(--gbx-size)*0.005) solid currentColor;display:grid;place-items:center;font-weight:800;line-height:1;aspect-ratio:1}",
    ".gbx-seal{border-radius:50%;border:calc(var(--gbx-size)*0.006) solid currentColor;display:grid;place-items:center;position:relative;aspect-ratio:1}",
    ".gbx-seal::before{content:'';position:absolute;inset:9%;border:1px dashed currentColor;border-radius:50%;opacity:.7}",
    ".gbx-postmark{border-radius:50%;border:calc(var(--gbx-size)*0.005) solid currentColor;display:grid;place-items:center;text-align:center;opacity:.6;aspect-ratio:1;padding:14%}",
    ".gbx-postmark span{font-family:var(--font-mono,monospace);font-size:.34em;letter-spacing:.08em;line-height:1.25}",
    ".gbx-barcode{height:calc(var(--gbx-size)*0.1);background:repeating-linear-gradient(90deg,currentColor 0 2px,transparent 2px 5px);opacity:.6}",
    ".gbx-art{display:block;border-radius:calc(var(--gbx-size)*var(--gbx-art-r,0.03));box-shadow:0 6px 20px rgba(0,0,0,0.5)}",
    ".gbx-decal{display:grid;place-items:center;filter:drop-shadow(0 5px 12px rgba(0,0,0,0.45))}",
    ".gbx-decal svg{width:100%;height:100%;display:block;overflow:visible}",
    ".gbx-panel{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}",
    ".gbx-panel svg{width:100%;height:100%;display:block}",
    ".gbx-lid-panel{transform:translateZ(1.2px);border-radius:7px;transition:opacity .4s;z-index:0}",
    ".gbx-tape{z-index:3}",
    ".gbx-box.gbx-opened .gbx-lid-panel{opacity:0}",
    /* patterns (overlay per face) */
    ".gbx-pattern{position:absolute;inset:0;z-index:1;pointer-events:none;opacity:.9}",
    ".gbx-pat-stripes{background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.10) 0 7px,transparent 7px 16px)}",
    ".gbx-pat-dots{background-image:radial-gradient(rgba(255,255,255,0.16) 1.5px,transparent 1.8px);background-size:16px 16px}",
    ".gbx-pat-grid{background-image:linear-gradient(rgba(255,255,255,0.11) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.11) 1px,transparent 1px);background-size:18px 18px}",
    ".gbx-pat-chevron{background-image:repeating-linear-gradient(135deg,rgba(255,255,255,0.10) 0 6px,transparent 6px 14px),repeating-linear-gradient(45deg,rgba(255,255,255,0.10) 0 6px,transparent 6px 14px);background-size:28px 28px}",
    ".gbx-pat-crosshatch{background-image:repeating-linear-gradient(45deg,rgba(255,255,255,0.10) 0 1px,transparent 1px 9px),repeating-linear-gradient(-45deg,rgba(255,255,255,0.10) 0 1px,transparent 1px 9px)}",
    ".gbx-pat-waves{background-image:radial-gradient(circle at 50% 120%,transparent 7px,rgba(255,255,255,0.12) 8px,transparent 9px);background-size:22px 13px}",
    ".gbx-pat-checker{background-image:conic-gradient(rgba(255,255,255,0.09) 0 25%,transparent 0 50%,rgba(255,255,255,0.09) 0 75%,transparent 0);background-size:22px 22px}",
    ".gbx-pat-rings{background-image:radial-gradient(circle,transparent 4px,rgba(255,255,255,0.13) 5px,transparent 6px);background-size:24px 24px}",
    ".gbx-pat-plus{background-image:linear-gradient(rgba(255,255,255,0.14) 2px,transparent 2px),linear-gradient(90deg,rgba(255,255,255,0.14) 2px,transparent 2px);background-size:22px 22px}",
    ".gbx-pat-diagonal{background-image:repeating-linear-gradient(60deg,rgba(255,255,255,0.09) 0 9px,transparent 9px 20px)}",
    ".gbx-pat-weave{background-image:repeating-linear-gradient(0deg,rgba(255,255,255,0.08) 0 2px,transparent 2px 10px),repeating-linear-gradient(90deg,rgba(255,255,255,0.08) 0 2px,transparent 2px 10px);background-size:20px 20px}",
    ".gbx-editable{outline:none}",
    "@media(prefers-reduced-motion:reduce){.gbx-box,.gbx-flap,.gbx-tape{transition:none}}"
  ].join("");

  function injectCss() {
    if (document.getElementById("gbx-css")) return;
    var st = document.createElement("style"); st.id = "gbx-css"; st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* --------------------------- element render --------------------------- */
  function px(frac) { return "calc(var(--gbx-size) * " + frac + ")"; }
  function placeLayer(node, e) {
    node.classList.add("gbx-layer");
    node.style.left = (e.x * 100) + "%";
    node.style.top = (e.y * 100) + "%";
    if (e.w != null && e.t !== "sticker" && e.t !== "seal" && e.t !== "postmark" && e.t !== "decal") node.style.width = (e.w * 100) + "%";
    node.style.setProperty("--rot", (e.rotate || 0) + "deg");
  }
  function renderElement(e, palette) {
    var n;
    switch (e.t) {
      case "text":
      case "graffiti":
        n = document.createElement("div");
        n.className = e.t === "graffiti" ? "gbx-graffiti" : "gbx-text";
        n.textContent = e.value;
        n.style.fontFamily = FONTS[e.font] || FONTS.display;
        n.style.fontSize = px(e.size);
        n.style.fontWeight = e.weight;
        n.style.color = e.color;
        n.style.textAlign = e.align;
        if (e.italic) n.style.fontStyle = "italic";
        break;
      case "stamp":
        n = document.createElement("div"); n.className = "gbx-stamp"; n.textContent = e.value;
        n.style.color = e.color; n.style.fontSize = px(e.size);
        break;
      case "note":
        n = document.createElement("div"); n.className = "gbx-note"; n.style.color = e.color; n.style.fontSize = px(0.05);
        if (e.label) { var l = document.createElement("span"); l.className = "gbx-note-l"; l.textContent = e.label; n.appendChild(l); }
        var t = document.createElement("span"); t.className = "gbx-note-t"; t.textContent = e.value; n.appendChild(t);
        break;
      case "label":
        n = document.createElement("div"); n.className = "gbx-label"; n.style.fontSize = px(0.045);
        n.innerHTML = '<div class="gbx-lb-t"></div><div class="gbx-lb-to gbx-lb-to1"></div><div class="gbx-lb-to gbx-lb-to2"></div><div class="gbx-lb-bar"></div>';
        n.querySelector(".gbx-lb-t").textContent = e.title;
        n.querySelector(".gbx-lb-to1").textContent = e.to;
        n.querySelector(".gbx-lb-to2").textContent = e.from;
        break;
      case "sticker":
        n = document.createElement("div"); n.className = "gbx-sticker"; n.textContent = e.value;
        n.style.width = px(e.size); n.style.fontSize = px(e.size * 0.5); n.style.color = palette.accent;
        break;
      case "seal":
        n = document.createElement("div"); n.className = "gbx-seal"; n.textContent = e.value || "✦";
        n.style.width = px(e.size); n.style.fontSize = px(e.size * 0.45); n.style.color = e.color;
        break;
      case "postmark":
        n = document.createElement("div"); n.className = "gbx-postmark"; n.style.width = px(e.size); n.style.color = e.color;
        n.innerHTML = "<span></span>"; n.firstChild.textContent = e.value || "";
        break;
      case "barcode":
        n = document.createElement("div"); n.className = "gbx-barcode"; n.style.color = e.color;
        break;
      case "art":
        if (e.src) {
          n = document.createElement("img"); n.className = "gbx-art"; n.src = e.src; n.alt = ""; n.loading = "lazy";
          n.style.objectFit = e.fit; n.style.width = px(e.w); n.style.height = px(e.h);
          n.style.setProperty("--gbx-art-r", e.radius);
          n.addEventListener("error", function () { n.remove(); });
        } else {
          n = document.createElement("div"); n.className = "gbx-art";
          n.style.width = px(e.w); n.style.height = px(e.h);
          n.style.background = "linear-gradient(135deg," + palette.c1 + "," + palette.c2 + ")";
          n.style.display = "grid"; n.style.placeItems = "center"; n.style.color = palette.accent; n.style.fontSize = px(0.12);
          n.textContent = "✦";
        }
        break;
      case "decal":
        n = document.createElement("div"); n.className = "gbx-decal";
        n.style.width = px(e.w); n.style.height = px(e.h);
        var ds = STICKERS[e.id];
        if (ds && ds.svg) { n.innerHTML = ds.svg; }
        else { n.style.background = "linear-gradient(135deg," + palette.c1 + "," + palette.c2 + ")"; n.style.borderRadius = "14%"; }
        break;
      default: return null;
    }
    placeLayer(n, e);
    return n;
  }

  /* ------------------------------ render -------------------------------- */
  // Resolve a panel's SVG, substituting {{key}} tokens with editable text.
  // Each field keeps its own <text> styling — only the string content changes.
  function panelSVG(idOrPanel, overrides) {
    var p = (typeof idOrPanel === "string") ? PANELS[idOrPanel] : idOrPanel;
    if (!p) return "";
    var svg = p.svg;
    if (p.fields) for (var i = 0; i < p.fields.length; i++) {
      var f = p.fields[i];
      var v = (overrides && typeof overrides[f.key] === "string") ? overrides[f.key] : f.value;
      svg = svg.split("{{" + f.key + "}}").join(esc(v));
    }
    return svg;
  }
  // dark neutral used behind a full-coverage panel, so the bright palette can't bleed at the rounded 3D seams/edges
  var NEUTRAL_BASE = { c1: "#202227", c2: "#141619", angle: 135, finish: "gradient" };
  function buildFace(pos, face, palette, cls) {
    var el = document.createElement("div");
    el.className = "gbx-face gbx-" + cls;
    el.dataset.pos = pos;
    var fill = (face.panel && PANELS[face.panel]) ? NEUTRAL_BASE : (face.fill || palette);
    var bg = faceBackground(fill, pos);
    el.style.background = bg.bg;
    el.style.setProperty("--gbx-bg-size", bg.size);
    if (face.pattern && face.pattern !== "none") {
      var p = document.createElement("div"); p.className = "gbx-pattern gbx-pat-" + face.pattern; el.appendChild(p);
    }
    if (face.panel && PANELS[face.panel]) {
      var pn = document.createElement("div"); pn.className = "gbx-panel"; pn.innerHTML = panelSVG(face.panel, face.panelText); el.appendChild(pn);
    }
    (face.layers || []).forEach(function (e, i) { var n = renderElement(e, palette); if (n) { n.dataset.li = i; n.dataset.face = pos; el.appendChild(n); } });
    return el;
  }

  // a coin that flies out on open — crypto-icon logo with a glyph/colour fallback
  function coinNode(it) {
    var span = document.createElement("span"); span.className = "gbx-coin";
    var fb = function () { span.innerHTML = ""; span.style.background = "radial-gradient(circle at 30% 25%,rgba(255,255,255,0.4),transparent 55%)," + ((it && it.color) || "#888"); span.textContent = (it && it.glyph) || (it && it.ticker ? it.ticker[0] : "•"); };
    if (!it || it.glyph || !it.ticker) { fb(); return span; }
    var img = document.createElement("img"); img.alt = ""; img.loading = "lazy";
    img.src = "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color/" + String(it.ticker).toLowerCase() + ".svg";
    img.addEventListener("error", fb); span.appendChild(img); return span;
  }
  function buildBurst(items) {
    var burst = document.createDocumentFragment();
    var beam = elDiv("gbx-beam"); burst.appendChild(beam);
    var parts = elDiv("gbx-particles"); for (var i = 0; i < 6; i++) parts.appendChild(elDiv("gbx-particle")); burst.appendChild(parts);
    var pop = elDiv("gbx-pop");
    var list = (items && items.length) ? items.slice(0, 6) : [{ glyph: "★", color: "#888" }];
    list.forEach(function (it, i) {
      var c = coinNode(it);
      var spread = list.length > 1 ? (i / (list.length - 1) - 0.5) : 0;
      c.style.setProperty("--pop-x", Math.round(spread * 175) + "px");
      c.style.setProperty("--pop-y", Math.round(-120 - Math.random() * 60) + "px");
      c.style.setProperty("--pop-r", Math.round(spread * 36) + "deg");
      c.style.animationDelay = (0.45 + i * 0.08) + "s";
      pop.appendChild(c);
    });
    burst.appendChild(pop);
    return burst;
  }

  function render(container, doc, opts) {
    opts = opts || {};
    injectCss();
    doc = normalize(doc);
    container.innerHTML = "";

    var scene = document.createElement("div"); scene.className = "gbx-scene";
    var box = document.createElement("div"); box.className = "gbx-box";
    box.style.setProperty("--gbx-accent", doc.palette.accent);
    box.style.setProperty("--gbx-tape", doc.palette.accent);
    if (opts.size) box.style.setProperty("--gbx-size", opts.size);

    box.appendChild(elDiv("gbx-cavity"));
    box.appendChild(elDiv("gbx-glow"));

    // six faces
    box.appendChild(buildFace("back", doc.faces.back, doc.palette, "back"));
    box.appendChild(buildFace("left", doc.faces.left, doc.palette, "left"));
    box.appendChild(buildFace("right", doc.faces.right, doc.palette, "right"));
    box.appendChild(buildFace("bottom", doc.faces.bottom, doc.palette, "bottom"));
    box.appendChild(buildFace("front", doc.faces.front, doc.palette, "front"));

    // lid (top face content rides on the flaps + a tape seam)
    var lid = document.createElement("div"); lid.className = "gbx-lid";
    var topFill = (doc.faces.top.panel && PANELS[doc.faces.top.panel]) ? NEUTRAL_BASE : (doc.faces.top.fill || doc.palette);
    var topBg = faceBackground(topFill, "top");
    ["fl-left", "fl-right", "fl-back", "fl-front"].forEach(function (f) {
      var fl = document.createElement("div"); fl.className = "gbx-flap gbx-" + f;
      fl.style.background = topBg.bg; fl.style.setProperty("--gbx-bg-size", topBg.size);
      if (doc.faces.top.pattern && doc.faces.top.pattern !== "none") { var p = document.createElement("div"); p.className = "gbx-pattern gbx-pat-" + doc.faces.top.pattern; fl.appendChild(p); }
      lid.appendChild(fl);
    });
    if (doc.faces.top.panel && PANELS[doc.faces.top.panel]) {
      var lp = document.createElement("div"); lp.className = "gbx-panel gbx-lid-panel";
      lp.innerHTML = panelSVG(doc.faces.top.panel, doc.faces.top.panelText);
      lid.appendChild(lp);
    }
    var tape = document.createElement("div"); tape.className = "gbx-tape"; lid.appendChild(tape);
    box.appendChild(lid);

    // open-reveal burst (assets fly out) — opt out with { burst:false }
    if (opts.burst !== false) box.appendChild(buildBurst(doc.items));

    scene.appendChild(box);
    container.appendChild(scene);

    var opened = false;
    var handle = {
      el: scene, box: box, doc: doc,
      open: function () { if (opened) return; opened = true; box.classList.add("gbx-opened"); if (opts.onOpen) opts.onOpen(); },
      isOpen: function () { return opened; },
      update: function (next) { return render(container, next, opts); },
      destroy: function () { container.innerHTML = ""; }
    };
    return handle;
  }
  function elDiv(cls) { var d = document.createElement("div"); d.className = cls; return d; }

  /* ------------------------------ export -------------------------------- */
  var API = {
    FACES: FACES, PATTERNS: PATTERNS, SHAPES: SHAPES, FINISHES: FINISHES, FONTS: FONTS, STICKERS: STICKERS, PANELS: PANELS,
    normalize: normalize, fromLegacy: fromLegacy, render: render,
    faceBackground: faceBackground, shadeHex: shadeHex, panelSVG: panelSVG,
  };
  global.GIIIFTBox = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : this);
