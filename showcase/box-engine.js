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
  /* Font library. FONTS keys are the doc whitelist (normalize coerces unknown keys), values
   * are the CSS stacks render uses. The original five resolve through page CSS vars and are
   * loaded by every page's own <link> (core:1 below = ensureFonts leaves them alone); the
   * extended set lazy-loads from Google Fonts the first time a doc actually uses a key, so
   * recipient pages only ever fetch the families their box needs. FONT_META: human name,
   * css2 query segment (gf), picker group (cat), and matching tags (vibe) for art pairing. */
  var FONTS = {
    display: "var(--font-serif, 'EB Garamond', serif)", mono: "var(--font-mono, 'VT323', monospace)", logo: "var(--font-logo, 'Bowlby One', sans-serif)", body: "var(--font-main, 'Inter', sans-serif)", marker: "'Caveat', 'Comic Sans MS', cursive",
    playfair: "'Playfair Display', Georgia, serif", cormorant: "'Cormorant Garamond', Georgia, serif", cinzel: "'Cinzel', 'Times New Roman', serif", abril: "'Abril Fatface', Georgia, serif",
    bebas: "'Bebas Neue', 'Arial Narrow', sans-serif", anton: "'Anton', 'Arial Black', sans-serif", archivo: "'Archivo Black', 'Arial Black', sans-serif", oswald: "'Oswald', 'Arial Narrow', sans-serif",
    bangers: "'Bangers', 'Comic Sans MS', cursive", luckiest: "'Luckiest Guy', 'Comic Sans MS', cursive", titan: "'Titan One', 'Arial Black', sans-serif", chewy: "'Chewy', 'Comic Sans MS', cursive", fredoka: "'Fredoka', 'Trebuchet MS', sans-serif", baloo: "'Baloo 2', 'Trebuchet MS', sans-serif",
    pacifico: "'Pacifico', 'Brush Script MT', cursive", dancing: "'Dancing Script', 'Brush Script MT', cursive", vibes: "'Great Vibes', 'Snell Roundhand', cursive", permanent: "'Permanent Marker', 'Comic Sans MS', cursive", rocksalt: "'Rock Salt', 'Comic Sans MS', cursive", homemade: "'Homemade Apple', 'Bradley Hand', cursive",
    orbitron: "'Orbitron', 'Avenir Next', sans-serif", audiowide: "'Audiowide', 'Trebuchet MS', sans-serif", pressstart: "'Press Start 2P', 'Courier New', monospace", silkscreen: "'Silkscreen', 'Courier New', monospace", sharetech: "'Share Tech Mono', 'Courier New', monospace", courier: "'Courier Prime', 'Courier New', monospace", typewriter: "'Special Elite', 'Courier New', monospace",
    bungee: "'Bungee', 'Arial Black', sans-serif", monoton: "'Monoton', 'Arial Black', sans-serif", righteous: "'Righteous', 'Trebuchet MS', sans-serif", rubikmono: "'Rubik Mono One', 'Arial Black', sans-serif", blackops: "'Black Ops One', 'Arial Black', sans-serif", limelight: "'Limelight', Georgia, serif", poiret: "'Poiret One', 'Avenir Next', sans-serif",
    creepster: "'Creepster', 'Chalkduster', cursive", nosifer: "'Nosifer', 'Chalkduster', cursive", eater: "'Eater', 'Chalkduster', cursive", pirata: "'Pirata One', 'Times New Roman', serif", fraktur: "'UnifrakturMaguntia', 'Times New Roman', serif", medieval: "'MedievalSharp', 'Times New Roman', serif", rye: "'Rye', Georgia, serif", smokum: "'Smokum', Georgia, serif",
  };
  var FONT_META = {
    display: { name: "Garamond", core: 1, cat: "classic", vibe: ["elegant", "classic", "paper"] },
    body: { name: "Inter", core: 1, cat: "bold", vibe: ["clean", "modern"] },
    logo: { name: "Bowlby One", core: 1, cat: "fun", vibe: ["fun", "round", "bold", "party"] },
    marker: { name: "Caveat", core: 1, cat: "script", vibe: ["hand", "script"] },
    mono: { name: "VT323", core: 1, cat: "tech", vibe: ["pixel", "game", "terminal", "retro"] },
    playfair: { name: "Playfair", gf: "Playfair+Display:ital,wght@0,400;0,700;1,400", cat: "classic", vibe: ["elegant", "luxury", "classic", "romantic"] },
    cormorant: { name: "Cormorant", gf: "Cormorant+Garamond:ital,wght@0,400;0,600;1,400", cat: "classic", vibe: ["elegant", "romantic", "classic"] },
    cinzel: { name: "Cinzel", gf: "Cinzel:wght@400;700", cat: "classic", vibe: ["epic", "classic", "luxury", "fantasy"] },
    abril: { name: "Abril Fatface", gf: "Abril+Fatface", cat: "classic", vibe: ["poster", "retro", "elegant", "bold"] },
    bebas: { name: "Bebas Neue", gf: "Bebas+Neue", cat: "bold", vibe: ["bold", "poster", "sport", "modern"] },
    anton: { name: "Anton", gf: "Anton", cat: "bold", vibe: ["bold", "poster", "sport"] },
    archivo: { name: "Archivo Black", gf: "Archivo+Black", cat: "bold", vibe: ["bold", "modern", "street"] },
    oswald: { name: "Oswald", gf: "Oswald:wght@400;700", cat: "bold", vibe: ["bold", "modern", "poster"] },
    bangers: { name: "Bangers", gf: "Bangers", cat: "fun", vibe: ["comic", "party", "fun", "poster"] },
    luckiest: { name: "Luckiest Guy", gf: "Luckiest+Guy", cat: "fun", vibe: ["comic", "kids", "fun", "party"] },
    titan: { name: "Titan One", gf: "Titan+One", cat: "fun", vibe: ["round", "kids", "fun", "bold"] },
    chewy: { name: "Chewy", gf: "Chewy", cat: "fun", vibe: ["round", "cute", "kids", "fun"] },
    fredoka: { name: "Fredoka", gf: "Fredoka:wght@400;600", cat: "fun", vibe: ["round", "cute", "clean", "fun"] },
    baloo: { name: "Baloo", gf: "Baloo+2:wght@400;700", cat: "fun", vibe: ["round", "cute", "kids"] },
    pacifico: { name: "Pacifico", gf: "Pacifico", cat: "script", vibe: ["script", "retro", "summer", "fun"] },
    dancing: { name: "Dancing Script", gf: "Dancing+Script:wght@400;700", cat: "script", vibe: ["script", "romantic", "elegant"] },
    vibes: { name: "Great Vibes", gf: "Great+Vibes", cat: "script", vibe: ["script", "romantic", "elegant", "luxury"] },
    permanent: { name: "Permanent Marker", gf: "Permanent+Marker", cat: "script", vibe: ["marker", "street", "hand", "grunge"] },
    rocksalt: { name: "Rock Salt", gf: "Rock+Salt", cat: "script", vibe: ["hand", "grunge", "street"] },
    homemade: { name: "Homemade Apple", gf: "Homemade+Apple", cat: "script", vibe: ["hand", "script", "paper", "romantic"] },
    orbitron: { name: "Orbitron", gf: "Orbitron:wght@400;700", cat: "tech", vibe: ["scifi", "tech", "neon", "modern"] },
    audiowide: { name: "Audiowide", gf: "Audiowide", cat: "tech", vibe: ["scifi", "tech", "sport", "neon"] },
    pressstart: { name: "Press Start 2P", gf: "Press+Start+2P", cat: "tech", vibe: ["pixel", "game", "retro"] },
    silkscreen: { name: "Silkscreen", gf: "Silkscreen:wght@400;700", cat: "tech", vibe: ["pixel", "game", "tech"] },
    sharetech: { name: "Share Tech Mono", gf: "Share+Tech+Mono", cat: "tech", vibe: ["terminal", "tech", "scifi"] },
    courier: { name: "Courier Prime", gf: "Courier+Prime:ital,wght@0,400;0,700;1,400", cat: "tech", vibe: ["paper", "terminal", "vintage"] },
    typewriter: { name: "Special Elite", gf: "Special+Elite", cat: "tech", vibe: ["paper", "vintage", "grunge"] },
    bungee: { name: "Bungee", gf: "Bungee", cat: "loud", vibe: ["street", "urban", "bold", "party", "fun"] },
    monoton: { name: "Monoton", gf: "Monoton", cat: "loud", vibe: ["neon", "retro", "deco", "party"] },
    righteous: { name: "Righteous", gf: "Righteous", cat: "loud", vibe: ["retro", "modern", "clean"] },
    rubikmono: { name: "Rubik Mono One", gf: "Rubik+Mono+One", cat: "loud", vibe: ["bold", "tech", "street"] },
    blackops: { name: "Black Ops One", gf: "Black+Ops+One", cat: "loud", vibe: ["military", "stencil", "bold"] },
    limelight: { name: "Limelight", gf: "Limelight", cat: "loud", vibe: ["deco", "retro", "elegant"] },
    poiret: { name: "Poiret One", gf: "Poiret+One", cat: "loud", vibe: ["deco", "elegant", "clean"] },
    creepster: { name: "Creepster", gf: "Creepster", cat: "dark", vibe: ["horror", "spooky", "party"] },
    nosifer: { name: "Nosifer", gf: "Nosifer", cat: "dark", vibe: ["horror", "dark"] },
    eater: { name: "Eater", gf: "Eater", cat: "dark", vibe: ["horror", "dark", "grunge"] },
    pirata: { name: "Pirata One", gf: "Pirata+One", cat: "dark", vibe: ["blackletter", "fantasy", "dark"] },
    fraktur: { name: "Unifraktur", gf: "UnifrakturMaguntia", cat: "dark", vibe: ["blackletter", "dark", "classic", "fantasy"] },
    medieval: { name: "MedievalSharp", gf: "MedievalSharp", cat: "dark", vibe: ["fantasy", "blackletter", "vintage"] },
    rye: { name: "Rye", gf: "Rye", cat: "dark", vibe: ["western", "vintage", "poster"] },
    smokum: { name: "Smokum", gf: "Smokum", cat: "dark", vibe: ["western", "vintage"] },
  };
  var ALIGN = { left: 1, center: 1, right: 1 };
  var EFFECTS = { none: 1, shadow: 1, lift: 1, neon: 1, highlight: 1 };   // wave 2: one-click text effects
  var FILLKINDS = { solid: 1, linear: 1, radial: 1 };   // shape gradient fill (incl. fade to transparent)
  var SHAPES = { rect: 1, ellipse: 1, line: 1, triangle: 1, star: 1, diamond: 1, heart: 1 };   // `shape` element sub-kinds
  var FRAMES = { rect: 1, rounded: 1, circle: 1, heart: 1, star: 1, triangle: 1 };             // `frame` photo-clip shapes
  var ELTYPES = { text: 1, stamp: 1, note: 1, graffiti: 1, label: 1, barcode: 1, seal: 1, postmark: 1, sticker: 1, art: 1, decal: 1, fade: 1, shape: 1, frame: 1 };
  // curated flat-SVG decal/sticker library (defined in box-stickers.js, loaded before this file)
  var STICKERS = (typeof window !== "undefined" && window.GIIIFTBoxStickers) || {};
  // full-face panel/wrap library (defined in box-panels.js, loaded before this file)
  var PANELS = (typeof window !== "undefined" && window.GIIIFTBoxPanels) || {};
  var MAX_LAYERS = 16;     // per face
  var MAX_TEXT = 160;
  // art sources: https URLs, ipfs, or our own generative svg data-uri
  var ART_OK = /^(https:\/\/[^\s"'<>]+|ipfs:\/\/[^\s"'<>]+)$/i;
  var ART_DATA = /^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i;   // embedded raster (panel authoring / offline art), size-capped below
  var ART_DATA_MAX = 160000;                                              // ~117 KB of image per art layer
  // per-position shading so a single palette still reads as a lit 3D box
  var SHADE = { front: 0, right: 0.05, top: 0.12, left: -0.12, back: -0.12, bottom: -0.08 };

  /* ----------------------------- validators ----------------------------- */
  function isHex(v) { return typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v); }
  function hex(v, fb) { return isHex(v) ? v : fb; }
  function num(v, fb, lo, hi) { v = Number(v); if (!isFinite(v)) return fb; if (lo != null) v = Math.max(lo, v); if (hi != null) v = Math.min(hi, v); return v; }
  function enumv(map, v, fb) { return (typeof v === "string" && map[v]) ? v : fb; }
  function str(v, max) { return String(v == null ? "" : v).slice(0, max || MAX_TEXT); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function rgba0(h) { var n = parseInt(String(h).slice(1, 7), 16); return isFinite(n) ? "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + ",0)" : "transparent"; }
  // CSS background for a shape: solid colour, or a linear/radial gradient (fillFade ends at the same colour at 0 alpha = clean fade to transparent, no grey midpoint)
  function shapeBg(e, solid) {
    if (e.fill === "none" || !(e.fillKind === "linear" || e.fillKind === "radial")) return solid;
    var end = e.fillFade ? rgba0(e.fill) : (e.fill2 || e.fill);
    return e.fillKind === "radial" ? "radial-gradient(circle at 50% 50%," + e.fill + "," + end + ")" : "linear-gradient(" + (e.fillAngle != null ? e.fillAngle : 135) + "deg," + e.fill + "," + end + ")";
  }

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
        base.lineHeight = num(e.lineHeight, e.t === "graffiti" ? 1 : 1.05, 0.7, 2.5);   // vertical spacing between wrapped/entered lines
        base.letterSpacing = num(e.letterSpacing, 0, -0.2, 1);                          // tracking, in em
        base.style = (e.style === "sticker") ? "sticker" : "plain";   // "sticker" = comic double-outline (fill + inner + outer edge)
        base.outline1 = hex(e.outline1, "#ffffff");                   // inner outline (the bright halo around the fill)
        base.outline2 = hex(e.outline2, "#111111");                   // outer edge (the dark border around the halo)
        base.effect = enumv(EFFECTS, e.effect, "none");               // wave 2: one-click text effect (shadow / lift / neon / highlight)
        base.effectColor = hex(e.effectColor, "#ffe066");             // neon glow / highlight-background colour
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
        base.src = (typeof e.src === "string" && ART_OK.test(e.src)) ? e.src
          : (typeof e.src === "string" && ART_DATA.test(e.src) && e.src.length <= ART_DATA_MAX) ? e.src
          : (typeof e.src === "string" && /^data:image\/svg\+xml/i.test(e.src) ? e.src.slice(0, 4000) : "");
        base.fit = e.fit === "contain" ? "contain" : "cover";
        base.w = num(e.w, 0.6, 0.1, 1); base.h = num(e.h, 0.6, 0.1, 1); base.radius = num(e.radius, 0.03, 0, 0.5); base.zoom = num(e.zoom, 1, 1, 4);
        if (e.noShadow) base.noShadow = true;                  // transparent cutouts opt out of the .gbx-art drop shadow
        base.opacity = num(e.opacity, 1, 0, 1);
        if (e.flipX) base.flipX = true; if (e.flipY) base.flipY = true;
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
      case "fade":                                       // gradient scrim layer: colour -> transparent, stackable between layers
        base.color = hex(e.color, "#000000");
        base.kind = e.kind === "radial" ? "radial" : "linear";
        base.angle = num(e.angle, 0, 0, 360);
        base.opacity = num(e.opacity, 1, 0, 1);
        base.w = num(e.w, 1, 0.05, 1); base.h = num(e.h, 0.6, 0.05, 1);
        break;
      case "shape":                                      // vector shape: colour block / badge / divider / star, etc.
        base.shape = enumv(SHAPES, e.shape, "rect");
        base.fill = e.fill === "none" ? "none" : hex(e.fill, palette.accent);
        base.fillKind = enumv(FILLKINDS, e.fillKind, "solid");      // solid / linear / radial
        base.fill2 = hex(e.fill2, base.fill === "none" ? palette.c2 : base.fill);   // second gradient stop
        base.fillAngle = num(e.fillAngle, 135, 0, 360);
        if (e.fillFade) base.fillFade = true;                       // gradient ends transparent (pro-panel fade)
        base.stroke = (e.stroke == null || e.stroke === "none") ? "none" : hex(e.stroke, "#111111");
        base.strokeW = num(e.strokeW, 0, 0, 0.06);       // border, as a fraction of box size (0 = none)
        base.radius = num(e.radius, 0.12, 0, 0.5);       // corner radius (rect), fraction of the shorter side
        base.w = num(e.w, 0.5, 0.02, 1); base.h = num(e.h, 0.2, 0.02, 1);
        base.opacity = num(e.opacity, 1, 0, 1);
        if (e.flipX) base.flipX = true; if (e.flipY) base.flipY = true;
        break;
      case "frame":                                      // a photo clipped into a shape (circle / heart / star / rounded ...)
        base.frame = enumv(FRAMES, e.frame, "circle");
        base.src = (typeof e.src === "string" && ART_OK.test(e.src)) ? e.src
          : (typeof e.src === "string" && ART_DATA.test(e.src) && e.src.length <= ART_DATA_MAX) ? e.src : "";
        base.stroke = (e.stroke == null || e.stroke === "none") ? "none" : hex(e.stroke, "#ffffff");
        base.strokeW = num(e.strokeW, 0, 0, 0.06);
        base.radius = num(e.radius, 0.16, 0, 0.5);       // corner radius for the `rounded` frame
        base.w = num(e.w, 0.42, 0.05, 1); base.h = num(e.h, 0.42, 0.05, 1);
        base.opacity = num(e.opacity, 1, 0, 1);
        break;
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
    if (out.panel && face.panelScale && typeof face.panelScale === "object") {
      var pdef2 = PANELS[out.panel], ps = {};
      if (pdef2 && pdef2.fields) pdef2.fields.forEach(function (f) {
        var s = Number(face.panelScale[f.key]);
        if (isFinite(s) && Math.abs(s - 1) > 0.01) ps[f.key] = Math.max(0.4, Math.min(2.5, Math.round(s * 100) / 100));
      });
      if (Object.keys(ps).length) out.panelScale = ps;
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
    // the note rides the pinned card beside the box, never the box face — the
    // marker layer used to collide with the model/qty line (owner call 2026-06-10)
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
    ".gbx-tape{position:absolute;left:0;width:100%;top:39%;height:22%;transform:translateZ(2px);transform-style:preserve-3d;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,0.12) 0 5px,transparent 5px 11px),linear-gradient(180deg,var(--gbx-tape,#d6b88c),color-mix(in srgb,var(--gbx-tape,#d6b88c) 70%,transparent));border-top:1px solid rgba(255,255,255,0.3);border-bottom:1px solid rgba(0,0,0,0.24);transition:opacity .4s}",
    /* tape wraps over the lid edges like real packing tape: 10% tabs folded down the sides */
    ".gbx-tape::before,.gbx-tape::after{content:'';position:absolute;top:-1px;bottom:-1px;width:10%;background:inherit;border-top:1px solid rgba(255,255,255,0.3);border-bottom:1px solid rgba(0,0,0,0.24);box-shadow:inset 0 0 0 999px rgba(0,0,0,0.22)}",
    ".gbx-tape::before{left:0;transform-origin:left center;transform:rotateY(90deg) translateZ(-1.5px)}",   /* nudge off the face plane: coplanar tabs z-fight with the side faces */
    ".gbx-tape::after{right:0;transform-origin:right center;transform:rotateY(-90deg) translateZ(-1.5px)}",
    ".gbx-box.gbx-opened .gbx-tape{opacity:0}",
    /* layered content elements */
    ".gbx-layer{position:absolute;transform:translate(-50%,-50%) rotate(var(--rot,0deg)) scale(var(--gbx-zoom,1)) scale(var(--gbx-fx,1),var(--gbx-fy,1));transform-origin:center;z-index:3}",
    ".gbx-text{line-height:1.05;overflow-wrap:break-word;white-space:pre-wrap;text-shadow:0 1px 2px rgba(0,0,0,0.25)}",
    ".gbx-graffiti{line-height:1;overflow-wrap:break-word;white-space:pre-wrap;text-shadow:0 1px 3px rgba(0,0,0,0.3)}",
    // comic "sticker" text: fill (color) + inner halo (--ol-c1) via the element's own stroke,
    // + outer edge (--ol-c2) via a thicker stroke on the ::before copy sitting behind it.
    // paint-order keeps the fill crisp; strokes scale with font-size (em). drop-shadow lifts it off the box.
    ".gbx-text.gbx-ol,.gbx-graffiti.gbx-ol{position:relative;text-shadow:none;color:var(--gbx-ol-fill,inherit);-webkit-text-stroke:var(--ol-w1,0.11em) var(--ol-c1,#fff);paint-order:stroke fill;filter:drop-shadow(0 3px 2px rgba(0,0,0,0.4))}",
    ".gbx-ol::before{content:attr(data-text);position:absolute;left:0;top:0;width:100%;z-index:-1;color:transparent;-webkit-text-stroke:var(--ol-w2,0.24em) var(--ol-c2,#111);paint-order:stroke fill;text-align:inherit;white-space:pre-wrap;line-height:inherit;letter-spacing:inherit;pointer-events:none}",
    /* wave 2: one-click text effects — additive, default none; neon/highlight read --fx-c (set per-element in renderElement) */
    ".gbx-fx-shadow{text-shadow:0.045em 0.07em 0 rgba(0,0,0,0.55)}",
    ".gbx-fx-lift{text-shadow:0 0.085em 0.16em rgba(0,0,0,0.55)}",
    ".gbx-fx-neon{text-shadow:0 0 0.08em var(--fx-c,#34f5c5),0 0 0.22em var(--fx-c,#34f5c5),0 0 0.5em var(--fx-c,#34f5c5)}",
    ".gbx-fx-highlight{text-shadow:none}",
    ".gbx-fx-highlight .gbx-hl{background:var(--fx-c,#ffe066);padding:0.02em 0.2em;border-radius:0.1em;-webkit-box-decoration-break:clone;box-decoration-break:clone}",
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
    ".gbx-fade{display:block}",
    ".gbx-decal{display:grid;place-items:center;filter:drop-shadow(0 5px 12px rgba(0,0,0,0.45))}",
    ".gbx-shape{display:block}",
    ".gbx-frame{display:block;overflow:hidden;background-position:center;background-repeat:no-repeat}",
    ".gbx-decal svg{width:100%;height:100%;display:block;overflow:visible}",
    ".gbx-panel{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}",
    ".gbx-panel svg{width:100%;height:100%;display:block}",
    /* the top face is a real face riding just above the lid plane; it fades on open so the flaps + cavity show */
    ".gbx-top{transform:rotateX(90deg) translateZ(calc(var(--gbx-size)/2 + 1.2px));transition:opacity .4s}",
    ".gbx-tape{z-index:3}",
    ".gbx-box.gbx-opened .gbx-top{opacity:0;pointer-events:none}",
    /* flat (unfolded) layout — render(opts.flat): the six faces lay out as a cross net for
     * all-at-once editing. Lid/fx hidden; !important beats the host's inline box transform. */
    ".gbx-box.gbx-flat{transform:none!important}",
    ".gbx-flat .gbx-lid,.gbx-flat .gbx-cavity,.gbx-flat .gbx-glow,.gbx-flat .gbx-pop,.gbx-flat .gbx-beam,.gbx-flat .gbx-particles{display:none}",
    ".gbx-flat .gbx-face{transform-origin:0 0;transition:transform .45s cubic-bezier(.5,.02,.2,1)}",
    ".gbx-flat .gbx-top{transform:translate(calc(var(--gbx-size)*0.11),calc(var(--gbx-size)*-0.09)) scale(0.38)}",
    ".gbx-flat .gbx-left{transform:translate(calc(var(--gbx-size)*-0.29),calc(var(--gbx-size)*0.31)) scale(0.38)}",
    ".gbx-flat .gbx-front{transform:translate(calc(var(--gbx-size)*0.11),calc(var(--gbx-size)*0.31)) scale(0.38)}",
    ".gbx-flat .gbx-right{transform:translate(calc(var(--gbx-size)*0.51),calc(var(--gbx-size)*0.31)) scale(0.38)}",
    ".gbx-flat .gbx-back{transform:translate(calc(var(--gbx-size)*0.91),calc(var(--gbx-size)*0.31)) scale(0.38)}",
    ".gbx-flat .gbx-bottom{transform:translate(calc(var(--gbx-size)*0.11),calc(var(--gbx-size)*0.71)) scale(0.38)}",
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
    /* gentle opt-in panel motion — animates SVG sub-elements only (never the 3D face/box, so no flatten) */
    "@keyframes gbx-a-spin{to{transform:rotate(360deg)}}",
    "@keyframes gbx-a-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}",
    "@keyframes gbx-a-pulse{0%,100%{opacity:1}50%{opacity:.6}}",
    "@keyframes gbx-a-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.4px)}}",
    ".gbx-a-spin,.gbx-a-breathe,.gbx-a-bob{transform-box:fill-box;transform-origin:center;will-change:transform}",
    ".gbx-a-spin{animation:gbx-a-spin 52s linear infinite}",
    ".gbx-a-breathe{animation:gbx-a-breathe 7s ease-in-out infinite}",
    ".gbx-a-pulse{animation:gbx-a-pulse 3s ease-in-out infinite}",
    ".gbx-a-bob{animation:gbx-a-bob 5.5s ease-in-out infinite}",
    "@media(prefers-reduced-motion:reduce){.gbx-box,.gbx-flap,.gbx-tape{transition:none}.gbx-a-spin,.gbx-a-breathe,.gbx-a-pulse,.gbx-a-bob{animation:none}}"
  ].join("");

  function injectCss() {
    if (document.getElementById("gbx-css")) return;
    var st = document.createElement("style"); st.id = "gbx-css"; st.textContent = CSS;
    document.head.appendChild(st);
    // Panel-only display fonts (manga family). Loaded once, non-blocking; JP falls back to system Hiragino/Yu Gothic.
    if (!document.getElementById("gbx-panel-fonts")) {
      var lk = document.createElement("link"); lk.id = "gbx-panel-fonts"; lk.rel = "stylesheet";
      lk.href = "https://fonts.googleapis.com/css2?family=Bangers&family=Oswald:wght@400;700&family=Space+Mono:wght@400;700&display=swap";
      document.head.appendChild(lk);
    }
  }

  /* --------------------------- lazy webfonts ---------------------------- */
  var fontsRequested = {};   // font keys already linked on this page
  function ensureFonts(keys) {
    // One stylesheet link per batch of not-yet-requested extended fonts. Core fonts
    // (the original five) ship with every page's own <link>, so they are skipped.
    if (typeof document === "undefined") return;
    var fams = [];
    (keys || []).forEach(function (k) {
      var m = FONT_META[k];
      if (m && m.gf && !m.core && !fontsRequested[k]) { fontsRequested[k] = 1; fams.push(m.gf); }
    });
    if (!fams.length) return;
    var lk = document.createElement("link"); lk.rel = "stylesheet";
    lk.href = "https://fonts.googleapis.com/css2?family=" + fams.join("&family=") + "&display=swap";
    document.head.appendChild(lk);
  }
  function docFonts(doc) {
    // every font key a doc actually uses: layer fonts + fonts declared by custom panels
    var seen = {}, out = [];
    var add = function (k) { if (k && FONTS[k] && !seen[k]) { seen[k] = 1; out.push(k); } };
    FACES.forEach(function (fk) {
      var f = doc && doc.faces && doc.faces[fk]; if (!f) return;
      (f.layers || []).forEach(function (L) { add(L.font); });
      var p = f.panel && PANELS[f.panel];
      if (p && p.fonts) p.fonts.forEach(add);
    });
    return out;
  }

  /* --------------------------- element render --------------------------- */
  function px(frac) { return "calc(var(--gbx-size) * " + frac + ")"; }
  function placeLayer(node, e) {
    node.classList.add("gbx-layer");
    node.style.left = (e.x * 100) + "%";
    node.style.top = (e.y * 100) + "%";
    if (e.w != null && e.t !== "sticker" && e.t !== "seal" && e.t !== "postmark" && e.t !== "decal" && e.t !== "fade") node.style.width = (e.w * 100) + "%";
    node.style.setProperty("--rot", (e.rotate || 0) + "deg");
  }
  var CLIP_ID = 1;
  function shapeSvgPath(shape, attrs) {   // inner SVG for polygon/path shapes in a 0..100 viewBox
    switch (shape) {
      case "triangle": return '<polygon points="50,6 95,94 5,94"' + attrs + '/>';
      case "diamond":  return '<polygon points="50,4 96,50 50,96 4,50"' + attrs + '/>';
      case "star":     return '<polygon points="50,3 61.8,37.6 98.2,37.6 68.8,59.2 80.4,94 50,72.4 19.6,94 31.2,59.2 1.8,37.6 38.2,37.6"' + attrs + '/>';
      case "heart":    return '<path d="M50,90 C16,64 6,42 18,27 C28,15 45,16 50,30 C55,16 72,15 82,27 C94,42 84,64 50,90 Z"' + attrs + '/>';
      default:         return '<rect x="1" y="1" width="98" height="98"' + attrs + '/>';
    }
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
        if (e.lineHeight != null) n.style.lineHeight = e.lineHeight;
        if (e.letterSpacing) n.style.letterSpacing = e.letterSpacing + "em";
        if (e.italic) n.style.fontStyle = "italic";
        if (e.style === "sticker") {                          // comic double-outline: fill + inner halo + outer edge
          n.classList.add("gbx-ol");
          n.setAttribute("data-text", e.value);               // the ::before edge copy reads this
          n.style.setProperty("--ol-c1", e.outline1 || "#ffffff");
          n.style.setProperty("--ol-c2", e.outline2 || "#111111");
        }
        if (e.effect && e.effect !== "none") {                // wave 2: one-click text effect
          n.classList.add("gbx-fx-" + e.effect);
          if (e.effect === "neon" || e.effect === "highlight") n.style.setProperty("--fx-c", e.effectColor || "#ffe066");
          if (e.effect === "highlight") {                     // the marker hugs the text (per wrapped line) via an inline span
            n.textContent = ""; var hl = document.createElement("span"); hl.className = "gbx-hl"; hl.textContent = e.value; n.appendChild(hl);
          }
        }
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
          n.style.setProperty("--gbx-art-r", e.radius); n.style.setProperty("--gbx-zoom", e.zoom || 1);
          if (e.noShadow) n.style.boxShadow = "none";          // cutout art (alpha subjects): the rectangular drop shadow gives the box away
          if (e.opacity != null && e.opacity < 1) n.style.opacity = e.opacity;
          if (e.flipX) n.style.setProperty("--gbx-fx", -1);
          if (e.flipY) n.style.setProperty("--gbx-fy", -1);
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
      case "fade":
        n = document.createElement("div"); n.className = "gbx-fade";
        n.style.width = px(e.w); n.style.height = px(e.h);
        var fr = parseInt(String(e.color || "#000000").slice(1), 16);
        var fparts = ((fr >> 16) & 255) + "," + ((fr >> 8) & 255) + "," + (fr & 255);
        var fo = e.opacity != null ? e.opacity : 1;
        var fOn = "rgba(" + fparts + "," + fo + ")", fOff = "rgba(" + fparts + ",0)";   // fade to the SAME colour at 0 alpha (keyword transparent greys mid-ramp)
        n.style.background = (e.kind === "radial")
          ? "radial-gradient(circle at center, " + fOff + " 0%, " + fOn + " 100%)"
          : "linear-gradient(" + (e.angle != null ? e.angle : 0) + "deg, " + fOn + ", " + fOff + ")";
        break;
      case "shape": {
        n = document.createElement("div"); n.className = "gbx-shape";
        n.style.width = px(e.w); n.style.height = px(e.h);
        var sfill = e.fill === "none" ? "transparent" : e.fill;
        var sStroke = e.stroke && e.stroke !== "none" && e.strokeW > 0;
        if (e.shape === "rect" || e.shape === "ellipse" || e.shape === "line") {   // CSS path: perfect uniform border
          n.style.background = shapeBg(e, sfill); n.style.boxSizing = "border-box";
          n.style.borderRadius = e.shape === "ellipse" ? "50%" : e.shape === "line" ? px(e.h * 0.5) : px(Math.min(e.w, e.h) * e.radius);
          if (sStroke) n.style.border = "calc(var(--gbx-size) * " + e.strokeW + ") solid " + e.stroke;
        } else {                                                                     // SVG path: triangle / star / diamond / heart
          var sa = ' fill="' + sfill + '"' + (sStroke ? ' stroke="' + e.stroke + '" stroke-width="' + (e.strokeW * 100).toFixed(2) + '" stroke-linejoin="round"' : '');
          n.innerHTML = '<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">' + shapeSvgPath(e.shape, sa) + '</svg>';
        }
        if (e.opacity != null && e.opacity < 1) n.style.opacity = e.opacity;
        if (e.flipX) n.style.setProperty("--gbx-fx", -1);
        if (e.flipY) n.style.setProperty("--gbx-fy", -1);
        break;
      }
      case "frame": {
        n = document.createElement("div"); n.className = "gbx-frame";
        n.style.width = px(e.w); n.style.height = px(e.h);
        var fStroke = e.stroke && e.stroke !== "none" && e.strokeW > 0;
        if (e.frame === "rect" || e.frame === "rounded" || e.frame === "circle") {   // CSS path
          n.style.boxSizing = "border-box";
          n.style.borderRadius = e.frame === "circle" ? "50%" : e.frame === "rounded" ? px(Math.min(e.w, e.h) * Math.max(e.radius, 0.08)) : "0";
          if (e.src) { n.style.backgroundImage = 'url("' + e.src + '")'; n.style.backgroundSize = "cover"; n.style.backgroundPosition = "center"; n.style.backgroundRepeat = "no-repeat"; }
          else { n.style.background = "rgba(255,255,255,.06)"; n.style.display = "grid"; n.style.placeItems = "center"; n.style.color = palette.accent; n.style.fontSize = px(0.14); n.textContent = "🖼"; }
          if (fStroke) n.style.border = "calc(var(--gbx-size) * " + e.strokeW + ") solid " + e.stroke;
          else if (!e.src) n.style.border = "calc(var(--gbx-size) * 0.006) dashed " + palette.accent;
        } else {                                                                     // SVG clip path: heart / star / triangle
          var cid = "gbxcl" + (CLIP_ID++);
          var clip = shapeSvgPath(e.frame, ' fill="#fff"');
          var border = fStroke ? shapeSvgPath(e.frame, ' fill="none" stroke="' + e.stroke + '" stroke-width="' + (e.strokeW * 100).toFixed(2) + '" stroke-linejoin="round"') : "";
          var inner = e.src
            ? '<image href="' + esc(e.src) + '" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid slice" clip-path="url(#' + cid + ')"/>'
            : shapeSvgPath(e.frame, ' fill="rgba(255,255,255,.07)" stroke="' + palette.accent + '" stroke-width="2.2" stroke-dasharray="5 3"');
          n.innerHTML = '<svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none"><defs><clipPath id="' + cid + '">' + clip + '</clipPath></defs>' + inner + border + '</svg>';
        }
        if (e.opacity != null && e.opacity < 1) n.style.opacity = e.opacity;
        break;
      }
      default: return null;
    }
    placeLayer(n, e);
    return n;
  }

  /* ------------------------------ render -------------------------------- */
  // Per-field fit control: multiply the font-size of the <text> that contains a field's
  // token. Explicit font-size="N" is scaled in place; tags inheriting their size from an
  // ancestor <g> get font-size="<s>em" injected (em multiplies the inherited size).
  function scaleTokenText(svg, key, s) {
    var idx = svg.indexOf("{{" + key + "}}"); if (idx < 0) return svg;
    var open = svg.lastIndexOf("<text", idx); if (open < 0) return svg;
    var end = svg.indexOf(">", open); if (end < 0 || end > idx) return svg;
    var tag = svg.slice(open, end), out;
    if (/font-size="[0-9.]+"/.test(tag)) out = tag.replace(/font-size="([0-9.]+)"/, function (m, n) { return 'font-size="' + Math.round(parseFloat(n) * s * 1000) / 1000 + '"'; });
    else out = tag + ' font-size="' + s + 'em"';
    return svg.slice(0, open) + out + svg.slice(end);
  }
  // Resolve a panel's SVG, substituting {{key}} tokens with editable text.
  // Each field keeps its own <text> styling — only the string content changes.
  // scales: optional { key: factor } from face.panelScale (user fit adjustments).
  function panelSVG(idOrPanel, overrides, scales) {
    var p = (typeof idOrPanel === "string") ? PANELS[idOrPanel] : idOrPanel;
    if (!p) return "";
    var svg = p.svg;
    if (p.fields) for (var i = 0; i < p.fields.length; i++) {
      var f = p.fields[i];
      var s = scales && Number(scales[f.key]);
      if (isFinite(s) && s > 0 && Math.abs(s - 1) > 0.01) svg = scaleTokenText(svg, f.key, s);
      var v = (overrides && typeof overrides[f.key] === "string") ? overrides[f.key] : f.value;
      svg = svg.split("{{" + f.key + "}}").join(esc(v));
    }
    return svg;
  }
  // dark neutral used behind full coverage (a panel OR a cover-fit art layer), so the bright
  // palette can't bleed at the rounded 3D seams/edges as a coloured rim
  var NEUTRAL_BASE = { c1: "#202227", c2: "#141619", angle: 135, finish: "gradient" };
  // a face reads as "fully covered" when a full-bleed panel sits on it, or when an opaque
  // cover-fit art layer spans (≈) the whole face — both want the neutral base, not the palette.
  function faceCovered(face) {
    if (face.panel && PANELS[face.panel]) return true;
    return (face.layers || []).some(function (e) {
      if (e.t === "art" && e.src && e.fit === "cover" && !e.noShadow
        && (e.opacity == null || e.opacity >= 1)
        && (e.w == null || e.w >= 0.98) && (e.h == null || e.h >= 0.98)) return true;
      if (e.t === "shape" && e.shape === "rect" && e.fill && e.fill !== "none" && !(e.strokeW > 0) && (!e.fillKind || e.fillKind === "solid")
        && (e.opacity == null || e.opacity >= 1) && e.w >= 0.98 && e.h >= 0.98) return true;
      if (e.t === "frame" && e.frame === "rect" && e.src
        && (e.opacity == null || e.opacity >= 1) && e.w >= 0.98 && e.h >= 0.98) return true;
      return false;
    });
  }
  function buildFace(pos, face, palette, cls) {
    var el = document.createElement("div");
    el.className = "gbx-face gbx-" + cls;
    el.dataset.pos = pos;
    var fill = faceCovered(face) ? NEUTRAL_BASE : (face.fill || palette);
    var bg = faceBackground(fill, pos);
    el.style.background = bg.bg;
    el.style.setProperty("--gbx-bg-size", bg.size);
    if (face.pattern && face.pattern !== "none") {
      var p = document.createElement("div"); p.className = "gbx-pattern gbx-pat-" + face.pattern; el.appendChild(p);
    }
    if (face.panel && PANELS[face.panel]) {
      var pn = document.createElement("div"); pn.className = "gbx-panel"; pn.innerHTML = panelSVG(face.panel, face.panelText, face.panelScale); el.appendChild(pn);
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
    ensureFonts(docFonts(doc));
    container.innerHTML = "";

    var scene = document.createElement("div"); scene.className = "gbx-scene";
    var box = document.createElement("div"); box.className = "gbx-box" + (opts.flat ? " gbx-flat" : "");
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
    var topFill = faceCovered(doc.faces.top) ? NEUTRAL_BASE : (doc.faces.top.fill || doc.palette);
    var topBg = faceBackground(topFill, "top");
    ["fl-left", "fl-right", "fl-back", "fl-front"].forEach(function (f) {
      var fl = document.createElement("div"); fl.className = "gbx-flap gbx-" + f;
      fl.style.background = topBg.bg; fl.style.setProperty("--gbx-bg-size", topBg.size);
      if (doc.faces.top.pattern && doc.faces.top.pattern !== "none") { var p = document.createElement("div"); p.className = "gbx-pattern gbx-pat-" + doc.faces.top.pattern; fl.appendChild(p); }
      lid.appendChild(fl);
    });
    var tape = document.createElement("div"); tape.className = "gbx-tape"; lid.appendChild(tape);
    box.appendChild(lid);

    // the top face is a first-class face (pattern, panel AND layers), riding just above the
    // closed flaps; it fades out on open (see .gbx-top CSS) so the flaps + cavity take over
    box.appendChild(buildFace("top", doc.faces.top, doc.palette, "top"));

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
    FACES: FACES, PATTERNS: PATTERNS, SHAPES: SHAPES, FINISHES: FINISHES, FONTS: FONTS, FONT_META: FONT_META, STICKERS: STICKERS, PANELS: PANELS,
    normalize: normalize, fromLegacy: fromLegacy, render: render,
    ensureFonts: ensureFonts, docFonts: docFonts,
    faceBackground: faceBackground, shadeHex: shadeHex, panelSVG: panelSVG,
  };
  global.GIIIFTBox = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : this);
