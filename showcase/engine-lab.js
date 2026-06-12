/* GIIIFT box lab — Canva-style editor UI over the box engine (window.GIIIFTBox).
 * Left tool-rail · canvas with on-box controls · contextual property panel.
 * The engine/doc model is untouched; this file is purely the authoring UI. */
(function () {
  "use strict";
  var GBX = window.GIIIFTBox;
  if (!GBX) { console.error("[box lab] GIIIFTBox not loaded"); return; }

  /* ---------------- helpers ---------------- */
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function $(s) { return document.querySelector(s); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function clamp01(v) { return clamp(v, 0, 1); }
  function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
  function esc(s) { var d = document.createElement("div"); d.textContent = String(s == null ? "" : s); return d.innerHTML; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isTextEntry(a) { return !!(a && (/^(input|textarea)$/i.test(a.tagName) || a.isContentEditable)); }
  var ADMIN = /[?&]admin\b/.test(location.search);   // ?admin unlocks in-browser panel authoring: drop/paste art + export a face as a registered panel
  function reducedMotion() { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  function isMobile() { try { return window.matchMedia("(max-width:980px)").matches; } catch (e) { return false; } }

  /* ---------------- icons (stroke SVG) ---------------- */
  var S = function (inner) { return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + inner + "</svg>"; };
  var ICONS = {
    templates: S('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
    box: S('<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/>'),
    faces: S('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>'),
    layers: S('<path d="M12 3 2 9l10 6 10-6z"/><path d="M2 15l10 6 10-6"/>'),
    stickers: S('<path d="M12 2l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 16.8 6.2 19.8l1.6-6.6L2.6 8.8l6.8-.5z"/>'),
    panels: S('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 4 20 21M20 3 4 20" stroke-opacity=".4"/>'),
    gift: S('<rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M3 13h18M12 9v12M12 9S9.5 3 7 4.5 9 9 12 9zM12 9s2.5-6 5-4.5S15 9 12 9z"/>'),
    code: S('<path d="M8 6 3 12l5 6M16 6l5 6-5 6"/>'),
    props: S('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'),
    undo: S('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-1"/>'),
    redo: S('<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h1"/>'),
    dup: S('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),
    fwd: S('<path d="M12 20V4M5 11l7-7 7 7"/>'),
    back: S('<path d="M12 4v16M5 13l7 7 7-7"/>'),
    trash: S('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
    help: S('<circle cx="12" cy="12" r="10"/><path d="M9.1 9.2a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4"/><path d="M12 17h.01"/>'),
    open: S('<path d="M3 9l9-6 9 6v10l-9 5-9-5z"/><path d="M3 9l9 5 9-5"/>'),
    edit: S('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    orbit: S('<path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 3v5h-5"/>'),
    unfold: S('<rect x="9" y="2.5" width="6" height="6" rx="1"/><rect x="2" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/><rect x="16" y="9" width="6" height="6" rx="1"/><rect x="9" y="15.5" width="6" height="6" rx="1"/>'),
    ctrx: S('<path d="M12 3v18" stroke-dasharray="3 3"/><rect x="6" y="9" width="12" height="6" rx="1.5"/>'),
    ctry: S('<path d="M3 12h18" stroke-dasharray="3 3"/><rect x="9" y="6" width="6" height="12" rx="1.5"/>'),
    eyedrop: S('<path d="m2 22 1-1h3l9-9"/><path d="M3 21v-3l9-9"/><path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.9.9a2.1 2.1 0 1 1-3 3l-.9-.9"/>'),
  };
  function ICON(k) { return ICONS[k] || ""; }

  /* ---------------- constants ---------------- */
  var FACES = ["front", "back", "left", "right", "top", "bottom"];
  var FACE_VIEW = { front: [0, -6], back: [180, 0], left: [90, 0], right: [-90, 0], top: [0, -86], bottom: [0, 86] };
  var FONTS = Object.keys(GBX.FONTS);                       // full engine library, insertion order = curated order
  var FONT_CATS = [["classic", "Classic"], ["bold", "Bold"], ["fun", "Fun"], ["script", "Script"], ["tech", "Tech"], ["loud", "Loud"], ["dark", "Dark"]];
  function fontMeta(k) { return (GBX.FONT_META || {})[k] || { name: k, cat: "bold", vibe: [] }; }
  var LAYER_ICON = { text: "T", graffiti: "✎", stamp: "◈", note: "✉", label: "▤", sticker: "★", art: "▢", shape: "▰", frame: "⬚", qr: "▦", seal: "✦", postmark: "◉", barcode: "‖", decal: "❖", fade: "◧" };
  var LAYER_NAME = { sticker: "Glyph", decal: "Sticker", text: "Text", graffiti: "Graffiti", stamp: "Stamp", note: "Note", label: "Label", art: "Art", shape: "Shape", frame: "Photo frame", qr: "QR code", seal: "Seal", postmark: "Postmark", barcode: "Barcode", fade: "Fade" };
  var ADD_TYPES = ["text", "graffiti", "stamp", "note", "label", "sticker", "art", "shape", "frame", "qr", "fade", "seal", "postmark", "barcode"];
  var ELEMENT_SCALE = 0.8;   // owner tune (2026-06-11): freshly placed elements land ~20% smaller — scales size/w/h at place time (fades stay full-bleed; templates and existing docs untouched)
  var LAYER_DEFAULTS = {
    text: { t: "text", value: "Your text", x: .5, y: .5, w: .72, font: "display", size: .11, weight: 600, color: "#fde68a", align: "center", italic: true, rotate: 0, lineHeight: 1.05, letterSpacing: 0, style: "plain", outline1: "#ffffff", outline2: "#111111", effect: "none", effectColor: "#ffe066", curve: 0, fillKind: "solid", fill2: "#7c3aed", fillAngle: 135, finish: "none" },
    graffiti: { t: "graffiti", value: "note!", x: .5, y: .82, w: .6, font: "marker", size: .08, color: "#a7f3d0", rotate: -3, lineHeight: 1, letterSpacing: 0, style: "plain", outline1: "#ffffff", outline2: "#111111", effect: "none", effectColor: "#ffe066", curve: 0, fillKind: "solid", fill2: "#7c3aed", fillAngle: 135, finish: "none" },
    stamp: { t: "stamp", value: "FRAGILE", x: .78, y: .16, size: .06, color: "#ff5a5a", rotate: 8 },
    note: { t: "note", label: "a note", value: "see you soon", x: .5, y: .72, w: .6, color: "#fde68a", rotate: 0 },
    label: { t: "label", title: "PRIORITY", to: "To: friend", from: "From: you", x: .34, y: .5, w: .5, rotate: -5 },
    sticker: { t: "sticker", value: "★", x: .5, y: .5, size: .13, rotate: 0 },
    art: { t: "art", src: "", fit: "cover", zoom: 1, x: .5, y: .5, w: .55, h: .55, radius: .04, rotate: 0, brightness: 1, contrast: 1, saturate: 1, blur: 0, sepia: 0, outlineW: 0, outlineColor: "#ffffff", softShadow: 0 },
    seal: { t: "seal", value: "✦", x: .5, y: .45, size: .28, color: "#fde68a", rotate: 0 },
    postmark: { t: "postmark", value: "WRAPPED WITH CARE", x: .5, y: .4, size: .3, color: "#fde68a", rotate: -8 },
    barcode: { t: "barcode", color: "#fde68a", x: .5, y: .7, w: .5, rotate: 0 },
    fade: { t: "fade", kind: "linear", color: "#000000", angle: 0, opacity: 1, x: .5, y: .75, w: 1, h: .55, rotate: 0 },
    shape: { t: "shape", shape: "rect", fill: "#fde68a", fillKind: "solid", fill2: "#7c3aed", fillAngle: 135, stroke: "#111111", strokeW: 0, strokeStyle: "solid", radius: .12, x: .5, y: .5, w: .5, h: .2, opacity: 1, rotate: 0 },
    frame: { t: "frame", frame: "circle", src: "", stroke: "#ffffff", strokeW: 0, radius: .16, x: .5, y: .5, w: .42, h: .42, opacity: 1, rotate: 0 },
    qr: { t: "qr", value: "https://giiift.com/g/your-gift", ecc: "M", dark: "#11141b", light: "#ffffff", x: .5, y: .5, w: .4, opacity: 1, rotate: 0 },
  };
  var RG = function (min, max, step, unit) { return { k: "range", min: min, max: max, step: step, unit: unit || "" }; };
  var POS = [["x", RG(0, 1, .01)], ["y", RG(0, 1, .01)], ["rotate", RG(-180, 180, 1, "°")], ["anim", "anim"], ["blend", "blendkind"]];
  var BLEND_OPTS = [{ value: "normal", label: "Normal" }, { value: "multiply", label: "Multiply" }, { value: "screen", label: "Screen" }, { value: "overlay", label: "Overlay" }, { value: "soft-light", label: "Soft Light" }, { value: "hard-light", label: "Hard Light" }, { value: "darken", label: "Darken" }, { value: "lighten", label: "Lighten" }, { value: "color-dodge", label: "Color Dodge" }, { value: "color-burn", label: "Color Burn" }, { value: "difference", label: "Difference" }, { value: "exclusion", label: "Exclusion" }, { value: "hue", label: "Hue" }, { value: "saturation", label: "Saturation" }, { value: "color", label: "Color" }, { value: "luminosity", label: "Luminosity" }];
  var LAYER_FIELDS = {
    text: [["value", "text"], ["font", "font"], ["style", "textstyle"], ["finish", "textfinish"], ["size", RG(.02, .4, .005)], ["weight", RG(100, 900, 50)], ["lineHeight", RG(.7, 2.5, .05)], ["letterSpacing", RG(-.1, .6, .01, "em")], ["color", "color"], ["outline1", "color"], ["outline2", "color"], ["effect", "texteffect"], ["effectColor", "color"], ["curve", RG(-180, 180, 1, "°")], ["fillKind", "fillkind"], ["fill2", "color"], ["fillAngle", RG(0, 360, 1, "°")], ["align", "align"], ["italic", "bool"], ["w", RG(.05, 1, .01)]].concat(POS),
    graffiti: [["value", "text"], ["font", "font"], ["style", "textstyle"], ["finish", "textfinish"], ["size", RG(.02, .4, .005)], ["lineHeight", RG(.7, 2.5, .05)], ["letterSpacing", RG(-.1, .6, .01, "em")], ["color", "color"], ["outline1", "color"], ["outline2", "color"], ["effect", "texteffect"], ["effectColor", "color"], ["curve", RG(-180, 180, 1, "°")], ["fillKind", "fillkind"], ["fill2", "color"], ["fillAngle", RG(0, 360, 1, "°")], ["w", RG(.05, 1, .01)]].concat(POS),
    stamp: [["value", "text"], ["color", "color"], ["size", RG(.03, .16, .005)]].concat(POS),
    note: [["label", "text"], ["value", "textarea"], ["color", "color"], ["w", RG(.2, 1, .01)]].concat(POS),
    label: [["title", "text"], ["to", "text"], ["from", "text"], ["w", RG(.25, 1, .01)]].concat(POS),
    sticker: [["value", "text"], ["glyphs", "glyphgrid"], ["size", RG(.04, .3, .005)]].concat(POS),
    art: [["src", "text"], ["fit", "fit"], ["zoom", RG(1, 4, .05, "×")], ["opacity", RG(0, 1, .05)], ["look", "artlooks"], ["brightness", RG(0, 2, .05, "×")], ["contrast", RG(0, 2, .05, "×")], ["saturate", RG(0, 2, .05, "×")], ["blur", RG(0, .04, .002)], ["sepia", RG(0, 1, .05)], ["outlineW", RG(0, .05, .002)], ["outlineColor", "color"], ["softShadow", RG(0, 1, .05)], ["flipX", "bool"], ["flipY", "bool"], ["w", RG(.1, 1, .01)], ["h", RG(.1, 1, .01)], ["radius", RG(0, .5, .01)]].concat(POS),
    seal: [["value", "text"], ["color", "color"], ["size", RG(.08, .5, .01)]].concat(POS),
    postmark: [["value", "text"], ["color", "color"], ["size", RG(.08, .5, .01)]].concat(POS),
    barcode: [["color", "color"], ["w", RG(.1, 1, .01)]].concat(POS),
    decal: [["id", "decalid"], ["w", RG(.08, 1, .01)], ["h", RG(.08, 1, .01)]].concat(POS),
    fade: [["kind", "fadekind"], ["color", "color"], ["angle", RG(0, 360, 1, "°")], ["opacity", RG(0, 1, .05)], ["w", RG(.05, 1, .01)], ["h", RG(.05, 1, .01)]].concat(POS),
    shape: [["shape", "shapekind"], ["fill", "color"], ["fillKind", "fillkind"], ["fill2", "color"], ["fillAngle", RG(0, 360, 1, "°")], ["fillFade", "bool"], ["stroke", "color"], ["strokeW", RG(0, .06, .002)], ["strokeStyle", "strokestyle"], ["radius", RG(0, .5, .01)], ["opacity", RG(0, 1, .05)], ["flipX", "bool"], ["flipY", "bool"], ["w", RG(.02, 1, .01)], ["h", RG(.02, 1, .01)]].concat(POS),
    frame: [["frame", "framekind"], ["src", "framephoto"], ["stroke", "color"], ["strokeW", RG(0, .06, .002)], ["radius", RG(0, .5, .01)], ["opacity", RG(0, 1, .05)], ["w", RG(.05, 1, .01)], ["h", RG(.05, 1, .01)]].concat(POS),
    qr: [["value", "text"], ["ecc", "qrecc"], ["dark", "color"], ["transparentBg", "qrtransp"], ["light", "color"], ["opacity", RG(0, 1, .05)], ["w", RG(.15, 1, .01)]].concat(POS),
  };
  var SHAPE_OPTS = [{ value: "rect", label: "▭" }, { value: "ellipse", label: "●" }, { value: "line", label: "▬" }, { value: "triangle", label: "▲" }, { value: "star", label: "★" }, { value: "diamond", label: "◆" }, { value: "heart", label: "♥" }, { value: "arrow", label: "➤" }, { value: "bubble", label: "💬" }, { value: "burst", label: "✸" }, { value: "ribbon", label: "🔖" }];
  var FRAME_OPTS = [{ value: "circle", label: "●" }, { value: "rounded", label: "▢" }, { value: "rect", label: "▭" }, { value: "heart", label: "♥" }, { value: "star", label: "★" }, { value: "triangle", label: "▲" }, { value: "hexagon", label: "⬢" }, { value: "blob", label: "☁" }];
  var PRESETS = [
    { name: "Aurora", c1: "#7c3aed", c2: "#ec4899", accent: "#fde68a", finish: "gradient" },
    { name: "Mint", c1: "#059669", c2: "#34d399", accent: "#ecfeff", finish: "gradient" },
    { name: "Sunset", c1: "#f97316", c2: "#ef4444", accent: "#fff7ed", finish: "gradient" },
    { name: "Ocean", c1: "#0ea5e9", c2: "#6366f1", accent: "#e0f2fe", finish: "gradient" },
    { name: "Holo", c1: "#22d3ee", c2: "#a855f7", accent: "#f5f3ff", finish: "holo" },
    { name: "Noir", c1: "#374151", c2: "#111827", accent: "#9ca3af", finish: "matte" },
    { name: "Gold", c1: "#d97706", c2: "#fbbf24", accent: "#fffbeb", finish: "gradient" },
    { name: "Candy", c1: "#f472b6", c2: "#c084fc", accent: "#fdf4ff", finish: "gradient" },
  ];
  var STYLE_FONTS = ["display", "logo", "bebas", "anton", "archivo", "bangers", "luckiest", "titan", "pacifico", "abril", "cinzel", "orbitron", "bungee", "monoton", "righteous", "permanent", "fredoka", "playfair"];
  function pickRand(a) { return a[Math.floor(Math.random() * a.length)]; }
  function shuffleLook() {   // one-tap "look": random palette + finish + angle + a display font on every text layer
    var p = pickRand(PRESETS), f = pickRand(STYLE_FONTS);
    doc.palette.c1 = p.c1; doc.palette.c2 = p.c2; doc.palette.accent = p.accent; doc.palette.finish = p.finish; doc.palette.angle = pickRand([90, 120, 135, 160, 200]);
    FACES.forEach(function (pos) { ((doc.faces[pos] && doc.faces[pos].layers) || []).forEach(function (L) { if (L.t === "text" || L.t === "graffiti") L.font = f; }); });
    rerender(); record(); renderInspector(); announce("New look: " + p.name + " + " + (fontMeta(f).name || f));
  }
  var SWATCHES = ["#ffffff", "#0b1120", "#fde68a", "#f59e0b", "#ef4444", "#ec4899", "#a855f7", "#6366f1", "#0ea5e9", "#22d3ee", "#10b981", "#84cc16"];
  var TOOLS = [
    { id: "templates", title: "Templates", sub: "Start from a design", icon: "templates" },
    { id: "box", title: "Box", sub: "Colour, finish & shape", icon: "box" },
    { id: "faces", title: "Faces", sub: "Per-side colour & pattern", icon: "faces" },
    { id: "layers", title: "Layers", sub: "Text & elements", icon: "layers" },
    { id: "stickers", title: "Stickers", sub: "Drop a decal on a face", icon: "stickers" },
    { id: "panels", title: "Panels", sub: "Full-face wraps", icon: "panels" },
    { id: "gift", title: "Gift", sub: "Assets inside the box", icon: "gift" },
    { id: "code", title: "Code", sub: "Import / export JSON", icon: "code" },
  ];

  var STARTER = GBX.fromLegacy({
    brand: "Your Gift", sublabel: "A GIFT FOR YOU", note: "made with love", labelTo: "To: friend", from: "From: you",
    model: "Model: GF-001", qty: "Qty: 1", finish: "gradient", cardboard: "#7c3aed", cardboard2: "#ec4899", angle: 135, pattern: "dots", accent: "#fde68a",
    items: [{ ticker: "ETH" }],
  });

  /* ---------------- templates ---------------- */
  function tdoc(o) { return GBX.normalize(o); }
  var TEMPLATES = [
    { id: "cel-crate", name: "Cel Crate", desc: "Industrial full-face wrap", c1: "#3c4248", c2: "#22262a", motif: (window.GIIIFTBoxStickers && GIIIFTBoxStickers["ind-hazard"] ? GIIIFTBoxStickers["ind-hazard"].svg : ""),
      build: function () { return { palette: { c1: "#3c4248", c2: "#22262a", accent: "#ffcc00", angle: 135, finish: "matte" }, faces: { front: { panel: "cel-crate" } }, items: [{ ticker: "USDC" }] }; } },
    { id: "holographic", name: "Holographic", desc: "Iridescent foil wrap", c1: "#22d3ee", c2: "#a855f7", motif: (window.GIIIFTBoxStickers && GIIIFTBoxStickers["g-rare-star"] ? GIIIFTBoxStickers["g-rare-star"].svg : ""),
      build: function () { return { palette: { c1: "#22d3ee", c2: "#a855f7", accent: "#f5f3ff", angle: 135, finish: "holo" }, faces: { front: { panel: "holo" } }, items: [{ ticker: "SOL" }] }; } },
    { id: "parcel", name: "Parcel", desc: "Kraft paper & twine", c1: "#c9a472", c2: "#a87a48", motif: '<div style="font-size:30px">✉</div>',
      build: function () { return { palette: { c1: "#c9a472", c2: "#a87a48", accent: "#3a2a18", angle: 135, finish: "matte" }, faces: { front: { panel: "kraft" } }, items: [{ ticker: "USDC" }] }; } },
    { id: "manga", name: "Manga Box", desc: "Inked manga panel wrap", c1: "#7c3aed", c2: "#ec4899", motif: (GBX.panelSVG ? GBX.panelSVG("manga-front") : ""),
      build: function () {
        return {
          v: 2, shape: "mailer",
          palette: { c1: "#7c3aed", c2: "#ec4899", accent: "#fde68a", angle: 135, finish: "gradient" },
          faces: {
            front: { pos: "front", panel: "manga-front", pattern: "dots", layers: [], panelText: { title2: "FOR YOU" } },
            back: { pos: "back", panel: "manga-meta", pattern: "dots", layers: [] },
            left: { pos: "left", panel: "manga-saga", pattern: "dots", layers: [], panelText: { saga1: "YOUR SAGA" } },
            right: { pos: "right", panel: "manga-panels", pattern: "dots", layers: [], panelText: { fx: "KAYAAA!" } },
            top: { pos: "top", panel: "manga-panels", pattern: "dots", layers: [] },
            bottom: { pos: "bottom", panel: "manga-hero", pattern: "dots", layers: [] }
          },
          features: {}, items: [{ ticker: "ETH" }], meta: { brand: "Your Gift", serial: "" }
        };
      } },
    { id: "specimen", name: "Specimen Box", desc: "Sealed containment crate", c1: "#7c3aed", c2: "#ec4899", motif: (GBX.panelSVG ? GBX.panelSVG("cel-msg", { message: "DON'T OPEN" }) : ""),
      build: function () {
        return {
          v: 2, shape: "mailer",
          palette: { c1: "#7c3aed", c2: "#ec4899", accent: "#fde68a", angle: 135, finish: "gradient" },
          faces: {
            front: { pos: "front", panel: "cel-msg", panelText: { message: "DON'T OPEN" }, pattern: "dots", layers: [] },
            back: { pos: "back", panel: "cel-octo", pattern: "dots", layers: [] },
            left: { pos: "left", panel: "cel-banner", pattern: "dots", layers: [] },
            right: { pos: "right", panel: "cel-crate", pattern: "dots", layers: [] },
            top: { pos: "top", panel: "cel-side", pattern: "dots", layers: [] },
            bottom: { pos: "bottom", panel: "cel-side", pattern: "dots", layers: [] }
          },
          features: {}, items: [{ ticker: "ETH" }], meta: { brand: "Your Gift", serial: "" }
        };
      } },
    { id: "expedition", name: "Expedition Box", desc: "Vintage expedition crate", c1: "#7c3aed", c2: "#ec4899", motif: (GBX.panelSVG ? GBX.panelSVG("explorer-front") : ""),
      build: function () {
        return {
          v: 2, shape: "mailer",
          palette: { c1: "#7c3aed", c2: "#ec4899", accent: "#fde68a", angle: 135, finish: "gradient" },
          faces: {
            // front upgraded: the rich "Expedition Crate" hero (was explorer-msg, a plain note)
            front: { pos: "front", panel: "explorer-front", pattern: "dots", layers: [] },
            back: { pos: "back", panel: "explorer-side", pattern: "dots", layers: [] },
            left: { pos: "left", panel: "explorer-scan", panelText: { id: "DISCOVERY_" }, pattern: "dots", layers: [] },
            // the personal note kept, moved off the front
            right: { pos: "right", panel: "explorer-msg", pattern: "dots", layers: [] },
            top: { pos: "top", panel: "explorer-side", pattern: "dots", layers: [] },
            bottom: { pos: "bottom", panel: "explorer-side", pattern: "dots", layers: [] }
          },
          features: {}, items: [{ ticker: "ETH" }], meta: { brand: "Your Gift", serial: "" }
        };
      } },
  ];
  // Template gallery categories (occasion/type sections in the picker). New templates set their own `cat`; the map categorises the built-in wraps without editing their entries.
  var TPL_CATS = [["occasion", "Occasions"], ["seasonal", "Seasonal & holidays"], ["love", "Love & thanks"], ["crypto", "Crypto-native"], ["collector", "Collector & TCG"], ["style", "Wraps & styles"]];
  var TPL_CAT = { "cel-crate": "style", "holographic": "collector", "parcel": "style", "manga": "style", "specimen": "style", "expedition": "style" };
  function tplCat(t) { return t.cat || TPL_CAT[t.id] || "style"; }

  /* ---------------- state ---------------- */
  var doc = GBX.normalize(STARTER);
  var activeFace = "front", sel = null, selX = [], activeTool = "templates";   // selX: extra layer indices shift-clicked into the selection (same face as sel)
  var clip = [];                                     // internal layer clipboard (Cmd/Ctrl+C → +V): deep-cloned layers, session-scoped, pastes onto the active face
  var labVertical = null;                            // lab-only "Recommended for" override (preview only — never writes the global vertical state)
  var cutBase = {}, cutSeq = 0;                      // touch-up brush: pre-mask crops keyed by layer.cutId, so Restore can re-add what the AI over-cut (session-only, never persisted)
  var viewRot = FACE_VIEW.front.slice(), rotating = null;
  var faceTiles = {};
  var panelFamily = null;   // null = show the set list; else the open set id
  var mount, stage, inspBody;
  var history = [], hidx = -1;
  var zoom = 1, pendingFocus = null, statusNode, toastNode, toastT;
  var orbit = false, spaceDown = false, placeType = null, editingText = false, gesture = null, THRESH = 5;
  var flatMode = false;                                // unfold view: faces laid out as a 2D cross net
  var lastTapT = 0, lastTapX = 0, lastTapY = 0;        // own double-tap detection (panel SVG text isn't hit-testable, native dblclick is unreliable under the arbiter)
  var TAP_MS = 380, TAP_SLOP = 16;                     // looser on touch: fat fingers land farther apart
  try { if (matchMedia("(pointer:coarse)").matches) { TAP_MS = 420; TAP_SLOP = 28; } } catch (e) {}

  function selLayer() { return sel ? doc.faces[sel.face].layers[sel.li] : null; }
  function faceLayers() { return doc.faces[activeFace].layers; }
  function selAll() { return sel ? [sel.li].concat(selX) : []; }                 // anchor first
  function selLayers() { var f = sel && doc.faces[sel.face]; return f ? selAll().map(function (i2) { return f.layers[i2]; }).filter(Boolean) : []; }
  function isSel(face, li) { return !!sel && sel.face === face && (sel.li === li || selX.indexOf(li) >= 0); }
  function multiSel() { return !!sel && selX.length > 0; }

  /* ---------------- history ---------------- */
  function record() {
    var snap = JSON.stringify(doc);
    if (hidx >= 0 && history[hidx] === snap) return;
    history = history.slice(0, hidx + 1); history.push(snap); hidx = history.length - 1;
    if (history.length > 80) { history.shift(); hidx--; }
    refreshUndoUI(); saveDraft();
  }
  /* ---------------- autosave draft (reload insurance; presets stay the deliberate save) ---------------- */
  var DRAFT_KEY = "giiift-lab-draft", draftT = null;
  function saveDraft() {
    clearTimeout(draftT);
    draftT = setTimeout(function () { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ t: Date.now(), doc: doc })); } catch (e) {} }, 800);
  }
  function maybeRestoreDraft() {
    var raw = null; try { raw = localStorage.getItem(DRAFT_KEY); } catch (e) {}
    var draft = null; try { draft = raw && JSON.parse(raw); } catch (e) {}
    var d = draft && draft.doc;
    var hasWork = d && d.faces && FACES.some(function (k) { return d.faces[k] && ((d.faces[k].layers || []).length || d.faces[k].panel); });
    if (!hasWork || Date.now() - (draft.t || 0) > 7 * 864e5) return maybeCoach();
    // embedded in the wrap flow (M4): the wizard seeded this draft on purpose — restore silently
    if (document.documentElement.classList.contains("embed")) {
      closeOverlays();
      doc = GBX.normalize(d); activeFace = "front"; viewRot = FACE_VIEW.front.slice(); sel = null; selX = [];
      rerender(); record(); renderInspector(); refreshStageToolbar(); updateCrumb();
      return;
    }
    modal({
      title: "Restore your last session?",
      message: "An unsaved box from your last visit is still here.",
      okText: "Restore", cancelText: "Start fresh",
      onOk: function () {
        closeOverlays();
        doc = GBX.normalize(d); activeFace = "front"; viewRot = FACE_VIEW.front.slice(); sel = null; selX = [];
        rerender(); record(); renderInspector(); refreshStageToolbar(); updateCrumb();
        toast("Session restored");
      },
      onCancel: function () { maybeCoach(); }
    });
  }
  function undo() { if (hidx <= 0) return; hidx--; doc = JSON.parse(history[hidx]); afterHistory(); announce("Undone"); }
  function redo() { if (hidx >= history.length - 1) return; hidx++; doc = JSON.parse(history[hidx]); afterHistory(); announce("Redone"); }
  function afterHistory() {
    if (sel) { var f = doc.faces[sel.face]; if (!f || !f.layers[sel.li]) { sel = null; selX = []; } else selX = selX.filter(function (i2) { return !!f.layers[i2]; }); }
    rerender(); renderInspector(); refreshStageToolbar(); updateCrumb(); refreshUndoUI();
  }
  function refreshUndoUI() {
    var u = $("#tb-undo"), r = $("#tb-redo");
    if (u) u.disabled = hidx <= 0;
    if (r) r.disabled = hidx >= history.length - 1;
  }

  /* ---------------- core render ---------------- */
  function applyView() { var box = mount && mount.querySelector(".gbx-box"); if (box) box.style.transform = "rotateY(" + viewRot[0] + "deg) rotateX(" + viewRot[1] + "deg)"; }

  /* ---- hover preview: paint a candidate doc onto the box only; any real rerender restores ---- */
  var hoverPrev = { t: null, on: false };
  function clearHoverPreview() { clearTimeout(hoverPrev.t); hoverPrev.t = null; hoverPrev.on = false; }
  function previewBox(d) {
    var nd; try { nd = GBX.normalize(d); } catch (err) { return; }
    GBX.render(mount, nd, { mode: "edit", burst: false, flat: flatMode });
    var box = mount.querySelector(".gbx-box"); if (!box) return;
    box.style.transition = "none"; applyView();
    var sf = box.querySelector('.gbx-face[data-pos="' + activeFace + '"]'); if (sf) sf.dataset.active = "1";
  }
  // getDoc is called lazily on hover; the real doc is never touched, so restore = rerender()
  function armHoverPreview(node, getDoc) {
    var canHover; try { canHover = matchMedia("(hover:hover)").matches; } catch (e) { canHover = false; }
    if (!canHover) return;
    node.addEventListener("mouseenter", function () {
      if (editingText || gesture || placeType) return;
      clearTimeout(hoverPrev.t);
      hoverPrev.t = setTimeout(function () { hoverPrev.on = true; previewBox(getDoc()); }, 140);
    });
    node.addEventListener("mouseleave", function () {
      clearTimeout(hoverPrev.t); hoverPrev.t = null;
      if (hoverPrev.on) rerender();                            // rerender() clears the flag
    });
  }

  function rerender() {
    clearHoverPreview();
    GBX.render(mount, doc, { mode: "edit", burst: false, flat: flatMode });
    var box = mount.querySelector(".gbx-box");
    box.style.transition = reducedMotion() ? "none" : "transform .45s cubic-bezier(.5,.02,.2,1)";
    applyView();
    var sf = box.querySelector('.gbx-face[data-pos="' + activeFace + '"]'); if (sf) sf.dataset.active = "1";
    markSelection();
    refreshFaceNet();
    refreshFaceStrip();
    syncJson();
  }
  // Box pointer interaction is delegated to a single capture-based arbiter bound once
  // to the persistent #stage (see bindStage). No per-node listeners to rebind on render.
  function markSelection() {
    var box = mount.querySelector(".gbx-box"); if (!box) return;
    box.querySelectorAll(".gbx-sel").forEach(function (e) { e.classList.remove("gbx-sel"); });
    box.querySelectorAll(".gbx-rs, .gbx-rot").forEach(function (e) { e.remove(); });
    if (sel && sel.face === activeFace) {
      selAll().forEach(function (li2) {
        var m2 = box.querySelector('[data-face="' + sel.face + '"][data-li="' + li2 + '"]');
        if (m2) m2.classList.add("gbx-sel");
      });
      var n = box.querySelector('[data-face="' + sel.face + '"][data-li="' + sel.li + '"]');
      var anchorL = doc.faces[sel.face].layers[sel.li];
      if (n && !(anchorL && anchorL.locked)) {                // a locked layer exposes no transform handles
        var rot = el("div", "gbx-rot"); rot.title = multiSel() ? "Drag to rotate the group" : "Drag to rotate"; rot.setAttribute("aria-hidden", "true"); n.appendChild(rot);
        var h = el("div", "gbx-rs"); h.title = multiSel() ? "Drag to resize the group" : "Drag to resize"; h.setAttribute("aria-hidden", "true"); n.appendChild(h);
      }
    }
  }

  // (layer move / resize / element-rotate now live in the pointer arbiter below)
  function inlineEdit(n, fresh) {                        // fresh = element was just created by this double-tap
    if (n.dataset.li == null) return;
    var face = n.dataset.face, li = +n.dataset.li;
    var L = doc.faces[face].layers[li];
    if (L.t !== "text" && L.t !== "graffiti") return;
    editingText = true;                                  // lock rotate/drag while typing
    var original = L.value || "", cancelled = false;
    n.contentEditable = "true"; n.focus();
    var r = document.createRange(); r.selectNodeContents(n); var s = getSelection(); s.removeAllRanges(); s.addRange(r);
    function onKey(e) {
      if (e.key === "Enter" && (e.shiftKey || e.metaKey || e.ctrlKey)) { e.preventDefault(); n.blur(); }   // ⇧/⌘-Enter finishes
      else if (e.key === "Enter") { e.preventDefault(); document.execCommand("insertText", false, "\n"); } // Enter = new line
      else if (e.key === "Escape") { e.preventDefault(); cancelled = true; n.textContent = original; n.blur(); }  // Esc cancels
      e.stopPropagation();
    }
    n.addEventListener("keydown", onKey);
    n.addEventListener("blur", function (ev) {
      n.removeEventListener("keydown", onKey);
      var val = (n.innerText != null ? n.innerText : n.textContent).replace(/\n$/, "").slice(0, 160);   // innerText keeps the line breaks
      n.contentEditable = "false"; editingText = false;
      var headedTo = ev && ev.relatedTarget;
      if (fresh && (cancelled || !val.trim())) {         // cancelled / left-empty creation: take it back out
        if (hidx > 0 && hidx === history.length - 1) { history.pop(); hidx--; doc = JSON.parse(history[hidx]); }
        else { var fl = doc.faces[face]; if (fl && fl.layers[li]) fl.layers.splice(li, 1); }
        sel = null; afterHistory();
        announce("Text cancelled"); restoreStageFocus(headedTo);
        return;
      }
      L.value = val;
      rerender(); record(); updateCrumb(); if (sel) renderInspector();
      restoreStageFocus(headedTo);
    }, { once: true });
  }
  // After an inline edit ends with Enter/Esc, focus drops to <body>; bring it back to the stage so
  // keyboard flow continues. When the edit ended because the user clicked another control
  // (blur's relatedTarget is set), leave focus alone.
  function restoreStageFocus(headedTo) {
    if (headedTo) return;
    setTimeout(function () { var a = document.activeElement; if ((!a || a === document.body) && stage) stage.focus(); }, 0);
  }

  /* ---------------- selection / face ---------------- */
  function nearYaw(target, current) {                  // equivalent angle closest to where we already are (no unwinding spins)
    var t = target;
    while (t - current > 180) t -= 360;
    while (current - t > 180) t += 360;
    return t;
  }
  function setActiveFace(pos) {
    var tgt = FACE_VIEW[pos], ty = nearYaw(tgt[0], viewRot[0]);
    // only skip when the VIEW is already there too — arrow keys rotate without changing
    // activeFace, and early-returning on the name alone left this face's button dead
    if (activeFace === pos && Math.abs(viewRot[0] - ty) < .5 && Math.abs(viewRot[1] - tgt[1]) < .5) return;
    activeFace = pos; viewRot = [ty, tgt[1]];
    if (sel && sel.face !== pos) { sel = null; selX = []; }
    rerender(); renderInspector(); refreshStageToolbar(); updateCrumb();
  }
  function selectLayer(face, li, additive) {
    if (additive && face != null && sel && sel.face === face && face === activeFace) {
      if (sel.li === li) { if (selX.length) sel.li = selX.shift(); else sel = null; }   // shift-click the anchor: drop it
      else { var ix = selX.indexOf(li); if (ix >= 0) selX.splice(ix, 1); else selX.push(li); }
      markSelection(); renderInspector(); refreshStageToolbar(); updateCrumb();
      announce(sel ? selAll().length + " selected" : "Selection cleared");
      return;
    }
    if (face != null && face !== activeFace) setActiveFace(face);
    sel = (face == null) ? null : { face: face, li: li }; selX = [];
    if (sel) {                                                 // persistent groups: selecting a member selects the group (shift-click still reaches one member)
      var gL = (doc.faces[face].layers || [])[li];
      if (gL && gL.grp != null) selX = grpMembers(face, gL.grp).filter(function (i) { return i !== li; });
    }
    markSelection(); renderInspector(); refreshStageToolbar(); updateCrumb();
  }
  function updateCrumb() {
    var c = $("#crumb"); if (!c) return;
    var face = '<span class="seg2">' + cap(activeFace) + "</span> face";
    if (sel && multiSel()) { c.innerHTML = face + '<span class="chev">›</span><span class="seg2">' + selAll().length + " elements</span>"; }
    else if (sel) { var L = selLayer(); var lbl = L.value || L.title || L.label || (LAYER_NAME[L.t] || L.t); c.innerHTML = face + '<span class="chev">›</span><span class="seg2">' + esc(String(lbl).slice(0, 22)) + "</span>"; }
    else c.innerHTML = face;
  }

  /* ---------------- actions ---------------- */
  function scaledDefaults(type) {                              // ELEMENT_SCALE tune on every add path; fades stay full-bleed scrims
    var o = clone(LAYER_DEFAULTS[type]);
    if (type !== "fade") {
      if (o.size != null) o.size = +(o.size * ELEMENT_SCALE).toFixed(3);
      if (o.w != null) o.w = +(o.w * ELEMENT_SCALE).toFixed(3);
      if (o.h != null) o.h = +(o.h * ELEMENT_SCALE).toFixed(3);
    }
    return o;
  }
  function addLayer(type) {
    var L = faceLayers(); L.push(scaledDefaults(type));
    selectLayer(activeFace, L.length - 1); rerender(); record();
    announce((LAYER_NAME[type] || type) + " added to the " + activeFace + " face");
  }
  function addDecal(id) {
    var s = GBX.STICKERS[id]; if (!s) return;
    var w = +(.34 * ELEMENT_SCALE).toFixed(3), h = +(w / (s.ar || 1)).toFixed(3);
    var L = faceLayers(); L.push({ t: "decal", id: id, x: .5, y: .5, w: w, h: h, rotate: 0 });
    selectLayer(activeFace, L.length - 1); rerender(); record();
    announce((s.name || "Sticker") + " added");
  }
  function applyPanel(id) {
    if (!GBX.PANELS[id]) return; var f = doc.faces[activeFace];
    f.panel = id; delete f.panelText; delete f.panelScale;     // layers stay: panels are the base, compositions ride on top
    pendingFocus = "panel-" + id; rerender(); record(); renderInspector();
    var kept = (f.layers || []).length;
    if (kept) toast((GBX.PANELS[id].name || "Panel") + " applied under your " + kept + " layer" + (kept > 1 ? "s" : ""));
    announce((GBX.PANELS[id].name || "Panel") + " applied to the " + activeFace + " face" + (kept ? ", keeping " + kept + " layers" : ""));
  }
  function clearPanel() { delete doc.faces[activeFace].panel; delete doc.faces[activeFace].panelText; delete doc.faces[activeFace].panelScale; rerender(); record(); renderInspector(); announce("Panel cleared from the " + activeFace + " face"); }
  function panelFamilies() {
    var sets = window.GIIIFTBoxPanelSets || [], all = GBX.PANELS;
    return sets.map(function (s) {
      var members = Object.keys(all).filter(function (k) { return all[k].family === s.id; });
      var fronts = members.filter(function (k) { return all[k].group !== "side"; });
      var sides = members.filter(function (k) { return all[k].group === "side"; });
      var msgFront = fronts.find(function (k) { return (all[k].fields || []).some(function (f) { return f.key === "message"; }); });
      return { id: s.id, name: s.name, desc: s.desc, members: members, front: msgFront || fronts[0] || members[0], side: sides[0] || null, sides: sides };
    }).filter(function (f) { return f.members.length; });
  }
  // Spread ALL side designs across the non-front faces (visible faces first), cycling if there are fewer sides than faces.
  function dressDoc(d, fam) {
    var sides = (fam.sides && fam.sides.length) ? fam.sides : (fam.side ? [fam.side] : []);
    var order = ["front", "right", "top", "left", "back", "bottom"], si = 0;
    order.forEach(function (face) {
      if (!d.faces[face]) return;
      var pid = (face === "front") ? (fam.front || sides[0]) : (sides.length ? sides[(si++) % sides.length] : fam.front);
      if (pid) { d.faces[face].panel = pid; delete d.faces[face].panelText; delete d.faces[face].panelScale; }   // layers survive a dress too
    });
    return d;
  }
  function applyPanelSet(familyId) {
    var fam = panelFamilies().find(function (f) { return f.id === familyId; }); if (!fam) return;
    dressDoc(doc, fam);
    rerender(); record(); renderInspector(); refreshStageToolbar(); updateCrumb();
    announce(fam.name + " applied across all faces");
  }
  var styleClip = null;                                        // format painter clipboard: { fam, props }
  var STYLE_FAMS = {                                           // what "style" means per family (never position/rotation/content)
    text: ["font", "size", "weight", "color", "italic", "lineHeight", "letterSpacing", "align", "style", "outline1", "outline2", "effect", "effectColor", "curve", "fillKind", "fill2", "fillAngle", "finish"],
    shape: ["fill", "fillKind", "fill2", "fillAngle", "fillFade", "stroke", "strokeW", "strokeStyle", "radius", "opacity"],
    art: ["brightness", "contrast", "saturate", "blur", "sepia", "opacity", "outlineW", "outlineColor", "softShadow", "radius", "noShadow"],
  };
  function styleFam(t) { return (t === "text" || t === "graffiti") ? "text" : (t === "shape" || t === "art") ? t : null; }
  function copyStyle() {
    var L = selLayer(); if (!L) return;
    var fam = styleFam(L.t); if (!fam) { toast("This element type has no copyable style", true); return; }
    var props = {}; STYLE_FAMS[fam].forEach(function (p) { if (L[p] !== undefined) props[p] = L[p]; });
    styleClip = { fam: fam, props: props };
    toast("Style copied — select another element, then Paste style (⌥⌘V)"); announce("Style copied");
  }
  function pasteStyle() {
    if (!styleClip) { toast("Copy a style first (⌥⌘C)", true); return; }
    var n = 0;
    selLayers().forEach(function (L) {
      if (styleFam(L.t) !== styleClip.fam) return;
      Object.keys(styleClip.props).forEach(function (p) { L[p] = styleClip.props[p]; });
      n++;
    });
    if (!n) { toast("Select a " + styleClip.fam + " element to paste onto", true); return; }
    rerender(); record(); renderInspector(); toast("Style pasted"); announce("Style pasted to " + n + " element" + (n > 1 ? "s" : ""));
  }
  function grpMembers(face, gid) { var out = []; ((doc.faces[face] || {}).layers || []).forEach(function (Lr, i) { if (Lr && Lr.grp === gid) out.push(i); }); return out; }
  function nextGrpId() { var m = 0; FACES.forEach(function (f) { ((doc.faces[f] || {}).layers || []).forEach(function (Lr) { if (Lr && typeof Lr.grp === "number" && Lr.grp > m) m = Lr.grp; }); }); return m + 1; }
  function groupSel() {                                        // ⌘G: a persistent group — clicking any member selects them all (editor-only field, dropped on export like `locked`)
    if (!multiSel()) { toast("Select 2+ elements to group (shift-click or marquee)", true); return; }
    var id = nextGrpId(), L = doc.faces[sel.face].layers;
    selAll().forEach(function (i) { if (L[i]) L[i].grp = id; });
    record(); renderInspector(); toast("Grouped — click any member to grab the whole group");
    announce(selAll().length + " elements grouped");
  }
  function ungroupSel() {                                      // ⇧⌘G
    if (!sel) return; var L = doc.faces[sel.face].layers, n = 0;
    selAll().forEach(function (i) { if (L[i] && L[i].grp != null) { delete L[i].grp; n++; } });
    if (n) { record(); renderInspector(); toast("Ungrouped"); announce("Ungrouped"); }
  }
  function regroupClones(clones) {                             // duplicated/pasted members form NEW groups (same partitions, fresh ids)
    var base2 = nextGrpId(), remap = {};
    clones.forEach(function (c2) { if (c2.grp != null) { if (remap[c2.grp] == null) remap[c2.grp] = base2 + Object.keys(remap).length; c2.grp = remap[c2.grp]; } });
  }
  function dupSel() {
    if (!sel) return; var L = doc.faces[sel.face].layers;
    if (multiSel()) {                                          // clones land on top, as the new selection
      var idxs = selAll().slice().sort(function (a, b) { return a - b; });
      var clones = idxs.map(function (i2) { var c2 = clone(L[i2]); if (c2.x != null) c2.x = clamp01(c2.x + .04); if (c2.y != null) c2.y = clamp01(c2.y + .04); return c2; });
      regroupClones(clones);
      var base = L.length; clones.forEach(function (c2) { L.push(c2); });
      sel.li = base; selX = clones.slice(1).map(function (_, k) { return base + 1 + k; });
      rerender(); record(); renderInspector(); refreshStageToolbar(); updateCrumb();
      announce(clones.length + " elements duplicated"); return;
    }
    var c = clone(L[sel.li]); if (c.grp != null) delete c.grp;   // a lone clone leaves the group
    if (c.x != null) c.x = clamp01(c.x + .04); if (c.y != null) c.y = clamp01(c.y + .04);
    L.splice(sel.li + 1, 0, c); sel.li += 1; rerender(); record(); renderInspector(); refreshStageToolbar(); updateCrumb();
  }
  function delSel() {
    if (!sel) return;
    var L = doc.faces[sel.face].layers;
    var idxs = selAll().slice().sort(function (a, b) { return b - a; });
    idxs.forEach(function (i2) { L.splice(i2, 1); });
    sel = null; selX = [];
    rerender(); record(); renderInspector(); refreshStageToolbar(); updateCrumb();
    announce(idxs.length > 1 ? idxs.length + " elements deleted" : "Element deleted"); focusActiveTool();
  }
  function moveSel(dir) { // dir +1 forward (up in z), -1 back — moves the whole selection as a block
    if (!sel) return; var L = doc.faces[sel.face].layers;
    var set = selAll().slice().sort(function (a, b) { return a - b; });
    var inSet = {}; set.forEach(function (i2) { inSet[i2] = 1; });
    var order = dir > 0 ? set.slice().reverse() : set, moved = false;
    order.forEach(function (i2) {
      var j = i2 + dir;
      if (j < 0 || j >= L.length || inSet[j]) return;          // edge, or blocked by another member: the block holds shape
      var t = L[i2]; L[i2] = L[j]; L[j] = t;
      delete inSet[i2]; inSet[j] = 1; moved = true;
      if (sel.li === i2) sel.li = j; else { var xi = selX.indexOf(i2); if (xi >= 0) selX[xi] = j; }
    });
    if (!moved) return;
    rerender(); record(); renderInspector(); refreshStageToolbar();
  }
  // ---- clipboard: copy the current selection, paste clones onto the active face ----
  // Internal (not the OS clipboard) so it round-trips full layer objects, incl. art data-URIs.
  // Works cross-face: copy on one face, switch faces, paste.
  function copySel() {
    if (!sel) return;
    var L = doc.faces[sel.face].layers;
    var idxs = selAll().slice().sort(function (a, b) { return a - b; });
    clip = idxs.map(function (i2) { return clone(L[i2]); });
    announce(clip.length > 1 ? clip.length + " elements copied" : "Element copied");
  }
  function pasteClip() {
    if (!clip || !clip.length) return;
    var L = faceLayers(); var base = L.length;
    var made = clip.map(function (c2) { var n = clone(c2); if (n.x != null) n.x = clamp01(n.x + .04); if (n.y != null) n.y = clamp01(n.y + .04); return n; });
    regroupClones(made);
    made.forEach(function (n) { L.push(n); });
    sel = { face: activeFace, li: base }; selX = made.slice(1).map(function (_, k) { return base + 1 + k; });   // pasted clones land selected, on top
    rerender(); record(); renderInspector(); refreshStageToolbar(); updateCrumb();
    announce(made.length > 1 ? made.length + " elements pasted" : "Element pasted");
  }
  // ---- layers-overview row actions: reorder / duplicate WITHOUT leaving the list ----
  // The overview only shows while nothing is selected, so these act on a single row and
  // re-render the list in place (you nudge or duplicate the same layer many times in a row).
  function relist(li, focusWhich) {
    renderInspector();                                 // sel is null here → re-renders the layer overview
    if (!inspBody) return;
    var row = inspBody.querySelector('.lyr[data-li="' + li + '"]');
    if (!row) return;
    row.classList.add("just-bumped");
    var btn = focusWhich && row.querySelector("[data-" + focusWhich + "]");
    if (btn) { try { btn.focus(); } catch (e) {} }     // keep focus on the moved row's button so it can be pressed again
    try { row.scrollIntoView({ block: "nearest" }); } catch (e) {}
  }
  function nudgeInList(i, dir, which) {                 // dir +1 = bring forward (up the stack), -1 = send back
    var L = faceLayers(); var j = i + dir;
    if (j < 0 || j >= L.length) return;
    var t = L[i]; L[i] = L[j]; L[j] = t;
    rerender(); record(); relist(j, which);
  }
  function dupLayerInList(i) {
    var L = faceLayers(); if (i < 0 || i >= L.length) return;
    var c = clone(L[i]); if (c.grp != null) delete c.grp;       // a lone clone leaves the group
    if (c.x != null) c.x = clamp01(c.x + .04); if (c.y != null) c.y = clamp01(c.y + .04);
    L.splice(i + 1, 0, c);
    rerender(); record(); relist(i + 1, "dup");
    announce("Element duplicated");
  }
  function applyTemplate(id) {
    var t = TEMPLATES.find(function (x) { return x.id === id; }); if (!t) return;
    closeOverlays();
    doc = tdoc(t.build()); activeFace = "front"; viewRot = FACE_VIEW.front.slice(); sel = null;
    rerender(); record(); setTool("box"); announce(t.name + " template applied");
  }
  function closeOverlays() { var pe = $(".panel-edit"); if (pe) pe.remove(); editingText = false; }   // bail out of any open text editor before replacing the doc
  function resetDoc() { closeOverlays(); doc = GBX.normalize(STARTER); activeFace = "front"; viewRot = FACE_VIEW.front.slice(); sel = null; rerender(); record(); renderInspector(); refreshStageToolbar(); updateCrumb(); announce("Box reset"); }

  /* ---------------- saved presets (user templates, persisted to localStorage) ---------------- */
  var PRESET_KEY = "giiift-lab-presets";
  function loadPresets() { try { return JSON.parse(localStorage.getItem(PRESET_KEY)) || []; } catch (e) { return []; } }
  function savePresets(a) { try { localStorage.setItem(PRESET_KEY, JSON.stringify(a)); } catch (e) {} }
  function saveCurrentAsPreset() {
    var def = (doc.meta && doc.meta.brand) || (doc.faces.front && doc.faces.front.panel) || "My box";
    modal({
      title: "Save preset", message: "Save the current box, panels and all, to reuse it as a template.",
      input: true, value: def, okText: "Save",
      onOk: function (name) {
        name = (name || "").trim() || "Preset";
        var a = loadPresets();
        a.push({ id: "p" + Date.now().toString(36), name: name, doc: JSON.parse(JSON.stringify(doc)) });
        savePresets(a);
        setTool("templates");                        // re-render the tab so the new preset shows
        toast("Preset saved");
      }
    });
  }
  function applyPreset(p) {
    closeOverlays();
    doc = GBX.normalize(p.doc); activeFace = "front"; viewRot = FACE_VIEW.front.slice(); sel = null;
    rerender(); record(); setTool("box");
  }
  function deletePreset(id) { savePresets(loadPresets().filter(function (p) { return p.id !== id; })); setTool("templates"); }

  /* ---------------- field components ---------------- */
  function fmtNum(v, rg) { v = +v; if (rg.step >= 1) return Math.round(v); if (rg.step >= .1) return v.toFixed(1); if (rg.step >= .01) return v.toFixed(2); return v.toFixed(3); }
  function field(labelText) { var f = el("div", "field"); var l = el("div", "field-lbl"); l.innerHTML = "<span>" + labelText + "</span>"; f.appendChild(l); return { f: f, l: l }; }
  function numField(labelText, get, set, rg) {
    var w = field(labelText);
    var row = el("div", "num");
    var slider = el("input"); slider.type = "range"; slider.min = rg.min; slider.max = rg.max; slider.step = rg.step; slider.value = get();
    var st = el("div", "stepper");
    var minus = el("button"); minus.type = "button"; minus.textContent = "−";
    var inp = el("input"); inp.type = "number"; inp.min = rg.min; inp.max = rg.max; inp.step = rg.step; inp.value = fmtNum(get(), rg);
    var plus = el("button"); plus.type = "button"; plus.textContent = "+";
    st.append(minus, inp, plus); if (rg.unit) { var u = el("span", "unit"); u.textContent = rg.unit; st.appendChild(u); }
    row.append(slider, st); w.f.appendChild(row);
    function show(v) { slider.value = v; inp.value = fmtNum(v, rg); }
    slider.addEventListener("input", function () { var v = +slider.value; inp.value = fmtNum(v, rg); set(v, false); });
    slider.addEventListener("change", function () { set(+slider.value, true); });
    inp.addEventListener("input", function () { var v = parseFloat(inp.value); if (isNaN(v)) return; v = clamp(v, rg.min, rg.max); slider.value = v; set(v, false); });
    inp.addEventListener("change", function () { var v = clamp(parseFloat(inp.value) || rg.min, rg.min, rg.max); show(v); set(v, true); });
    minus.addEventListener("click", function () { var v = clamp((+slider.value) - rg.step, rg.min, rg.max); show(v); set(v, true); });
    plus.addEventListener("click", function () { var v = clamp((+slider.value) + rg.step, rg.min, rg.max); show(v); set(v, true); });
    return w.f;
  }
  function docColors() {
    // every colour currently on the box — palette, then face fill overrides, then layer colours — deduped, doc order
    var out = [], seen = {};
    var add = function (c) { if (typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)) { var k = c.toLowerCase(); if (!seen[k]) { seen[k] = 1; out.push(c); } } };
    add(doc.palette.c1); add(doc.palette.c2); add(doc.palette.accent);
    FACES.forEach(function (k) {
      var f = doc.faces[k]; if (!f) return;
      if (f.fill) { add(f.fill.c1); add(f.fill.c2); add(f.fill.accent); }
      (f.layers || []).forEach(function (L) { add(L.color); });
    });
    return out;
  }
  function colorField(labelText, get, set, withSwatches) {
    var w = field(labelText);
    var row = el("div", "color");
    var sw = el("input"); sw.type = "color"; sw.className = "sw"; sw.value = get();
    var hex = el("input"); hex.className = "hex"; hex.value = get(); hex.spellcheck = false; hex.maxLength = 7;
    row.append(sw, hex);
    function pick(c) { sw.value = c; hex.value = c; set(c, true); }
    if (typeof window.EyeDropper === "function") {
      // Chromium eyedropper: sample any rendered pixel (panel art, photos, other faces — Unfold shows all six at once)
      var eye = el("button", "eyedrop"); eye.type = "button"; eye.innerHTML = ICON("eyedrop");
      eye.title = "Pick a colour from the box · tip: Unfold (U) shows every face";
      eye.setAttribute("aria-label", "Eyedropper: sample a colour from the screen");
      eye.addEventListener("click", function () {
        new window.EyeDropper().open().then(function (r) { if (r && r.sRGBHex) pick(r.sRGBHex); }).catch(function () { /* Esc = cancelled */ });
      });
      row.appendChild(eye);
    }
    w.f.appendChild(row);
    function valid(v) { if (v && v[0] !== "#") v = "#" + v; return /^#[0-9a-fA-F]{6}$/.test(v) ? v : null; }
    sw.addEventListener("input", function () { hex.value = sw.value; set(sw.value, false); });
    sw.addEventListener("change", function () { set(sw.value, true); });
    hex.addEventListener("input", function () { var v = valid(hex.value.trim()); if (v) { sw.value = v; set(v, false); } });
    hex.addEventListener("change", function () { var v = valid(hex.value.trim()); if (v) { sw.value = v; hex.value = v; set(v, true); } else { sw.value = get(); hex.value = get(); } });
    if (withSwatches) {
      var mine = docColors();
      if (mine.length) {
        var dh = el("div", "sw-h"); dh.textContent = "On this box";
        var ds = el("div", "swatches"); ds.setAttribute("role", "group"); ds.setAttribute("aria-label", labelText + ": colours already on this box");
        mine.slice(0, 14).forEach(function (c) { var ch = el("button", "ch"); ch.type = "button"; ch.style.background = c; ch.title = c + " · already on this box"; ch.setAttribute("aria-label", "Use box colour " + c); ch.addEventListener("click", function () { pick(c); }); ds.appendChild(ch); });
        w.f.append(dh, ds);
      }
      var sws = el("div", "swatches"); sws.setAttribute("role", "group"); sws.setAttribute("aria-label", labelText + " swatches"); SWATCHES.forEach(function (c) { var ch = el("button", "ch"); ch.type = "button"; ch.style.background = c; ch.title = c; ch.setAttribute("aria-label", "Use colour " + c); ch.addEventListener("click", function () { pick(c); }); sws.appendChild(ch); });
      if (mine.length) { var gh = el("div", "sw-h"); gh.textContent = "Quick colours"; w.f.appendChild(gh); }
      w.f.appendChild(sws);
    }
    return w.f;
  }
  function fontField(labelText, get, set) {
    // grouped gallery — every chip renders in its own face so the picker IS the preview
    var w = field(labelText);
    var gal = el("div", "fontgal");
    FONT_CATS.forEach(function (c) {
      var keys = FONTS.filter(function (k) { return fontMeta(k).cat === c[0]; });
      if (!keys.length) return;
      var h = el("div", "sw-h"); h.textContent = c[1]; gal.appendChild(h);
      var grid = el("div", "fontgrid");
      keys.forEach(function (k) {
        var m = fontMeta(k);
        var b = el("button", "font-chip" + (get() === k ? " on" : "")); b.type = "button"; b.title = m.name; b.dataset.fkey = "font-" + k;
        b.innerHTML = '<span class="fc-aa" style="font-family:' + GBX.FONTS[k].replace(/"/g, "&quot;") + '">Aa</span><span class="fc-nm">' + esc(m.name) + "</span>";
        b.setAttribute("aria-pressed", get() === k ? "true" : "false");
        b.addEventListener("click", function () {
          set(k);
          gal.querySelectorAll(".font-chip").forEach(function (x) { var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on ? "true" : "false"); });
        });
        grid.appendChild(b);
      });
      gal.appendChild(grid);
    });
    w.f.appendChild(gal);
    return w.f;
  }
  function textField(labelText, get, set, opts) {
    opts = opts || {}; var w = field(labelText);
    var inp = el(opts.area ? "textarea" : "input", "txt"); if (!opts.area) inp.type = "text";
    inp.value = get() || ""; if (opts.placeholder) inp.placeholder = opts.placeholder;
    inp.addEventListener("input", function () { set(inp.value, false); });
    inp.addEventListener("change", function () { set(inp.value, true); });
    w.f.appendChild(inp); return w.f;
  }
  function segField(labelText, options, get, set, ariaLabel) {
    var w = labelText ? field(labelText) : { f: el("div", "field") };
    var seg = el("div", "seg"); seg.setAttribute("role", "group"); var al = labelText || ariaLabel; if (al) seg.setAttribute("aria-label", al);
    options.forEach(function (o) {
      var b = el("button"); b.type = "button"; b.dataset.v = o.value; b.appendChild(document.createTextNode(o.label));
      if (o.disabled) { b.disabled = true; b.setAttribute("aria-label", o.label + " (coming soon)"); } if (o.badge) { var s2 = el("span", "badge"); s2.textContent = o.badge; b.appendChild(s2); }
      b.addEventListener("click", function () { if (o.disabled) return; set(o.value); paint(); });
      seg.appendChild(b);
    });
    function paint() { seg.querySelectorAll("button").forEach(function (b) { var on = b.dataset.v === String(get()); b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); }); }
    paint(); w.f.appendChild(seg); return w.f;
  }
  function toggleField(labelText, get, set, key) {
    var row = el("div", "toggle"); var l = el("span", "lbl"); l.textContent = labelText;
    var t = el("button", "sw-toggle"); t.type = "button"; t.setAttribute("role", "switch"); t.setAttribute("aria-label", labelText);
    t.setAttribute("aria-checked", get() ? "true" : "false"); t.classList.toggle("on", !!get());
    if (key) t.setAttribute("data-fkey", key);
    t.addEventListener("click", function () { set(!get()); var on = !!get(); t.classList.toggle("on", on); t.setAttribute("aria-checked", on ? "true" : "false"); });
    row.append(l, t); return row;
  }
  function group(title, note) { var g = el("div", "grp"); if (title) { var h = el("h3", "grp-h"); h.textContent = title; g.appendChild(h); } if (note) { var n = el("div", "grp-note"); n.textContent = note; g.appendChild(n); } return g; }
  function emptyState(icon, t, s) { var e = el("div", "empty"); e.innerHTML = '<div class="e-ic">' + icon + '</div><div class="e-t">' + esc(t) + '</div><div class="e-s">' + esc(s) + "</div>"; return e; }

  /* ---------------- inspector dispatch ---------------- */
  var TOOL_RENDER = { templates: toolTemplates, box: toolBox, faces: toolFaces, layers: toolLayers, stickers: toolStickers, panels: toolPanels, gift: toolGift, code: toolCode };
  function renderInspector() {
    var insp = $("#inspector");
    var ae = document.activeElement;
    var savedFocus = (inspBody && ae && inspBody.contains(ae) && ae.getAttribute && ae.getAttribute("data-fkey")) || pendingFocus;
    insp.innerHTML = "";
    var head = el("div", "insp-head"); var body = el("div", "insp-body");
    head.appendChild(el("div", "sheet-grip"));
    var title, sub, icon, back = false;
    if (sel && multiSel()) { title = selAll().length + " elements"; sub = "selected on the " + sel.face + " face"; icon = ICON("layers"); back = true; }
    else if (sel) { var L = selLayer(); title = (LAYER_NAME[L.t] || L.t); sub = "on the " + sel.face + " face"; icon = ICON("props"); back = true; }
    else { var t = TOOLS.find(function (x) { return x.id === activeTool; }); title = t.title; sub = t.sub; icon = ICON(t.icon); }
    var hc = el("div"); hc.style.cssText = "display:flex;align-items:center;gap:10px;flex:1;min-width:0";
    hc.innerHTML = '<div class="ih-ic" aria-hidden="true">' + icon + '</div><div style="min-width:0"><h2 class="ih-t" id="insp-title">' + esc(title) + '</h2><div class="ih-sub">' + esc(sub) + "</div></div>";
    head.appendChild(hc);
    if (back) { var b = el("button", "ih-back"); b.textContent = "Done"; b.addEventListener("click", function () { selectLayer(null); focusActiveTool(); }); head.appendChild(b); }
    head.addEventListener("click", function (e) { if (e.target.closest("button")) return; toggleSheet(); });
    insp.setAttribute("role", "region"); insp.setAttribute("aria-labelledby", "insp-title");
    insp.append(head, body); inspBody = body;
    if (sel) propsPanel(body); else TOOL_RENDER[activeTool](body);
    if (savedFocus) { var tgt = body.querySelector('[data-fkey="' + savedFocus + '"]'); if (tgt) tgt.focus(); }
    pendingFocus = null;
  }

  /* ---------------- props panel (selected element) ---------------- */
  function propsPanel(body) {
    if (multiSel()) return multiPanel(body);
    var L = selLayer(); if (!L) return;
    var fields = LAYER_FIELDS[L.t] || [];
    var g = group();
    fields.forEach(function (pair) {
      var prop = pair[0], kind = pair[1];
      if ((prop === "outline1" || prop === "outline2") && L.style !== "sticker") return;   // outline colours only apply to the sticker style
      if (prop === "effectColor" && L.effect !== "neon" && L.effect !== "highlight") return;   // effect colour only for the neon glow / highlight marker
      if (prop === "outlineColor" && !(L.outlineW > 0)) return;      // outline colour only once there is an outline
      if (prop === "strokeStyle" && L.stroke === "none") return;   // border style whenever a stroke colour is set (sliders don't re-render the inspector, so don't gate on width)
      if (prop === "radius" && ((L.t === "shape" && L.shape !== "rect") || (L.t === "frame" && L.frame !== "rounded"))) return;   // corner radius only for rects / rounded frames
      if ((prop === "fill2" || prop === "fillAngle" || prop === "fillFade") && (L.fillKind || "solid") === "solid") return;   // gradient sub-controls only when a gradient fill is on
      if (prop === "fillAngle" && L.fillKind === "radial") return;   // angle is linear-only
      if (prop === "fill2" && L.fillFade) return;                    // fade-to-transparent ignores the 2nd colour
      if (prop === "light" && L.light === "none") return;            // QR background colour hidden when transparent
      g.appendChild(buildPropControl(L, prop, kind));
    });
    body.appendChild(g);
    if (styleFam(L.t)) {                                       // format painter
      var fpRow = el("div", "btn-row"); fpRow.style.marginTop = "6px";
      var bc = el("button", "btn"); bc.textContent = "🖌 Copy style"; bc.title = "⌥⌘C"; bc.addEventListener("click", copyStyle);
      fpRow.appendChild(bc);
      if (styleClip && styleClip.fam === styleFam(L.t)) { var bp = el("button", "btn"); bp.textContent = "Paste style"; bp.title = "⌥⌘V"; bp.addEventListener("click", pasteStyle); fpRow.appendChild(bp); }
      body.appendChild(fpRow);
    }
    if (L.t === "art" && typeof L.src === "string" && L.src) {
      var cg = group("Crop", L.crop ? "This photo is reframed. Re-crop or clear it." : "Reframe the photo to any window.");
      var cb = el("button", "btn"); cb.textContent = "⛶ Crop / reframe"; cb.style.cssText = "width:100%;font-weight:600";
      cb.addEventListener("click", function () { cropTool(L); });
      cg.appendChild(cb);
      if (L.crop) { var clr = el("button", "btn"); clr.textContent = "Clear crop"; clr.style.cssText = "width:100%;margin-top:5px;font-size:11px"; clr.addEventListener("click", function () { delete L.crop; rerender(); record(); renderInspector(); toast("Crop cleared"); }); cg.appendChild(clr); }
      body.appendChild(cg);
    }
    if (L.t === "art" && typeof L.src === "string" && L.src.indexOf("data:") === 0) {
      var tg = group("Cutout", "Erase leftover background, or restore parts the AI over-cut.");
      var tb = el("button", "btn"); tb.textContent = "✂ Touch up"; tb.style.cssText = "width:100%;font-weight:600";
      tb.addEventListener("click", function () { touchUp(L); });
      tg.appendChild(tb); body.appendChild(tg);
    }
    if (ADMIN && (L.t === "text" || L.t === "graffiti" || L.t === "art")) { var pg = pairingGroup(); if (pg) body.appendChild(pg); }
    var tip = el("div", "grp-note"); tip.style.marginTop = "4px";
    tip.textContent = "Tip: drag on the box to move · corner handle to resize · arrow keys nudge · ⌫ deletes.";
    body.appendChild(tip);
  }
  function elExtents(L) {                                    // approximate half-extents for alignment (text height ≈ its size)
    return { hw: (L.w != null ? L.w : L.size != null ? L.size : .3) / 2, hh: (L.h != null ? L.h : L.size != null ? L.size : .12) / 2 };
  }
  function alignSel(mode) {
    var Ls = selLayers(); if (Ls.length < 2) return;
    var horiz = mode === "left" || mode === "cx" || mode === "right";
    var lo = Infinity, hi = -Infinity;
    Ls.forEach(function (L) {
      var ex = elExtents(L);
      if (horiz) { lo = Math.min(lo, L.x - ex.hw); hi = Math.max(hi, L.x + ex.hw); }
      else { lo = Math.min(lo, L.y - ex.hh); hi = Math.max(hi, L.y + ex.hh); }
    });
    Ls.forEach(function (L) {
      var ex = elExtents(L);
      if (mode === "left") L.x = clamp01(lo + ex.hw);
      else if (mode === "cx") L.x = clamp01((lo + hi) / 2);
      else if (mode === "right") L.x = clamp01(hi - ex.hw);
      else if (mode === "top") L.y = clamp01(lo + ex.hh);
      else if (mode === "cy") L.y = clamp01((lo + hi) / 2);
      else if (mode === "bottom") L.y = clamp01(hi - ex.hh);
    });
    rerender(); record(); renderInspector();
    announce("Aligned " + Ls.length + " elements");
  }
  function distributeSel(axis) {
    var Ls = selLayers();
    if (Ls.length < 3) { toast("Select at least 3 elements to distribute", true); return; }
    var k = axis === "x" ? "x" : "y";
    var sorted = Ls.slice().sort(function (a, b) { return a[k] - b[k]; });
    var first = sorted[0][k], last = sorted[sorted.length - 1][k], step = (last - first) / (sorted.length - 1);
    sorted.forEach(function (L, i2) { L[k] = clamp01(first + step * i2); });
    rerender(); record(); renderInspector();
    announce("Distributed evenly");
  }
  function multiPanel(body) {
    var g = group(selAll().length + " elements selected", "They move, resize and reorder together.");
    var rowG = el("div", "btn-row"); rowG.style.marginBottom = "6px";
    var bg2 = el("button", "btn"); bg2.textContent = "⛓ Group"; bg2.title = "⌘G — clicking any member then selects the whole group"; bg2.addEventListener("click", groupSel);
    rowG.appendChild(bg2);
    if (selLayers().some(function (Lr) { return Lr.grp != null; })) { var bu2 = el("button", "btn"); bu2.textContent = "Ungroup"; bu2.title = "⇧⌘G"; bu2.addEventListener("click", ungroupSel); rowG.appendChild(bu2); }
    g.appendChild(rowG);
    var row = el("div", "btn-row");
    var dup = el("button", "btn"); dup.textContent = "Duplicate all"; dup.addEventListener("click", dupSel);
    var del = el("button", "btn"); del.textContent = "Delete all"; del.style.color = "#ffb3c4"; del.addEventListener("click", delSel);
    row.append(dup, del); g.appendChild(row); body.appendChild(g);
    var ga = group("Align & distribute", "Edges align to the selection's bounds; distribute spaces centres evenly.");
    var mk2 = function (label, title, fn) { var b = el("button", "btn"); b.type = "button"; b.textContent = label; b.title = title; b.style.cssText = "flex:1;font-size:11px;padding:7px 4px"; b.addEventListener("click", fn); return b; };
    var rA = el("div", "btn-row");
    rA.append(mk2("⇤ Left", "Align left edges", function () { alignSel("left"); }),
              mk2("↔ Mid", "Align horizontal centres", function () { alignSel("cx"); }),
              mk2("Right ⇥", "Align right edges", function () { alignSel("right"); }));
    var rB = el("div", "btn-row"); rB.style.marginTop = "6px";
    rB.append(mk2("⤒ Top", "Align top edges", function () { alignSel("top"); }),
              mk2("↕ Mid", "Align vertical centres", function () { alignSel("cy"); }),
              mk2("Btm ⤓", "Align bottom edges", function () { alignSel("bottom"); }));
    var rC = el("div", "btn-row"); rC.style.marginTop = "6px";
    rC.append(mk2("Spread ↔", "Distribute horizontally (3+)", function () { distributeSel("x"); }),
              mk2("Spread ↕", "Distribute vertically (3+)", function () { distributeSel("y"); }));
    ga.append(rA, rB, rC); body.appendChild(ga);
    var tip = el("div", "grp-note"); tip.style.marginTop = "4px";
    tip.textContent = "Drag any selected element to move the group · the corner handle scales the group · ↑/↓ reorder together · shift-click adds or removes.";
    body.appendChild(tip);
  }
  function buildPropControl(L, prop, kind) {
    var label = prop === "flipX" ? "Flip ↔" : prop === "flipY" ? "Flip ↕" : prop === "outline1" ? "Outline" : prop === "outline2" ? "Edge" : prop === "effectColor" ? "Effect colour" : prop === "fillKind" ? "Fill" : prop === "fill2" ? "Fill 2" : prop === "fillAngle" ? "Angle" : prop === "fillFade" ? "Fade to clear" : prop === "saturate" ? "Saturation" : prop === "lineHeight" ? "Line height" : prop === "letterSpacing" ? "Letter spacing" : prop === "strokeStyle" ? "Border style" : prop === "outlineW" ? "Sticker outline" : prop === "outlineColor" ? "Outline colour" : prop === "softShadow" ? "Soft shadow" : prop === "finish" ? "Finish" : prop === "look" ? "Looks" : prop === "glyphs" ? "Pick a glyph" : prop === "anim" ? "Animate" : prop === "blend" ? "Blend" : prop === "ecc" ? "Error correction" : prop === "dark" ? "Modules" : prop === "light" ? "Background" : prop === "transparentBg" ? "Transparent bg" : cap(prop);
    function setV(v, c) { L[prop] = v; rerender(); if (c) record(); if (prop === "value" || prop === "title" || prop === "label") updateCrumb(); }
    if (kind === "text") return textField(label, function () { return L[prop]; }, setV);
    if (kind === "textarea") return textField(label, function () { return L[prop]; }, setV, { area: true });
    if (kind === "color") return colorField(label, function () { return L[prop] || "#ffffff"; }, setV, true);
    if (kind === "bool") return toggleField(label, function () { return !!L[prop]; }, function (v) { setV(v, true); });
    if (kind === "font") return fontField(label, function () { return L[prop]; }, function (v) { setV(v, true); });
    if (kind === "align") return segField(label, [{ value: "left", label: "Left" }, { value: "center", label: "Center" }, { value: "right", label: "Right" }], function () { return L[prop]; }, function (v) { setV(v, true); });
    if (kind === "fit") return segField(label, [{ value: "cover", label: "Cover" }, { value: "contain", label: "Contain" }], function () { return L[prop]; }, function (v) { setV(v, true); });
    if (kind === "fadekind") return segField(label, [{ value: "linear", label: "Linear" }, { value: "radial", label: "Radial" }], function () { return L[prop]; }, function (v) { setV(v, true); });
    if (kind === "textstyle") return segField(label, [{ value: "plain", label: "Plain" }, { value: "sticker", label: "Sticker" }], function () { return L.style || "plain"; }, function (v) { setV(v, true); renderInspector(); });   // re-render so the outline colour pickers show/hide
    if (kind === "texteffect") return segField(label, [{ value: "none", label: "None" }, { value: "shadow", label: "Shadow" }, { value: "lift", label: "Lift" }, { value: "neon", label: "Neon" }, { value: "highlight", label: "Mark" }], function () { return L.effect || "none"; }, function (v) {
      if (v === "highlight" && (!L.effectColor || L.effectColor.toLowerCase() === "#ffe066")) {   // stock marker default only: auto-contrast it against the text colour (light text would vanish on the yellow marker)
        var hc = parseInt(String(L.color || "#ffffff").slice(1), 16);
        var hlum = (0.2126 * ((hc >> 16) & 255) + 0.7152 * ((hc >> 8) & 255) + 0.0722 * (hc & 255)) / 255;
        if (hlum > 0.5) L.effectColor = "#111111";
      }
      setV(v, true); renderInspector();
    });   // re-render so the effect-colour picker shows/hides
    if (kind === "decalid") return decalSwap(L);
    if (kind === "shapekind") return segField(label, SHAPE_OPTS, function () { return L.shape || "rect"; }, function (v) { setV(v, true); renderInspector(); });
    if (kind === "textfinish") return segField(label, [{ value: "none", label: "None" }, { value: "gold", label: "Gold" }, { value: "silver", label: "Silver" }, { value: "rosegold", label: "Rose" }, { value: "holo", label: "Holo" }], function () { return L.finish || "none"; }, function (v) { setV(v, true); });
    if (kind === "strokestyle") return segField(label, [{ value: "solid", label: "——" }, { value: "dashed", label: "– –" }, { value: "dotted", label: "· ·" }], function () { return L.strokeStyle || "solid"; }, function (v) { setV(v, true); });
    if (kind === "artlooks") return artLooksField(L);
    if (kind === "glyphgrid") return glyphGridField(L);
    if (kind === "framekind") return segField(label, FRAME_OPTS, function () { return L.frame || "circle"; }, function (v) { setV(v, true); renderInspector(); });
    if (kind === "qrecc") return segField(label, [{ value: "L", label: "L" }, { value: "M", label: "M" }, { value: "Q", label: "Q" }, { value: "H", label: "H" }], function () { return L.ecc || "M"; }, function (v) { setV(v, true); });
    if (kind === "qrtransp") return toggleField(label, function () { return L.light === "none"; }, function (on) { L.light = on ? "none" : "#ffffff"; rerender(); record(); renderInspector(); });
    if (kind === "fillkind") return segField(label, [{ value: "solid", label: "Solid" }, { value: "linear", label: "Linear" }, { value: "radial", label: "Radial" }], function () { return L.fillKind || "solid"; }, function (v) { setV(v, true); renderInspector(); });
    if (kind === "anim") return segField(label, [{ value: "none", label: "None" }, { value: "pop", label: "Pop" }, { value: "fade", label: "Fade" }, { value: "rise", label: "Rise" }, { value: "spin", label: "Spin" }, { value: "float", label: "Float" }], function () { return L.anim || "none"; }, function (v) { if (v === "none") delete L.anim; else L.anim = v; rerender(); record(); });
    if (kind === "blendkind") {
      var bw = field(label);
      var bs = el("select"); bs.style.cssText = "width:100%;padding:7px 9px;border-radius:7px;border:1px solid var(--acc-line,#2a2f3a);background:rgba(255,255,255,.05);color:inherit;font:inherit;cursor:pointer";
      BLEND_OPTS.forEach(function (o) { var op = el("option"); op.value = o.value; op.textContent = o.label; if ((L.blend || "normal") === o.value) op.selected = true; bs.appendChild(op); });
      bs.addEventListener("change", function () { if (bs.value === "normal") delete L.blend; else L.blend = bs.value; rerender(); record(); });
      bw.f.appendChild(bs); return bw.f;
    }
    if (kind === "framephoto") return framePhotoField(L);
    if (kind && kind.k === "range") return numField(label, function () { return L[prop] != null ? L[prop] : 0; }, setV, kind);
    return el("div");
  }
  function framePhotoField(L) {
    var w = field("Photo");
    var row = el("div", "color");
    var thumb = el("div", "pthumb"); thumb.style.cssText = "width:38px;height:38px;flex:0 0 38px;border-radius:9px;overflow:hidden;border:1px solid var(--line-2);background:rgba(255,255,255,.04) center/cover no-repeat";
    if (L.src) thumb.style.backgroundImage = 'url("' + L.src + '")';
    var btn = el("button", "btn"); btn.style.flex = "1"; btn.textContent = L.src ? "Replace photo" : "Add a photo";
    var inp = el("input"); inp.type = "file"; inp.accept = "image/*"; inp.style.display = "none";
    btn.addEventListener("click", function () { inp.click(); });
    inp.addEventListener("change", function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      fileToCanvas(f, function (cv) { L.src = encodeSmart(cv, false); rerender(); record(); renderInspector(); }, function () { toast("Could not read that image", true); });
    });
    row.append(thumb, btn); w.f.append(row, inp);
    if (L.src) { var rm = el("button", "btn"); rm.textContent = "Remove photo"; rm.style.cssText = "margin-top:5px;font-size:11px;color:#ffb3c4"; rm.addEventListener("click", function () { L.src = ""; rerender(); record(); renderInspector(); }); w.f.appendChild(rm); }
    var note = el("div", "grp-note"); note.textContent = "The photo fills the frame shape; size and position it below.";
    w.f.appendChild(note);
    return w.f;
  }
  var LOOKS = [   // one-tap colour grades: bundles of the existing filter fields (sliders fine-tune after)
    { id: "none", name: "None", v: { brightness: 1, contrast: 1, saturate: 1, blur: 0, sepia: 0 } },
    { id: "vintage", name: "Vintage", v: { brightness: 1.05, contrast: .92, saturate: .8, blur: 0, sepia: .45 } },
    { id: "noir", name: "Noir", v: { brightness: .95, contrast: 1.25, saturate: 0, blur: 0, sepia: 0 } },
    { id: "dreamy", name: "Dreamy", v: { brightness: 1.08, contrast: .85, saturate: 1.15, blur: .004, sepia: 0 } },
    { id: "punch", name: "Punch", v: { brightness: 1, contrast: 1.18, saturate: 1.35, blur: 0, sepia: 0 } },
    { id: "faded", name: "Faded", v: { brightness: 1.08, contrast: .82, saturate: .7, blur: 0, sepia: .12 } },
    { id: "warm", name: "Warm", v: { brightness: 1.03, contrast: 1.02, saturate: 1.1, blur: 0, sepia: .25 } },
  ];
  function artLooksField(L) {
    var w = field("Looks");
    var row = el("div", "btn-row"); row.style.flexWrap = "wrap"; row.style.gap = "4px";
    LOOKS.forEach(function (lk) {
      var b = el("button", "btn"); b.type = "button"; b.textContent = lk.name; b.style.cssText = "flex:1 0 28%;font-size:11px;padding:6px 4px";
      var active = Object.keys(lk.v).every(function (k) { var cur = L[k] != null ? L[k] : (k === "blur" || k === "sepia" ? 0 : 1); return Math.abs(cur - lk.v[k]) < .001; });
      if (active) b.style.outline = "1px solid var(--acc,#00ff9d)";
      b.addEventListener("click", function () {
        Object.keys(lk.v).forEach(function (k) { L[k] = lk.v[k]; });
        rerender(); record(); renderInspector(); announce(lk.name === "None" ? "Look cleared" : lk.name + " look applied");
      });
      row.appendChild(b);
    });
    w.f.appendChild(row);
    return w.f;
  }
  var GLYPHS = ["★", "✦", "✧", "♥", "✸", "✿", "❄", "☀", "☾", "⚡", "♛", "♬", "✈", "⚓", "☘", "✌", "🎁", "🎀", "🎉", "🎊", "🥳", "🎂", "🧁", "🍾", "🥂", "✨", "🌈", "🔥", "🍀", "🌸", "🌹", "🦋", "🐝", "🐻", "🐱", "🐶", "🦄", "👑", "💎", "🔮", "🎈", "🏆", "💌", "😍", "🤩", "🫶", "💫", "🌟"];
  function glyphGridField(L) {
    var w = field("Pick a glyph");
    var grid = el("div"); grid.style.cssText = "display:grid;grid-template-columns:repeat(8,1fr);gap:4px";
    GLYPHS.forEach(function (gch) {
      var b = el("button", "btn"); b.type = "button"; b.textContent = gch;
      b.setAttribute("aria-label", "Use " + gch); b.style.cssText = "padding:5px 0;font-size:15px;line-height:1";
      if (L.value === gch) b.style.outline = "1px solid var(--acc,#00ff9d)";
      b.addEventListener("click", function () { L.value = gch; rerender(); record(); renderInspector(); });
      grid.appendChild(b);
    });
    w.f.appendChild(grid);
    return w.f;
  }
  function decalSwap(L) {
    var w = field("Sticker");
    var cur = GBX.STICKERS[L.id];
    var row = el("div", "color");
    var thumb = el("div", "pthumb"); thumb.style.cssText = "width:38px;height:38px;flex:0 0 38px;border-radius:9px;overflow:hidden;border:1px solid var(--line-2);background:rgba(255,255,255,.04);display:grid;place-items:center";
    thumb.innerHTML = cur ? cur.svg : "";
    var btn = el("button", "btn"); btn.style.flex = "1"; btn.textContent = cur ? ("Change · " + cur.name) : "Pick a sticker";
    btn.addEventListener("click", function () { setTool("stickers"); });
    row.append(thumb, btn); w.f.appendChild(row);
    var note = el("div", "grp-note"); note.textContent = "Browse the Stickers tool to swap; size/position below.";
    w.f.appendChild(note);
    return w.f;
  }

  /* ---------------- tool: templates ---------------- */
  var lastTplSnippet = "";
  var editingTplId = null;                             // admin: which existing template the authoring group is updating (persists across tool switches)
  function templateAuthoringGroup() {                 // admin: save the whole box as a NEW reusable template, or update an existing one
    var ga = group("Author a template", "Save the whole box as a reusable template, or pick one to update.");
    var cur = editingTplId ? (TEMPLATES.find(function (t) { return t.id === editingTplId; }) || null) : null;
    var inputCss = "width:100%;margin:4px 0;padding:7px 9px;border-radius:7px;border:1px solid var(--acc-line,#2a2f3a);background:rgba(255,255,255,.05);color:inherit;font:inherit";
    // pick an existing template to UPDATE (loads it into the editor; the choice persists while you tweak + come back to save)
    var selLbl = el("div"); selLbl.textContent = "Update an existing template"; selLbl.style.cssText = "font-size:11px;opacity:.7;margin-bottom:3px";
    var sel = el("select"); sel.style.cssText = inputCss + ";cursor:pointer";
    var optNew = el("option"); optNew.value = ""; optNew.textContent = "✦ New template (save current box)"; sel.appendChild(optNew);
    TEMPLATES.forEach(function (t) { var o = el("option"); o.value = t.id; o.textContent = "Update: " + t.name; if (t.id === editingTplId) o.selected = true; sel.appendChild(o); });
    sel.addEventListener("change", function () {
      if (!sel.value) { editingTplId = null; renderInspector(); return; }   // back to "new"
      editingTplId = sel.value; applyTemplate(sel.value);   // load it to tweak (jumps to the Box tool); editingTplId persists for the return trip
    });
    ga.append(selLbl, sel);
    var mk = function (ph, val) { var i = el("input"); i.type = "text"; i.placeholder = ph; if (val) i.value = val; i.spellcheck = false; i.style.cssText = inputCss; return i; };
    var idIn = mk("template-id", cur ? cur.id : ""), nameIn = mk("Display name", cur ? cur.name : ""), descIn = mk("Short description", cur ? (cur.desc || "") : "");
    if (cur) { idIn.readOnly = true; idIn.style.opacity = ".6"; }   // keep the id fixed while updating so it replaces in place (use "✦ New" to clone)
    ga.append(idIn, nameIn, descIn);
    var saveBtn = el("button", "btn"); saveBtn.textContent = cur ? ("Update “" + cur.name + "”") : "Save current box as a template"; saveBtn.style.cssText = "width:100%;margin-top:6px;font-weight:600";
    saveBtn.addEventListener("click", function () {
      var res = exportDocAsTemplate(idIn.value, nameIn.value, descIn.value);
      var existed = TEMPLATES.some(function (t) { return t.id === res.id; });
      lastTplSnippet = templateSnippet(res);
      try { navigator.clipboard.writeText(lastTplSnippet); } catch (e) {}
      registerTemplateLive(res.entry);
      editingTplId = res.id;                             // stay in update-mode for this id
      toast('Template "' + res.entry.name + '" ' + (existed ? "updated" : "saved") + " — snippet copied");
      renderInspector();
    });
    ga.appendChild(saveBtn);
    if (lastTplSnippet) {
      var det = el("details"); det.style.cssText = "margin-top:8px"; det.open = true;
      var sm = el("summary"); sm.textContent = "Snippet — " + (cur ? "replace the entry with this id" : "paste") + " in TEMPLATES (engine-lab.js) to keep it"; sm.style.cssText = "font-size:11px;opacity:.7;cursor:pointer";
      var out = el("textarea"); out.readOnly = true; out.value = lastTplSnippet; out.style.cssText = "width:100%;height:110px;margin-top:6px;font-family:monospace;font-size:11px";
      var cp = el("button", "btn"); cp.textContent = "Copy snippet"; cp.style.cssText = "margin-top:4px";
      cp.addEventListener("click", function () { out.select(); try { navigator.clipboard.writeText(out.value); } catch (e) {} toast("Snippet copied"); });
      det.append(sm, out, cp); ga.appendChild(det);
    }
    var note = el("p"); note.style.cssText = "font-size:11px;opacity:.65;margin-top:7px;line-height:1.4";
    note.textContent = cur
      ? 'Editing "' + cur.name + '": tweak the box, then Update to overwrite it in place. The change is live this session; paste the snippet over the matching id in engine-lab.js to keep it.'
      : "Captures the box exactly as it stands (art rides along as embedded images). Session templates vanish on reload — paste the snippet to keep one.";
    ga.appendChild(note);
    return ga;
  }
  function miniBox(prev, docFactory) {                 // render a real small 3D box inside a card (synchronous: previews are static, modest count)
    if (!window.GIIIFTBox || !GIIIFTBox.render) return;
    try { var holder = el("div", "tpl-box"); prev.appendChild(holder); GIIIFTBox.render(holder, docFactory(), { mode: "view", size: "82px", burst: false }); } catch (e) {}
  }
  function toolTemplates(body) {
    if (ADMIN) body.appendChild(templateAuthoringGroup());
    var g = group(null, "Pick a starting point. You can change anything afterwards.");
    function tplCard(t) {
      var card = el("button", "tpl-card");
      var prev = el("div", "tpl-prev"); prev.style.background = "linear-gradient(135deg," + t.c1 + "55," + t.c2 + "55)";   // faint tint until the real mini box renders
      miniBox(prev, function () { return t.build(); });
      var meta = el("div", "tpl-meta"); meta.innerHTML = '<div class="tpl-name">' + esc(t.name) + '</div><div class="tpl-desc">' + esc(t.desc) + "</div>";
      card.append(prev, meta);
      card.addEventListener("click", function () { applyTemplate(t.id); });
      armHoverPreview(card, function () { return t.build(); });
      return card;
    }
    var shown = {};
    TPL_CATS.forEach(function (c) {                          // group the picker by occasion/type so it scales (and stays browsable) as templates are added
      var inCat = TEMPLATES.filter(function (t) { return tplCat(t) === c[0]; });
      if (!inCat.length) return;
      shown[c[0]] = 1;
      var h = el("div", "sw-h"); h.textContent = c[1]; g.appendChild(h);
      var grid = el("div", "tpl-grid"); inCat.forEach(function (t) { grid.appendChild(tplCard(t)); }); g.appendChild(grid);
    });
    var rest = TEMPLATES.filter(function (t) { return !shown[tplCat(t)]; });   // any cat not listed in TPL_CATS
    if (rest.length) { var hr = el("div", "sw-h"); hr.textContent = "More"; g.appendChild(hr); var gr = el("div", "tpl-grid"); rest.forEach(function (t) { gr.appendChild(tplCard(t)); }); g.appendChild(gr); }
    body.appendChild(g);

    /* ---- your presets: save the current box (panels and all) as a reusable template ---- */
    var gs = group("Your presets", "Save the current box, panels and all, to reuse it as a template.");
    var save = el("button", "btn-add"); save.style.width = "100%"; save.textContent = "＋ Save current box as preset";
    save.addEventListener("click", saveCurrentAsPreset);
    gs.appendChild(save);
    var presets = loadPresets();
    if (presets.length) {
      var pg = el("div", "tpl-grid"); pg.style.marginTop = "10px";
      presets.forEach(function (p) {
        var card = el("div", "tpl-card"); card.style.position = "relative"; card.setAttribute("role", "button"); card.tabIndex = 0; card.setAttribute("aria-label", "Apply preset " + p.name);
        var pal = (p.doc && p.doc.palette) || {};
        var prev = el("div", "tpl-prev"); prev.style.background = "linear-gradient(135deg," + (pal.c1 || "#334155") + "55," + (pal.c2 || "#111827") + "55)";
        miniBox(prev, function () { return clone(p.doc); });
        var meta = el("div", "tpl-meta"); meta.innerHTML = '<div class="tpl-name">' + esc(p.name) + '</div><div class="tpl-desc">saved preset</div>';
        var del = el("button"); del.type = "button"; del.textContent = "✕"; del.title = "Delete preset"; del.setAttribute("aria-label", "Delete preset " + p.name);
        del.style.cssText = "position:absolute;top:5px;right:6px;font-size:11px;line-height:1;color:#fff;opacity:.75;z-index:3;cursor:pointer;background:rgba(0,0,0,.45);border:none;border-radius:6px;width:22px;height:22px";
        del.addEventListener("click", function (e) { e.stopPropagation(); modal({ title: "Delete preset", message: 'Delete "' + p.name + '"? This cannot be undone.', okText: "Delete", danger: true, onOk: function () { deletePreset(p.id); toast("Preset deleted"); } }); });
        card.append(prev, meta, del);
        card.addEventListener("click", function () { applyPreset(p); });
        card.addEventListener("keydown", function (e) { if (e.target === card && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); applyPreset(p); } });
        armHoverPreview(card, function () { return clone(p.doc); });
        pg.appendChild(card);
      });
      gs.appendChild(pg);
    } else {
      var none = el("div"); none.style.cssText = "font-size:11px;color:var(--ink-dim);margin-top:9px;line-height:1.4";
      none.textContent = "No saved presets yet. Design a box (or dress it in panels), then save it here to reuse as a template.";
      gs.appendChild(none);
    }
    body.appendChild(gs);
  }

  /* ---------------- tool: box ---------------- */
  function toolBox(body) {
    var g = group("Theme");
    var pr = el("div", "presets");
    PRESETS.forEach(function (t) {
      var b = el("button", "preset"); b.title = t.name; b.style.background = "linear-gradient(135deg," + t.c1 + "," + t.c2 + ")";
      var n = el("span", "pn"); n.textContent = t.name; b.appendChild(n);
      b.addEventListener("click", function () { doc.palette.c1 = t.c1; doc.palette.c2 = t.c2; doc.palette.accent = t.accent; doc.palette.finish = t.finish; rerender(); record(); renderInspector(); });
      pr.appendChild(b);
    });
    g.appendChild(pr);
    var shuf = el("button", "btn"); shuf.textContent = "🎲 Shuffle look"; shuf.title = "Random palette + finish + font across the whole box"; shuf.style.cssText = "width:100%;margin-top:8px;font-weight:600"; shuf.addEventListener("click", shuffleLook); g.appendChild(shuf);
    body.appendChild(g);

    var g2 = group("Finish");
    g2.appendChild(segField(null, [{ value: "gradient", label: "Gradient" }, { value: "holo", label: "Holo" }, { value: "matte", label: "Matte" }, { value: "solid", label: "Solid" }], function () { return doc.palette.finish; }, function (v) { doc.palette.finish = v; rerender(); record(); }, "Finish"));
    body.appendChild(g2);

    var g3 = group("Colours");
    g3.appendChild(colorField("Base", function () { return doc.palette.c1; }, function (v, c) { doc.palette.c1 = v; rerender(); if (c) record(); }, true));
    g3.appendChild(colorField("Blend", function () { return doc.palette.c2; }, function (v, c) { doc.palette.c2 = v; rerender(); if (c) record(); }, true));
    g3.appendChild(colorField("Accent", function () { return doc.palette.accent; }, function (v, c) { doc.palette.accent = v; rerender(); if (c) record(); }, true));
    g3.appendChild(numField("Gradient angle", function () { return doc.palette.angle; }, function (v, c) { doc.palette.angle = v; rerender(); if (c) record(); }, RG(0, 360, 1, "°")));
    body.appendChild(g3);

    var g4 = group("Shape");
    g4.appendChild(segField(null, [{ value: "mailer", label: "Mailer" }, { value: "present", label: "Present", disabled: true, badge: "soon" }, { value: "cube", label: "Cube", disabled: true, badge: "soon" }, { value: "envelope", label: "Env", disabled: true, badge: "soon" }], function () { return doc.shape; }, function (v) { doc.shape = v; rerender(); record(); }, "Shape"));
    body.appendChild(g4);
  }

  /* ---------------- tool: faces ---------------- */
  function buildFaceNet() {
    var net = el("div", "facenet"); faceTiles = {};
    FACES.forEach(function (pos) {
      var t = el("button", "ftile ft-" + pos); t.dataset.face = pos;
      var ov = el("div", "ftile-pat"); var nm = el("span", "ftile-nm"); nm.textContent = pos;
      t.append(ov, nm);
      t.addEventListener("click", function () { setActiveFace(pos); });
      faceTiles[pos] = { el: t, ov: ov }; net.appendChild(t);
    });
    return net;
  }
  function paintFaceTile(pos) {
    var t = faceTiles[pos]; if (!t || !t.el.isConnected) return;
    var fill = doc.faces[pos].fill || doc.palette; var bg = GBX.faceBackground(fill, pos);
    t.el.style.background = bg.bg; t.el.style.backgroundSize = bg.size;
    var pat = doc.faces[pos].pattern || "none";
    t.ov.className = "ftile-pat" + (pat !== "none" ? (" gbx-pattern gbx-pat-" + pat) : "");
    t.el.classList.toggle("on", pos === activeFace);
  }
  function refreshFaceNet() { Object.keys(faceTiles).forEach(paintFaceTile); }
  function toolFaces(body) {
    var g = group("Faces", "Click a side to edit it. The box rotates to show that face.");
    g.appendChild(buildFaceNet()); body.appendChild(g);
    refreshFaceNet();

    var g2 = group("This face");
    g2.appendChild(toggleField("Override colour", function () { return !!doc.faces[activeFace].fill; }, function (on) {
      if (on) doc.faces[activeFace].fill = Object.assign({}, doc.palette); else delete doc.faces[activeFace].fill;
      pendingFocus = "face-override"; rerender(); record(); renderInspector();
    }, "face-override"));
    if (doc.faces[activeFace].fill) {
      var f = doc.faces[activeFace].fill;
      g2.appendChild(colorField("Base", function () { return f.c1; }, function (v, c) { f.c1 = v; rerender(); if (c) record(); }, true));
      g2.appendChild(colorField("Blend", function () { return f.c2; }, function (v, c) { f.c2 = v; rerender(); if (c) record(); }, true));
    }
    body.appendChild(g2);

    var g3 = group("Pattern");
    var pg = el("div", "patgrid"); pg.id = "patgrid";
    var cur = doc.faces[activeFace].pattern || "none";
    Object.keys(GBX.PATTERNS).forEach(function (name) {
      var b = el("button", "patcell" + (name === cur ? " on" : "")); b.dataset.pat = name; b.title = name;
      var fill = el("div", "patcell-fill");
      if (name === "none") { var n = el("span", "patcell-none"); n.textContent = "none"; fill.appendChild(n); }
      else { var po = el("div", "gbx-pattern gbx-pat-" + name); fill.appendChild(po); }
      b.appendChild(fill);
      b.addEventListener("click", function () { doc.faces[activeFace].pattern = name; rerender(); record(); pg.querySelectorAll(".patcell").forEach(function (c) { c.classList.toggle("on", c.dataset.pat === name); }); });
      pg.appendChild(b);
    });
    g3.appendChild(pg); body.appendChild(g3);
  }

  /* ---------------- tool: layers ---------------- */
  function toolLayers(body) {
    var g = group("Add element", "Pick a type, then tap the box where you want it. Or double-click an empty spot to type.");
    var add = el("div", "addgrid");
    ADD_TYPES.forEach(function (t) {
      var b = el("button", "addcell");
      b.innerHTML = '<span class="addcell-ic" aria-hidden="true">' + (LAYER_ICON[t] || "+") + '</span><span class="addcell-nm">' + (LAYER_NAME[t] || t) + "</span>";
      b.addEventListener("click", function () { armPlace(t); });
      add.appendChild(b);
    });
    g.appendChild(add); body.appendChild(g);

    var g2 = group("Stack", "Topmost is in front. Click to edit.");
    var L = faceLayers();
    if (!L.length) { g2.appendChild(emptyState("▤", "No elements yet", "Add text, a label or a sticker to this face.")); }
    else {
      var stack = el("div", "stack");
      // show topmost first
      for (var i = L.length - 1; i >= 0; i--) (function (i) {
        var e = L[i]; var row = el("div", "lyr" + (isSel(activeFace, i) ? " on" : "") + (e.locked ? " locked" : ""));
        row.dataset.li = i;
        var label = e.value || e.title || e.label || (e.t === "decal" ? (GBX.STICKERS[e.id] && GBX.STICKERS[e.id].name) || "sticker" : e.t === "shape" ? "Shape · " + (e.shape || "rect") : e.t === "frame" ? "Frame · " + (e.frame || "circle") : (LAYER_NAME[e.t] || e.t));
        row.innerHTML = '<button class="lyr-grip" title="Drag to reorder" aria-label="Drag to reorder (or use the arrow buttons)">⋮⋮</button><span class="lyr-ic" aria-hidden="true">' + (LAYER_ICON[e.t] || "•") + '</span><span class="lyr-v"></span><span class="lyr-btns"><button data-up title="Bring forward" aria-label="Bring forward">↑</button><button data-down title="Send back" aria-label="Send back">↓</button><button data-dup title="Duplicate" aria-label="Duplicate element">⧉</button><button data-lock title="' + (e.locked ? "Unlock" : "Lock") + '" aria-label="' + (e.locked ? "Unlock element" : "Lock element") + '">' + (e.locked ? "🔒" : "🔓") + '</button><button data-del title="Delete" aria-label="Delete element">✕</button></span>';
        row.querySelector(".lyr-v").textContent = label;
        if (e.grp != null) { row.style.boxShadow = "inset 3px 0 0 hsl(" + ((e.grp * 67) % 360) + " 80% 60%)"; row.title = "Grouped — clicking selects the whole group"; }
        row.addEventListener("click", function (ev) {
          if (ev.target.closest(".lyr-grip")) return;          // grip never selects
          var d = ev.target.dataset || {};
          // row buttons reorder / duplicate / delete in place and KEEP you on the overview
          // (you press the same one repeatedly) instead of dropping into the details panel
          if (d.up != null)   { nudgeInList(i,  1, "up");   return; }
          if (d.down != null) { nudgeInList(i, -1, "down"); return; }
          if (d.dup != null)  { dupLayerInList(i); return; }
          if (d.lock != null) { faceLayers()[i].locked = !faceLayers()[i].locked; rerender(); record(); renderInspector(); return; }
          if (d.del != null)  { sel = { face: activeFace, li: i }; selX = []; delSel(); return; }   // delSel clears the selection → renderInspector falls back to the overview
          selectLayer(activeFace, i, ev.shiftKey);
        });
        // row hover lights the element on the box (the stage side of the sync is in onHoverIn)
        row.addEventListener("mouseenter", function () { var n = mount.querySelector('[data-face="' + activeFace + '"][data-li="' + i + '"]'); if (n) n.classList.add("gbx-hov"); });
        row.addEventListener("mouseleave", function () { var n = mount.querySelector('[data-face="' + activeFace + '"][data-li="' + i + '"]'); if (n) n.classList.remove("gbx-hov"); });
        bindRowDrag(row.querySelector(".lyr-grip"), row, stack);
        stack.appendChild(row);
      })(i);
      g2.appendChild(stack);
    }
    body.appendChild(g2);
  }

  /* ---------------- layer drag-to-reorder (grip) ---------------- */
  function bindRowDrag(grip, row, stack) {
    if (!grip) return;
    grip.addEventListener("click", function (e) { e.stopPropagation(); });
    grip.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button > 0) return;
      e.preventDefault(); e.stopPropagation();
      try { grip.setPointerCapture(e.pointerId); } catch (_) {}
      var moved = false, y0 = e.clientY;
      function mv(ev) {
        if (ev.pointerId !== e.pointerId) return;
        if (!moved && Math.abs(ev.clientY - y0) < 4) return;
        if (!moved) { moved = true; row.classList.add("dragging"); }
        var others = Array.from(stack.querySelectorAll(".lyr")).filter(function (r) { return r !== row; });
        var next = null;
        for (var i = 0; i < others.length; i++) { var rb = others[i].getBoundingClientRect(); if (ev.clientY < rb.top + rb.height / 2) { next = others[i]; break; } }
        if (next) stack.insertBefore(row, next); else stack.appendChild(row);
      }
      function up(ev) {
        if (ev.pointerId !== e.pointerId) return;
        grip.removeEventListener("pointermove", mv); grip.removeEventListener("pointerup", up); grip.removeEventListener("pointercancel", up);
        try { grip.releasePointerCapture(e.pointerId); } catch (_) {}
        row.classList.remove("dragging");
        if (moved) commitStackOrder(stack);
      }
      grip.addEventListener("pointermove", mv); grip.addEventListener("pointerup", up); grip.addEventListener("pointercancel", up);
    });
  }
  function commitStackOrder(stack) {
    var L = faceLayers();
    var order = Array.from(stack.querySelectorAll(".lyr")).map(function (r) { return +r.dataset.li; });  // visual: topmost first
    if (order.length !== L.length) return;
    var docOrder = order.slice().reverse();                    // doc array runs bottom -> top
    var selLi = (sel && sel.face === activeFace) ? sel.li : null;
    doc.faces[activeFace].layers = docOrder.map(function (li) { return L[li]; });
    if (selLi != null) sel.li = docOrder.indexOf(selLi);
    rerender(); record(); renderInspector(); refreshStageToolbar(); updateCrumb();
    announce("Layers reordered");
  }

  /* ---------------- tool: stickers ---------------- */
  /* ---------------- vertical "Recommended" rows (stickers + panels) ---------------- */
  // The vertical packs (verticals/*.js) list featured sticker/panel ids per audience
  // (wrap.<kind>.featured). We surface them as a "Recommended · <vertical>" row atop the
  // Stickers/Panels tools. `labVertical` is a lab-only preview override (no global change).
  var VERT_SHORT = { tcg: "TCG", pokemon: "Pokémon", onepiece: "One Piece" };
  function vList() { var V = window.GIIIFTVertical; return (V && V.list) ? V.list().filter(function (v) { return !v.hidden; }) : []; }
  function labVertId() { var V = window.GIIIFTVertical; return labVertical || (V && V.id && V.id()) || "core"; }
  function vFeatured(kind) {   // kind: "stickers" | "panels"
    var V = window.GIIIFTVertical; if (!V) return { id: "core", label: "", ids: [] };
    var id = labVertId(), cfg = (V.find && V.find(id)) || (V.active && V.active()) || null;
    var sec = cfg && cfg.wrap && cfg.wrap[kind];
    return { id: id, label: (cfg && cfg.label) || id, ids: (sec && Array.isArray(sec.featured)) ? sec.featured : [] };
  }
  function verticalPicker() {   // segmented "Recommended for" selector; null when no packs are registered
    var list = vList(); if (!list.length) return null;
    var opts = [{ value: "core", label: "None" }].concat(list.map(function (v) { return { value: v.id, label: VERT_SHORT[v.id] || v.label || v.id }; }));
    return segField("Recommended for", opts, labVertId, function (v) { labVertical = v; renderInspector(); });
  }
  function featuredRow(body, label, gridCls, ids, buildCell) {   // labelled grid; no-op when empty
    if (!ids.length) return;
    var lbl = el("div", "stk-grp"); lbl.textContent = "Recommended · " + label; body.appendChild(lbl);
    var grid = el("div", gridCls); ids.forEach(function (id) { grid.appendChild(buildCell(id)); }); body.appendChild(grid);
  }

  function toolStickers(body) {
    var g = group("Stickers", "Pick a decal, then tap the box where you want it.");
    body.appendChild(g);
    var all = GBX.STICKERS || {};
    var pick = verticalPicker(); if (pick) body.appendChild(pick);
    var fS = vFeatured("stickers");
    if (fS.id !== "core") featuredRow(body, fS.label, "stk-grid", fS.ids.filter(function (id) { return all[id]; }), function (id) {
      var c = el("button", "stk-cell"); c.title = all[id].name;
      c.innerHTML = all[id].svg + '<span class="nm">' + esc(all[id].name) + "</span>";
      c.addEventListener("click", function () { armPlace("decal:" + id); });
      return c;
    });
    var groups = { web3: "Web3", game: "Game / TCG", street: "Streetwear", industrial: "Industrial" };
    Object.keys(groups).forEach(function (grp) {
      var ids = Object.keys(all).filter(function (k) { return all[k].group === grp; });
      if (!ids.length) return;
      var gl = el("div", "stk-grp"); gl.textContent = groups[grp]; body.appendChild(gl);
      var grid = el("div", "stk-grid");
      ids.forEach(function (id) {
        var c = el("button", "stk-cell"); c.title = all[id].name;
        c.innerHTML = all[id].svg + '<span class="nm">' + esc(all[id].name) + "</span>";
        c.addEventListener("click", function () { armPlace("decal:" + id); });
        grid.appendChild(c);
      });
      body.appendChild(grid);
    });
  }

  /* ---------------- tool: panels ---------------- */
  var lastSnippet = "";
  function authoringGroup() {                              // admin: Midjourney render -> compose -> save as a reusable panel, no code editor
    var ga = group("Author a panel", "Drop or paste a render onto the box, add wording with the Layers tab, then save this face as a reusable panel.");
    var mk = function (ph, val) { var i = el("input"); i.type = "text"; i.placeholder = ph; if (val) i.value = val; i.spellcheck = false; i.style.cssText = "width:100%;margin:4px 0;padding:7px 9px;border-radius:7px;border:1px solid var(--acc-line,#2a2f3a);background:rgba(255,255,255,.05);color:inherit;font:inherit"; return i; };
    var idIn = mk("panel-id", "custom-" + activeFace), nameIn = mk("Display name", "");
    ga.append(idIn, nameIn);
    var grp = "side", seg = el("div", "btn-row"), bFront = el("button", "btn"), bSide = el("button", "btn");
    bFront.textContent = "Front"; bSide.textContent = "Side";
    var syncSeg = function () { bFront.style.opacity = grp === "front" ? "1" : ".5"; bSide.style.opacity = grp === "side" ? "1" : ".5"; };
    bFront.addEventListener("click", function () { grp = "front"; syncSeg(); }); bSide.addEventListener("click", function () { grp = "side"; syncSeg(); });
    syncSeg(); seg.append(bFront, bSide); ga.appendChild(seg);
    var saveBtn = el("button", "btn"); saveBtn.textContent = "Save this face as a panel"; saveBtn.style.cssText = "width:100%;margin-top:6px;font-weight:600";
    saveBtn.addEventListener("click", function () {
      var res = exportFaceAsPanel(idIn.value, nameIn.value, grp);
      lastSnippet = panelSnippet(res, "custom");
      try { navigator.clipboard.writeText(lastSnippet); } catch (e) {}
      registerPanelLive(res.id, res.entry, "custom");
      panelFamily = null;
      toast('Saved "' + res.id + '" — it is in the Session panels set below' + (res.skipped ? " · " + res.skipped + " layer(s) skipped" : ""));
      renderInspector();
    });
    ga.appendChild(saveBtn);
    if (lastSnippet) {
      var det = el("details"); det.style.cssText = "margin-top:8px";
      var sm = el("summary"); sm.textContent = "Snippet — paste into box-panels.js to keep it permanently"; sm.style.cssText = "font-size:11px;opacity:.7;cursor:pointer";
      var out = el("textarea"); out.readOnly = true; out.value = lastSnippet; out.style.cssText = "width:100%;height:110px;margin-top:6px;font-family:monospace;font-size:11px";
      var cp = el("button", "btn"); cp.textContent = "Copy snippet"; cp.style.cssText = "margin-top:4px";
      cp.addEventListener("click", function () { out.select(); try { navigator.clipboard.writeText(out.value); } catch (e) {} toast("Snippet copied"); });
      det.append(sm, out, cp); ga.appendChild(det);
    }
    var note = el("p"); note.style.cssText = "font-size:11px;opacity:.65;margin-top:7px;line-height:1.4"; note.textContent = "Drag an image onto the box (or ⌘/Ctrl-V paste) for full-bleed art. Saves text (effects/curve/gradients), art (filters/flip), shapes, photo frames and fades; stamps/labels/notes/seals/postmarks/barcodes/stickers are skipped. Session panels vanish on reload — paste the snippet to keep one.";
    ga.appendChild(note);
    return ga;
  }
  function toolPanels(body) {
    if (ADMIN) { var pg = pairingGroup(); if (pg) body.appendChild(pg); body.appendChild(authoringGroup()); }
    var all = GBX.PANELS, id = doc.faces[activeFace].panel, p = id && all[id];
    // --- what's on this face + its editable text ---
    var g = group("This face", "Panel on the " + activeFace + " face. Layers still sit on top.");
    var row = el("div", "panelrow");
    var thumb = el("div", "pthumb"); thumb.innerHTML = p ? GBX.panelSVG(id, doc.faces[activeFace].panelText, doc.faces[activeFace].panelScale) : '<span class="none">none</span>';
    var meta = el("div", "pmeta"); var name = el("div", "pname"); name.textContent = p ? p.name : ("No panel on the " + activeFace + " face");
    var btns = el("div", "pbtns");
    if (p) { var clr = el("button", "pclear"); clr.textContent = "Clear"; clr.addEventListener("click", clearPanel); btns.appendChild(clr); }
    meta.append(name, btns); row.append(thumb, meta); g.appendChild(row); body.appendChild(g);
    if (p && p.fields && p.fields.length) {
      var gt = group("Panel text", "Type your own wording — it keeps the panel's style.");
      p.fields.forEach(function (f) {
        gt.appendChild(textField(f.label,
          function () { var pt = doc.faces[activeFace].panelText; return (pt && pt[f.key] != null) ? pt[f.key] : f.value; },
          function (v, c) { var fc = doc.faces[activeFace]; fc.panelText = fc.panelText || {}; fc.panelText[f.key] = String(v).slice(0, f.max || 60); rerender(); if (c) record(); },
          { placeholder: f.value }));
      });
      body.appendChild(gt);
    }

    // --- set browser (list of families → drill into one) ---
    var fams = panelFamilies();
    if (!panelFamily) {
      var pick = verticalPicker(); if (pick) body.appendChild(pick);
      var fP = vFeatured("panels");
      if (fP.id !== "core") featuredRow(body, fP.label, "stk-grid panel-grid", fP.ids.filter(function (pid) { return all[pid]; }), function (pid) {
        var c = el("button", "stk-cell panel-cell" + (pid === id ? " on" : "")); c.title = all[pid].name;
        c.innerHTML = GBX.panelSVG(pid) + '<span class="nm">' + esc(all[pid].name) + "</span>";
        c.addEventListener("click", function () { applyPanel(pid); });
        armHoverPreview(c, function () { var d = clone(doc), fc = d.faces[activeFace]; fc.panel = pid; delete fc.panelText; delete fc.panelScale; fc.layers = []; return d; });
        return c;
      });
      var gl = group("Panel sets", "Open a set to see its panels, or 'Dress box' to apply it (front to front; the other faces get the set's side designs spread across them).");
      body.appendChild(gl);
      var sg = el("div", "setgrid");
      fams.forEach(function (fam) {
        var card = el("div", "set-card"); card.addEventListener("click", function () { panelFamily = fam.id; renderInspector(); });
        var prev = el("div", "set-prev"); prev.innerHTML = GBX.panelSVG(fam.front);
        var m = el("div", "set-meta");
        var nm = el("div", "set-name"); nm.textContent = fam.name;
        var cnt = el("div", "set-cnt"); cnt.textContent = fam.members.length + " panels · " + fam.desc;
        var dress = el("button", "set-dress"); dress.textContent = "Dress box"; dress.title = "Apply " + fam.name + " across all faces";
        dress.addEventListener("click", function (e) { e.stopPropagation(); applyPanelSet(fam.id); });
        armHoverPreview(card, function () { return dressDoc(clone(doc), fam); });
        m.append(nm, cnt, dress); card.append(prev, m); sg.appendChild(card);
      });
      body.appendChild(sg);
    } else {
      var fam = fams.find(function (f) { return f.id === panelFamily; }) || fams[0];
      var back = el("button", "insp-back-link"); back.textContent = "‹ All sets"; back.addEventListener("click", function () { panelFamily = null; renderInspector(); });
      body.appendChild(back);
      var gd = group(fam.name + " set", fam.desc);
      var dressAll = el("button", "btn-add"); dressAll.textContent = "✦ Dress whole box in " + fam.name; dressAll.addEventListener("click", function () { applyPanelSet(fam.id); });
      gd.appendChild(dressAll); body.appendChild(gd);
      var hasMsg = function (k) { return (all[k].fields || []).some(function (f) { return f.key === "message"; }) ? 1 : 0; };
      var fronts = fam.members.filter(function (k) { return all[k].group !== "side"; }).sort(function (a, b) { return hasMsg(b) - hasMsg(a); });
      var sides = fam.members.filter(function (k) { return all[k].group === "side"; });
      var isFront = activeFace === "front";
      var sections = isFront ? [["Front panels", fronts, true], ["Side panels", sides, false]] : [["Side panels", sides, true], ["Front panels", fronts, false]];
      sections.forEach(function (sec) {
        if (!sec[1].length) return;
        var lbl = el("div", "stk-grp"); lbl.textContent = sec[0] + (sec[2] ? " · suggested for this face" : "");
        body.appendChild(lbl);
        var grid = el("div", "stk-grid panel-grid");
        sec[1].forEach(function (pid) {
          var c = el("button", "stk-cell panel-cell" + (pid === id ? " on" : "")); c.title = all[pid].name; c.dataset.fkey = "panel-" + pid;
          c.innerHTML = GBX.panelSVG(pid) + '<span class="nm">' + esc(all[pid].name) + "</span>";
          c.addEventListener("click", function () { applyPanel(pid); });
          armHoverPreview(c, function () { var d = clone(doc), fc = d.faces[activeFace]; fc.panel = pid; delete fc.panelText; delete fc.panelScale; fc.layers = []; return d; });
          grid.appendChild(c);
        });
        body.appendChild(grid);
      });
    }
  }

  /* ---------------- tool: gift ---------------- */
  function toolGift(body) {
    var g = group("Assets inside", "These pop out of the box when it opens.");
    var list = el("div", "items"); list.id = "items"; g.appendChild(list);
    var qa = el("div", "chips");
    ["ETH", "BTC", "USDC", "SOL", "USDT", "DEGEN"].forEach(function (tk) { var b = el("button", "chip"); b.textContent = "+ " + tk; b.addEventListener("click", function () { doc.items.push({ ticker: tk, amount: "" }); record(); renderItems(); }); qa.appendChild(b); });
    g.appendChild(qa);
    var addB = el("button", "btn-add"); addB.textContent = "+ Add custom asset"; addB.addEventListener("click", function () { doc.items.push({ ticker: "", amount: "" }); record(); renderItems(); });
    g.appendChild(addB); body.appendChild(g);
    renderItems();

    var g2 = group("Box label");
    g2.appendChild(textField("Brand", function () { return doc.meta.brand; }, function (v, c) { doc.meta.brand = v; if (c) record(); }, { placeholder: "Your Gift" }));
    g2.appendChild(textField("Serial", function () { return doc.meta.serial; }, function (v, c) { doc.meta.serial = v; if (c) record(); }, { placeholder: "optional" }));
    body.appendChild(g2);
  }
  function renderItems() {
    var host = $("#items"); if (!host) return; host.innerHTML = "";
    if (!doc.items.length) { host.appendChild(emptyState("🎁", "No assets yet", "Add ETH, USDC or a custom ticker below.")); return; }
    doc.items.forEach(function (it, i) {
      var row = el("div", "item");
      var tk = el("input", "txt tk"); tk.type = "text"; tk.placeholder = "TICKER"; tk.value = it.ticker || "";
      tk.addEventListener("input", function () { it.ticker = tk.value.toUpperCase().slice(0, 8); }); tk.addEventListener("change", record);
      var am = el("input", "txt"); am.type = "text"; am.placeholder = "amount"; am.value = it.amount || "";
      am.addEventListener("input", function () { it.amount = am.value.slice(0, 16); }); am.addEventListener("change", record);
      var del = el("button", "item-del"); del.textContent = "✕"; del.setAttribute("aria-label", "Remove asset"); del.addEventListener("click", function () { doc.items.splice(i, 1); record(); renderItems(); });
      row.append(tk, am, del); host.appendChild(row);
    });
  }

  /* ---------------- tool: code ---------------- */
  function toolCode(body) {
    var g = group("Document JSON", "The lab speaks the same schema the receive page renders.");
    var ta = el("textarea"); ta.id = "json"; ta.spellcheck = false; ta.value = JSON.stringify(clone(doc));
    g.appendChild(ta);
    var row = el("div", "btn-row");
    var copy = el("button", "btn"); copy.textContent = "Copy JSON"; copy.addEventListener("click", function () { ta.select(); try { navigator.clipboard.writeText(ta.value); } catch (e) {} var old = copy.textContent; copy.textContent = "Copied!"; setTimeout(function () { copy.textContent = old; }, 1200); toast("Copied to clipboard"); });
    var load = el("button", "btn"); load.textContent = "Load JSON"; load.addEventListener("click", function () { try { doc = GBX.normalize(JSON.parse(ta.value)); activeFace = "front"; viewRot = FACE_VIEW.front.slice(); sel = null; rerender(); record(); renderInspector(); updateCrumb(); toast("Loaded"); } catch (e) { toast("Invalid JSON", true); } });
    row.append(copy, load); g.appendChild(row); body.appendChild(g);
    if (ADMIN) { var hint = group("Panel authoring", "Moved to the Panels tab → 'Author a panel'. Drop art on the box, compose, save — no code needed."); body.appendChild(hint); }
  }
  function syncJson() { var ta = $("#json"); if (ta && document.activeElement !== ta) ta.value = JSON.stringify(clone(doc)); }

  /* ---------------- stage toolbar ---------------- */
  function refreshStageToolbar() {
    var bar = $("#stage-toolbar"), hint = $("#hint"); if (!bar) return;
    if (!sel) { bar.hidden = true; if (hint) hint.textContent = flatMode ? "all six faces at once · click a face · ⇧drag selects" : "drag to rotate · click a face · double-click text to type · ⇧drag selects"; return; }
    var L = selLayer(); bar.hidden = false; bar.innerHTML = "";
    bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Element actions");
    var title = el("span", "st-title"); title.textContent = multiSel() ? selAll().length + " selected" : (LAYER_NAME[L.t] || L.t); bar.appendChild(title);
    if (!multiSel() && (L.t === "text" || L.t === "graffiti")) {
      bar.appendChild(stbtn("edit", "Edit text", function () { var nn = mount.querySelector('[data-face="' + sel.face + '"][data-li="' + sel.li + '"]'); if (nn) inlineEdit(nn); }));
      bar.appendChild(el("span", "st-sep"));
    }
    bar.appendChild(stbtn("ctrx", "Center horizontally", function () { centerSel("x"); }));
    bar.appendChild(stbtn("ctry", "Center vertically", function () { centerSel("y"); }));
    bar.appendChild(el("span", "st-sep"));
    bar.appendChild(stbtn("fwd", "Bring forward", function () { moveSel(1); }));
    bar.appendChild(stbtn("back", "Send back", function () { moveSel(-1); }));
    bar.appendChild(el("span", "st-sep"));
    bar.appendChild(stbtn("dup", "Duplicate", dupSel));
    bar.appendChild(stbtn("trash", "Delete", delSel, true));
    if (hint) hint.textContent = "drag to move · corner to resize · ⌫ delete · esc deselect";
  }
  function stbtn(icon, title, fn, danger) { var b = el("button", "stbtn" + (danger ? " danger" : "")); b.type = "button"; b.title = title; b.setAttribute("aria-label", title); b.innerHTML = ICON(icon); b.addEventListener("click", fn); return b; }

  /* ---------------- topbar + rail ---------------- */
  function setTool(id) {
    activeTool = id; sel = null;
    $("#rail").querySelectorAll(".rail-btn").forEach(function (b) { var on = b.dataset.tool === id; b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false"); });
    if (isMobile()) document.body.classList.add("sheet-open");
    markSelection(); renderInspector(); refreshStageToolbar(); updateCrumb();
    if (!isTextEntry(document.activeElement)) focusActiveTool();
  }
  function focusActiveTool() { var ab = document.querySelector("#rail .rail-btn.on"); if (ab) ab.focus(); }
  function toggleSheet() { if (isMobile()) document.body.classList.toggle("sheet-open"); }
  function buildRail() {
    var rail = $("#rail"); rail.innerHTML = ""; rail.setAttribute("role", "tablist"); rail.setAttribute("aria-label", "Editor tools");
    TOOLS.forEach(function (t) {
      var on = t.id === activeTool;
      var b = el("button", "rail-btn" + (on ? " on" : "")); b.dataset.tool = t.id; b.title = t.sub; b.type = "button";
      b.setAttribute("role", "tab"); b.setAttribute("aria-selected", on ? "true" : "false");
      b.innerHTML = '<span class="rail-ic" aria-hidden="true">' + ICON(t.icon) + '</span><span class="rail-lbl">' + t.title + "</span>";
      b.addEventListener("click", function () { setTool(t.id); });
      rail.appendChild(b);
    });
  }
  function buildTopbar() {
    var tb = $("#topbar"); tb.innerHTML = '<span class="tb-logo" aria-hidden="true">G<span class="i1">I</span><span class="i2">I</span><span class="i3">I</span>FT box lab</span><div class="tb-crumb" id="crumb"></div><span class="tb-spacer"></span>';
    function ic(id, icon, title, fn) { var b = el("button", "tb-ic"); b.id = id; b.type = "button"; b.title = title; b.setAttribute("aria-label", title); b.innerHTML = ICON(icon); b.addEventListener("click", fn); return b; }
    tb.appendChild(ic("tb-undo", "undo", "Undo (⌘Z)", undo));
    tb.appendChild(ic("tb-redo", "redo", "Redo (⌘⇧Z)", redo));
    var d1 = el("span", "tb-divider"); tb.appendChild(d1);
    tb.appendChild(ic("tb-help", "help", "Shortcuts", toggleHelp));
    var open = el("button", "tb-btn primary"); open.textContent = "Open lid"; open.addEventListener("click", openLid); tb.appendChild(open);
    var reset = el("button", "tb-btn"); reset.textContent = "Reset"; reset.addEventListener("click", resetDoc); tb.appendChild(reset);
  }
  function openLid() {
    if (flatMode) setFlat(false);                            // the reveal is a 3D moment: fold first
    var handle = GBX.render(mount, doc, { mode: "edit", burst: true });
    var box = mount.querySelector(".gbx-box"); box.style.transform = "rotateY(" + viewRot[0] + "deg) rotateX(" + viewRot[1] + "deg)";
    setTimeout(function () { handle.open(); }, 60);   // (attachBox was removed with the per-node listeners; the stage arbiter covers the rebuilt box)
  }
  var helpOpen = false;
  function toggleHelp() {
    var ex = $("#help-pop"); if (ex) { ex.remove(); helpOpen = false; return; }
    var p = el("div", "help-pop"); p.id = "help-pop";
    p.innerHTML = "<h4>Keyboard</h4>" +
      kb("Undo / Redo", "⌘Z / ⌘⇧Z") + kb("Duplicate", "⌘D") + kb("Delete element", "⌫") +
      kb("Nudge / big nudge", "Arrows / ⇧Arrows") + kb("Resize element", "+ / −") + kb("Deselect", "Esc") +
      kb("Select all on face", "⌘A") + kb("Marquee select", "⇧Drag") +
      kb("Rotate box (box focused)", "Arrows") + kb("Jump to a face", "1 – 6") + kb("Orbit (hold)", "Space") + kb("Unfold / fold the box", "U") + kb("Finish editing text", "Enter / Esc") +
      '<div class="grp-note" style="margin-top:10px">Drag the bare box or empty space to turn it. Press an element to move it, the grip to rotate, the corner to resize. Double-click text to edit it (panel wording or your own), or an empty spot to add text. Toggle Orbit (or hold Space) to turn the box without touching your elements.</div>';
    document.body.appendChild(p); helpOpen = true;
    setTimeout(function () { document.addEventListener("pointerdown", closeHelp, { once: true }); }, 0);
  }
  function closeHelp(e) { var p = $("#help-pop"); if (p && !p.contains(e.target) && e.target.id !== "tb-help") { p.remove(); helpOpen = false; } else if (p) document.addEventListener("pointerdown", closeHelp, { once: true }); }
  function kb(label, keys) { return '<div class="kb"><span>' + label + "</span><kbd>" + keys + "</kbd></div>"; }

  /* ---------------- pointer arbiter (one gesture, decided once, never hijacked) ---------------- */
  function orbiting() { return orbit || spaceDown; }
  function setOrbitVisual() {
    stage.classList.toggle("can-orbit", orbiting());
    var b = $("#orbit-toggle"); if (b) { b.classList.toggle("on", orbit); b.setAttribute("aria-checked", orbit ? "true" : "false"); }
  }
  function bindStage() {
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onUp);
    stage.addEventListener("lostpointercapture", onUp);
    stage.addEventListener("pointerover", onHoverIn);
    stage.addEventListener("pointerout", onHoverOut);
    stage.addEventListener("contextmenu", onCtxMenu);
  }
  /* hovering an element on the box lights its row in the Layers stack (and vice versa, see toolLayers) */
  function onHoverIn(e) {
    if (gesture || editingText || placeType || orbiting()) return;
    var n = e.target.closest && e.target.closest("[data-li]");
    if (!n || n.dataset.face !== activeFace) return;
    n.classList.add("gbx-hov");
    if (inspBody) { var row = inspBody.querySelector('.lyr[data-li="' + n.dataset.li + '"]'); if (row) row.classList.add("hov"); }
  }
  function onHoverOut(e) {
    var n = e.target.closest && e.target.closest("[data-li]");
    if (!n || (e.relatedTarget && n.contains(e.relatedTarget))) return;
    n.classList.remove("gbx-hov");
    if (inspBody) { var row = inspBody.querySelector('.lyr[data-li="' + n.dataset.li + '"]'); if (row) row.classList.remove("hov"); }
  }
  function onDown(e) {
    if (e.button != null && e.button > 0) return;            // primary button / touch only
    if (gesture || editingText) return;                       // one gesture at a time; locked while typing
    var t = e.target;
    if (t.closest && (t.closest(".stage-toolbar") || t.closest(".zoom-ctl") || t.closest(".orbit-toggle") || t.closest(".unfold-toggle") || t.closest(".place-banner") || t.closest(".coach") || t.closest(".coach-veil") || t.closest(".face-bar"))) return;
    t = resolveStageTarget(t, e.clientX, e.clientY);          // side faces: hit-test misses, coordinates don't
    if (placeType) {                                          // place mode: drop the armed element where you click
      var pf = t.closest && t.closest(".gbx-face");
      if (pf) placeArmedAt(pf, e); else clearPlaceMode();
      e.preventDefault(); return;
    }
    if (t.closest(".gbx-rot")) return beginGesture(e, "elrotate");
    if (t.closest(".gbx-rs")) return beginGesture(e, "elresize");
    if (orbiting()) return beginGesture(e, "orbit");          // safe-rotate override
    var ln = t.closest("[data-li]");
    if (ln) {
      if (e.shiftKey && ln.dataset.face === activeFace) {     // shift-click: toggle into / out of the selection, no drag
        selectLayer(activeFace, +ln.dataset.li, true);
        e.preventDefault(); return;
      }
      var pL = doc.faces[ln.dataset.face] && doc.faces[ln.dataset.face].layers[+ln.dataset.li];
      if (pL && pL.locked) { selectLayer(ln.dataset.face, +ln.dataset.li); e.preventDefault(); return; }   // locked: select it (so you can unlock) but never drag
      return beginGesture(e, "layer", ln);                    // press a layer -> move it (the whole selection if it's a member)
    }
    if (e.shiftKey) return beginGesture(e, "marquee");        // shift-drag on bare face / empty space = rubber-band select
    var fc = t.closest(".gbx-face");
    if (fc) return beginGesture(e, "face", fc);               // bare face -> tap selects, drag rotates
    beginGesture(e, "orbit");                                 // empty space -> rotate
  }
  function beginGesture(e, kind, node) {
    var box = mount.querySelector(".gbx-box"); if (!box) return;
    try { stage.setPointerCapture(e.pointerId); } catch (_) {}
    gesture = { kind: kind, id: e.pointerId, node: node || null, x0: e.clientX, y0: e.clientY, moved: false, box: box, size: (box.offsetWidth || 360) * zoom };
    if (kind === "orbit" || kind === "face") { gesture.ry = viewRot[0]; gesture.rx = viewRot[1]; }
    if (kind === "face") gesture.face = node.dataset.pos;
    if (kind === "layer") {
      var face = node.dataset.face, li = +node.dataset.li;
      if (!isSel(face, li)) selectLayer(face, li);            // fresh press collapses to that one; a selected member keeps the set (group drag)
      box = mount.querySelector(".gbx-box");                  // re-fetch: selectLayer may have re-rendered
      gesture.box = box; gesture.size = (box.offsetWidth || 360) * zoom;
      gesture.node = box.querySelector('[data-face="' + face + '"][data-li="' + li + '"]') || node;
      gesture.L = doc.faces[face].layers[li];
      gesture.sx = gesture.L.x; gesture.sy = gesture.L.y;
      gesture.group = selAll().map(function (gi) {            // every UNLOCKED member rides the drag (locked ones sit out); the pressed one drives snapping
        var ML = doc.faces[face].layers[gi];
        return (ML && !ML.locked) ? { L: ML, sx: ML.x, sy: ML.y, node: box.querySelector('[data-face="' + face + '"][data-li="' + gi + '"]') } : null;
      }).filter(Boolean);
      gesture.faceEl = box.querySelector('.gbx-face[data-pos="' + face + '"]');
      gesture.size = faceDragSize(gesture.faceEl, box);
    }
    if (kind === "elresize" || kind === "elrotate") {
      var L = selLayer(); if (!L) { gesture = null; return; }
      gesture.L = L;
      if (kind === "elresize") {
        gesture.sw = (L.w != null ? L.w : L.size != null ? L.size : .3); gesture.sh = (L.h != null ? L.h : .3);
        gesture.prop = (L.w != null) ? "w" : (L.size != null ? "size" : "w");
        gesture.size = faceDragSize(box.querySelector('.gbx-face[data-pos="' + activeFace + '"]'), box);
        if (multiSel()) {                                     // group scale: sizes multiply, positions spread about the group centre
          var mems = [], sumx = 0, sumy = 0;
          selAll().forEach(function (gi) {
            var ML = doc.faces[sel.face].layers[gi]; if (!ML || ML.locked) return;   // locked members sit out group transforms
            mems.push({ L: ML, sw: ML.w != null ? ML.w : null, ssz: ML.size != null ? ML.size : null, sh: ML.h != null ? ML.h : null, sx: ML.x, sy: ML.y });
            sumx += ML.x; sumy += ML.y;
          });
          if (mems.length > 1) { gesture.members = mems; gesture.gcx = sumx / mems.length; gesture.gcy = sumy / mems.length; }
        }
      } else {
        if (multiSel()) {                                     // group rotate: spin every member about the group centroid
          var rmems = [], rsx = 0, rsy = 0;
          selAll().forEach(function (gi) { var ML = doc.faces[sel.face].layers[gi]; if (!ML || ML.locked) return; rmems.push({ L: ML, sx: ML.x, sy: ML.y, srot: ML.rotate || 0 }); rsx += ML.x; rsy += ML.y; });   // locked members sit out group transforms
          gesture.members = rmems; gesture.gcx = rsx / rmems.length; gesture.gcy = rsy / rmems.length;
          var rfe = box.querySelector('.gbx-face[data-pos="' + sel.face + '"]'), rfr = (rfe || box).getBoundingClientRect();
          gesture.cx = rfr.left + gesture.gcx * rfr.width; gesture.cy = rfr.top + gesture.gcy * rfr.height;
        } else {
          var rn = box.querySelector('[data-face="' + sel.face + '"][data-li="' + sel.li + '"]');
          var rr = (rn || box).getBoundingClientRect();
          gesture.cx = rr.left + rr.width / 2; gesture.cy = rr.top + rr.height / 2;
        }
        gesture.a0 = Math.atan2(e.clientY - gesture.cy, e.clientX - gesture.cx);
        gesture.rot0 = L.rotate || 0;
      }
    }
    if (kind === "marquee") {
      var mq = el("div", "gbx-marquee");
      mq.style.cssText = "position:fixed;border:1px dashed var(--acc,#00ff9d);background:rgba(0,255,157,.07);z-index:80;pointer-events:none;left:" + e.clientX + "px;top:" + e.clientY + "px;width:0;height:0";
      document.body.appendChild(mq);
      gesture.mq = mq;
    }
    if (kind === "orbit" && !flatMode) { box.style.transition = "none"; stage.classList.add("dragging"); }
    e.preventDefault();
  }
  function onMove(e) {
    if (!gesture || e.pointerId !== gesture.id) return;
    var dx = e.clientX - gesture.x0, dy = e.clientY - gesture.y0;
    if (!gesture.moved) {
      if (Math.abs(dx) < THRESH && Math.abs(dy) < THRESH) return;   // below threshold = still a click, do nothing
      gesture.moved = true;
      if (gesture.kind === "face" && !flatMode) { gesture.kind = "orbit"; gesture.box.style.transition = "none"; stage.classList.add("dragging"); }
    }
    if (gesture.kind === "orbit") { if (flatMode) return; viewRot[0] = gesture.ry + dx * 0.4; viewRot[1] = clamp(gesture.rx - dy * 0.4, -90, 90); applyView(); }
    else if (gesture.kind === "marquee") doMarquee(e);
    else if (gesture.kind === "layer") doLayerDrag(e);
    else if (gesture.kind === "elresize") doResize(e);
    else if (gesture.kind === "elrotate") doElRotate(e);
  }
  function doMarquee(e) {
    var g = gesture, x0 = Math.min(g.x0, e.clientX), y0 = Math.min(g.y0, e.clientY);
    var w = Math.abs(e.clientX - g.x0), h = Math.abs(e.clientY - g.y0);
    g.mq.style.left = x0 + "px"; g.mq.style.top = y0 + "px"; g.mq.style.width = w + "px"; g.mq.style.height = h + "px";
    g.rect = { left: x0, top: y0, right: x0 + w, bottom: y0 + h };
  }
  function onUp(e) {
    if (!gesture || (e.pointerId != null && e.pointerId !== gesture.id)) return;
    var g = gesture; gesture = null;
    try { stage.releasePointerCapture(g.id); } catch (_) {}
    stage.classList.remove("dragging"); clearGuides(g);
    if (g.kind === "marquee") {                               // select everything the band touched on the active face
      if (g.mq) g.mq.remove();
      if (g.moved && g.rect) {
        var hits = [];
        mount.querySelectorAll('.gbx-face[data-pos="' + activeFace + '"] [data-li]').forEach(function (n2) {
          var r2b = n2.getBoundingClientRect();
          if (r2b.width && r2b.left < g.rect.right && r2b.right > g.rect.left && r2b.top < g.rect.bottom && r2b.bottom > g.rect.top) hits.push(+n2.dataset.li);
        });
        if (hits.length) {
          var FLm = doc.faces[activeFace].layers, hitSet = {};   // a marquee that touches one member takes the whole group
          hits.forEach(function (h) { hitSet[h] = 1; var gv = FLm[h] && FLm[h].grp; if (gv != null) grpMembers(activeFace, gv).forEach(function (i2) { hitSet[i2] = 1; }); });
          hits = Object.keys(hitSet).map(Number);
          hits.sort(function (a, b) { return a - b; });
          sel = { face: activeFace, li: hits[hits.length - 1] };   // topmost = anchor
          selX = hits.slice(0, -1);
          markSelection(); renderInspector(); refreshStageToolbar(); updateCrumb();
          announce(hits.length + " element" + (hits.length > 1 ? "s" : "") + " selected");
        } else selectLayer(null);
      }
      return;
    }
    if (!g.moved) {                                           // a tap, not a drag
      var now = Date.now();
      var dbl = (now - lastTapT < TAP_MS) && Math.abs(g.x0 - lastTapX) < TAP_SLOP && Math.abs(g.y0 - lastTapY) < TAP_SLOP;
      lastTapT = dbl ? 0 : now; lastTapX = g.x0; lastTapY = g.y0;   // reset on dbl so a triple doesn't re-fire
      if (dbl) { handleDoubleTap(g); return; }
      if (g.kind === "face") { if (g.face !== activeFace) setActiveFace(g.face); else selectLayer(null); }
      else if (g.kind === "orbit" && !orbiting()) selectLayer(null);   // click empty space to deselect
      return;
    }
    if (g.kind === "layer" || g.kind === "elresize" || g.kind === "elrotate") { record(); renderInspector(); }
    else if (g.kind === "orbit" && !flatMode) settleToFace(); // free spin released -> glide to the nearest face
  }
  // After an orbit drag ends, ease the view to the nearest squared-up face so the box
  // never rests at an awkward angle. Yaw snaps to the closest 90° in the SAME revolution
  // (no unwinding spins), so the equivalent face is derived from the snapped quadrant.
  function settleToFace() {
    var yaw = viewRot[0], pitch = viewRot[1], face, ty, tp;
    if (pitch <= -50) { face = "top"; ty = Math.round(yaw / 90) * 90; tp = -86; }
    else if (pitch >= 50) { face = "bottom"; ty = Math.round(yaw / 90) * 90; tp = 86; }
    else {
      var q = Math.round(yaw / 90); ty = q * 90;
      face = ["front", "left", "back", "right"][((q % 4) + 4) % 4];
      tp = face === "front" ? -6 : 0;
    }
    viewRot = [ty, tp];
    var box = mount.querySelector(".gbx-box");
    if (box) box.style.transition = reducedMotion() ? "none" : "transform .45s cubic-bezier(.5,.02,.2,1)";
    applyView();
    if (face === activeFace) { refreshFaceStrip(); return; }
    // adopt the settled face as active WITHOUT rerendering — a rebuild would cut the glide
    activeFace = face;
    if (sel && sel.face !== face) { sel = null; selX = []; }
    if (box) {
      var old = box.querySelector('.gbx-face[data-active="1"]'); if (old) old.removeAttribute("data-active");
      var sf = box.querySelector('.gbx-face[data-pos="' + face + '"]'); if (sf) sf.dataset.active = "1";
    }
    markSelection(); refreshFaceNet(); refreshFaceStrip(); renderInspector(); refreshStageToolbar(); updateCrumb();
    announce(cap(face) + " face");
  }
  function clearGuides(g) { if (!g) return; if (g.gv) g.gv.remove(); if (g.gh) g.gh.remove(); if (g.ro) g.ro.remove(); g.gv = g.gh = g.ro = null; }
  function guide(faceEl, cls) { if (cls === "readout") { var r = el("div", "gbx-readout"); faceEl.appendChild(r); return r; } var g = el("div", "gbx-guide " + cls); faceEl.appendChild(g); return g; }
  // Screen-x equals face-x on every visible face: each face's own rotation cancels the view
  // yaw that squares it up (back is rotY(180) seen at yaw 180, etc.), and any face you can
  // grab has cos(total yaw) > 0. The old per-face mirror sign for back/left moved elements
  // opposite to the cursor there.
  // Sibling alignment targets on the active face (each element's centre + both edges),
  // excluding the dragged element(s). Computed once per drag — siblings don't move.
  function dragSnapTargets(g) {
    var face = (sel && sel.face) || activeFace;
    var layers = (doc.faces[face] && doc.faces[face].layers) || [];
    var moving = {};
    (g.group && g.group.length ? g.group : [{ L: g.L }]).forEach(function (m) { var i = layers.indexOf(m.L); if (i >= 0) moving[i] = 1; });
    var X = [], Y = [];
    layers.forEach(function (S, i) {
      if (moving[i] || !S) return;
      var ex = elExtents(S);
      X.push(S.x, S.x - ex.hw, S.x + ex.hw);
      Y.push(S.y, S.y - ex.hh, S.y + ex.hh);
    });
    return { X: X, Y: Y };
  }
  // Snap one axis: align the dragged centre OR either edge to a sibling target (pink "el" guide),
  // the .25/.5/.75 grid (centre only), or the 0/1 face border (edges). Closest within T wins.
  function snapAxis(c, he, elTs, T) {
    var best = null;
    function take(target, pt, isEl) { var d = Math.abs(target - pt); if (d <= T && (!best || d < best.d)) best = { d: d, c: c + (target - pt), guide: target, el: isEl }; }
    elTs.forEach(function (t) { take(t, c, true); take(t, c - he, true); take(t, c + he, true); });
    [0.25, 0.5, 0.75].forEach(function (t) { take(t, c, false); });
    [0, 1].forEach(function (t) { take(t, c - he, false); take(t, c + he, false); });
    return best || { c: c, guide: null, el: false };
  }
  // Resize snapping: the centre stays put, so snap a MOVING EDGE to a sibling target (or the
  // face border) by adjusting the half-extent. Single-layer resize only — group scale stays free.
  function snapEdge(c, he, elTs, T) {
    var best = null;
    function take(target, isEl) {
      var d = Math.min(Math.abs(target - (c + he)), Math.abs(target - (c - he))), nhe = Math.abs(target - c);
      if (d <= T && nhe > .025 && (!best || d < best.d)) best = { d: d, he: nhe, guide: target, el: isEl };
    }
    elTs.forEach(function (t) { take(t, true); });
    [0, 1].forEach(function (t) { take(t, false); });
    return best || { he: he, guide: null, el: false };
  }
  function drawResizeGuide(g, axis, snap) {                    // doResize rerenders every move, so guides are re-created fresh on the NEW face node
    var fe = mount.querySelector('.gbx-face[data-pos="' + ((sel && sel.face) || activeFace) + '"]'); if (!fe) return;
    if (snap.guide == null) { if (axis === "v") g.gv = null; else g.gh = null; return; }
    var gl = guide(fe, axis); if (snap.el) gl.classList.add("el");
    if (axis === "v") { gl.style.left = (snap.guide * 100) + "%"; g.gv = gl; } else { gl.style.top = (snap.guide * 100) + "%"; g.gh = gl; }
  }
  function doLayerDrag(e) {
    var g = gesture, L = g.L;
    if (!g.snapT) g.snapT = dragSnapTargets(g);             // siblings are static for the drag — compute targets once
    var ext = elExtents(L), T = Math.max(0.012, 7 / g.size);
    var rx = snapAxis(clamp01(g.sx + (e.clientX - g.x0) / g.size), ext.hw, g.snapT.X, T);
    var ry = snapAxis(clamp01(g.sy + (e.clientY - g.y0) / g.size), ext.hh, g.snapT.Y, T);
    L.x = clamp01(rx.c); L.y = clamp01(ry.c);
    g.node.style.left = (L.x * 100) + "%"; g.node.style.top = (L.y * 100) + "%";
    if (g.group && g.group.length > 1) {
      var gdx = L.x - g.sx, gdy = L.y - g.sy;                // the snapped anchor drives the whole group
      g.group.forEach(function (m) {
        if (m.L === L) return;
        m.L.x = clamp01(m.sx + gdx); m.L.y = clamp01(m.sy + gdy);
        if (m.node) { m.node.style.left = (m.L.x * 100) + "%"; m.node.style.top = (m.L.y * 100) + "%"; }
      });
    }
    var fe = g.faceEl; if (!fe) return;
    if (rx.guide != null) { g.gv = g.gv || guide(fe, "v"); g.gv.style.left = (rx.guide * 100) + "%"; g.gv.classList.toggle("el", !!rx.el); } else if (g.gv) { g.gv.remove(); g.gv = null; }
    if (ry.guide != null) { g.gh = g.gh || guide(fe, "h"); g.gh.style.top = (ry.guide * 100) + "%"; g.gh.classList.toggle("el", !!ry.el); } else if (g.gh) { g.gh.remove(); g.gh = null; }
    g.ro = g.ro || guide(fe, "readout"); g.ro.style.left = (L.x * 100) + "%"; g.ro.style.top = (L.y * 100) + "%"; g.ro.textContent = Math.round(L.x * 100) + ", " + Math.round(L.y * 100);
  }
  function doResize(e) {
    var g = gesture, L = g.L; var d = (e.clientX - g.x0) / g.size * 2;
    if (g.members && g.members.length > 1) {
      var f2 = clamp((g.sw + d) / (g.sw || .3), .1, 8);        // scale factor from the anchor's own resize
      g.members.forEach(function (m) {
        if (m.sw != null) m.L.w = clamp(m.sw * f2, .05, 1);
        if (m.ssz != null) m.L.size = clamp(m.ssz * f2, .02, .5);
        if (m.sh != null) m.L.h = clamp(m.sh * f2, .05, 1);
        m.L.x = clamp01(g.gcx + (m.sx - g.gcx) * f2);
        m.L.y = clamp01(g.gcy + (m.sy - g.gcy) * f2);
      });
      rerender(); return;
    }
    var sxr = null, syr = null;
    if (g.prop === "size") L.size = clamp(g.sw + d, .02, .5);   // glyph-scale layers (stamps/seals) don't edge-snap
    else {
      if (!g.snapT) g.snapT = dragSnapTargets(g);
      var T3 = Math.max(0.012, 7 / g.size);
      var nw = clamp(g.sw + d, .05, 1);
      sxr = snapEdge(L.x, nw / 2, g.snapT.X, T3);
      L.w = sxr.guide != null ? clamp(sxr.he * 2, .05, 1) : nw;
    }
    if (L.t === "decal" || L.t === "art" || L.t === "fade") {
      if (!g.snapT) g.snapT = dragSnapTargets(g);
      var nh = clamp(g.sh + (e.clientY - g.y0) / g.size * 2, .05, 1);
      syr = snapEdge(L.y, nh / 2, g.snapT.Y, Math.max(0.012, 7 / g.size));
      L.h = syr.guide != null ? clamp(syr.he * 2, .05, 1) : nh;
    }
    rerender();
    if (sxr) drawResizeGuide(g, "v", sxr);                      // after rerender: the face node is fresh
    if (syr) drawResizeGuide(g, "h", syr);
  }
  function doElRotate(e) {
    var g = gesture, L = g.L;
    var deg = (Math.atan2(e.clientY - g.cy, e.clientX - g.cx) - g.a0) * 180 / Math.PI;
    if (g.members && g.members.length > 1) {                  // group: rotate each member's position about the centroid + spin the member
      var d = e.shiftKey ? Math.round(deg / 15) * 15 : deg, rad = d * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
      g.members.forEach(function (m) {
        var dx = m.sx - g.gcx, dy = m.sy - g.gcy;
        m.L.x = clamp01(g.gcx + dx * cs - dy * sn);
        m.L.y = clamp01(g.gcy + dx * sn + dy * cs);
        m.L.rotate = Math.round(m.srot + d);
      });
      rerender(); return;
    }
    var v = g.rot0 + deg; if (e.shiftKey) v = Math.round(v / 15) * 15;
    L.rotate = Math.round(v); rerender();
  }
  // px-per-face-fraction for cursor math: the face's projected on-screen size, not the box's
  // layout width — perspective renders faces ~15% larger than --gbx-size, so offsetWidth-based
  // math makes dragged elements lead the cursor and placements land past the tap point.
  // The projected rect also bakes in zoom. Falls back to layout size when the rect is collapsed.
  function faceDragSize(faceEl, box) {
    var r = faceEl && faceEl.getBoundingClientRect();
    var s = r ? Math.max(r.width, r.height) : 0;               // tilted faces compress one axis; the larger is truer
    return s > 40 ? s : ((box || mount.querySelector(".gbx-box") || {}).offsetWidth || 360) * zoom;
  }
  function overFace(face, x, y) {                              // .gbx-box rect collapses to 0 when a side face is squared up; use the face's own rect
    var fe = mount.querySelector('.gbx-face[data-pos="' + face + '"]'); if (!fe) return false;
    var r = fe.getBoundingClientRect(); if (!r.width || !r.height) return false;
    return x >= r.left - 8 && x <= r.right + 8 && y >= r.top - 8 && y <= r.bottom + 8;
  }
  function inRectPad(node, x, y, pad) {
    var r = node.getBoundingClientRect(); if (!r.width && !r.height) return false;
    return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
  }
  // DOM hit-testing through the 3D transform can miss everything on a squared-up side face —
  // the tap resolves to the scene/stage even though it visually lands on the box. When the DOM
  // target is that uninformative, re-derive the intent from coordinates on the active face:
  // selection handles first (visually topmost), then layers, then the face itself.
  function resolveStageTarget(t, x, y) {
    if (t.closest && (t.closest(".gbx-rot") || t.closest(".gbx-rs") || t.closest("[data-li]") || t.closest(".gbx-face"))) return t;
    var rot = mount.querySelector(".gbx-rot"); if (rot && inRectPad(rot, x, y, 6)) return rot;
    var rs = mount.querySelector(".gbx-rs"); if (rs && inRectPad(rs, x, y, 6)) return rs;
    // True 3D hit-test (respects the projected quad): empty space around an ANGLED box resolves to
    // nothing-on-the-box, so the gesture orbits, instead of a layer's loose axis-aligned rect catching it.
    var real = faceOrLayerFromPoint(x, y); if (real) return real;
    // No surface under the point. Only recover via coordinate math when a face is squared-up (flat to
    // camera): there the box rect collapses and DOM hit-testing can miss the face, but the face's own
    // rect is axis-tight so the AABB test is safe. On an ANGLED box a miss means the point is genuinely
    // off the box → leave it for orbit (this is the fix: no more phantom layer-drags in empty space).
    if (faceIsSquaredUp(activeFace)) {
      var ln = layerAtPoint(activeFace, x, y); if (ln) return ln;
      if (overFace(activeFace, x, y)) return mount.querySelector('.gbx-face[data-pos="' + activeFace + '"]') || t;
    }
    return t;
  }
  // the real element under a screen point via the browser's 3D-aware hit test: a layer on the active
  // face (→ drag-move), else any face surface (→ tap-select / drag-rotate), else null (→ orbit).
  function faceOrLayerFromPoint(x, y) {
    var els = document.elementsFromPoint(x, y);
    for (var i = 0; i < els.length; i++) {
      var e = els[i]; if (!e.closest) continue;
      var li = e.closest("[data-li]"); if (li && li.dataset.face === activeFace) return li;
      var fc = e.closest(".gbx-face"); if (fc) return fc;
    }
    return null;
  }
  // is the view aligned flat-on to this face? (then its rect is axis-tight, so AABB recovery is safe)
  function faceIsSquaredUp(face) {
    var tv = FACE_VIEW[face]; if (!tv) return false;
    var ty = nearYaw(tv[0], viewRot[0]);
    return Math.abs(viewRot[0] - ty) < 8 && Math.abs(viewRot[1] - tv[1]) < 8;
  }
  function handleDoubleTap(g) {
    if (editingText || placeType) return;
    if (g.kind === "layer" && g.node) {                       // double-tap a text element -> edit it
      var ln = g.node.closest ? g.node.closest("[data-li]") : g.node;
      if (ln) inlineEdit(ln);
      return;
    }
    // 3D hit-testing returns a wrapper (.gbx-scene) over rotated / side faces, so the tap reads as "orbit".
    // Resolve the face we mean: the specific face if one was hit, otherwise the face we're looking at (active).
    var face = (g.kind === "face" && g.face) ? g.face : activeFace;
    var f = doc.faces[face]; if (!f) return;
    if (face !== activeFace) { setActiveFace(face); if (!flatMode) return; }   // 3D squares up first; flat cells are already in view, act immediately
    // hit-testing can miss layer nodes on squared-up faces (same collapse that breaks panel text),
    // so the tap arrives as "face"/"orbit" even over an element: resolve layers by coordinates first
    var hitNode = layerAtPoint(face, g.x0, g.y0);
    if (hitNode) {
      var hli = +hitNode.dataset.li, hL = f.layers[hli];
      selectLayer(face, hli);
      if (hL && (hL.t === "text" || hL.t === "graffiti")) {
        var hn = mount.querySelector('[data-face="' + face + '"][data-li="' + hli + '"]');
        if (hn) inlineEdit(hn);
      }
      return;
    }
    if (f.panel) {                                            // paneled face -> edit the panel's wording
      var textEl = textAtPoint(face, g.x0, g.y0);             // panel text isn't hit-testable; find by coordinates
      if (textEl) {
        var field = panelFieldAt(face, textEl);
        if (field) { editPanelField(face, field, textEl); return; }
      }
      if (overFace(face, g.x0, g.y0)) { setTool("panels"); toast("Edit this panel's wording in the Panels tool"); }
      return;
    }
    // bare face -> create text where you tapped
    if (!overFace(face, g.x0, g.y0)) return;                  // ignore real empty-space double-taps
    var faceEl = mount.querySelector('.gbx-face[data-pos="' + face + '"]'); if (!faceEl) return;
    var pt = faceLocalXY(faceEl, { clientX: g.x0, clientY: g.y0 });
    var li = addLayerAt("text", pt.x, pt.y);
    var n = mount.querySelector('[data-face="' + face + '"][data-li="' + li + '"]'); if (n) inlineEdit(n, true);
  }
  // find the layer element whose box contains the point (coordinate twin of textAtPoint, for the same reason)
  function layerAtPoint(face, x, y) {
    var nodes = mount.querySelectorAll('.gbx-face[data-pos="' + face + '"] [data-li]');
    var best = null, bestArea = Infinity;
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect(); if (!r.width || !r.height) continue;
      if (x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 4 && y <= r.bottom + 4) {
        var area = r.width * r.height; if (area < bestArea) { bestArea = area; best = nodes[i]; }  // smallest = most specific
      }
    }
    return best;
  }
  // find the panel <text>/<tspan> whose box contains the point (hit-testing can't reach pointer-events:none SVG)
  function textAtPoint(face, x, y) {
    var panel = mount.querySelector('.gbx-face[data-pos="' + face + '"] .gbx-panel'); if (!panel) return null;
    var nodes = panel.querySelectorAll("text, tspan"), best = null, bestArea = Infinity;
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect(); if (!r.width || !r.height) continue;
      if (x >= r.left - 4 && x <= r.right + 4 && y >= r.top - 4 && y <= r.bottom + 4) {
        var area = r.width * r.height; if (area < bestArea) { bestArea = area; best = nodes[i]; }  // smallest = most specific line
      }
    }
    return best;
  }
  // map a double-clicked panel <text> to its editable field by matching the rendered text to field values
  function panelFieldAt(face, textEl) {
    var id = doc.faces[face].panel, p = GBX.PANELS[id];
    if (!p || !p.fields || !p.fields.length) return null;
    var pt = doc.faces[face].panelText || {};
    function cur(fld) { return String((pt[fld.key] != null ? pt[fld.key] : fld.value) || "").trim(); }
    var clicked = (textEl.textContent || "").trim(); if (!clicked) return null;
    var cu = clicked.toUpperCase();
    var exact = p.fields.filter(function (fld) { return cur(fld).toUpperCase() === cu; });
    if (exact.length === 1) return exact[0];
    var loose = p.fields.filter(function (fld) { var v = cur(fld).toUpperCase(); return v && (v.indexOf(cu) >= 0 || cu.indexOf(v) >= 0); });
    if (loose.length === 1) return loose[0];
    return null;                                              // static text or ambiguous -> caller routes to Panels tool
  }
  function editPanelField(face, field, textEl) {
    var fc = doc.faces[face], pt = fc.panelText || {};
    var curVal = (pt[field.key] != null ? pt[field.key] : field.value) || "";
    var rect = textEl.getBoundingClientRect();
    var scale0 = (fc.panelScale && fc.panelScale[field.key]) || 1, scale = scale0;
    var wrap = el("div", "panel-edit-wrap");
    wrap.style.left = Math.max(8, rect.left - 38) + "px";
    wrap.style.top = Math.max(8, rect.top - 4) + "px";
    var inp = el("input", "panel-edit"); inp.type = "text"; inp.value = curVal; inp.maxLength = field.max || 60;
    inp.setAttribute("aria-label", field.label || "Panel text");
    inp.style.minWidth = Math.max(rect.width + 18, 90) + "px";
    function applyScale(v) {                                  // live: the text under the editor grows/shrinks
      scale = clamp(Math.round(v * 100) / 100, .4, 2.5);
      fc.panelScale = fc.panelScale || {};
      if (Math.abs(scale - 1) < .01) delete fc.panelScale[field.key]; else fc.panelScale[field.key] = scale;
      if (!Object.keys(fc.panelScale).length) delete fc.panelScale;
      rerender();
      announce("Text size " + Math.round(scale * 100) + " percent");
    }
    function sizeBtn(label, dir, title) {
      var b = el("button", "pe-size"); b.type = "button"; b.textContent = label; b.title = title;
      b.setAttribute("aria-label", title);
      b.addEventListener("pointerdown", function (e) { e.preventDefault(); });   // keep focus (and the blur-commit) on the input
      b.addEventListener("click", function () { applyScale(dir > 0 ? scale * 1.12 : scale / 1.12); });
      return b;
    }
    wrap.append(sizeBtn("A−", -1, "Smaller text (↓)"), inp, sizeBtn("A+", 1, "Larger text (↑)"));
    document.body.appendChild(wrap);
    editingText = true; inp.focus(); inp.select();
    var done = false;
    function commit(save, headedTo) {
      if (done) return; done = true; editingText = false;
      if (save) {
        fc.panelText = fc.panelText || {}; fc.panelText[field.key] = inp.value.slice(0, field.max || 60);
        rerender(); record(); renderInspector();              // one record captures wording + size together
      } else if (Math.abs(scale - scale0) > .005) {
        applyScale(scale0);                                   // cancel: put the size back too
      }
      wrap.remove();
      restoreStageFocus(headedTo);
    }
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commit(true); }
      else if (e.key === "Escape") { e.preventDefault(); commit(false); }
      else if (e.key === "ArrowUp") { e.preventDefault(); applyScale(scale * 1.12); }
      else if (e.key === "ArrowDown") { e.preventDefault(); applyScale(scale / 1.12); }
      e.stopPropagation();
    });
    inp.addEventListener("blur", function (ev) { commit(true, ev && ev.relatedTarget); });
    announce("Editing " + (field.label || "panel text") + ". Type to change the wording; A plus and A minus (or up and down arrows) resize it. Enter to save, Escape to cancel.");
  }
  function faceLocalXY(faceEl, e) {
    var size = faceDragSize(faceEl, mount.querySelector(".gbx-box"));
    var r = faceEl.getBoundingClientRect(); var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return { x: clamp01(.5 + (e.clientX - cx) / size), y: clamp01(.5 + (e.clientY - cy) / size) };
  }

  /* ---------------- context menu ---------------- */
  function closeCtxMenu() {
    var m = $("#ctx-menu"); if (!m) return;
    m.remove();
    document.removeEventListener("pointerdown", ctxAway, true);
    document.removeEventListener("keydown", ctxKeys, true);
  }
  function ctxAway(e) { var m = $("#ctx-menu"); if (m && !m.contains(e.target)) closeCtxMenu(); }
  function ctxKeys(e) {
    var m = $("#ctx-menu"); if (!m) return;
    var items = Array.from(m.querySelectorAll("button"));
    var idx = items.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeCtxMenu(); stage.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); items[(idx + 1) % items.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); items[(idx - 1 + items.length) % items.length].focus(); }
    else if (e.key === "Tab") { e.preventDefault(); items[(idx + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus(); }
  }
  function openCtxMenu(x, y, entries) {
    closeCtxMenu();
    var m = el("div", "ctx-menu"); m.id = "ctx-menu"; m.setAttribute("role", "menu");
    entries.forEach(function (en) {
      if (en === "-") { m.appendChild(el("div", "sep")); return; }
      var b = el("button", en.danger ? "danger" : ""); b.type = "button"; b.setAttribute("role", "menuitem");
      var ic = el("span", "ci"); ic.setAttribute("aria-hidden", "true"); ic.textContent = en.icon || "";
      var lb = el("span"); lb.textContent = en.label;
      b.append(ic, lb);
      if (en.k) { var k = el("span", "k"); k.setAttribute("aria-hidden", "true"); k.textContent = en.k; b.appendChild(k); }
      b.addEventListener("click", function () { closeCtxMenu(); en.fn(); });
      m.appendChild(b);
    });
    document.body.appendChild(m);
    var r = m.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(x, innerWidth - r.width - 8)) + "px";
    m.style.top = Math.max(8, Math.min(y, innerHeight - r.height - 8)) + "px";
    document.addEventListener("keydown", ctxKeys, true);
    setTimeout(function () {
      document.addEventListener("pointerdown", ctxAway, true);
      var f = m.querySelector("button"); if (f) f.focus();
    }, 0);
  }
  function onCtxMenu(e) {
    if (editingText) return;                                  // typing: leave the native menu alone
    e.preventDefault();
    if (placeType) { clearPlaceMode(); return; }
    var t = e.target;
    if (t.closest && (t.closest(".zoom-ctl") || t.closest(".orbit-toggle") || t.closest(".unfold-toggle") || t.closest(".face-bar") || t.closest(".stage-toolbar") || t.closest(".coach") || t.closest(".coach-veil"))) return;
    var node = t.closest && t.closest("[data-li]");
    var faceEl = t.closest && t.closest(".gbx-face");
    var face = (faceEl && faceEl.dataset.pos) || activeFace;
    if (!node && face === activeFace) node = layerAtPoint(face, e.clientX, e.clientY);   // same fallback as double-tap
    if (node) {
      var li = +node.dataset.li, nf = node.dataset.face || face;
      selectLayer(nf, li);
      var L = selLayer(); if (!L) return;
      var entries = [];
      if (L.t === "text" || L.t === "graffiti") entries.push({ label: "Edit text", icon: "✎", fn: function () { var nn = mount.querySelector('[data-face="' + nf + '"][data-li="' + li + '"]'); if (nn) inlineEdit(nn); } });
      entries.push({ label: "Center horizontally", icon: "⇆", fn: function () { centerSel("x"); } });
      entries.push({ label: "Center vertically", icon: "⇅", fn: function () { centerSel("y"); } });
      entries.push("-");
      entries.push({ label: "Bring forward", icon: "↑", fn: function () { moveSel(1); } });
      entries.push({ label: "Send back", icon: "↓", fn: function () { moveSel(-1); } });
      entries.push("-");
      entries.push({ label: "Duplicate", icon: "⧉", k: "⌘D", fn: dupSel });
      entries.push({ label: "Delete", icon: "✕", k: "⌫", danger: true, fn: delSel });
      openCtxMenu(e.clientX, e.clientY, entries);
      return;
    }
    if (face !== activeFace) setActiveFace(face);
    var f = doc.faces[activeFace], entries2 = [];
    if (overFace(activeFace, e.clientX, e.clientY) && !f.panel) {
      entries2.push({ label: "Add text here", icon: "T", fn: (function (cx, cy) {
        return function () {
          var fe = mount.querySelector('.gbx-face[data-pos="' + activeFace + '"]'); if (!fe) return;
          var pt = faceLocalXY(fe, { clientX: cx, clientY: cy });
          var nli = addLayerAt("text", pt.x, pt.y);
          var nn = mount.querySelector('[data-face="' + activeFace + '"][data-li="' + nli + '"]'); if (nn) inlineEdit(nn, true);
        };
      })(e.clientX, e.clientY) });
    }
    if (f.panel) entries2.push({ label: "Edit panel wording", icon: "▦", fn: function () { setTool("panels"); } });
    entries2.push({ label: "Face colour & pattern", icon: "▤", fn: function () { setTool("faces"); } });
    entries2.push({ label: "Add an element…", icon: "✚", fn: function () { setTool("layers"); } });
    openCtxMenu(e.clientX, e.clientY, entries2);
  }

  /* ---------------- click-to-place ---------------- */
  function armPlace(type) {
    placeType = type; selectLayer(null); stage.classList.add("placing");
    var label = (type.indexOf("decal:") === 0) ? ((GBX.STICKERS[type.slice(6)] || {}).name || "sticker") : (LAYER_NAME[type] || type);
    var b = $("#place-banner"); if (b) { b.querySelector(".pb-text").textContent = "Tap the box to place your " + label; b.hidden = false; }
    refreshStageToolbar();
    announce("Placing " + label + ". Tap the box, or press Escape to cancel.");
  }
  function clearPlaceMode() { placeType = null; stage.classList.remove("placing"); var b = $("#place-banner"); if (b) b.hidden = true; }
  function placeArmedAt(faceEl, e) {
    var type = placeType, pt = faceLocalXY(faceEl, e), face = faceEl.dataset.pos;
    if (face !== activeFace) setActiveFace(face);
    clearPlaceMode();
    if (type.indexOf("decal:") === 0) addDecalAt(type.slice(6), pt.x, pt.y); else addLayerAt(type, pt.x, pt.y);
  }
  function addLayerAt(type, x, y) {
    var L = faceLayers(); var o = scaledDefaults(type); o.x = x; o.y = y; L.push(o);
    selectLayer(activeFace, L.length - 1); rerender(); record();
    announce((LAYER_NAME[type] || type) + " placed");
    return L.length - 1;
  }
  function addDecalAt(id, x, y) {
    var s = GBX.STICKERS[id]; if (!s) return;
    var w = +(.34 * ELEMENT_SCALE).toFixed(3), h = +(w / (s.ar || 1)).toFixed(3);
    var L = faceLayers(); L.push({ t: "decal", id: id, x: x, y: y, w: w, h: h, rotate: 0 });
    selectLayer(activeFace, L.length - 1); rerender(); record();
    announce((s.name || "Sticker") + " placed");
  }
  function centerSel(axis) {
    if (!sel) return; var Ls = selLayers(); if (!Ls.length) return;
    if (Ls.length > 1) {                                       // shift the GROUP so its centre hits the middle; spacing kept
      var sum = 0; Ls.forEach(function (Ln) { sum += (axis === "x" ? Ln.x : Ln.y); });
      var dlt = .5 - sum / Ls.length;
      Ls.forEach(function (Ln) { if (axis === "x") Ln.x = clamp01(Ln.x + dlt); else Ln.y = clamp01(Ln.y + dlt); });
    } else { if (axis === "x") Ls[0].x = .5; else Ls[0].y = .5; }
    rerender(); record(); renderInspector();
    announce(axis === "x" ? "Centred horizontally" : "Centred vertically");
  }
  /* ---------------- face bar (labeled face nav with content badges) ---------------- */
  var stripTiles = {};
  function buildFaceStrip() {
    var bar = el("div", "face-bar"); bar.id = "face-strip";
    bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Faces");
    FACES.forEach(function (pos, i) {
      var b = el("button", "fb-btn"); b.type = "button"; b.dataset.face = pos;
      var nm = el("span", "fb-name"); nm.textContent = cap(pos);
      var pn = el("span", "fb-panel"); pn.textContent = "▦"; pn.hidden = true; pn.setAttribute("aria-hidden", "true");
      var ct = el("span", "fb-count"); ct.hidden = true; ct.setAttribute("aria-hidden", "true");
      b.append(nm, pn, ct);
      b.addEventListener("click", function () { setActiveFace(pos); });
      stripTiles[pos] = { el: b, pn: pn, ct: ct, key: i + 1 };
      bar.appendChild(b);
    });
    stage.appendChild(bar);
  }
  function refreshFaceStrip() {
    FACES.forEach(function (pos) {
      var t = stripTiles[pos]; if (!t) return;
      var f = doc.faces[pos];
      var n = (f.layers || []).length;
      t.ct.hidden = !n; if (n) t.ct.textContent = n;
      var p = f.panel && GBX.PANELS[f.panel];
      t.pn.hidden = !p;
      var on = pos === activeFace;
      t.el.classList.toggle("on", on);
      t.el.setAttribute("aria-pressed", on ? "true" : "false");
      t.el.setAttribute("aria-label", cap(pos) + " face" + (n ? ", " + n + " element" + (n > 1 ? "s" : "") : "") + (p ? ", panel: " + p.name : ""));
      t.el.title = cap(pos) + " face (" + t.key + ")" + (p ? " · " + p.name : "") + (n ? " · " + n + " element" + (n > 1 ? "s" : "") : "");
    });
  }

  function buildOrbitToggle() {
    var b = el("button", "orbit-toggle"); b.id = "orbit-toggle"; b.type = "button"; b.setAttribute("role", "switch"); b.setAttribute("aria-checked", "false");
    b.title = "Orbit mode: drag anywhere to turn the box (or hold Space)";
    b.innerHTML = ICON("orbit") + "<span>Orbit</span>";
    b.addEventListener("click", function () { orbit = !orbit; setOrbitVisual(); announce(orbit ? "Orbit mode on. Drag anywhere to turn the box." : "Orbit mode off."); });
    stage.appendChild(b);
  }

  /* ---------------- unfold (flat net) mode ---------------- */
  function setFlat(on) {
    on = !!on;
    if (flatMode === on) return;
    flatMode = on;
    closeOverlays(); clearPlaceMode(); closeCtxMenu();
    rerender(); refreshStageToolbar(); updateCrumb();
    var b = $("#unfold-toggle");
    if (b) {
      b.classList.toggle("on", on); b.setAttribute("aria-checked", on ? "true" : "false");
      var lbl = b.querySelector("span"); if (lbl) lbl.textContent = on ? "Fold" : "Unfold";
    }
    announce(on ? "Unfolded. All six faces are flat; click any face to work on it." : "Folded back to 3D.");
  }
  function buildUnfoldToggle() {
    var b = el("button", "unfold-toggle"); b.id = "unfold-toggle"; b.type = "button"; b.setAttribute("role", "switch"); b.setAttribute("aria-checked", "false");
    b.title = "Unfold the box into a flat net to edit every face at once (U)";
    b.innerHTML = ICON("unfold") + "<span>Unfold</span>";
    b.addEventListener("click", function () { setFlat(!flatMode); });
    stage.appendChild(b);
  }
  function buildPlaceBanner() {
    var b = el("div", "place-banner"); b.id = "place-banner"; b.hidden = true; b.setAttribute("role", "status");
    var t = el("span", "pb-text"); var c = el("button", "pb-cancel"); c.type = "button"; c.textContent = "Cancel"; c.setAttribute("aria-label", "Cancel placing");
    c.addEventListener("click", clearPlaceMode);
    b.append(t, c); stage.appendChild(b);
  }

  /* ---------------- keyboard ---------------- */
  function bindKeys() {
    window.addEventListener("keydown", function (e) {
      var a = document.activeElement; var editing = isTextEntry(a);
      var meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === "z" || e.key === "Z")) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (meta && (e.key === "y" || e.key === "Y")) { e.preventDefault(); redo(); return; }
      if (editing) return;
      if (e.code === "Space" && (a === stage || a === document.body)) { if (!spaceDown) { spaceDown = true; setOrbitVisual(); } e.preventDefault(); return; }
      if (e.key === "Escape" && placeType) { clearPlaceMode(); announce("Placement cancelled"); return; }
      if (meta && (e.key === "d" || e.key === "D")) { e.preventDefault(); if (sel) dupSel(); return; }
      if (meta && (e.key === "g" || e.key === "G")) { e.preventDefault(); if (e.shiftKey) ungroupSel(); else groupSel(); return; }
      if (meta && e.altKey && e.code === "KeyC") { if (sel) { e.preventDefault(); copyStyle(); } return; }       // format painter (⌥⌘C) — checked before plain copy; ⌥ remaps e.key on macOS so match on code
      if (meta && e.altKey && e.code === "KeyV") { if (sel) { e.preventDefault(); pasteStyle(); } return; }
      if (meta && (e.key === "c" || e.key === "C")) { if (sel) { e.preventDefault(); copySel(); } return; }     // copy selection (else let the browser copy text)
      if (meta && (e.key === "v" || e.key === "V")) { if (clip.length) { e.preventDefault(); pasteClip(); } return; }
      if (meta && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        var FL = faceLayers(); if (!FL.length) return;
        sel = { face: activeFace, li: FL.length - 1 };          // topmost = anchor
        selX = []; for (var ai = FL.length - 2; ai >= 0; ai--) selX.push(ai);
        markSelection(); renderInspector(); refreshStageToolbar(); updateCrumb();
        announce(FL.length + " elements selected"); return;
      }
      if (!meta && (e.key === "u" || e.key === "U")) { e.preventDefault(); setFlat(!flatMode); return; }
      // box focused, nothing selected: arrows rotate, 1-6 jump to a face
      if (!sel && a === stage) {
        if (/^Arrow/.test(e.key)) {
          if (flatMode) return;                                // flat net: nothing to rotate
          e.preventDefault(); var step = e.shiftKey ? 30 : 12;
          if (e.key === "ArrowLeft") viewRot[0] -= step; if (e.key === "ArrowRight") viewRot[0] += step;
          if (e.key === "ArrowUp") viewRot[1] = clamp(viewRot[1] - step, -90, 90); if (e.key === "ArrowDown") viewRot[1] = clamp(viewRot[1] + step, -90, 90);
          applyView(); return;
        }
        if (e.key >= "1" && e.key <= "6") { e.preventDefault(); var fp = FACES[+e.key - 1]; setActiveFace(fp); announce(cap(fp) + " face"); return; }
      }
      if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); delSel(); return; }
      if (e.key === "Escape" && sel) { selectLayer(null); focusActiveTool(); return; }
      if (sel && (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "_")) {
        e.preventDefault(); var d = ((e.key === "+" || e.key === "=") ? 1 : -1) * (e.shiftKey ? .05 : .02);
        selLayers().forEach(function (Lr) {
          if (Lr.w != null) Lr.w = clamp(Lr.w + d, .05, 1); else if (Lr.size != null) Lr.size = clamp(Lr.size + d, .02, .5);
          if ((Lr.t === "decal" || Lr.t === "art" || Lr.t === "fade") && Lr.h != null) Lr.h = clamp(Lr.h + d, .05, 1);
        });
        rerender(); record(); renderInspector(); return;
      }
      if (sel && /^Arrow/.test(e.key)) {
        e.preventDefault(); var d = e.shiftKey ? .05 : .01;
        selLayers().forEach(function (L) {
          if (e.key === "ArrowLeft") L.x = clamp01(L.x - d); if (e.key === "ArrowRight") L.x = clamp01(L.x + d);
          if (e.key === "ArrowUp") L.y = clamp01(L.y - d); if (e.key === "ArrowDown") L.y = clamp01(L.y + d);
        });
        rerender(); record();
      }
    });
    window.addEventListener("keyup", function (e) { if (e.code === "Space" && spaceDown) { spaceDown = false; setOrbitVisual(); } });
    window.addEventListener("blur", function () { if (spaceDown) { spaceDown = false; setOrbitVisual(); } });
  }

  /* ---------------- status (screen-reader live region) ---------------- */
  function buildStatusRegion() { statusNode = el("div", "sr-only"); statusNode.id = "lab-status"; statusNode.setAttribute("role", "status"); statusNode.setAttribute("aria-live", "polite"); document.body.appendChild(statusNode); }
  function announce(msg) { if (statusNode) { statusNode.textContent = ""; statusNode.textContent = msg; } }

  /* ---------------- toast + modal dialogs ---------------- */
  function toast(msg, err) {
    if (!toastNode) { toastNode = el("div", "toast"); document.body.appendChild(toastNode); }
    toastNode.className = "toast" + (err ? " err" : ""); toastNode.textContent = msg;
    void toastNode.offsetWidth; toastNode.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function () { toastNode.classList.remove("show"); }, 1900);
    announce(msg);
  }
  function modal(opts) {
    var prev = document.activeElement;
    var back = el("div", "modal-back");
    var m = el("div", "modal"); m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-labelledby", "modal-h");
    var h = el("h3"); h.id = "modal-h"; h.textContent = opts.title || ""; m.appendChild(h);
    if (opts.message) { var p = el("p"); p.textContent = opts.message; m.appendChild(p); }
    var inp = null;
    if (opts.input) { inp = el("input", "txt"); inp.type = "text"; inp.value = opts.value || ""; inp.setAttribute("aria-label", opts.title || "Value"); m.appendChild(inp); }
    var row = el("div", "modal-row");
    var cancel = el("button", "btn"); cancel.type = "button"; cancel.textContent = opts.cancelText || "Cancel";
    var ok = el("button", "btn acc"); ok.type = "button"; ok.textContent = opts.okText || "OK";
    if (opts.danger) { ok.classList.remove("acc"); ok.style.cssText = "background:rgba(255,77,109,.16);border-color:rgba(255,107,139,.45);color:#ffb3c4"; }
    row.append(cancel, ok); m.appendChild(row); back.appendChild(m); document.body.appendChild(back);
    function close() { back.remove(); document.removeEventListener("keydown", onKey, true); if (prev && prev.focus) prev.focus(); }
    function doOk() { var v = inp ? inp.value : true; close(); if (opts.onOk) opts.onOk(v); }
    function doCancel() { close(); if (opts.onCancel) opts.onCancel(); }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); doCancel(); }
      else if (e.key === "Enter" && (inp || document.activeElement === ok)) { e.preventDefault(); doOk(); }
      else if (e.key === "Tab") {
        var f = m.querySelectorAll("button,input"); if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    cancel.addEventListener("click", doCancel); ok.addEventListener("click", doOk);
    back.addEventListener("pointerdown", function (e) { if (e.target === back) doCancel(); });
    document.addEventListener("keydown", onKey, true);
    setTimeout(function () { (inp || ok).focus(); if (inp) inp.select(); }, 0);
  }

  /* ---------------- stage a11y + zoom + coachmark ---------------- */
  function setupStageA11y() {
    stage.tabIndex = 0; stage.setAttribute("role", "application");
    stage.setAttribute("aria-roledescription", "3D box preview");
    stage.setAttribute("aria-label", "Box preview. Use arrow keys to rotate, number keys 1 to 6 to jump to a face.");
    var h1 = el("h1", "sr-only"); h1.textContent = "GIIIFT box lab editor"; document.body.insertBefore(h1, document.body.firstChild);
  }
  function setZoom(z) { zoom = clamp(+(+z).toFixed(2), .4, 2.5); if (mount) mount.style.transform = "scale(" + zoom + ")"; var l = $("#zlvl"); if (l) l.textContent = Math.round(zoom * 100) + "%"; }
  function buildZoom() {
    mount.style.transformOrigin = "center"; mount.style.transition = "transform .15s";
    var c = el("div", "zoom-ctl"); c.setAttribute("role", "group"); c.setAttribute("aria-label", "Zoom");
    var out = el("button"); out.type = "button"; out.textContent = "−"; out.title = "Zoom out"; out.setAttribute("aria-label", "Zoom out"); out.addEventListener("click", function () { setZoom(zoom - .15); });
    var lvl = el("button", "zlvl"); lvl.type = "button"; lvl.id = "zlvl"; lvl.textContent = "100%"; lvl.title = "Reset zoom"; lvl.setAttribute("aria-label", "Reset zoom to 100 percent"); lvl.addEventListener("click", function () { setZoom(1); });
    var inb = el("button"); inb.type = "button"; inb.textContent = "+"; inb.title = "Zoom in"; inb.setAttribute("aria-label", "Zoom in"); inb.addEventListener("click", function () { setZoom(zoom + .15); });
    c.append(out, lvl, inb); stage.appendChild(c);
  }
  function maybeCoach() {
    try { if (localStorage.getItem("giiift-lab-coached")) return; } catch (e) {}
    var veil = el("div", "coach-veil");
    var c = el("div", "coach"); c.setAttribute("role", "dialog"); c.setAttribute("aria-modal", "true"); c.setAttribute("aria-labelledby", "coach-title");
    c.innerHTML = '<h4>Quick start</h4><h3 id="coach-title">Welcome to the box lab</h3><ul>' +
      '<li><span class="em" aria-hidden="true">🖐️</span><span>Drag empty space to <b>rotate</b> the box. Or click the box, then use the <b>arrow keys</b>.</span></li>' +
      '<li><span class="em" aria-hidden="true">👆</span><span>Click a face to edit it. Drag any element to move it, the green corner to <b>resize</b>.</span></li>' +
      '<li><span class="em" aria-hidden="true">⌨️</span><span>Double-click text on the box to type. Press the <b>?</b> button up top for all shortcuts.</span></li>' +
      '</ul>';
    function dismiss() {
      try { localStorage.setItem("giiift-lab-coached", "1"); } catch (e) {}
      document.removeEventListener("keydown", onEsc, true);
      veil.remove(); c.remove(); if (stage) stage.focus();
    }
    function onEsc(e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); dismiss(); } }
    var go = el("button", "btn acc"); go.type = "button"; go.style.width = "100%"; go.textContent = "Start designing";
    go.addEventListener("click", dismiss);
    veil.addEventListener("pointerdown", function (e) { e.stopPropagation(); dismiss(); });
    document.addEventListener("keydown", onEsc, true);
    c.appendChild(go); stage.appendChild(veil); stage.appendChild(c);
    setTimeout(function () { go.focus(); }, 0);
  }

  /* ---------------- admin: in-browser panel authoring (?admin) ---------------- */
  function r2(n) { return Math.round(n * 100) / 100; }
  function dtHasFiles(e) { var dt = e.dataTransfer; if (!dt || !dt.types) return false; for (var i = 0; i < dt.types.length; i++) if (dt.types[i] === "Files") return true; return false; }

  // drop/paste a render -> downscaled JPEG data-URI -> full-bleed art layer on the target face
  // decode a file to a canvas at its natural aspect, capped to the import edge limit
  function fileToCanvas(file, cb, cbErr) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      URL.revokeObjectURL(url);
      var max = 768, scale = Math.min(1, max / Math.max(img.width, img.height));
      var cv = document.createElement("canvas");
      cv.width = Math.max(1, Math.round(img.width * scale)); cv.height = Math.max(1, Math.round(img.height * scale));
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv);
    };
    img.onerror = function () { URL.revokeObjectURL(url); if (cbErr) cbErr(); };
    img.src = url;
  }
  function canvasHasAlpha(cv) {                                // sampled scan: any meaningfully transparent pixel
    var d = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
    for (var i = 3; i < d.length; i += 16) if (d[i] < 250) return true;
    return false;
  }
  // alpha sources keep their transparency (WebP/PNG); opaque ones take the lighter JPEG path
  function encodeSmart(cv, hasAlpha) {
    return hasAlpha
      ? (encodeUnderCap(cv, "image/webp", [0.8, 0.62]) || encodeUnderCap(cv, "image/png", [1]))
      : encodeUnderCap(cv, "image/jpeg", [0.72, 0.55]);
  }
  function fillCanvasToFace(cv, face) {                        // the classic flow: one full-bleed art layer
    var alpha = canvasHasAlpha(cv);
    var uri = encodeSmart(cv, alpha);
    if (!uri) { toast("Image too large even compressed — crop it first", true); return; }
    if (face !== activeFace) setActiveFace(face);
    var an = analyzeCanvas(cv); if (an) ART_AN_CACHE[artKey(uri)] = an;   // pairing suggestions are ready the moment the art lands
    var L = faceLayers(); L.push({ t: "art", src: uri, fit: "cover", zoom: 1, x: .5, y: .5, w: 1, h: 1, radius: 0, rotate: 0 });
    selectLayer(activeFace, L.length - 1); rerender(); record();
    toast("Art imported (" + Math.round(uri.length / 1024) + " KB) on the " + activeFace + " face" + (ADMIN ? " · Panels → Pair text" : ""));
    announce("Image imported onto the " + activeFace + " face");
  }
  function importImageToFace(file, face) {
    if (!file || !/^image\//.test(file.type || "")) { toast("Not an image", true); return; }
    face = face || activeFace;
    fileToCanvas(file, function (cv) { fillCanvasToFace(cv, face); }, function () { toast("Could not read that image", true); });
  }

  /* ---------------- admin: art analysis -> font + colour pairing ----------------
   * No real font identification happens here (that would need an ML classifier and a
   * service); instead the artwork's measurable character — palette, darkness, neon,
   * sepia, pastel, contrast, edge business — scores the vibe tags every font in
   * GBX.FONT_META carries, and the closest matches surface as live previews. */
  var ART_AN_CACHE = {};
  function artKey(src) { return src.length + ":" + src.slice(48, 88); }
  function analyzeCanvas(source) {
    var W = 48, H = 48, d;
    var cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    var cx = cv.getContext("2d", { willReadFrequently: true });
    try { cx.drawImage(source, 0, 0, W, H); d = cx.getImageData(0, 0, W, H).data; } catch (e) { return null; }
    var n = W * H, lum = new Float32Array(n), buckets = {};
    var sumS = 0, dark = 0, light = 0, neon = 0, warm = 0, cool = 0, red = 0, sepia = 0, pastel = 0, i;
    for (i = 0; i < n; i++) {
      var r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      var l = (mx + mn) / 510;
      var s = mx === mn ? 0 : (mx - mn) / (255 - Math.abs(mx + mn - 255));
      lum[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      sumS += s;
      if (l < 0.16) dark++;
      if (l > 0.84) light++;
      if (s > 0.62 && l > 0.32 && l < 0.78) neon++;
      if (s > 0.1 && s < 0.52 && l > 0.62 && l < 0.93) pastel++;
      if (mx !== mn) {
        var h6 = mx === r ? ((g - b) / (mx - mn)) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
        var hue = (h6 * 60 + 360) % 360;
        if (hue < 70 || hue > 330) warm++; else if (hue > 150 && hue < 285) cool++;
        if ((hue < 16 || hue > 344) && s > 0.42) red++;
        if (hue >= 20 && hue <= 52 && s > 0.1 && s < 0.55 && l > 0.28 && l < 0.82) sepia++;
      }
      var q = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      buckets[q] = (buckets[q] || 0) + 1;
    }
    var mean = 0; for (i = 0; i < n; i++) mean += lum[i]; mean /= n;
    var va = 0; for (i = 0; i < n; i++) { var dv = lum[i] - mean; va += dv * dv; }
    var eSum = 0, x, y;
    for (y = 0; y < H - 1; y++) for (x = 0; x < W - 1; x++) { var p = y * W + x; eSum += Math.abs(lum[p] - lum[p + 1]) + Math.abs(lum[p] - lum[p + W]); }
    var sh = {
      dark: dark / n, light: light / n, neon: neon / n, warm: warm / n, cool: cool / n, red: red / n,
      sepia: sepia / n, pastel: pastel / n, sat: sumS / n,
      edge: clamp(eSum / ((W - 1) * (H - 1) * 2) * 5, 0, 1), contrast: clamp(Math.sqrt(va / n) * 3.2, 0, 1),
    };
    // dominant palette (4-bit buckets, near-duplicates merged)
    var order = Object.keys(buckets).sort(function (a, b2) { return buckets[b2] - buckets[a]; });
    var pal = [];
    for (i = 0; i < order.length && pal.length < 6; i++) {
      var q2 = +order[i], rr = ((q2 >> 8) & 15) * 17, gg = ((q2 >> 4) & 15) * 17, bb = (q2 & 15) * 17;
      if (!pal.some(function (c) { return Math.abs(c[0] - rr) + Math.abs(c[1] - gg) + Math.abs(c[2] - bb) < 84; })) pal.push([rr, gg, bb]);
    }
    var hex = function (c) { return "#" + ((1 << 24) + (c[0] << 16) + (c[1] << 8) + c[2]).toString(16).slice(1); };
    var lumOf = function (c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; };
    var satOf = function (c) { var a = Math.max(c[0], c[1], c[2]), z = Math.min(c[0], c[1], c[2]); return a === z ? 0 : (a - z) / (255 - Math.abs(a + z - 255)); };
    // text colours: palette entries that stand off the image's mean luminance, punchiest first
    var textCols = pal.slice().sort(function (a, b2) {
      return (Math.abs(lumOf(b2) - mean) + satOf(b2) * 0.6) - (Math.abs(lumOf(a) - mean) + satOf(a) * 0.6);
    }).filter(function (c) { return Math.abs(lumOf(c) - mean) > 0.22; }).map(hex);
    // near-black (or blown-white) art: the contrast filter can empty the list, leaving every
    // suggestion the same fallback white — rank the art's saturated entries back in as alternates
    if (textCols.length < 3) {
      pal.slice().sort(function (a, b2) { return satOf(b2) - satOf(a); }).forEach(function (c) {
        var h2 = hex(c);
        if (satOf(c) > 0.25 && textCols.length < 4 && textCols.indexOf(h2) < 0) textCols.push(h2);
      });
    }
    textCols.push(mean > 0.5 ? "#16182a" : "#ffffff");
    // vibe scores
    var v = {};
    v.horror = sh.dark * 1.6 + sh.red * 1.5 + sh.contrast * 0.4;
    v.spooky = sh.dark * 1.4 + sh.red * 1.0 + sh.cool * 0.3;
    v.dark = sh.dark * 1.8 + (1 - sh.sat) * 0.3;
    v.blackletter = sh.dark * 1.1 + sh.sepia * 0.6 + sh.contrast * 0.3;
    v.fantasy = sh.cool * 0.6 + sh.dark * 0.5 + sh.sepia * 0.4;
    v.epic = sh.dark * 0.7 + sh.contrast * 0.7;
    v.neon = sh.neon * 2 + sh.dark * 0.7;
    v.scifi = sh.neon * 1.2 + sh.cool * 1.1 + sh.dark * 0.5;
    v.tech = sh.cool * 0.8 + sh.neon * 0.5 + sh.contrast * 0.3;
    v.terminal = sh.dark * 0.9 + sh.cool * 0.5;
    v.pixel = sh.edge * 1.2 + sh.neon * 0.6;
    v.game = sh.edge * 0.7 + sh.sat * 0.8;
    v.retro = sh.sepia * 0.7 + sh.warm * 0.6 + sh.pastel * 0.3;
    v.vintage = sh.sepia * 1.6 + (1 - sh.sat) * 0.4;
    v.paper = sh.sepia * 1.1 + sh.light * 0.6 + (1 - sh.contrast) * 0.3;
    v.western = sh.sepia * 1.5 + sh.warm * 0.8;
    v.elegant = sh.light * 0.8 + (1 - sh.sat) * 0.6 + (1 - sh.edge) * 0.5;
    v.luxury = sh.dark * 0.7 + sh.warm * 0.5 + sh.contrast * 0.5;
    v.classic = (1 - sh.sat) * 0.6 + sh.sepia * 0.4 + (1 - sh.edge) * 0.4;
    v.romantic = sh.pastel * 1.3 + sh.warm * 0.5 + sh.light * 0.4;
    v.comic = sh.sat * 1.2 + sh.edge * 0.6 + sh.warm * 0.4;
    v.fun = sh.sat * 1.0 + sh.light * 0.4 + sh.warm * 0.3;
    v.cute = sh.pastel * 1.5 + sh.light * 0.4;
    v.round = sh.pastel * 0.8 + sh.sat * 0.4;
    v.kids = sh.sat * 0.9 + sh.light * 0.5;
    v.party = sh.neon * 0.9 + sh.sat * 0.8;
    v.summer = sh.warm * 0.8 + sh.sat * 0.6 + sh.light * 0.4;
    v.street = sh.edge * 0.9 + sh.contrast * 0.6 + sh.dark * 0.4;
    v.urban = sh.edge * 0.8 + sh.dark * 0.5 + sh.cool * 0.3;
    v.grunge = sh.edge * 1.0 + sh.dark * 0.6;
    v.marker = sh.sat * 0.6 + sh.edge * 0.4;
    v.hand = sh.pastel * 0.6 + sh.sepia * 0.5 + (1 - sh.edge) * 0.2;
    v.script = sh.pastel * 0.7 + sh.light * 0.4 + (1 - sh.edge) * 0.3;
    v.bold = sh.contrast * 1.0 + sh.sat * 0.5;
    v.poster = sh.contrast * 0.8 + sh.sat * 0.6;
    v.modern = sh.cool * 0.5 + (1 - sh.sepia) * 0.3 + (1 - sh.edge) * 0.3;
    v.clean = (1 - sh.edge) * 0.7 + (1 - sh.sat) * 0.4 + sh.light * 0.3;
    v.sport = sh.sat * 0.7 + sh.contrast * 0.5;
    v.military = sh.dark * 0.5 + (1 - sh.sat) * 0.4 + sh.edge * 0.3;
    v.stencil = sh.dark * 0.5 + sh.contrast * 0.5;
    v.deco = sh.dark * 0.5 + sh.warm * 0.6 + sh.contrast * 0.4;
    // rank the library: mean tag score (sqrt-normalized), max two picks per category for spread
    var scored = FONTS.map(function (k) {
      var m = fontMeta(k), s2 = 0;
      (m.vibe || []).forEach(function (t) { s2 += v[t] || 0; });
      return { k: k, score: m.vibe && m.vibe.length ? s2 / Math.sqrt(m.vibe.length) : 0, cat: m.cat };
    }).sort(function (a, b2) { return b2.score - a.score; });
    var picks = [], perCat = {};
    for (i = 0; i < scored.length && picks.length < 6; i++) {
      if ((perCat[scored[i].cat] || 0) >= 2) continue;
      perCat[scored[i].cat] = (perCat[scored[i].cat] || 0) + 1;
      picks.push(scored[i].k);
    }
    var vibeLine = Object.keys(v).sort(function (a, b2) { return v[b2] - v[a]; }).slice(0, 3).join(" · ");
    return { palette: pal.map(hex), textColors: textCols.slice(0, 5), fonts: picks, vibeLine: vibeLine };
  }
  function artAnalysisFor(src, cb) {
    var key = artKey(src);
    if (ART_AN_CACHE[key]) {
      // microtask, not sync: the caller's holder isn't attached to the inspector yet
      var hit = ART_AN_CACHE[key];
      Promise.resolve().then(function () { cb(hit); });
      return;
    }
    var img = new Image();
    img.onload = function () { var a = analyzeCanvas(img); if (a) ART_AN_CACHE[key] = a; cb(a); };
    img.onerror = function () { cb(null); };
    img.src = src;
  }
  function applyPairing(fontKey, color) {
    var m = fontMeta(fontKey), L = sel && selLayer();
    if (L && (L.t === "text" || L.t === "graffiti")) {
      L.font = fontKey; if (color) L.color = color;
      rerender(); record(); renderInspector();
      toast(m.name + " + " + color + " applied");
    } else {
      var Ls = faceLayers();
      Ls.push(Object.assign({}, LAYER_DEFAULTS.text, { value: "Your text", font: fontKey, color: color || "#ffffff", y: .8, size: .12 }));
      rerender(); record();
      selectLayer(activeFace, Ls.length - 1);
      toast(m.name + " line added — double-click it to type");
    }
  }
  function pairingGroup() {
    var arts = (doc.faces[activeFace].layers || []).filter(function (L) { return L.t === "art" && L.src; });
    if (!arts.length) return null;
    var src = arts[arts.length - 1].src;   // topmost art wins
    var selL = sel && selLayer();
    var forSelected = selL && (selL.t === "text" || selL.t === "graffiti");
    var g = group("Pair text with the art", forSelected
      ? "Fonts and colours scored against this face's artwork — tap one to restyle the selected layer."
      : "Fonts and colours scored against this face's artwork — tap one to drop in a styled line.");
    var holder = el("div", "pair-grid"); g.appendChild(holder);
    artAnalysisFor(src, function (an) {
      if (!holder.isConnected) return;
      if (!an) { var err = el("div", "grp-note"); err.textContent = "Could not analyze this image."; holder.appendChild(err); return; }
      var vl = el("div", "pair-vibe"); vl.textContent = "reads as: " + an.vibeLine; holder.appendChild(vl);
      var sampleText = (forSelected && selL.value) || "Your text";
      an.fonts.forEach(function (k, idx) {
        var m = fontMeta(k), col = an.textColors[idx % an.textColors.length];
        var card = el("button", "pair-card"); card.type = "button"; card.title = m.name + " + " + col;
        card.innerHTML = '<span class="pc-sample" style="font-family:' + GBX.FONTS[k].replace(/"/g, "&quot;") + ';color:' + col + '">' + esc(sampleText) + '</span><span class="pc-meta"><span class="pc-nm">' + esc(m.name) + '</span><span class="pc-dot" style="background:' + col + '"></span></span>';
        card.addEventListener("click", function () { applyPairing(k, col); });
        holder.appendChild(card);
      });
      var sh2 = el("div", "sw-h"); sh2.textContent = "From the art"; holder.appendChild(sh2);
      var row = el("div", "swatches");
      an.textColors.concat(an.palette).filter(function (c, i2, arr) { return arr.indexOf(c) === i2; }).slice(0, 8).forEach(function (c) {
        var ch = el("button", "ch"); ch.type = "button"; ch.style.background = c; ch.title = c;
        ch.setAttribute("aria-label", "Use art colour " + c);
        ch.addEventListener("click", function () {
          var L2 = sel && selLayer();
          if (L2 && L2.color != null) { L2.color = c; rerender(); record(); renderInspector(); toast(c + " applied"); }
          else toast("Select a text layer first — double-click text on the box", true);
        });
        row.appendChild(ch);
      });
      holder.appendChild(row);
    });
    return g;
  }

  // mirrors box-engine's FOILS (CSS gradients there, SVG stops here) — keep the stop lists in lockstep
  var FOIL_STOPS = {
    gold:     [["0", "#8a6a1f"], [".24", "#f6e27a"], [".38", "#fffbe6"], [".55", "#d4a017"], [".72", "#f9df7b"], ["1", "#7c5e16"]],
    silver:   [["0", "#5f6468"], [".24", "#d9dde2"], [".40", "#ffffff"], [".58", "#a6abb1"], [".78", "#e8ebee"], ["1", "#62676c"]],
    rosegold: [["0", "#8a5240"], [".25", "#eebfa6"], [".42", "#ffe9dd"], [".60", "#d18a70"], [".78", "#f3c6ae"], ["1", "#8a5240"]],
    holo:     [["0", "#ff9ad5"], [".18", "#ffd36e"], [".36", "#9dff8a"], [".54", "#7adfff"], [".72", "#a08bff"], [".90", "#ff8bd1"], ["1", "#ffd36e"]],
  };
  // mirrors box-engine's shapeSvgPath (not exported): polygon/path sub-shapes in a 0..100 box
  function shapePathFor(kind, attrs) {
    switch (kind) {
      case "triangle": return '<polygon points="50,6 95,94 5,94"' + attrs + '/>';
      case "diamond": return '<polygon points="50,4 96,50 50,96 4,50"' + attrs + '/>';
      case "star": return '<polygon points="50,3 61.8,37.6 98.2,37.6 68.8,59.2 80.4,94 50,72.4 19.6,94 31.2,59.2 1.8,37.6 38.2,37.6"' + attrs + '/>';
      case "heart": return '<path d="M50,90 C16,64 6,42 18,27 C28,15 45,16 50,30 C55,16 72,15 82,27 C94,42 84,64 50,90 Z"' + attrs + '/>';
      case "hexagon": return '<polygon points="50,2 92,26 92,74 50,98 8,74 8,26"' + attrs + '/>';
      case "blob": return '<path d="M55,7 C75,9 95,25 93,47 C91,68 72,96 49,94 C27,92 6,74 8,50 C10,27 33,5 55,7 Z"' + attrs + '/>';
      case "arrow": return '<polygon points="0,32 58,32 58,12 100,50 58,88 58,68 0,68"' + attrs + '/>';
      case "bubble": return '<path d="M14,8 H86 Q96,8 96,18 V60 Q96,70 86,70 H40 L24,92 L29,70 H14 Q4,70 4,60 V18 Q4,8 14,8 Z"' + attrs + '/>';
      case "burst": return '<polygon points="50,3 59.3,15.2 73.5,9.3 75.5,24.5 90.7,26.5 84.8,40.7 97,50 84.8,59.3 90.7,73.5 75.5,75.5 73.5,90.7 59.3,84.8 50,97 40.7,84.8 26.5,90.7 24.5,75.5 9.3,73.5 15.2,59.3 3,50 15.2,40.7 9.3,26.5 24.5,24.5 26.5,9.3 40.7,15.2"' + attrs + '/>';
      case "ribbon": return '<polygon points="0,25 100,25 88,50 100,75 0,75 12,50"' + attrs + '/>';
      default: return '<rect x="1" y="1" width="98" height="98"' + attrs + '/>';
    }
  }
  // rotate + flip-about-centre transform list, shared by every exported layer kind
  function exportTf(L) {
    var tf = [];
    if (L.rotate) tf.push('rotate(' + r2(L.rotate) + ' ' + r2(L.x * 100) + ' ' + r2(L.y * 100) + ')');
    if (L.flipX || L.flipY) tf.push('translate(' + r2(L.x * 100) + ' ' + r2(L.y * 100) + ') scale(' + (L.flipX ? -1 : 1) + ' ' + (L.flipY ? -1 : 1) + ') translate(' + r2(-L.x * 100) + ' ' + r2(-L.y * 100) + ')');
    return tf;
  }
  // doc.faces[face] -> a panel { name, group, fields, svg } (viewBox 0 0 100 100, preserveAspectRatio none)
  // opts.face picks the face (default active); opts.literal bakes wording in verbatim instead of {{field}} tokens (template motifs)
  function exportFaceAsPanel(id, name, group, opts) {
    opts = opts || {};
    var faceKey = opts.face || activeFace;
    id = String(id || ("custom-" + faceKey)).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || ("custom-" + faceKey);
    name = (name || id.replace(/-/g, " ")).trim();
    group = (group === "front") ? "front" : "side";
    var f = doc.faces[faceKey], pal = doc.palette || {}, fil = f.fill || {};
    var c1 = fil.c1 || pal.c1 || "#7c3aed", c2 = fil.c2 || pal.c2 || "#ec4899", bgId = id + "Bg";
    var svg = '<svg viewBox="0 0 100 100" preserveAspectRatio="none">'
      + '<defs><linearGradient id="' + bgId + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient></defs>'
      + '<rect width="100" height="100" fill="url(#' + bgId + ')"/>';
    if (f.panel && GBX.PANELS[f.panel]) svg += GBX.panelSVG(f.panel, f.panelText, f.panelScale).replace('<svg viewBox="0 0 100 100" preserveAspectRatio="none">', '<svg x="0" y="0" width="100" height="100" viewBox="0 0 100 100" preserveAspectRatio="none">');   // panel-wearing face: the worn panel is the base layer (ids already namespaced per panel)
    var fields = [], msgUsed = false, lineN = 0, skipped = 0, usedFonts = {}, extraDefs = "", fadeN = 0, gradN = 0;
    var idSafe = id.replace(/[^a-z0-9]/g, "");
    (f.layers || []).forEach(function (L) {
      var _bStart = svg.length;   // mark, so the per-layer blend wrap below can enclose whatever this layer appends
      if (L.t === "art" && L.src && L.crop) {                  // manual reframe: clip the crop window to the layer box
        var cw100 = L.w * 100, ch100 = L.h * 100, cx0 = L.x * 100 - cw100 / 2, cy0 = L.y * 100 - ch100 / 2;
        var fullW = cw100 / L.crop.w, fullH = ch100 / L.crop.h, imgX = cx0 - L.crop.x * fullW, imgY = cy0 - L.crop.y * fullH;
        var cfb = [];
        if (L.brightness != null && L.brightness !== 1) cfb.push("brightness(" + L.brightness + ")");
        if (L.contrast != null && L.contrast !== 1) cfb.push("contrast(" + L.contrast + ")");
        if (L.saturate != null && L.saturate !== 1) cfb.push("saturate(" + L.saturate + ")");
        if (L.blur) cfb.push("blur(" + r2(L.blur * 100) + "px)");
        if (L.sepia) cfb.push("sepia(" + L.sepia + ")");
        var ccid = idSafe + "Crop" + (gradN++), crr = L.radius ? Math.min(cw100, ch100) * L.radius : 0;
        extraDefs += '<clipPath id="' + ccid + '"><rect x="' + r2(cx0) + '" y="' + r2(cy0) + '" width="' + r2(cw100) + '" height="' + r2(ch100) + '" rx="' + r2(crr) + '"/></clipPath>';
        var cimg = '<image href="' + L.src + '" x="' + r2(imgX) + '" y="' + r2(imgY) + '" width="' + r2(fullW) + '" height="' + r2(fullH) + '" preserveAspectRatio="none" clip-path="url(#' + ccid + ')"' + (L.opacity != null && L.opacity < 1 ? ' opacity="' + r2(L.opacity) + '"' : '') + (cfb.length ? ' style="filter:' + cfb.join(" ") + '"' : '') + '/>';
        var ctf = exportTf(L);
        svg += ctf.length ? '<g transform="' + ctf.join(' ') + '">' + cimg + '</g>' : cimg;
      } else if (L.t === "art" && L.src) {
        var z = L.zoom || 1, iw = L.w * 100 * z, ih = L.h * 100 * z;
        var x = L.x * 100 - iw / 2, y = L.y * 100 - ih / 2, par = (L.fit === "contain") ? "xMidYMid meet" : "xMidYMid slice";
        var afb = [];
        if (L.brightness != null && L.brightness !== 1) afb.push("brightness(" + L.brightness + ")");
        if (L.contrast != null && L.contrast !== 1) afb.push("contrast(" + L.contrast + ")");
        if (L.saturate != null && L.saturate !== 1) afb.push("saturate(" + L.saturate + ")");
        if (L.blur) afb.push("blur(" + r2(L.blur * 100) + "px)");
        if (L.sepia) afb.push("sepia(" + L.sepia + ")");
        if (L.outlineW) {                                      // die-cut outline, in viewBox px (×100), mirroring the live 8-shadow dilation
          var oc2 = L.outlineColor || "#ffffff", ow2 = L.outlineW * 100, od2 = ow2 * 0.7071;
          [[ow2, 0], [-ow2, 0], [0, ow2], [0, -ow2], [od2, od2], [-od2, od2], [od2, -od2], [-od2, -od2]].forEach(function (p2) {
            afb.push("drop-shadow(" + r2(p2[0]) + "px " + r2(p2[1]) + "px 0 " + oc2 + ")");
          });
        }
        if (L.softShadow) afb.push("drop-shadow(0 " + r2(1.8 * L.softShadow) + "px " + r2(4.5 * L.softShadow) + "px rgba(0,0,0," + (0.3 + 0.4 * L.softShadow).toFixed(2) + "))");
        var im = '<image href="' + L.src + '" x="' + r2(x) + '" y="' + r2(y) + '" width="' + r2(iw) + '" height="' + r2(ih) + '" preserveAspectRatio="' + par + '"' + (L.opacity != null && L.opacity < 1 ? ' opacity="' + r2(L.opacity) + '"' : '') + (afb.length ? ' style="filter:' + afb.join(" ") + '"' : '') + '/>';
        var tf = exportTf(L);
        svg += tf.length ? '<g transform="' + tf.join(' ') + '">' + im + '</g>' : im;
      } else if (L.t === "text" || L.t === "graffiti") {
        var key, label;
        if (!msgUsed) { key = "message"; label = "Message"; msgUsed = true; } else { lineN++; key = "line" + lineN; label = "Line " + lineN; }
        var val = String(L.value == null ? "" : L.value);
        fields.push({ key: key, label: label, value: val, max: Math.max(4, Math.ceil(val.length * 1.6)) });
        if (L.font && GBX.FONTS[L.font]) usedFonts[L.font] = 1;
        var ff = (GBX.FONTS[L.font] || GBX.FONTS.display).replace(/"/g, "'"), size = r2((L.size || .1) * 100);
        var anchor = (L.align === "left") ? "start" : (L.align === "right") ? "end" : "middle";
        var curved = L.curve && Math.abs(L.curve) > 0.5;
        if (curved) anchor = "middle";                         // the live render centres curved text too
        var tx = L.x * 100 + (anchor === "start" ? -(L.w || .7) * 50 : anchor === "end" ? (L.w || .7) * 50 : 0);
        var ty = L.y * 100 + (L.size || .1) * 35;
        var content = opts.literal ? esc(val) : "{{" + key + "}}";
        // fill: solid, or a namespaced gradient (the live render also skips gradients on curved text)
        var fillAttr = L.color || "#ffffff";
        if (!curved && (L.fillKind === "linear" || L.fillKind === "radial")) {
          var tgid = idSafe + "Txt" + (gradN++);
          var tstops = '<stop offset="0" stop-color="' + (L.color || "#ffffff") + '"/><stop offset="1" stop-color="' + (L.fill2 || L.color || "#ffffff") + '"/>';
          extraDefs += L.fillKind === "radial"
            ? '<radialGradient id="' + tgid + '">' + tstops + '</radialGradient>'
            : '<linearGradient id="' + tgid + '" gradientTransform="rotate(' + r2(L.fillAngle != null ? L.fillAngle : 135) + ' .5 .5)">' + tstops + '</linearGradient>';
          fillAttr = "url(#" + tgid + ")";
        }
        if (!curved && L.finish && L.finish !== "none" && FOIL_STOPS[L.finish]) {   // metallic foil -> namespaced multi-stop gradient (wins over colour/gradient, like the live render)
          var fgid = idSafe + "Foil" + (gradN++);
          extraDefs += '<linearGradient id="' + fgid + '" gradientTransform="rotate(' + (L.finish === "holo" ? 115 : 105) + ' .5 .5)">'
            + FOIL_STOPS[L.finish].map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"/>'; }).join("") + '</linearGradient>';
          fillAttr = "url(#" + fgid + ")";
        }
        // sticker style keeps its own outer-edge colour; plain keeps the legacy dark edge.
        // (sticker's inner halo would need a duplicate <text> per token, which breaks per-field A+/A− scaling — single-stroke approximation.)
        var strokeAttr = L.style === "sticker"
          ? ' stroke="' + (L.outline2 || "#111111") + '" stroke-width="' + r2(size * 0.14) + '" paint-order="stroke"'
          : ' stroke="#16182a" stroke-width="' + r2(size * 0.06) + '" paint-order="stroke"';
        // effects ride a CSS style attribute: panels render as inline SVG in HTML, where filter applies to <text> (text-shadow does not)
        var styleBits = [];
        if (L.letterSpacing) styleBits.push("letter-spacing:" + L.letterSpacing + "em");
        if (L.effect === "shadow") styleBits.push("filter:drop-shadow(" + r2(size * 0.045) + "px " + r2(size * 0.07) + "px 0 rgba(0,0,0,0.55))");
        else if (L.effect === "lift") styleBits.push("filter:drop-shadow(0 " + r2(size * 0.085) + "px " + r2(size * 0.16) + "px rgba(0,0,0,0.55))");
        else if (L.effect === "neon") {
          var nc = L.effectColor || "#34f5c5";
          styleBits.push("filter:drop-shadow(0 0 " + r2(size * 0.08) + "px " + nc + ") drop-shadow(0 0 " + r2(size * 0.22) + "px " + nc + ") drop-shadow(0 0 " + r2(size * 0.5) + "px " + nc + ")");
        }
        var styleAttr = styleBits.length ? ' style="' + styleBits.join(";") + '"' : "";
        // highlight: an estimated marker plate behind the text (sized from the default copy; token edits won't retrack it)
        var pre = "";
        if (L.effect === "highlight" && !curved) {
          var hw2 = Math.max(val.length, 2) * (L.size || .1) * 100 * 0.6 + size * 0.5, hh2 = size * 1.3;
          var hx2 = anchor === "start" ? tx - size * 0.25 : anchor === "end" ? tx - hw2 + size * 0.25 : tx - hw2 / 2;
          pre = '<rect x="' + r2(hx2) + '" y="' + r2(ty - size * 0.95) + '" width="' + r2(hw2) + '" height="' + r2(hh2) + '" rx="' + r2(size * 0.12) + '" fill="' + (L.effectColor || "#ffe066") + '"/>';
        }
        var t;
        if (curved) {
          // a true arc via textPath (the live render tilts per glyph; the arc is the cleaner SVG analogue, and edits re-centre via startOffset)
          var cn2 = Math.max(val.replace(/\n/g, " ").length, 2);
          var Rc2 = Math.min(24, Math.max(1.4, (cn2 * 0.62) / (Math.abs(L.curve) * Math.PI / 180)));
          var Rr = Rc2 * (L.size || .1) * 100;
          var thm = Math.abs(L.curve) / 2 * Math.PI / 180;
          var up = L.curve > 0, cyc = up ? ty + Rr : ty - Rr;
          var pxa = tx - Rr * Math.sin(thm), pxb = tx + Rr * Math.sin(thm);
          var pya = up ? cyc - Rr * Math.cos(thm) : cyc + Rr * Math.cos(thm);
          var aid = idSafe + "Arc" + (gradN++);
          extraDefs += '<path id="' + aid + '" d="M ' + r2(pxa) + ' ' + r2(pya) + ' A ' + r2(Rr) + ' ' + r2(Rr) + ' 0 0 ' + (up ? 1 : 0) + ' ' + r2(pxb) + ' ' + r2(pya) + '" fill="none"/>';
          t = '<text font-family="' + ff + '" font-size="' + size + '" font-weight="' + (L.weight || 600) + '" fill="' + fillAttr + '"' + (L.italic ? ' font-style="italic"' : '') + strokeAttr + styleAttr + '><textPath href="#' + aid + '" startOffset="50%" text-anchor="middle">' + content + '</textPath></text>';
        } else {
          t = '<text x="' + r2(tx) + '" y="' + r2(ty) + '" font-family="' + ff + '" font-size="' + size + '" font-weight="' + (L.weight || 600) + '" fill="' + fillAttr + '" text-anchor="' + anchor + '"' + (L.italic ? ' font-style="italic"' : '') + strokeAttr + styleAttr + '>' + content + '</text>';
        }
        var tOut = pre + t;
        svg += L.rotate ? '<g transform="rotate(' + r2(L.rotate) + ' ' + r2(L.x * 100) + ' ' + r2(L.y * 100) + ')">' + tOut + '</g>' : tOut;
      } else if (L.t === "fade") {
        // gradient scrim -> namespaced SVG gradient + rect (CSS angle: 0deg = colour at the bottom, fading up)
        var gid = idSafe + "Fade" + (fadeN++);
        var fop = L.opacity != null ? L.opacity : 1;
        if (L.kind === "radial") {
          extraDefs += '<radialGradient id="' + gid + '"><stop offset="0" stop-color="' + (L.color || "#000000") + '" stop-opacity="0"/><stop offset="1" stop-color="' + (L.color || "#000000") + '" stop-opacity="' + fop + '"/></radialGradient>';
        } else {
          var fa = (L.angle || 0) * Math.PI / 180, fsx = Math.sin(fa) / 2, fsy = Math.cos(fa) / 2;
          extraDefs += '<linearGradient id="' + gid + '" x1="' + r2(0.5 - fsx) + '" y1="' + r2(0.5 + fsy) + '" x2="' + r2(0.5 + fsx) + '" y2="' + r2(0.5 - fsy) + '"><stop offset="0" stop-color="' + (L.color || "#000000") + '" stop-opacity="' + fop + '"/><stop offset="1" stop-color="' + (L.color || "#000000") + '" stop-opacity="0"/></linearGradient>';
        }
        var frw = (L.w || 1) * 100, frh = (L.h || 0.6) * 100, frx = L.x * 100 - frw / 2, fry = L.y * 100 - frh / 2;
        var frect = '<rect x="' + r2(frx) + '" y="' + r2(fry) + '" width="' + r2(frw) + '" height="' + r2(frh) + '" fill="url(#' + gid + ')"/>';
        svg += L.rotate ? '<g transform="rotate(' + r2(L.rotate) + ' ' + r2(L.x * 100) + ' ' + r2(L.y * 100) + ')">' + frect + '</g>' : frect;
      } else if (L.t === "shape") {
        var sw2 = (L.w || .5) * 100, sh3 = (L.h || .2) * 100;
        var sx2 = L.x * 100 - sw2 / 2, sy2 = L.y * 100 - sh3 / 2;
        var sFill = L.fill === "none" ? "none" : (L.fill || pal.accent || "#fde68a");
        if (sFill !== "none" && (L.fillKind === "linear" || L.fillKind === "radial")) {
          var sgid = idSafe + "Shp" + (gradN++);
          var send = L.fillFade ? '<stop offset="1" stop-color="' + sFill + '" stop-opacity="0"/>' : '<stop offset="1" stop-color="' + (L.fill2 || sFill) + '"/>';
          extraDefs += L.fillKind === "radial"
            ? '<radialGradient id="' + sgid + '"><stop offset="0" stop-color="' + sFill + '"/>' + send + '</radialGradient>'
            : '<linearGradient id="' + sgid + '" gradientTransform="rotate(' + r2(L.fillAngle != null ? L.fillAngle : 135) + ' .5 .5)"><stop offset="0" stop-color="' + sFill + '"/>' + send + '</linearGradient>';
          sFill = "url(#" + sgid + ")";
        }
        var sStr = L.stroke && L.stroke !== "none" && L.strokeW > 0;
        var sDash2 = L.strokeStyle === "dashed" ? ' stroke-dasharray="7 4"' : L.strokeStyle === "dotted" ? ' stroke-dasharray="0.5 5" stroke-linecap="round"' : '';   // mirrors the live render's border styles
        var sCommon = ' fill="' + sFill + '"' + (sStr ? ' stroke="' + L.stroke + '" stroke-width="' + r2(L.strokeW * 100) + '" stroke-linejoin="round"' + sDash2 : '') + (L.opacity != null && L.opacity < 1 ? ' opacity="' + r2(L.opacity) + '"' : '');
        var sEl;
        if (L.shape === "ellipse") sEl = '<ellipse cx="' + r2(L.x * 100) + '" cy="' + r2(L.y * 100) + '" rx="' + r2(sw2 / 2) + '" ry="' + r2(sh3 / 2) + '"' + sCommon + '/>';
        else if (L.shape === "rect" || L.shape === "line") {
          var srx = L.shape === "line" ? sh3 / 2 : Math.min(sw2, sh3) * (L.radius != null ? L.radius : .12);
          sEl = '<rect x="' + r2(sx2) + '" y="' + r2(sy2) + '" width="' + r2(sw2) + '" height="' + r2(sh3) + '" rx="' + r2(srx) + '"' + sCommon + '/>';
        } else {                                               // triangle / star / diamond / heart: 0..100 path scaled into the element box (stroke stretches like the live render)
          sEl = '<g transform="translate(' + r2(sx2) + ' ' + r2(sy2) + ') scale(' + r2(sw2 / 100) + ' ' + r2(sh3 / 100) + ')">' + shapePathFor(L.shape, sCommon) + '</g>';
        }
        var stf = exportTf(L);
        svg += stf.length ? '<g transform="' + stf.join(' ') + '">' + sEl + '</g>' : sEl;
      } else if (L.t === "frame") {
        if (!L.src) { skipped++; }                             // an empty slot is a placeholder, not panel content
        else {
          var fw2 = (L.w || .42) * 100, fh2 = (L.h || .42) * 100;
          var fx3 = L.x * 100 - fw2 / 2, fy3 = L.y * 100 - fh2 / 2;
          var fStr = L.stroke && L.stroke !== "none" && L.strokeW > 0;
          var fOp = (L.opacity != null && L.opacity < 1) ? ' opacity="' + r2(L.opacity) + '"' : '';
          var fRx = L.frame === "rounded" ? Math.min(fw2, fh2) * Math.max(L.radius != null ? L.radius : .16, .08) : 0;
          var img2 = '<image href="' + L.src + '" x="' + r2(fx3) + '" y="' + r2(fy3) + '" width="' + r2(fw2) + '" height="' + r2(fh2) + '" preserveAspectRatio="xMidYMid slice"' + fOp;
          var border2 = "", fEl;
          if (L.frame === "rect") {                            // the image box IS the rect: no clip needed
            fEl = img2 + '/>';
            if (fStr) border2 = '<rect x="' + r2(fx3) + '" y="' + r2(fy3) + '" width="' + r2(fw2) + '" height="' + r2(fh2) + '" fill="none" stroke="' + L.stroke + '" stroke-width="' + r2(L.strokeW * 100) + '"/>';
          } else if (L.frame === "rounded" || L.frame === "circle") {
            var cid2 = idSafe + "Clip" + (gradN++);
            extraDefs += L.frame === "circle"
              ? '<clipPath id="' + cid2 + '"><ellipse cx="' + r2(L.x * 100) + '" cy="' + r2(L.y * 100) + '" rx="' + r2(fw2 / 2) + '" ry="' + r2(fh2 / 2) + '"/></clipPath>'
              : '<clipPath id="' + cid2 + '"><rect x="' + r2(fx3) + '" y="' + r2(fy3) + '" width="' + r2(fw2) + '" height="' + r2(fh2) + '" rx="' + r2(fRx) + '"/></clipPath>';
            fEl = img2 + ' clip-path="url(#' + cid2 + ')"/>';
            if (fStr) border2 = L.frame === "circle"
              ? '<ellipse cx="' + r2(L.x * 100) + '" cy="' + r2(L.y * 100) + '" rx="' + r2(fw2 / 2) + '" ry="' + r2(fh2 / 2) + '" fill="none" stroke="' + L.stroke + '" stroke-width="' + r2(L.strokeW * 100) + '"/>'
              : '<rect x="' + r2(fx3) + '" y="' + r2(fy3) + '" width="' + r2(fw2) + '" height="' + r2(fh2) + '" rx="' + r2(fRx) + '" fill="none" stroke="' + L.stroke + '" stroke-width="' + r2(L.strokeW * 100) + '"/>';
          } else {                                             // heart / star / triangle: path clip scaled into the element box
            var cid3 = idSafe + "Clip" + (gradN++);
            var tf3 = 'transform="translate(' + r2(fx3) + ' ' + r2(fy3) + ') scale(' + r2(fw2 / 100) + ' ' + r2(fh2 / 100) + ')"';
            extraDefs += '<clipPath id="' + cid3 + '">' + shapePathFor(L.frame, ' ' + tf3) + '</clipPath>';
            fEl = img2 + ' clip-path="url(#' + cid3 + ')"/>';
            if (fStr) border2 = '<g ' + tf3 + '>' + shapePathFor(L.frame, ' fill="none" stroke="' + L.stroke + '" stroke-width="' + r2(L.strokeW * 100) + '" stroke-linejoin="round"') + '</g>';
          }
          var fOut = fEl + border2;
          svg += L.rotate ? '<g transform="rotate(' + r2(L.rotate) + ' ' + r2(L.x * 100) + ' ' + r2(L.y * 100) + ')">' + fOut + '</g>' : fOut;
        }
      } else if (L.t === "qr") {
        var qm = GBX.qrMatrix && GBX.qrMatrix(L.value, L.ecc);
        if (!qm) { skipped++; }                                // value too big for v10 — nothing to bake
        else {
          var quiet = 4, D = qm.count + quiet * 2, qsz = (L.w || .4) * 100, qx = L.x * 100 - qsz / 2, qy = L.y * 100 - qsz / 2;
          var qd = "", qr2, qc;
          for (qr2 = 0; qr2 < qm.count; qr2++) { qc = 0; while (qc < qm.count) { if (qm.modules[qr2][qc]) { var qs = qc; while (qc < qm.count && qm.modules[qr2][qc]) qc++; var qrun = qc - qs; qd += "M" + (qs + quiet) + " " + (qr2 + quiet) + "h" + qrun + "v1h-" + qrun + "z"; } else qc++; } }
          var qbg = (L.light && L.light !== "none") ? '<rect width="' + D + '" height="' + D + '" fill="' + L.light + '"/>' : '';
          var qsvg = '<svg x="' + r2(qx) + '" y="' + r2(qy) + '" width="' + r2(qsz) + '" height="' + r2(qsz) + '" viewBox="0 0 ' + D + ' ' + D + '" shape-rendering="crispEdges">' + qbg + '<path d="' + qd + '" fill="' + (L.dark || "#11141b") + '"/></svg>';
          var qtf = exportTf(L);
          svg += qtf.length ? '<g transform="' + qtf.join(' ') + '">' + qsvg + '</g>' : qsvg;
        }
      } else if (L.t) { skipped++; }
      if (L.blend && /^[a-z-]+$/.test(L.blend) && svg.length > _bStart) svg = svg.slice(0, _bStart) + '<g style="mix-blend-mode:' + L.blend + '">' + svg.slice(_bStart) + '</g>';   // per-layer blend parity
    });
    if (extraDefs) svg = svg.replace("</defs>", extraDefs + "</defs>");
    svg += '</svg>';
    var entry = { name: name, group: group, fields: fields, svg: svg };
    var fk = Object.keys(usedFonts);
    if (fk.length) entry.fonts = fk;   // docFonts() reads this so pages lazy-load a custom panel's webfonts
    return { id: id, name: name, group: group, entry: entry, skipped: skipped };
  }

  // register a panel into the live registries so it appears in the Panels tool immediately
  function registerPanelLive(id, entry, setId) {
    setId = setId || "custom";
    entry.family = setId;
    GBX.PANELS[id] = entry;
    if (window.GIIIFTBoxPanels) window.GIIIFTBoxPanels[id] = entry;
    var sets = window.GIIIFTBoxPanelSets = window.GIIIFTBoxPanelSets || [];
    if (!sets.some(function (s) { return s.id === setId; })) sets.push({ id: setId, name: "Session panels", desc: "Session panels (admin)" });
    // (no renderInspector here — we're in the Code tool; re-rendering would wipe the snippet box.
    //  The Panels tool reads GBX.PANELS + GIIIFTBoxPanelSets live, so the new panel/set appears on switch.)
  }

  // build the box-panels.js registration snippet for a panel
  function panelSnippet(res, setId) {
    return '  "' + res.id + '": { name: ' + JSON.stringify(res.name) + ', group: "' + res.group + '",\n'
      + '    fields: ' + JSON.stringify(res.entry.fields) + (res.entry.fonts ? ', fonts: ' + JSON.stringify(res.entry.fonts) : '') + ', svg:\n'
      + '    `' + res.entry.svg + '` },\n\n'
      + '  // fam map:  "' + res.id + '": "' + setId + '",\n'
      + '  // set:      { id: "' + setId + '", name: "Session panels", desc: "Custom" },';
  }

  /* ---------------- admin: template authoring — save the WHOLE box as a TEMPLATES entry ---------------- */
  function tplSlug(id, fb) { return String(id || fb).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || fb; }
  // template-card thumbnail: the front face as it stands — its panel if it wears one,
  // else the literal-text variant of the panel exporter (gradient + art + wording)
  function frontMotifSVG(tplId) {
    var f = doc.faces.front;
    if (f.panel && GBX.PANELS[f.panel]) return GBX.panelSVG(f.panel, f.panelText, f.panelScale);
    return exportFaceAsPanel(tplId + "-motif", "", "side", { face: "front", literal: true }).entry.svg;
  }
  function exportDocAsTemplate(id, name, desc) {
    id = tplSlug(id, "custom-template");
    name = (name || id.replace(/-/g, " ")).trim();
    desc = (desc || "Session template").trim();
    var snap = JSON.stringify(clone(doc));           // frozen snapshot; build() re-parses so every apply gets a fresh doc
    return {
      id: id, snap: snap,
      entry: { id: id, name: name, desc: desc, c1: doc.palette.c1, c2: doc.palette.c2, motif: frontMotifSVG(id), session: true,
        build: function () { return JSON.parse(snap); } }
    };
  }
  function registerTemplateLive(entry) {             // same id saved again replaces in place
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].id === entry.id) { TEMPLATES[i] = entry; return; }
    TEMPLATES.push(entry);
  }
  // paste target is the TEMPLATES array in this file (panels go to box-panels.js, whole boxes live here)
  function templateSnippet(res) {
    return '    { id: "' + res.id + '", name: ' + JSON.stringify(res.entry.name) + ', desc: ' + JSON.stringify(res.entry.desc)
      + ', c1: "' + res.entry.c1 + '", c2: "' + res.entry.c2 + '", motif: ' + JSON.stringify(res.entry.motif) + ',\n'
      + '      build: function () { return JSON.parse(' + JSON.stringify(res.snap) + '); } },';
  }

  /* ---------------- admin: subject / background split (drop -> two movable art layers) ----------------
   * The Canva-"Magic Grab" move, fully in-browser: onnxruntime-web (CDN, lazy-injected) runs the
   * silueta saliency model (u2net arch @320, Apache-2.0, ~42 MB one-time download, kept in the
   * Cache API). Drop a render -> background art layer + the subject cut out onto its own layer
   * (WebP alpha), placed so the composite matches the original until you move it. No server, no keys. */
  var ORT_CDN = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";
  var SEG_MODEL_URL = "https://huggingface.co/jellybox/silueta/resolve/main/silueta_320.onnx";
  var SEG_SIZE = 320, segSessionP = null, segBusy = false;
  function loadOrt() {
    if (window.ort) return Promise.resolve(window.ort);
    if (loadOrt.p) return loadOrt.p;
    loadOrt.p = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = ORT_CDN + "ort.min.js";
      s.onload = function () { if (window.ort) { window.ort.env.wasm.wasmPaths = ORT_CDN; resolve(window.ort); } else reject(new Error("ort global missing")); };
      s.onerror = function () { loadOrt.p = null; reject(new Error("could not load onnxruntime")); };
      document.head.appendChild(s);
    });
    return loadOrt.p;
  }
  function fetchModelCached(url) {
    var get = function () { return fetch(url, { mode: "cors" }).then(function (r) { if (!r.ok) throw new Error("model fetch " + r.status); return r; }); };
    if (!window.caches) return get().then(function (r) { return r.arrayBuffer(); });
    return caches.open("giiift-lab-models").then(function (c) {
      return c.match(url).then(function (hit) {
        if (hit) return hit.arrayBuffer();
        toast("Downloading cutout model (42 MB, first time only)…");
        return get().then(function (r) { return c.put(url, r.clone()).then(function () { return r.arrayBuffer(); }); });
      });
    }).catch(function () { return get().then(function (r) { return r.arrayBuffer(); }); });   // Cache API hiccup -> plain fetch
  }
  function segSession() {
    if (segSessionP) return segSessionP;
    segSessionP = loadOrt().then(function (ort) {
      return fetchModelCached(SEG_MODEL_URL).then(function (buf) {
        return ort.InferenceSession.create(buf, { executionProviders: ["wasm"] });
      });
    });
    segSessionP.catch(function () { segSessionP = null; });    // a failed load retries on the next attempt
    return segSessionP;
  }
  // square art canvas -> Float32 saliency mask (0..1, SEG_SIZE²) — rembg's u2net preprocessing
  function segmentMask(square) {
    return segSession().then(function (sess) {
      var cv = document.createElement("canvas"); cv.width = SEG_SIZE; cv.height = SEG_SIZE;
      var cx = cv.getContext("2d"); cx.drawImage(square, 0, 0, SEG_SIZE, SEG_SIZE);
      var d = cx.getImageData(0, 0, SEG_SIZE, SEG_SIZE).data, n = SEG_SIZE * SEG_SIZE;
      var mx = 1, i;
      for (i = 0; i < n * 4; i++) { if ((i & 3) !== 3 && d[i] > mx) mx = d[i]; }   // /max over RGB, like rembg
      var t = new Float32Array(n * 3);
      for (i = 0; i < n; i++) {
        t[i] = (d[i * 4] / mx - 0.485) / 0.229;
        t[n + i] = (d[i * 4 + 1] / mx - 0.456) / 0.224;
        t[2 * n + i] = (d[i * 4 + 2] / mx - 0.406) / 0.225;
      }
      var feeds = {}; feeds[sess.inputNames[0]] = new window.ort.Tensor("float32", t, [1, 3, SEG_SIZE, SEG_SIZE]);
      return sess.run(feeds).then(function (out) {
        var m = out[sess.outputNames[0]].data, lo = Infinity, hi = -Infinity, k;
        for (k = 0; k < n; k++) { if (m[k] < lo) lo = m[k]; if (m[k] > hi) hi = m[k]; }
        var rng = (hi - lo) || 1, mask = new Float32Array(n);
        for (k = 0; k < n; k++) mask[k] = (m[k] - lo) / rng;
        return mask;
      });
    });
  }
  function maskToCanvas(mask, W, H) {                          // SEG_SIZE float mask -> W×H smooth grayscale canvas
    var mc = document.createElement("canvas"); mc.width = SEG_SIZE; mc.height = SEG_SIZE;
    var mctx = mc.getContext("2d"), id = mctx.createImageData(SEG_SIZE, SEG_SIZE);
    for (var i = 0; i < mask.length; i++) { var v = Math.round(mask[i] * 255); id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
    mctx.putImageData(id, 0, 0);
    var up = document.createElement("canvas"); up.width = W; up.height = H;
    var ux = up.getContext("2d"); ux.imageSmoothingEnabled = true; ux.imageSmoothingQuality = "high";
    ux.drawImage(mc, 0, 0, W, H);
    return up;
  }
  function maskBBox(md, W, H) {                                // subject bounds (alpha ≥ 30) + 1.5% pad; null = no subject
    var x0 = W, y0 = H, x1 = -1, y1 = -1, x, y;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (md[(y * W + x) * 4] >= 30) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    var pad = Math.round(Math.max(W, H) * 0.015);
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
    return { x0: x0, y0: y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1 };
  }
  function cutoutCanvas(srcCv, md, W, bb) {                    // crop to bbox, mask as alpha (min with source alpha), low floor
    var cut = document.createElement("canvas"); cut.width = bb.bw; cut.height = bb.bh;
    var cctx = cut.getContext("2d");
    cctx.drawImage(srcCv, bb.x0, bb.y0, bb.bw, bb.bh, 0, 0, bb.bw, bb.bh);
    var cd = cctx.getImageData(0, 0, bb.bw, bb.bh);
    for (var y = 0; y < bb.bh; y++) for (var x = 0; x < bb.bw; x++) {
      var a = md[((y + bb.y0) * W + (x + bb.x0)) * 4];
      var o = (y * bb.bw + x) * 4 + 3;
      cd.data[o] = Math.min(cd.data[o], a < 24 ? 0 : a);       // floor low alpha: no milky veil over the bg
    }
    cctx.putImageData(cd, 0, 0);
    return cut;
  }
  // crop the FULL source to the subject bbox at full alpha — the touch-up brush's "Restore" source
  // (the encoded cutout loses RGB under alpha=0, so Restore must sample the un-masked original).
  function cropCanvas(srcCv, bb) {
    var c = document.createElement("canvas"); c.width = bb.bw; c.height = bb.bh;
    c.getContext("2d").drawImage(srcCv, bb.x0, bb.y0, bb.bw, bb.bh, 0, 0, bb.bw, bb.bh); return c;
  }
  function tagCutout(L, srcCv, bb) { var id = "cut" + (++cutSeq); L.cutId = id; cutBase[id] = cropCanvas(srcCv, bb); }
  // the centered square "cover" actually shows on a square face, capped to the import edge limit
  function coverSquare(img) {
    var S0 = Math.min(img.width, img.height), S = Math.min(768, S0);
    var cv = document.createElement("canvas"); cv.width = S; cv.height = S;
    cv.getContext("2d").drawImage(img, (img.width - S0) / 2, (img.height - S0) / 2, S0, S0, 0, 0, S, S);
    return cv;
  }
  function encodeUnderCap(cv, mime, qs) {                      // try qualities, then one downscale; null if hopeless
    for (var i = 0; i < qs.length; i++) { var u = cv.toDataURL(mime, qs[i]); if (u.indexOf("data:" + mime) === 0 && u.length <= 160000) return u; }
    var half = document.createElement("canvas");
    half.width = Math.max(64, Math.round(cv.width * 0.66)); half.height = Math.max(64, Math.round(cv.height * 0.66));
    half.getContext("2d").drawImage(cv, 0, 0, half.width, half.height);
    var u2 = half.toDataURL(mime, qs[qs.length - 1]);
    return (u2.indexOf("data:" + mime) === 0 && u2.length <= 160000) ? u2 : null;
  }
  function splitImportToFace(file, face, dim) {
    if (segBusy) { toast("Already cutting one out — hang on", true); return; }
    if (!file || !/^image\//.test(file.type || "")) { toast("Not an image", true); return; }
    segBusy = true;
    var url = URL.createObjectURL(file), img = new Image();
    function fail(msg) { segBusy = false; toast(msg, true); importImageToFace(file, face); }
    img.onload = function () {
      URL.revokeObjectURL(url);
      var square = coverSquare(img), S = square.width;
      toast("Cutting out the subject…"); announce("Cutting out the subject");
      segmentMask(square).then(function (mask) {
        var mcv = maskToCanvas(mask, S, S);
        var md = mcv.getContext("2d").getImageData(0, 0, S, S).data;
        var bb = maskBBox(md, S, S);
        if (!bb) return fail("No clear subject found — imported as one layer");
        if (bb.bw * bb.bh > S * S * 0.94) return fail("Subject fills the whole frame — imported as one layer");
        var x0 = bb.x0, y0 = bb.y0, bw = bb.bw, bh = bb.bh;
        var cut = cutoutCanvas(square, md, S, bb);
        var cutUri = encodeUnderCap(cut, "image/webp", [0.8, 0.62]) || encodeUnderCap(cut, "image/png", [1]);
        if (!cutUri) return fail("Cutout too heavy to embed — imported as one layer");
        var bg = square;
        if (dim) {                                             // baked treatment: the engine has no per-layer filters
          bg = document.createElement("canvas"); bg.width = S; bg.height = S;
          var bx = bg.getContext("2d");
          bx.filter = "blur(6px) brightness(0.55) saturate(0.85)"; bx.drawImage(square, 0, 0); bx.filter = "none";
        }
        var bgUri = encodeUnderCap(bg, "image/jpeg", [0.72, 0.55]);
        if (!bgUri) return fail("Background too heavy to embed — imported as one layer");
        if (face !== activeFace) setActiveFace(face);
        var an = analyzeCanvas(square);                        // pairing should read the whole composition for either layer
        if (an) { ART_AN_CACHE[artKey(bgUri)] = an; ART_AN_CACHE[artKey(cutUri)] = an; }
        var L = faceLayers();
        L.push({ t: "art", src: bgUri, fit: "cover", zoom: 1, x: 0.5, y: 0.5, w: 1, h: 1, radius: 0, rotate: 0 });
        L.push({ t: "art", src: cutUri, fit: "contain", zoom: 1, x: +((x0 + bw / 2) / S).toFixed(4), y: +((y0 + bh / 2) / S).toFixed(4), w: +(bw / S).toFixed(4), h: +(bh / S).toFixed(4), radius: 0, rotate: 0, noShadow: true });
        tagCutout(L[L.length - 1], square, bb);
        segBusy = false;
        selectLayer(activeFace, L.length - 1); rerender(); record();
        toast("Split done — the subject is its own layer (" + Math.round(cutUri.length / 1024) + " KB), drag it anywhere");
        announce("Subject cut out onto its own layer on the " + activeFace + " face");
      }).catch(function (err) {
        console.error("[box lab] split failed", err);
        fail("Cutout failed (" + ((err && err.message) || "error") + ") — imported as one layer");
      });
    };
    img.onerror = function () { URL.revokeObjectURL(url); segBusy = false; toast("Could not read that image", true); };
    img.src = url;
  }
  /* ---------------- admin: place assets as their own layers (multi-asset panel composition) ----------------
   * A drop no longer has to mean "wallpaper the face": a logo / sticker / cutout can land AT the
   * drop point as its own art layer (transparency kept, no shadow box), stack with everything
   * already on the face, and be reordered with the existing Layers depth tools. */
  function placeCanvasAsElement(cv, face, pt, hasAlpha) {
    var uri = encodeSmart(cv, hasAlpha);
    if (!uri) { toast("Asset too large to embed — crop or shrink it first", true); return false; }
    if (face !== activeFace) setActiveFace(face);
    var MAXD = 0.45, ar = cv.width / cv.height;                // ~half the face on its long side, aspect kept
    var w = ar >= 1 ? MAXD : +(MAXD * ar).toFixed(4);
    var h = ar >= 1 ? +(MAXD / ar).toFixed(4) : MAXD;
    var an = analyzeCanvas(cv); if (an) ART_AN_CACHE[artKey(uri)] = an;
    var lay = { t: "art", src: uri, fit: "contain", zoom: 1, x: +clamp01(pt && pt.x != null ? pt.x : 0.5).toFixed(4), y: +clamp01(pt && pt.y != null ? pt.y : 0.5).toFixed(4), w: w, h: h, radius: 0, rotate: 0 };
    if (hasAlpha) lay.noShadow = true;                         // sticker-style assets shouldn't draw their rectangle
    var L = faceLayers(); L.push(lay);
    selectLayer(activeFace, L.length - 1); rerender(); record();
    return true;
  }
  function placeImportToFace(file, face, pt, quiet) {
    fileToCanvas(file, function (cv) {
      var alpha = canvasHasAlpha(cv);
      if (placeCanvasAsElement(cv, face, pt, alpha) && !quiet) {
        toast("Asset placed as its own layer" + (alpha ? " (transparency kept)" : "") + " — drag, resize, reorder");
        announce("Asset placed on the " + activeFace + " face");
      }
    }, function () { toast("Could not read that image", true); });
  }
  // AI cutout of the subject ONLY, placed at the drop point — the source's background never lands
  function cutPlaceCanvas(cv, face, pt) {
    if (segBusy) { toast("Already cutting one out — hang on", true); return; }
    segBusy = true;
    toast("Cutting out the subject…"); announce("Cutting out the subject");
    segmentMask(cv).then(function (mask) {
      var W = cv.width, H = cv.height;
      var mcv = maskToCanvas(mask, W, H);
      var md = mcv.getContext("2d").getImageData(0, 0, W, H).data;
      var bb = maskBBox(md, W, H);
      segBusy = false;
      if (!bb) { toast("No clear subject found — placed whole", true); placeCanvasAsElement(cv, face, pt, canvasHasAlpha(cv)); return; }
      var cut = cutoutCanvas(cv, md, W, bb);
      var cutUri = encodeUnderCap(cut, "image/webp", [0.8, 0.62]) || encodeUnderCap(cut, "image/png", [1]);
      if (!cutUri) { toast("Cutout too heavy to embed — crop or shrink it first", true); return; }
      if (face !== activeFace) setActiveFace(face);
      var an = analyzeCanvas(cv); if (an) ART_AN_CACHE[artKey(cutUri)] = an;
      var MAXD = 0.5, ar = bb.bw / bb.bh;
      var w = ar >= 1 ? MAXD : +(MAXD * ar).toFixed(4);
      var h = ar >= 1 ? +(MAXD / ar).toFixed(4) : MAXD;
      var L = faceLayers();
      L.push({ t: "art", src: cutUri, fit: "contain", zoom: 1, x: +clamp01(pt && pt.x != null ? pt.x : 0.5).toFixed(4), y: +clamp01(pt && pt.y != null ? pt.y : 0.5).toFixed(4), w: w, h: h, radius: 0, rotate: 0, noShadow: true });
      tagCutout(L[L.length - 1], cv, bb);
      selectLayer(activeFace, L.length - 1); rerender(); record();
      toast("Subject cut out and placed (" + Math.round(cutUri.length / 1024) + " KB) — drag, resize, reorder");
      announce("Subject placed on the " + activeFace + " face");
    }).catch(function (err) {
      console.error("[box lab] cut+place failed", err);
      segBusy = false;
      toast("Cutout failed (" + ((err && err.message) || "error") + ") — placed whole", true);
      placeCanvasAsElement(cv, face, pt, canvasHasAlpha(cv));
    });
  }
  function importDialog(file, face, pt) {
    if (!file || !/^image\//.test(file.type || "")) { toast("Not an image", true); return; }
    fileToCanvas(file, function (cv) {
      var alpha = canvasHasAlpha(cv);
      var prev = document.activeElement;
      var back = el("div", "modal-back");
      var m = el("div", "modal"); m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-labelledby", "split-h");
      var h = el("h3"); h.id = "split-h"; h.textContent = "Import art"; m.appendChild(h);
      var p = el("p"); p.textContent = alpha
        ? "Transparent image detected — it can sit on the face as a sticker-style layer."
        : "How should this land on the " + face + " face?";
      m.appendChild(p);
      function close() { back.remove(); document.removeEventListener("keydown", onKey, true); if (prev && prev.focus) prev.focus(); }
      function onKey(e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } }
      function opt(label, sub, fn, acc) {
        var b = el("button", "btn" + (acc ? " acc" : "")); b.type = "button";
        b.style.cssText = "display:block;width:100%;text-align:left;margin-top:7px;padding:9px 11px";
        b.innerHTML = '<div style="font-weight:600">' + esc(label) + '</div><div style="font-size:11px;opacity:.65;margin-top:2px;font-weight:400">' + esc(sub) + "</div>";
        b.addEventListener("click", function () { close(); fn(); });
        m.appendChild(b); return b;
      }
      var bPlace = opt("Place here — its own layer",
        alpha ? "Keeps the transparency. Drag, resize and reorder it after." : "Lands at ~half size where you dropped it. Drag, resize, reorder after.",
        function () {
          if (placeCanvasAsElement(cv, face, pt, alpha)) {
            toast("Asset placed as its own layer" + (alpha ? " (transparency kept)" : "") + " — drag, resize, reorder");
            announce("Asset placed on the " + activeFace + " face");
          }
        }, alpha);
      opt("Cut out the subject, place it", "AI cutout of the main subject only — its background never lands.", function () { cutPlaceCanvas(cv, face, pt); });
      opt("Fill the face", "One full-bleed layer (the classic flow).", function () { fillCanvasToFace(cv, face); });
      var bSplit = opt("Split subject / background", "Two layers: full-bleed background + the subject cut out on top.", function () { splitImportToFace(file, face, chk.checked); }, !alpha);
      var lab = el("label"); lab.style.cssText = "display:flex;align-items:center;gap:8px;font-size:12px;margin:6px 0 0 11px;cursor:pointer";
      var chk = el("input"); chk.type = "checkbox"; var st2 = el("span"); st2.textContent = "Dim the background layer on split (baked blur + darken)";
      lab.append(chk, st2); m.appendChild(lab);
      var note = el("p"); note.style.cssText = "font-size:11px;opacity:.6;margin:8px 0 0";
      note.textContent = "AI options download a 42 MB model once (kept locally). Esc / outside click cancels.";
      m.appendChild(note);
      back.appendChild(m); document.body.appendChild(back);
      back.addEventListener("pointerdown", function (e) { if (e.target === back) close(); });
      document.addEventListener("keydown", onKey, true);
      var crowded = !!(doc.faces[face].panel || (doc.faces[face].layers || []).some(function (L2) { return L2.t === "art"; }));
      setTimeout(function () { ((alpha || crowded) ? bPlace : bSplit).focus(); }, 0);   // never bury existing work by default
    }, function () { toast("Could not read that image", true); });
  }

  /* ---------------- cutout touch-up brush ----------------
   * Paint to clean up / restore an art layer's alpha. Edits a fit-resolution copy (snappy, and
   * cutouts ride small on a face anyway), then re-encodes into the layer's src. ERASE removes
   * alpha (destination-out, soft); RESTORE re-draws from the pre-mask original (cutBase[cutId])
   * when we have it, else from the image's open-state snapshot. */
  function touchUp(L) {
    if (!L || L.t !== "art" || typeof L.src !== "string") return;
    var img = new Image();
    img.onload = function () {
      var nat = Math.max(img.width, img.height) || 1, scale = Math.min(1, 720 / nat);
      var W = Math.max(1, Math.round(img.width * scale)), H = Math.max(1, Math.round(img.height * scale));
      var work = document.createElement("canvas"); work.width = W; work.height = H;
      var wx = work.getContext("2d"); wx.drawImage(img, 0, 0, W, H);
      var rest = document.createElement("canvas"); rest.width = W; rest.height = H;     // Restore source, aligned to work
      var rcx = rest.getContext("2d");
      if (L.cutId && cutBase[L.cutId]) rcx.drawImage(cutBase[L.cutId], 0, 0, W, H);      // the un-masked original (best)
      else rcx.drawImage(work, 0, 0);                                                    // fallback: bring back the open-state pixels

      var prev = document.activeElement, mode = "erase", size = Math.max(8, Math.round(Math.max(W, H) * 0.12)), painting = false, lastX = 0, lastY = 0, undo = [];
      var back = el("div", "modal-back"), m = el("div", "modal tu-modal");
      m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-label", "Touch up cutout");
      var h = el("h3"); h.textContent = "Touch up cutout"; m.appendChild(h);
      var note = el("p"); note.style.cssText = "font-size:11px;opacity:.65;margin-bottom:8px"; note.textContent = "Drag on the image. Erase removes leftover background; Restore brings back parts the AI over-cut."; m.appendChild(note);
      var stageEl = el("div", "tu-stage"); var view = el("canvas", "tu-view"); view.width = W; view.height = H; stageEl.appendChild(view); m.appendChild(stageEl);
      var vx = view.getContext("2d");
      function blit() { vx.clearRect(0, 0, W, H); vx.drawImage(work, 0, 0); }
      blit();
      var ctrls = el("div", "tu-ctrls");
      ctrls.appendChild(segField("", [{ value: "erase", label: "Erase" }, { value: "restore", label: "Restore" }], function () { return mode; }, function (v) { mode = v; }));
      var sizeWrap = el("label", "tu-size"); var sl = el("span"); sl.textContent = "Brush"; var sr = el("input"); sr.type = "range"; sr.min = "6"; sr.max = String(Math.round(Math.max(W, H) * 0.5)); sr.value = String(size); sr.addEventListener("input", function () { size = +sr.value; });
      sizeWrap.append(sl, sr); ctrls.appendChild(sizeWrap); m.appendChild(ctrls);
      function snap() { try { undo.push(wx.getImageData(0, 0, W, H)); if (undo.length > 24) undo.shift(); } catch (e) {} }
      function paintAt(px, py) {
        if (mode === "erase") {
          wx.save(); wx.globalCompositeOperation = "destination-out";
          var rg = wx.createRadialGradient(px, py, 0, px, py, size);
          rg.addColorStop(0, "rgba(0,0,0,1)"); rg.addColorStop(.65, "rgba(0,0,0,1)"); rg.addColorStop(1, "rgba(0,0,0,0)");
          wx.fillStyle = rg; wx.beginPath(); wx.arc(px, py, size, 0, 6.2832); wx.fill(); wx.restore();
        } else {
          wx.save(); wx.beginPath(); wx.arc(px, py, size, 0, 6.2832); wx.clip(); wx.globalCompositeOperation = "source-over"; wx.drawImage(rest, 0, 0); wx.restore();
        }
        blit();
      }
      function toPx(ev) { var r = view.getBoundingClientRect(); return { x: (ev.clientX - r.left) * (W / r.width), y: (ev.clientY - r.top) * (H / r.height) }; }
      view.addEventListener("pointerdown", function (ev) { ev.preventDefault(); snap(); painting = true; var p = toPx(ev); lastX = p.x; lastY = p.y; paintAt(p.x, p.y); try { view.setPointerCapture(ev.pointerId); } catch (e) {} });
      view.addEventListener("pointermove", function (ev) { if (!painting) return; var p = toPx(ev), d = Math.hypot(p.x - lastX, p.y - lastY), st = Math.max(1, size * .4); for (var t = st; t < d; t += st) paintAt(lastX + (p.x - lastX) * t / d, lastY + (p.y - lastY) * t / d); paintAt(p.x, p.y); lastX = p.x; lastY = p.y; });
      function stop() { painting = false; }
      view.addEventListener("pointerup", stop); view.addEventListener("pointercancel", stop);
      var foot = el("div", "tu-foot");
      var bu = el("button", "btn"); bu.textContent = "Undo"; bu.addEventListener("click", function () { var im = undo.pop(); if (im) { wx.putImageData(im, 0, 0); blit(); } });
      var bc = el("button", "btn"); bc.textContent = "Cancel"; bc.addEventListener("click", close);
      var bd = el("button", "btn acc"); bd.textContent = "Done"; bd.addEventListener("click", commit);
      foot.append(bu, bc, bd); m.appendChild(foot);
      function close() { back.remove(); document.removeEventListener("keydown", onKey, true); if (prev && prev.focus) prev.focus(); }
      function onKey(e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } }
      function commit() {
        var uri = encodeUnderCap(work, "image/webp", [0.85, 0.7]) || encodeUnderCap(work, "image/png", [1]);
        if (!uri) { toast("Edited cutout too heavy to embed — erase more or shrink it", true); return; }
        L.src = uri; L.noShadow = true; close(); rerender(); record(); announce("Cutout touched up"); toast("Cutout touched up");
      }
      back.appendChild(m); document.body.appendChild(back);
      back.addEventListener("pointerdown", function (e) { if (e.target === back) close(); });
      document.addEventListener("keydown", onKey, true);
      setTimeout(function () { bd.focus(); }, 0);
    };
    img.onerror = function () { toast("Couldn't load that image to edit", true); };
    img.src = L.src;
  }

  /* ---------------- crop / reframe tool (manual sub-window of a photo) ---------------- */
  function cropTool(L) {
    if (!L || L.t !== "art" || typeof L.src !== "string" || !L.src) return;
    var img = new Image();
    img.onload = function () {
      var nat = Math.max(img.width, img.height) || 1, scale = Math.min(1, 720 / nat);
      var W = Math.max(1, Math.round(img.width * scale)), H = Math.max(1, Math.round(img.height * scale));
      var MIN = Math.max(20, Math.round(Math.min(W, H) * 0.08));
      // crop rect in canvas px — seed from the existing crop, else the whole image
      var rx = L.crop ? L.crop.x * W : 0, ry = L.crop ? L.crop.y * H : 0, rw = L.crop ? L.crop.w * W : W, rh = L.crop ? L.crop.h * H : H;
      var prev = document.activeElement, drag = null;
      var back = el("div", "modal-back"), m = el("div", "modal tu-modal");
      m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true"); m.setAttribute("aria-label", "Crop photo");
      var h = el("h3"); h.textContent = "Crop / reframe"; m.appendChild(h);
      var note = el("p"); note.style.cssText = "font-size:11px;opacity:.65;margin-bottom:8px"; note.textContent = "Drag the frame to move it, the handles to resize. The framed area fills the layer."; m.appendChild(note);
      var stageEl = el("div", "tu-stage"); var view = el("canvas", "tu-view"); view.width = W; view.height = H; stageEl.appendChild(view); m.appendChild(stageEl);
      var vx = view.getContext("2d");
      function handles() { return { nw: [rx, ry], n: [rx + rw / 2, ry], ne: [rx + rw, ry], e: [rx + rw, ry + rh / 2], se: [rx + rw, ry + rh], s: [rx + rw / 2, ry + rh], sw: [rx, ry + rh], w: [rx, ry + rh / 2] }; }
      function draw() {
        vx.clearRect(0, 0, W, H); vx.drawImage(img, 0, 0, W, H);
        vx.fillStyle = "rgba(8,11,20,.62)";                    // scrim outside the crop
        vx.fillRect(0, 0, W, ry); vx.fillRect(0, ry + rh, W, H - ry - rh); vx.fillRect(0, ry, rx, rh); vx.fillRect(rx + rw, ry, W - rx - rw, rh);
        vx.strokeStyle = "rgba(255,255,255,.28)"; vx.lineWidth = 1;   // rule-of-thirds
        for (var t = 1; t <= 2; t++) { vx.beginPath(); vx.moveTo(rx + rw * t / 3, ry); vx.lineTo(rx + rw * t / 3, ry + rh); vx.stroke(); vx.beginPath(); vx.moveTo(rx, ry + rh * t / 3); vx.lineTo(rx + rw, ry + rh * t / 3); vx.stroke(); }
        vx.strokeStyle = "#fff"; vx.lineWidth = 2; vx.strokeRect(rx, ry, rw, rh);
        var hs = handles(), hsz = Math.max(7, Math.round(Math.min(W, H) * 0.022));
        vx.fillStyle = "#fff"; Object.keys(hs).forEach(function (k) { vx.fillRect(hs[k][0] - hsz / 2, hs[k][1] - hsz / 2, hsz, hsz); });
      }
      draw();
      function toPx(ev) { var r = view.getBoundingClientRect(); return { x: (ev.clientX - r.left) * (W / r.width), y: (ev.clientY - r.top) * (H / r.height), tol: 14 * (W / r.width) }; }
      function hitHandle(p) { var hs = handles(), best = null, bd = p.tol; Object.keys(hs).forEach(function (k) { var d = Math.hypot(hs[k][0] - p.x, hs[k][1] - p.y); if (d <= bd) { bd = d; best = k; } }); return best; }
      view.addEventListener("pointerdown", function (ev) {
        ev.preventDefault(); var p = toPx(ev), hh = hitHandle(p);
        if (hh) drag = { mode: hh, x: p.x, y: p.y };
        else if (p.x >= rx && p.x <= rx + rw && p.y >= ry && p.y <= ry + rh) drag = { mode: "move", x: p.x, y: p.y, ox: rx, oy: ry };
        else drag = null;
        if (drag) { try { view.setPointerCapture(ev.pointerId); } catch (e) {} }
      });
      view.addEventListener("pointermove", function (ev) {
        if (!drag) return; var p = toPx(ev);
        if (drag.mode === "move") {
          rx = Math.max(0, Math.min(W - rw, drag.ox + (p.x - drag.x))); ry = Math.max(0, Math.min(H - rh, drag.oy + (p.y - drag.y)));
        } else {
          var x2 = rx + rw, y2 = ry + rh, mx = Math.max(0, Math.min(W, p.x)), my = Math.max(0, Math.min(H, p.y)), md = drag.mode;
          if (md.indexOf("w") >= 0) rx = Math.min(mx, x2 - MIN);
          if (md.indexOf("e") >= 0) x2 = Math.max(mx, rx + MIN);
          if (md.indexOf("n") >= 0) ry = Math.min(my, y2 - MIN);
          if (md.indexOf("s") >= 0) y2 = Math.max(my, ry + MIN);
          rw = x2 - rx; rh = y2 - ry;
        }
        draw();
      });
      function stop(ev) { drag = null; try { view.releasePointerCapture(ev.pointerId); } catch (e) {} }
      view.addEventListener("pointerup", stop); view.addEventListener("pointercancel", stop);
      var foot = el("div", "tu-foot");
      var br = el("button", "btn"); br.textContent = "Reset"; br.addEventListener("click", function () { rx = 0; ry = 0; rw = W; rh = H; draw(); });
      var bc = el("button", "btn"); bc.textContent = "Cancel"; bc.addEventListener("click", close);
      var bd2 = el("button", "btn acc"); bd2.textContent = "Apply"; bd2.addEventListener("click", commit);
      foot.append(br, bc, bd2); m.appendChild(foot);
      function close() { back.remove(); document.removeEventListener("keydown", onKey, true); if (prev && prev.focus) prev.focus(); }
      function onKey(e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } }
      function commit() {
        if (rx <= 1 && ry <= 1 && rw >= W - 1 && rh >= H - 1) { delete L.crop; announce("Crop cleared"); }
        else L.crop = { x: +(rx / W).toFixed(4), y: +(ry / H).toFixed(4), w: +(rw / W).toFixed(4), h: +(rh / H).toFixed(4) };
        close(); rerender(); record(); renderInspector(); toast(L.crop ? "Photo reframed" : "Crop cleared");
      }
      back.appendChild(m); document.body.appendChild(back);
      back.addEventListener("pointerdown", function (e) { if (e.target === back) close(); });
      document.addEventListener("keydown", onKey, true);
      setTimeout(function () { bd2.focus(); }, 0);
    };
    img.onerror = function () { toast("Couldn't load that image to crop", true); };
    img.src = L.src;
  }

  function bindAdmin() {
    var st = document.createElement("style"); st.textContent = "#stage.dropping::after{content:'';position:absolute;inset:10px;border:2px dashed var(--acc,#00ff9d);border-radius:14px;pointer-events:none;z-index:40}"; document.head.appendChild(st);
    stage.addEventListener("dragover", function (e) { if (dtHasFiles(e)) { e.preventDefault(); stage.classList.add("dropping"); } });
    stage.addEventListener("dragleave", function (e) { if (e.target === stage) stage.classList.remove("dropping"); });
    stage.addEventListener("drop", function (e) {
      var files = e.dataTransfer && e.dataTransfer.files; if (!files || !files.length) return;
      e.preventDefault(); stage.classList.remove("dropping");
      var tgt = resolveStageTarget(e.target, e.clientX, e.clientY);
      var faceEl = (tgt && tgt.closest) ? tgt.closest(".gbx-face") : null;
      var face = faceEl ? faceEl.dataset.pos : activeFace;
      var pt = faceEl ? faceLocalXY(faceEl, e) : { x: 0.5, y: 0.5 };
      if (files.length > 1) {                                  // multi-drop: every asset lands as its own layer, cascaded
        var arr = Array.prototype.slice.call(files, 0, 8), i = 0;
        (function next() {
          if (i >= arr.length) { toast(arr.length + " assets placed as layers — reorder them in Layers"); return; }
          var p = { x: clamp01(pt.x + i * 0.05), y: clamp01(pt.y + i * 0.05) };
          placeImportToFace(arr[i], face, p, true); i++;
          setTimeout(next, 240);                               // paced so each decode lands in push order
        })();
        return;
      }
      importDialog(files[0], face, pt);
    });
    document.addEventListener("paste", function (e) {
      if (editingText || isTextEntry(document.activeElement)) return;
      var items = (e.clipboardData && e.clipboardData.items) || [];
      for (var i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.indexOf("image/") === 0) { var fl = items[i].getAsFile(); if (fl) { e.preventDefault(); importDialog(fl, activeFace, { x: 0.5, y: 0.5 }); return; } }
      }
    });
  }

  /* ---------------- boot ---------------- */
  function boot() {
    mount = $("#box-mount"); stage = $("#stage");
    if (window.GIIIFTVertical) { try { window.GIIIFTVertical.resolve(); } catch (e) {} }   // re-resolve after the packs registered (the engine's first resolve ran before they loaded)
    if (GBX.ensureFonts) GBX.ensureFonts(FONTS);   // the gallery previews every font, so the lab loads the whole library up front
    setupStageA11y(); buildStatusRegion(); buildZoom(); buildOrbitToggle(); buildUnfoldToggle(); buildPlaceBanner(); buildFaceStrip();
    buildTopbar(); buildRail(); bindStage(); bindKeys();
    if (ADMIN) bindAdmin();
    rerender(); renderInspector(); refreshStageToolbar(); updateCrumb();
    record();
    maybeRestoreDraft();                                       // reads the draft before the boot record's debounced save lands
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
