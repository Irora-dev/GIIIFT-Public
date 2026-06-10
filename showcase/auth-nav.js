/* GIIIFT — lightweight auth nav (always loaded; tiny).
 *
 * Renders the top-right control into #giiift-auth-slot:
 *   - logged in  -> "Vault" link   (from a cached flag, instant)
 *   - logged out -> "Log in" button
 * Clicking "Log in" lazily loads the heavy Privy bundle (/giiift-auth.js) and
 * opens the modal. Stays in sync via the "giiift-auth" events the island fires.
 */
(function () {
  function authed() {
    try { return localStorage.getItem("giiift-authed") === "1"; } catch (e) { return false; }
  }
  function slot() { return document.getElementById("giiift-auth-slot"); }

  function loadPrivy() {
    if (window.__giiiftPrivyLoad) return window.__giiiftPrivyLoad;
    window.__giiiftPrivyLoad = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "/showcase/giiift-auth.js";
      s.defer = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return window.__giiiftPrivyLoad;
  }

  function startLogin() {
    if (typeof window.giiiftLogin === "function") { window.giiiftLogin(); return; }
    window.__giiiftWantLogin = true; // the island opens the modal once it boots
    var b = document.getElementById("giiift-login-btn");
    if (b) { b.disabled = true; b.textContent = "Loading…"; }
    loadPrivy().catch(function () { if (b) { b.disabled = false; b.textContent = "Log in"; } });
  }

  function render() {
    var el = slot();
    if (!el) return;
    if (authed()) {
      el.innerHTML =
        '<a class="nav-vault" href="/showcase/" aria-label="Open your vault"><span class="v-dot"></span><span>Vault</span></a>';
    } else {
      el.innerHTML = '<button type="button" class="nav-login" id="giiift-login-btn">Log in</button>';
      var b = document.getElementById("giiift-login-btn");
      if (b) b.addEventListener("click", startLogin);
    }
  }

  window.giiiftStartLogin = startLogin;
  window.addEventListener("giiift-auth", render);
  if (document.readyState !== "loading") render();
  else document.addEventListener("DOMContentLoaded", render);
})();
