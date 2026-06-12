/* GIIIFT - shared top bar (glass pill nav), site-wide.
 *
 * Drop <script defer src="/showcase/site-nav.js"></script> on any page and it injects the
 * sticky pill nav (logo · Shop · Vault · Send · auth slot) + its own scoped CSS.
 *
 * Auth gating: Vault and Send require an account. If a signed-out visitor taps
 * them, we stash the destination and open the Privy login (via auth-nav.js);
 * once they're in (the "giiift-auth" event), we forward them to where they were
 * headed. The auth slot itself (Log in / Vault) is rendered by auth-nav.js.
 *
 * Self-sufficient: it lazy-loads supabase-config.js + auth-nav.js if the host
 * page hasn't already, so a single include is all that's needed.
 */
(function () {
  if (window.__giiiftNavMounted) return;
  window.__giiiftNavMounted = true;

  /* Demo mode: ?demo=1 (or just ?demo) bypasses login site-wide; ?demo=0 exits.
   * It persists in localStorage so it sticks across navigation, and we keep the
   * auth flag asserted so every page (vault, send, the auth slot) behaves as
   * signed-in - auth-nav.js only reads "giiift-authed", and the heavy Privy
   * bundle is lazy-loaded only on a real "Log in" click, so nothing overrides it. */
  function demoFlag() { try { return localStorage.getItem("giiift-demo") === "1"; } catch (e) { return false; } }
  function setDemo(on) {
    try {
      if (on) { localStorage.setItem("giiift-demo", "1"); localStorage.setItem("giiift-authed", "1"); }
      else { localStorage.removeItem("giiift-demo"); localStorage.removeItem("giiift-authed"); }
    } catch (e) {}
  }
  (function syncDemo() {
    var p; try { p = new URLSearchParams(location.search); } catch (e) { p = null; }
    if (p && p.has("demo")) {
      var v = (p.get("demo") || "").toLowerCase();
      setDemo(v === "" || v === "1" || v === "true" || v === "on" || v === "yes");
    } else if (demoFlag()) {
      setDemo(true); // re-assert on subsequent page loads
    }
  })();
  window.giiiftDemo = function (on) { setDemo(on !== false); location.reload(); };

  function authed() { try { return localStorage.getItem("giiift-authed") === "1" || demoFlag(); } catch (e) { return demoFlag(); } }
  function scriptLoaded(src) {
    return [].some.call(document.scripts, function (s) { return s.src && s.src.indexOf(src) !== -1; });
  }
  function ensureScript(src) {
    if (scriptLoaded(src)) return;
    var s = document.createElement("script"); s.src = src; s.defer = true; document.head.appendChild(s);
  }

  function injectCss() {
    if (document.getElementById("giiift-nav-css")) return;
    var st = document.createElement("style");
    st.id = "giiift-nav-css";
    st.textContent = [
      ".site-nav{position:sticky;top:13.5px;z-index:400;max-width:1320px;margin:0 auto 16.5px;padding:0 clamp(12px,4vw,30px);font-family:'Inter',sans-serif}",
      ".site-nav .snav-pill{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8.3px 10.5px 8.3px 16.5px;border-radius:75px;background:rgba(22,24,30,0.55);-webkit-backdrop-filter:blur(30px);backdrop-filter:blur(30px);border:1px solid rgba(255,255,255,0.12);box-shadow:0 18px 36px -9px rgba(0,0,0,0.5)}",
      ".site-nav .snav-logo{font-family:'Bowlby One',sans-serif;font-size:16.5px;letter-spacing:-0.04em;color:#fff;text-decoration:none;transform:rotate(-3deg);display:inline-flex;align-items:baseline;gap:1px;user-select:none}",
      ".site-nav .snav-logo .i1{color:#FF3B6F}.site-nav .snav-logo .i2{color:#FFD93D}.site-nav .snav-logo .i3{color:#4ECDC4}",
      ".site-nav .snav-logo .dot{width:6px;height:6px;background:#fff;border-radius:50%;display:inline-block;transform:translateY(-2px);margin-left:3px}",
      ".site-nav .snav-links{display:flex;gap:3px;background:rgba(0,0,0,0.22);border:1px solid rgba(255,255,255,0.12);padding:3.8px;border-radius:75px}",
      ".site-nav .snav-links a{padding:6px 13.5px;border-radius:75px;font-size:10.5px;font-weight:600;color:rgba(255,255,255,0.6);text-decoration:none;cursor:pointer;transition:color .2s,background .2s}",
      ".site-nav .snav-links a:hover{color:#fff}",
      ".site-nav .snav-links a.active{background:rgba(255,255,255,0.1);color:#fff}",
      ".site-nav #giiift-auth-slot{display:flex;align-items:center}",
      ".site-nav .nav-vault,.site-nav .nav-login{font-family:'Inter',sans-serif;font-weight:600;font-size:10.5px;line-height:1;padding:8.3px 13.5px;border-radius:75px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.08);color:#fff;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background .2s}",
      ".site-nav .nav-vault:hover,.site-nav .nav-login:hover{background:rgba(255,255,255,0.15)}",
      ".site-nav .nav-vault .v-dot{width:5.3px;height:5.3px;border-radius:50%;background:#00FF9D;box-shadow:0 0 6px #00FF9D}",
      /* coarse-pointer tap floor (§10.3: ≥40px) — invisible hit-area expander, pill visuals unchanged */
      "@media(pointer:coarse){.site-nav .snav-logo,.site-nav .nav-vault,.site-nav .nav-login{position:relative}.site-nav .snav-logo::after,.site-nav .nav-vault::after,.site-nav .nav-login::after{content:'';position:absolute;left:-4px;right:-4px;top:50%;height:40px;transform:translateY(-50%)}}",
      "@media(max-width:540px){.site-nav .snav-links{display:none}}",
      /* sign-in gate (vault / send when signed out) */
      ".giiift-gate{position:fixed;inset:0;z-index:350;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(8,8,11,0.66);-webkit-backdrop-filter:blur(15px);backdrop-filter:blur(15px);font-family:'Inter',sans-serif;animation:giiift-gate-in .3s ease both}",
      "@keyframes giiift-gate-in{from{opacity:0}to{opacity:1}}",
      ".giiift-gate-card{text-align:center;max-width:315px;width:100%;padding:32px 27px;border-radius:21px;background:rgba(22,24,30,0.62);border:1px solid rgba(255,255,255,0.12);box-shadow:0 23px 53px -15px rgba(0,0,0,0.7)}",
      ".giiift-gate-ic{width:45px;height:45px;margin:0 auto 12px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12)}",
      ".giiift-gate-ic svg{width:19.5px;height:19.5px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}",
      ".giiift-gate-card h2{font-size:21px;font-weight:700;color:#fff;letter-spacing:-0.02em;margin:0 0 6px}",
      ".giiift-gate-card p{font-size:11.3px;color:rgba(255,255,255,0.6);margin:0 0 19.5px}",
      ".giiift-gate-btn{font-family:'Inter',sans-serif;font-weight:700;font-size:11.3px;padding:11.3px 27px;border-radius:75px;border:1px solid rgba(255,255,255,0.22);background:rgba(255,255,255,0.12);color:#fff;cursor:pointer;transition:background .2s,transform .15s}",
      ".giiift-gate-btn:hover{background:rgba(255,255,255,0.2);transform:translateY(-1px)}",
      ".giiift-gate-demo{display:block;margin:12px auto 0;background:none;border:none;color:rgba(255,255,255,0.5);font-family:'Inter',sans-serif;font-size:10.1px;font-weight:600;cursor:pointer;transition:color .2s}",
      ".giiift-gate-demo:hover{color:#fff}",
      /* demo-mode badge (login bypass active) */
      ".giiift-demo-badge{position:fixed;left:13.5px;bottom:13.5px;z-index:420;display:inline-flex;align-items:center;gap:6.8px;padding:6px 6px 6px 10.5px;border-radius:75px;background:rgba(22,24,30,0.7);-webkit-backdrop-filter:blur(15px);backdrop-filter:blur(15px);border:1px solid rgba(255,255,255,0.14);box-shadow:0 9px 23px -7.5px rgba(0,0,0,0.6);color:#fff;font-family:'Inter',sans-serif;font-size:9.8px;font-weight:600;cursor:pointer}",
      ".giiift-demo-badge .gdb-dot{width:6px;height:6px;border-radius:50%;background:#00FF9D;box-shadow:0 0 6px #00FF9D}",
      ".giiift-demo-badge .gdb-x{font-size:8.3px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:rgba(255,255,255,0.6);background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);padding:3px 6.8px;border-radius:75px;transition:color .2s,background .2s}",
      ".giiift-demo-badge:hover .gdb-x{color:#fff;background:rgba(255,255,255,0.16)}",
    ].join("");
    document.head.appendChild(st);
  }

  function activeKey() {
    var p = (location.pathname || "/").replace(/\/+$/, "").replace(/\.html$/, "").replace(/^\/showcase/, "");
    if (p === "/shop" || p === "/market") return "shop";
    if (p === "/me" || p === "/vault") return "vault";
    if (p === "/create" || p === "/wrap") return "send";
    return "";
  }

  function showDemoBadge() {
    if (!demoFlag() || document.getElementById("giiift-demo-badge")) return;
    var b = document.createElement("button");
    b.id = "giiift-demo-badge";
    b.type = "button";
    b.className = "giiift-demo-badge";
    b.title = "Demo mode bypasses login. Click to exit";
    b.innerHTML = '<span class="gdb-dot"></span>Demo mode<span class="gdb-x">Exit</span>';
    b.addEventListener("click", function () { setDemo(false); location.reload(); });
    document.body.appendChild(b);
  }

  function showGate(kind) {
    if (document.getElementById("giiift-gate")) return;
    var copy = kind === "send"
      ? { h: "Send a gift", p: "Log in to wrap and send a gift." }
      : { h: "Your vault", p: "Log in to see your assets." };
    var g = document.createElement("div");
    g.id = "giiift-gate";
    g.className = "giiift-gate";
    g.innerHTML =
      '<div class="giiift-gate-card">' +
        '<div class="giiift-gate-ic"><svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>' +
        "<h2>" + copy.h + "</h2>" +
        "<p>" + copy.p + "</p>" +
        '<button class="giiift-gate-btn" type="button">Log in</button>' +
        '<button class="giiift-gate-demo" type="button">Skip, explore in demo mode →</button>' +
      "</div>";
    document.body.appendChild(g);
    g.querySelector(".giiift-gate-btn").addEventListener("click", function () {
      if (typeof window.giiiftStartLogin === "function") window.giiiftStartLogin();
    });
    g.querySelector(".giiift-gate-demo").addEventListener("click", function () {
      setDemo(true); location.reload();
    });
  }

  function mount() {
    if (document.querySelector(".site-nav")) return;
    injectCss();
    // Remove any pre-existing standalone auth slot so there's a single one in the bar.
    [].forEach.call(document.querySelectorAll("#giiift-auth-slot"), function (el) { el.remove(); });

    var active = activeKey();
    var header = document.createElement("header");
    header.className = "site-nav";
    header.innerHTML =
      '<div class="snav-pill">' +
        '<a href="/showcase/" class="snav-logo" aria-label="GIIIFT home">G<span class="i1">I</span><span class="i2">I</span><span class="i3">I</span>FT<span class="dot"></span></a>' +
        '<nav class="snav-links">' +
          '<a href="/showcase/shop.html" data-nav="shop"' + (active === "shop" ? ' class="active"' : "") + ">Shop</a>" +
          '<a href="/showcase/" data-nav="vault" data-gated' + (active === "vault" ? ' class="active"' : "") + ">Vault</a>" +
          '<a href="/showcase/wrap.html" data-nav="send"' + (active === "send" ? ' class="active"' : "") + ">Send</a>" +
        "</nav>" +
        '<div id="giiift-auth-slot"></div>' +
      "</div>";
    document.body.insertBefore(header, document.body.firstChild);

    // Gated links (Vault / Send) navigate normally - the destination page shows
    // the on-page sign-in gate (with its "Log in" + "explore in demo mode" options),
    // so login always happens on the page rather than via a surprise modal.

    // Vault needs an identity, so it's gated; sending is open (you capture the
    // recipient during the flow - the sender shouldn't have to log in first).
    if (!authed() && active === "vault") showGate(active);

    // Show the demo-mode badge (login bypass active) so it's visible + exitable.
    showDemoBadge();

    // After login, drop any gate + forward to wherever they were headed.
    window.addEventListener("giiift-auth", function () {
      if (!authed()) return;
      var g = document.getElementById("giiift-gate"); if (g) g.remove();
      var dest; try { dest = sessionStorage.getItem("giiift-postlogin"); } catch (e) {}
      if (dest) { try { sessionStorage.removeItem("giiift-postlogin"); } catch (e) {} location.href = dest; }
    });

    // Make sure the login machinery + public config are present, then render the slot.
    ensureScript("/showcase/supabase-config.js");
    ensureScript("/showcase/auth-nav.js");
    ensureScript("/showcase/crt-overlay.js"); // TEST: CRT/mission-control overlay site-wide (revert: remove this line, or ?nocrt)
    window.dispatchEvent(new Event("giiift-auth")); // prompt auth-nav.js to render into the slot
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
