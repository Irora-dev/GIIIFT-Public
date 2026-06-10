/* GIIIFT — CRT / mission-control overlay (TEST, easily reverted).
 *
 * Drop-in: add <script defer src="/showcase/crt-overlay.js"></script> to any page and it
 * injects a scanline + chromatic CRT layer plus a perimeter telemetry HUD on top
 * of the existing content (it does NOT touch the page's own background/borealis).
 *
 * Purely decorative: the overlay is pointer-events:none, so it never blocks clicks.
 * Toggle off at runtime with ?nocrt (or ?crt=0) in the URL.
 * REVERT: remove the <script> include line(s); optionally delete this file.
 */
(function () {
  if (window.__giiiftCrt) return;
  window.__giiiftCrt = true;
  try {
    var p = new URLSearchParams(location.search);
    if (p.has("nocrt") || p.get("crt") === "0") return;
  } catch (e) {}

  var CSS = [
    ".crt-scan{position:fixed;inset:0;z-index:9000;pointer-events:none;background:linear-gradient(rgba(10,16,18,0) 50%,rgba(0,0,0,0.22) 50%),linear-gradient(90deg,rgba(0,255,255,0.04),rgba(0,255,120,0.02),rgba(0,0,0,0.06));background-size:100% 4px,3px 100%}",
    ".crt-flicker{position:fixed;inset:0;z-index:9000;pointer-events:none;background:rgba(120,250,255,0.012);animation:crt-flick 4.5s steps(2,start) infinite}",
    "@keyframes crt-flick{0%,97%{opacity:0}98%{opacity:1}100%{opacity:0}}",
    ".crt-hud{position:fixed;inset:0;z-index:9001;pointer-events:none;font-family:'IBM Plex Mono','VT323',monospace;color:rgba(180,230,255,0.5);text-transform:uppercase}",
    ".crt-hud .pe{position:absolute;font-size:11px;letter-spacing:0.02em;text-shadow:0 0 6px rgba(0,200,255,0.25)}",
    ".crt-tl{top:26px;left:26px;display:flex;flex-direction:column;gap:2px;border-left:3px solid #44ccff;padding-left:10px}",
    ".crt-tl .lead{color:#e0faff;font-weight:600}",
    ".crt-tr{top:26px;right:26px;display:flex;align-items:center;gap:10px;background:rgba(0,0,0,0.3);padding:5px 12px}",
    ".crt-dot{width:6px;height:6px;background:#00f3ff;box-shadow:0 0 10px #00f3ff;animation:crt-blink 1s steps(2,start) infinite}",
    ".crt-bl{bottom:26px;left:26px;display:flex;flex-direction:column;gap:2px}",
    ".crt-br{bottom:26px;right:26px;text-align:right;display:flex;flex-direction:column;gap:2px}",
    ".crt-div{width:40px;height:1px;background:rgba(50,200,255,0.4);margin:6px 0}",
    ".crt-br .crt-div{margin-left:auto}",
    ".crt-bk{position:fixed;width:30px;height:30px;border:1px solid rgba(180,230,255,0.35);z-index:9001;pointer-events:none}",
    ".crt-bk.tl{top:14px;left:14px;border-right:0;border-bottom:0}",
    ".crt-bk.tr{top:14px;right:14px;border-left:0;border-bottom:0}",
    ".crt-bk.bl{bottom:14px;left:14px;border-right:0;border-top:0}",
    ".crt-bk.br{bottom:14px;right:14px;border-left:0;border-top:0}",
    "@keyframes crt-blink{to{visibility:hidden}}",
    "@media(max-width:760px){.crt-tr,.crt-br{display:none}}",
  ].join("");

  function mount() {
    if (document.getElementById("crt-overlay-css")) return;
    var st = document.createElement("style"); st.id = "crt-overlay-css"; st.textContent = CSS;
    document.head.appendChild(st);

    var scan = document.createElement("div"); scan.className = "crt-scan";
    var flick = document.createElement("div"); flick.className = "crt-flicker";
    document.body.appendChild(scan);
    document.body.appendChild(flick);

    // Scanlines-only mode for dense tool pages (the perimeter HUD would collide
    // with their chrome). Opt in with <html data-crt="min"> or ?crt=min.
    var minimal = false;
    try { minimal = document.documentElement.getAttribute("data-crt") === "min" || new URLSearchParams(location.search).get("crt") === "min"; } catch (e) {}
    if (minimal) return;

    var hud = document.createElement("div");
    hud.className = "crt-hud";
    hud.innerHTML =
      '<div class="pe crt-tl"><span class="lead">GIIIFT.SYS [ACTIVE]</span><span>BOX_ENGINE_V2.0</span></div>' +
      '<div class="pe crt-tr"><span>LIVE TELEMETRY</span><span class="crt-dot"></span></div>' +
      '<div class="pe crt-bl"><span>LAT: +64.1400</span><span>LNG: -21.9283</span><span class="crt-div"></span><span>ALT: 36,576 M</span></div>' +
      '<div class="pe crt-br"><span>BUF_SEQ: 89-B / BRAVO</span><span class="crt-div"></span><span>REALTIME_RASTER_SCAN</span></div>' +
      '<div class="crt-bk tl"></div><div class="crt-bk tr"></div><div class="crt-bk bl"></div><div class="crt-bk br"></div>';
    document.body.appendChild(hud);
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
