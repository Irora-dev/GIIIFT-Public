/* GIIIFT — intent client (link-gifting M1, docs/SPEC_T2_HANDSHAKE.md).
 *
 * Tiny shared client for the /api/intent* edge router. Used by wrap.html (create
 * a link), box.html (/i/<code> claim + waiting room), and me.html (pending
 * approvals). Auth = the Privy access token the SDK keeps in
 * localStorage["privy:token"], sent as `Authorization: Bearer` and verified
 * server-side (JWKS). Login itself rides the existing lazy island:
 * auth-nav.js's giiiftStartLogin() loads /giiift-auth.js which exposes
 * window.giiiftLogin / window.giiiftAuth and fires "giiift-auth" events.
 *
 *   window.GIIIFTIntent = { authed, ensureLogin, create, get, claim, nudge,
 *                           opened, confirm, reject, cancel, list }
 *
 * Every call resolves { ok, status, data } and never throws.
 */
(function () {
  function token() {
    try { return localStorage.getItem("privy:token") || ""; } catch (e) { return ""; }
  }
  function authed() {
    var a = window.giiiftAuth;
    return !!(a && a.authenticated && token());
  }

  /* Resolve true once the user is logged in (opens the Privy modal if needed).
   * loginOpts (optional) rides through to the Privy modal — the claim page
   * passes { loginMethods: ['twitter'] } to pre-select a restricted provider. */
  function ensureLogin(timeoutMs, loginOpts) {
    return new Promise(function (resolve) {
      if (authed()) return resolve(true);
      var done = false;
      function fin(ok) { if (done) return; done = true; window.removeEventListener("giiift-auth", onAuth); resolve(ok); }
      function onAuth() { if (authed()) fin(true); }
      window.addEventListener("giiift-auth", onAuth);
      if (typeof window.giiiftLogin === "function") window.giiiftLogin(loginOpts);
      else if (typeof window.giiiftStartLogin === "function") {
        window.__giiiftLoginOpts = loginOpts || null; // the island reads this once it boots
        window.giiiftStartLogin();
      }
      else return fin(false);
      setTimeout(function () { fin(authed()); }, timeoutMs || 180000);
    });
  }

  function call(method, path, body) {
    var h = { "content-type": "application/json" };
    var t = token();
    if (t) h.authorization = "Bearer " + t;
    return fetch(path, { method: method, headers: h, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          return { ok: r.ok, status: r.status, data: j };
        });
      })
      .catch(function () { return { ok: false, status: 0, data: {} }; });
  }

  window.GIIIFTIntent = {
    authed: authed,
    ensureLogin: ensureLogin,
    create:  function (body) { return call("POST", "/api/intent", body); },
    get:     function (id)   { return call("GET", "/api/intent/" + encodeURIComponent(id)); },
    claim:   function (id, body) { return call("POST", "/api/intent/" + encodeURIComponent(id) + "/claim", body || {}); },
    nudge:   function (id)   { return call("POST", "/api/intent/" + encodeURIComponent(id) + "/nudge", {}); },
    opened:  function (id)   { return call("POST", "/api/intent/" + encodeURIComponent(id) + "/opened", {}); },
    confirm: function (id, body) { return call("POST", "/api/intent/" + encodeURIComponent(id) + "/confirm", body || {}); },
    reject:  function (id)   { return call("POST", "/api/intent/" + encodeURIComponent(id) + "/reject", {}); },
    cancel:  function (id)   { return call("POST", "/api/intent/" + encodeURIComponent(id) + "/cancel", {}); },
    list:    function ()     { return call("GET", "/api/intents"); },
  };
})();
