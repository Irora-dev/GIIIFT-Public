/* GIIIFT brand background - a randomized cool gradient, recomposed on every
   load so the whole site shares one identity that shifts subtly each refresh.
   Cool hues only (mint → teal → cyan → blue → indigo → violet), layered with
   the #00FF9D-adjacent mint over the near-black base. Shared by every page. */
(function () {
  var BASE = "#0b0d0c";
  // cool HSL hue stops: mint, spring, teal, cyan, azure, blue, indigo, violet.
  // A vertical can re-tint the whole site by setting window.GIIIFT_BRAND_HUES
  // (the vertical engine does this in applyTheme) - read at apply() time so a
  // late re-apply() picks up a vertical switch.
  var DEFAULT_HUES = [152, 162, 174, 188, 202, 218, 244, 268];
  function hues() {
    var v = window.GIIIFT_BRAND_HUES;
    return (Array.isArray(v) && v.length) ? v : DEFAULT_HUES;
  }

  function r(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }

  function blob() {
    var h = pick(hues()),
        s = r(72, 94) | 0,
        l = r(52, 62) | 0,
        a = r(0.12, 0.22).toFixed(3),
        w = r(900, 1320) | 0,
        ht = r(680, 1000) | 0,
        x = r(-12, 112) | 0,
        y = r(-16, 122) | 0,
        stop = r(56, 66) | 0;
    return "radial-gradient(" + w + "px " + ht + "px at " + x + "% " + y + "%, " +
           "hsla(" + h + "," + s + "%," + l + "%," + a + "), transparent " + stop + "%)";
  }

  function apply() {
    var layers = [blob(), blob(), blob()];
    document.body.style.background = layers.join(", ") + ", " + BASE;
    document.body.style.backgroundAttachment = "fixed";
    document.body.style.minHeight = "100vh";

    // Grid + noise texture - inject only if the page doesn't already ship its own.
    if (!document.querySelector(".studio-grid, .noise, .bg-grid") && !document.getElementById("brand-bg-tex")) {
      var st = document.createElement("style");
      st.id = "brand-bg-tex";
      st.textContent =
        "body::before{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;" +
        "background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px)," +
        "linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px);background-size:48px 48px;" +
        "-webkit-mask-image:radial-gradient(circle at 60% 35%,#000 0%,transparent 75%);" +
        "mask-image:radial-gradient(circle at 60% 35%,#000 0%,transparent 75%);}" +
        "body::after{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;opacity:.035;" +
        "background-image:url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\");}";
      document.head.appendChild(st);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply);
  else apply();

  // let the vertical engine (or anything else) recompose the backdrop on demand
  window.giiiftBrand = { apply: apply };
})();
