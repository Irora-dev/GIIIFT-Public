/* GIIIFT — asset visuals: the THING an asset is, not a disc.
 *
 * One shared builder for every place an asset enters or leaves a box:
 *   kind "card"  → a sleek digital-asset card (glass, glyph, ticker, amount)
 *   kind "frame" → a framed piece of art (gilded bevel, mat, plaque) for NFTs
 *   kind "pack"  → a foil booster pack (crimped ends, burst seal) for TCG picks
 *
 * Kind resolution: ticker NFT inside a tcg-family vertical → pack; NFT
 * elsewhere → frame; every fungible ticker → card. Pages can force a kind
 * via opts.kind. The builder is dependency-free (reads GIIIFTVertical lazily)
 * and returns a self-contained node; size comes from the CSS var --av-h on
 * the node or any ancestor (height; width follows each kind's ratio).
 *
 * Used by box.html (the open-reveal rise) and wrap.html (the deposit drop).
 * Exported to the public mirror by tools/export-showcase.mjs (SCRIPTS list).
 */
(function () {
  "use strict";

  var CSS = [
    ".av { position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center;",
    "  height:var(--av-h,56px); border-radius:calc(var(--av-h,56px)*.12); overflow:hidden; box-sizing:border-box;",
    "  box-shadow:0 calc(var(--av-h,56px)*.16) calc(var(--av-h,56px)*.38) rgba(0,0,0,.55), 0 0 calc(var(--av-h,56px)*.34) calc(var(--av-h,56px)*-.1) var(--av-glow,var(--accent-ui,#7ef0c2)); }",
    /* one shared specular sweep, runs once when the node gains .av-shine */
    ".av::after { content:''; position:absolute; inset:0; background:linear-gradient(115deg, transparent 38%, rgba(255,255,255,.34) 50%, transparent 62%);",
    "  background-size:240% 100%; background-position:120% 0; pointer-events:none; }",
    ".av.av-shine::after { animation:av-sweep 1.1s ease-out .15s 1 both; }",
    "@keyframes av-sweep { from { background-position:120% 0; } to { background-position:-120% 0; } }",
    "@media (prefers-reduced-motion: reduce) { .av.av-shine::after { animation:none; } }",

    /* ---- digital asset card ---- */
    ".av-card { aspect-ratio:.74; background:linear-gradient(165deg,#1c2434 0%,#10151f 58%,#0a0e15 100%);",
    "  border:1px solid rgba(255,255,255,.16); gap:calc(var(--av-h,56px)*.05); padding:calc(var(--av-h,56px)*.07); }",
    ".av-card::before { content:''; position:absolute; inset:0 auto 0 0; width:calc(var(--av-h,56px)*.045); background:linear-gradient(180deg, var(--av-accent,#7ef0c2), transparent 85%); opacity:.9; }",
    ".av-card .av-glyph { width:calc(var(--av-h,56px)*.34); height:calc(var(--av-h,56px)*.34); border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center;",
    "  background:#f3f4f2; color:#111; font-weight:800; font-size:calc(var(--av-h,56px)*.16); box-shadow:inset 0 -2px 3px rgba(0,0,0,.2), inset 0 2px 3px rgba(255,255,255,.3); }",
    ".av-card .av-glyph img { width:100%; height:100%; object-fit:cover; display:block; }",
    ".av-card .av-glyph.no-logo { color:#fff; text-shadow:0 1px 1px rgba(0,0,0,.35); }",
    ".av-card .av-tk { font-family:var(--font-main,Inter,sans-serif); font-weight:800; font-size:calc(var(--av-h,56px)*.13); letter-spacing:.04em; color:#fff; line-height:1; }",
    ".av-card .av-amt { font-family:var(--font-mono,monospace); font-size:calc(var(--av-h,56px)*.115); color:var(--av-accent,#7ef0c2); line-height:1; max-width:92%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }",

    /* ---- framed art ---- */
    ".av-frame { aspect-ratio:.84; background:linear-gradient(135deg,#e3c27c 0%,#a47a35 38%,#daba74 52%,#7c5a24 100%);",
    "  padding:calc(var(--av-h,56px)*.075); border-radius:calc(var(--av-h,56px)*.04);",
    "  box-shadow:inset 0 1px 0 rgba(255,246,220,.65), inset 0 -1px 0 rgba(60,40,8,.55), 0 calc(var(--av-h,56px)*.16) calc(var(--av-h,56px)*.38) rgba(0,0,0,.55); }",
    ".av-frame .av-mat { position:relative; width:100%; height:100%; background:#f2edda; padding:calc(var(--av-h,56px)*.05); box-sizing:border-box; box-shadow:inset 0 0 calc(var(--av-h,56px)*.05) rgba(0,0,0,.28); }",
    ".av-frame .av-art { width:100%; height:100%; overflow:hidden; position:relative;",
    "  background:radial-gradient(90% 70% at 28% 24%, var(--av-accent,#9a6cff) 0%, transparent 62%), radial-gradient(80% 80% at 76% 72%, var(--av-c2,#22324d) 0%, transparent 70%), linear-gradient(160deg,#283042,#10141f); }",
    ".av-frame .av-art::after { content:''; position:absolute; inset:0; background:repeating-linear-gradient(105deg, rgba(255,255,255,.05) 0 2px, transparent 2px 5px); }",
    ".av-frame .av-art img { width:100%; height:100%; object-fit:cover; display:block; }",
    ".av-frame .av-plaque { position:absolute; left:50%; bottom:calc(var(--av-h,56px)*-.005); transform:translate(-50%,0);",
    "  font-family:var(--font-mono,monospace); font-size:calc(var(--av-h,56px)*.085); letter-spacing:.08em; color:#5a4517; background:linear-gradient(180deg,#efd9a0,#c9a45c);",
    "  padding:1px calc(var(--av-h,56px)*.07); border-radius:2px; box-shadow:0 1px 2px rgba(0,0,0,.4); white-space:nowrap; max-width:86%; overflow:hidden; text-overflow:ellipsis; }",

    /* ---- foil booster pack ---- */
    ".av-pack { aspect-ratio:.62; border-radius:calc(var(--av-h,56px)*.05);",
    "  background:linear-gradient(170deg, color-mix(in srgb, var(--av-accent,#ffd34d) 72%, #fff) 0%, var(--av-accent,#ffd34d) 26%, color-mix(in srgb, var(--av-accent,#ffd34d) 55%, #131722) 72%, color-mix(in srgb, var(--av-accent,#ffd34d) 30%, #05070c) 100%);",
    "  border:1px solid rgba(255,255,255,.22); }",
    ".av-pack .av-crimp { position:absolute; left:0; right:0; height:calc(var(--av-h,56px)*.085);",
    "  background:repeating-linear-gradient(90deg, rgba(255,255,255,.30) 0 2px, rgba(0,0,0,.18) 2px 4px); }",
    ".av-pack .av-crimp.top { top:0; border-bottom:1px solid rgba(0,0,0,.3); } .av-pack .av-crimp.bot { bottom:0; border-top:1px solid rgba(0,0,0,.3); }",
    ".av-pack .av-burst { width:calc(var(--av-h,56px)*.40); height:calc(var(--av-h,56px)*.40); border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center;",
    "  background:radial-gradient(circle at 32% 28%, #fff, #dfe6f2 58%, #aab4c8); color:#1a2030; font-weight:800; font-size:calc(var(--av-h,56px)*.17);",
    "  box-shadow:0 0 0 calc(var(--av-h,56px)*.026) rgba(255,255,255,.65), 0 2px 8px rgba(0,0,0,.4); }",
    ".av-pack .av-burst img { width:100%; height:100%; object-fit:cover; display:block; }",
    ".av-pack .av-lbl { position:absolute; bottom:calc(var(--av-h,56px)*.12); left:0; right:0; text-align:center;",
    "  font-family:var(--font-mono,monospace); font-size:calc(var(--av-h,56px)*.082); letter-spacing:.26em; color:rgba(255,255,255,.92); text-shadow:0 1px 2px rgba(0,0,0,.55); }",
  ].join("\n");

  function injectCss() {
    if (document.getElementById("av-css")) return;
    var st = document.createElement("style"); st.id = "av-css"; st.textContent = CSS;
    document.head.appendChild(st);
  }

  function esc(s) { var d = document.createElement("div"); d.textContent = String(s == null ? "" : s); return d.innerHTML; }
  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function kindOf(it) {
    var tk = String((it && it.ticker) || "").toUpperCase();
    if (tk === "NFT") {
      var V = window.GIIIFTVertical;
      return (V && V.is && V.is("tcg")) ? "pack" : "frame";
    }
    return "card";
  }

  // glyph disc shared by card + pack (logo img with lettered fallback)
  function glyph(it, cls, logo) {
    var g = el("span", cls);
    var fallback = function () {
      g.classList.add("no-logo");
      g.style.background = "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.4), transparent 55%), " + (it.color || "#888");
      g.textContent = it.glyph || (it.ticker ? it.ticker[0] : "•");
    };
    if (!logo || it.glyph || !it.ticker) { fallback(); return g; }
    var img = document.createElement("img"); img.src = logo; img.alt = ""; img.loading = "lazy";
    img.addEventListener("error", function () { g.innerHTML = ""; fallback(); });
    g.appendChild(img);
    return g;
  }

  /* build(it, opts) → node.
   *   it   : { ticker, amount, name?, color?, glyph?, img? }
   *   opts : { kind?: card|frame|pack, logo?: <url>, shine?: bool (default true) } */
  function build(it, opts) {
    injectCss();
    it = it || {}; opts = opts || {};
    var kind = opts.kind || kindOf(it);
    var node = el("span", "av av-" + kind + (opts.shine === false ? "" : " av-shine"));
    if (it.color) { node.style.setProperty("--av-accent", it.color); node.style.setProperty("--av-glow", it.color); }
    if (kind === "frame") {
      var mat = el("span", "av-mat"), art = el("span", "av-art");
      if (it.img) { var im = document.createElement("img"); im.src = it.img; im.alt = ""; art.appendChild(im); }
      mat.appendChild(art); node.appendChild(mat);
      var pl = el("span", "av-plaque"); pl.innerHTML = esc(it.name || it.ticker || "One of one"); node.appendChild(pl);
    } else if (kind === "pack") {
      node.appendChild(el("span", "av-crimp top"));
      node.appendChild(glyph(it, "av-burst", opts.logo));
      var lb = el("span", "av-lbl"); lb.textContent = "BOOSTER"; node.appendChild(lb);
      node.appendChild(el("span", "av-crimp bot"));
    } else {
      node.appendChild(glyph(it, "av-glyph", opts.logo));
      var tk = el("span", "av-tk"); tk.textContent = it.ticker || "?"; node.appendChild(tk);
      if (it.amount) { var am = el("span", "av-amt"); am.textContent = it.amount; node.appendChild(am); }
    }
    return node;
  }

  window.GIIIFTAssetVisuals = { build: build, kindOf: kindOf };
})();
