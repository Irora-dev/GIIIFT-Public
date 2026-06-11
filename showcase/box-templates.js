/* GIIIFT — shared box-design TEMPLATES (the "lab boxes" in the wrap flow).
 *
 * One registry consumed by BOTH ends of a gift:
 *   wrap.html  — the design step's "Box designs" gallery; picking one skins the
 *                stage box's faces via GIIIFTBox.panelSVG and ships `d.tp=<id>`
 *                in the compact gift payload.
 *   box.html   — sees `d.tp`, rebuilds the SAME design as a full engine doc
 *                (GIIIFTBox.render) so the recipient gets the real thing.
 *
 * Seeded from engine-lab.js's TEMPLATES (the panel-based ones; the lab keeps
 * its own authoring copy — the BOX LAB lane owns engine-lab.js, this file is
 * the cross-page consumer seam). Panels resolve from box-panels.js, which both
 * pages already load. Layer-based lab templates (minimal/birthday/crypto) are
 * deliberately absent: they don't survive the wrap stage-box's face DOM; the
 * pattern/colour system covers that ground.
 *
 * Each entry:
 *   id/name/desc      — gallery copy
 *   palette           — default c1/c2/accent/finish (colour pickers override)
 *   faces             — face → { panel, panelText? } (engine-doc shape)
 *   personalize(x, p) — write {to, from, note} into the template's own text
 *                       slots (each template decides where a name lives)
 *   label             — face to carry the PRIORITY to/from label when the
 *                       template has no to/from slots of its own (null = the
 *                       template already says who it's for)
 */
(function (global) {
  "use strict";

  function up(s, n) { return String(s || "").toUpperCase().slice(0, n); }
  function cut(s, n) { return String(s || "").slice(0, n); }

  var TEMPLATES = [
    {
      id: "expedition", name: "Expedition", desc: "Vintage expedition crate",
      palette: { c1: "#a0793f", c2: "#5d4426", accent: "#e9d9ae", angle: 135, finish: "gradient" },
      faces: {
        front:  { panel: "explorer-front" },
        back:   { panel: "explorer-side" },
        left:   { panel: "explorer-scan", panelText: { id: "DISCOVERY_" } },
        right:  { panel: "explorer-msg" },
        top:    { panel: "explorer-side" },
        bottom: { panel: "explorer-side" },
      },
      label: null, // explorer-msg carries to/message/from itself
      personalize: function (x, p) {
        x.right.panelText = {
          to: cut(p.to || "the finder", 20),
          message: cut(p.note || "Bon voyage", 26),
          from: cut(p.from || "an old friend", 22),
        };
      },
    },
    {
      id: "manga", name: "Manga Box", desc: "Inked manga panel wrap",
      palette: { c1: "#7c3aed", c2: "#ec4899", accent: "#fde68a", angle: 135, finish: "gradient" },
      faces: {
        front:  { panel: "manga-front", panelText: { title2: "FOR YOU" } },
        back:   { panel: "manga-meta" },
        left:   { panel: "manga-saga", panelText: { saga1: "YOUR SAGA" } },
        right:  { panel: "manga-panels", panelText: { fx: "KAYAAA!" } },
        top:    { panel: "manga-panels" },
        bottom: { panel: "manga-hero" },
      },
      label: null, // the cover IS the address: title2 becomes their name
      personalize: function (x, p) {
        if (p.title || p.to) x.front.panelText = { title2: up(p.title || p.to, 9) };
        if (p.note) x.left.panelText = { saga1: up(p.note, 12) };
      },
    },
    {
      id: "specimen", name: "Specimen Box", desc: "Sealed containment crate",
      palette: { c1: "#3c4248", c2: "#22262a", accent: "#ffcc00", angle: 135, finish: "matte" },
      faces: {
        front:  { panel: "cel-msg", panelText: { message: "DON'T OPEN" } },
        back:   { panel: "cel-octo" },
        left:   { panel: "cel-banner" },
        right:  { panel: "cel-crate" },
        top:    { panel: "cel-side" },
        bottom: { panel: "cel-side" },
      },
      label: null, // cel-msg carries to/message/from itself
      personalize: function (x, p) {
        x.front.panelText = {
          to: up(p.title || p.to || "A FRIEND", 20),
          message: cut(p.note || "DON'T OPEN", 24),
          from: up(p.from || "YOU", 20),
        };
      },
    },
    {
      id: "cel-crate", name: "Cel Crate", desc: "Industrial full-face wrap",
      palette: { c1: "#3c4248", c2: "#22262a", accent: "#ffcc00", angle: 135, finish: "matte" },
      faces: { front: { panel: "cel-crate" } },
      label: "right",
      personalize: function () {},
    },
    {
      id: "holographic", name: "Holographic", desc: "Iridescent foil wrap",
      palette: { c1: "#22d3ee", c2: "#a855f7", accent: "#f5f3ff", angle: 135, finish: "holo" },
      faces: { front: { panel: "holo" } },
      label: "right",
      personalize: function (x, p) {
        if (p.to) x.front.panelText = { cert: up("FOR " + p.to, 22) };
      },
    },
    {
      id: "parcel", name: "Parcel", desc: "Kraft paper & twine",
      palette: { c1: "#c9a472", c2: "#a87a48", accent: "#3a2a18", angle: 135, finish: "matte" },
      faces: { front: { panel: "kraft" } },
      label: "right",
      personalize: function (x, p) {
        if (p.note) x.front.panelText = { msg: cut(p.note, 18) };
      },
    },
  ];

  function get(id) {
    for (var i = 0; i < TEMPLATES.length; i++) if (TEMPLATES[i].id === id) return TEMPLATES[i];
    return null;
  }

  /* ---- template text slots (wrap-flow M4.5) -------------------------------
   * The light slice of the editor: a template's editable text = the union of
   * the panel-registry `fields` metadata across its faces. slots() feeds the
   * wrap design step's inputs; cleanText() is the ONE validator both ends use;
   * applyText() merges sanitized overrides onto a built doc — only keys a
   * face's panel actually declares can land, so an arbitrary `d.tt` payload
   * can never write outside known panel text tokens. */
  var SLOT_KEY = /^[a-z0-9]{1,16}$/;
  var SLOT_MAX = 40;       // hard value cap (panel field max wins when smaller)
  var SLOT_COUNT = 8;      // bound the map an attacker (or a bug) can ship

  function slots(id) {
    var t = get(id);
    var PANELS = (global.GIIIFTBox && global.GIIIFTBox.PANELS) || {};
    if (!t) return [];
    var seen = {}, out = [];
    Object.keys(t.faces).forEach(function (f) {
      var src = t.faces[f] || {};
      var p = src.panel && PANELS[src.panel];
      ((p && p.fields) || []).forEach(function (fl) {
        if (!fl || !SLOT_KEY.test(fl.key || "") || seen[fl.key]) return;
        seen[fl.key] = 1;
        out.push({
          key: fl.key,
          label: fl.label || fl.key,
          max: Math.min(fl.max || SLOT_MAX, SLOT_MAX),
          def: fl.value || "",
        });
      });
    });
    return out.slice(0, SLOT_COUNT);
  }

  function cleanText(tt) {
    if (!tt || typeof tt !== "object" || Array.isArray(tt)) return null;
    var out = {}, n = 0;
    for (var k in tt) {
      if (!Object.prototype.hasOwnProperty.call(tt, k)) continue;
      if (!SLOT_KEY.test(k)) continue;
      var v = String(tt[k] == null ? "" : tt[k]).replace(/\s+/g, " ").trim().slice(0, SLOT_MAX);
      if (!v) continue;
      out[k] = v;
      if (++n >= SLOT_COUNT) break;
    }
    return n ? out : null;
  }

  function applyText(doc, tt) {
    tt = cleanText(tt);
    if (!tt || !doc || !doc.faces) return doc;
    var PANELS = (global.GIIIFTBox && global.GIIIFTBox.PANELS) || {};
    ["front", "back", "left", "right", "top", "bottom"].forEach(function (f) {
      var face = doc.faces[f];
      var p = face && face.panel && PANELS[face.panel];
      var fl = (p && p.fields) || [];
      for (var i = 0; i < fl.length; i++) {
        var k = fl[i].key;
        if (tt[k] == null) continue;
        if (!face.panelText) face.panelText = {};
        face.panelText[k] = tt[k].slice(0, Math.min(fl[i].max || SLOT_MAX, SLOT_MAX));
      }
    });
    return doc;
  }

  /* Build a full engine doc for a template:
   *   doc("expedition", { c1, c2, accent, to, from, note, title })
   *   (title = the sender's own Front text; title slots prefer it over the name)
   * Colour args override the template palette (the wrap colour pickers);
   * to/from/note personalize the template's own slots; when the template has
   * no to/from slots a PRIORITY label layer lands on `label` face (same shape
   * GIIIFTBox.fromLegacy uses). */
  function doc(id, p) {
    var t = get(id); if (!t) return null;
    p = p || {};
    var faces = {};
    ["front", "back", "left", "right", "top", "bottom"].forEach(function (f) {
      var src = t.faces[f] || {};
      faces[f] = {
        pos: f,
        panel: src.panel || null,
        panelText: src.panelText ? JSON.parse(JSON.stringify(src.panelText)) : undefined,
        pattern: "dots",
        layers: [],
      };
    });
    try { t.personalize(faces, p); } catch (e) { /* a bad slot never blocks the box */ }
    if (t.label && faces[t.label] && !faces[t.label].panel) {
      faces[t.label].layers.push({
        t: "label", title: "PRIORITY",
        to: p.to ? "To: " + cut(p.to, 22) : "To: someone",
        from: cut(p.from || "", 22),
        x: 0.34, y: 0.5, w: 0.5, rotate: -5,
      });
    }
    return {
      v: 2, shape: "mailer",
      palette: {
        c1: p.c1 || t.palette.c1, c2: p.c2 || t.palette.c2,
        accent: p.accent || t.palette.accent,
        angle: t.palette.angle, finish: t.palette.finish,
      },
      faces: faces, features: {}, items: [],
    };
  }

  global.GIIIFTBoxTemplates = { list: TEMPLATES, get: get, doc: doc, slots: slots, cleanText: cleanText, applyText: applyText };
})(typeof window !== "undefined" ? window : this);
