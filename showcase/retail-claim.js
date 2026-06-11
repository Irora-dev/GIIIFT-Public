/* GIIIFT - the receive-side retail customize card (retail-gifting V1, M3).
 *
 * When a gift payload carries a retail mandate (g.r -> gift.mandate.productId),
 * the open/claim flow calls giiiftRetailClaimCard() to mount a card under the
 * manifest: "your gift suggests <product>" with a variant picker, an OPTIONAL
 * shipping-address block (best-effort prefill of the merchant checkout, plan
 * §10), and the handoff button to the merchant's own USDC-on-Base checkout.
 *
 * Posture (do not regress):
 *   - The item is a SUGGESTION. The card always shows "keep it as balance" and
 *     renders nothing at all if the menu/product can't be resolved: the gift
 *     stays a normal balance gift. Nothing here ever blocks the claim.
 *   - The recipient is the only signer, on the MERCHANT'S checkout. This card
 *     never collects payment and never sends address data anywhere except into
 *     the merchant-checkout URL params (giiiftRetailResolve).
 *   - Variant + address are recipient-side only; the sender never sees them.
 *
 * Depends on retail-gifting.js (giiiftRetailMenu / giiiftRetailResolve).
 */
(function () {
  var CSS = [
    ".rgc{margin:18px auto 0;max-width:520px;text-align:left;background:rgba(255,255,255,.04);",
    "border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:18px 18px 16px;color:#f3f4f2;",
    "font-family:inherit}",
    ".rgc h4{margin:0 0 4px;font-size:15px;font-weight:800}",
    ".rgc .rgc-sub{font-size:12.5px;color:rgba(243,244,242,.62);margin:0 0 12px;line-height:1.5}",
    ".rgc .rgc-row{display:flex;gap:10px;align-items:center;margin:0 0 10px}",
    ".rgc label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(243,244,242,.55)}",
    ".rgc select,.rgc input{width:100%;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.16);",
    "border-radius:10px;color:#fff;font-size:14px;padding:9px 11px;font-family:inherit}",
    ".rgc select:focus,.rgc input:focus{outline:none;border-color:rgba(0,255,157,.45)}",
    ".rgc details{margin:2px 0 12px}",
    ".rgc summary{cursor:pointer;font-size:12.5px;color:rgba(160,255,230,.75)}",
    ".rgc .rgc-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}",
    ".rgc .rgc-grid .wide{grid-column:1/-1}",
    ".rgc .rgc-go{display:block;width:100%;text-align:center;margin:4px 0 0;padding:12px;border-radius:12px;",
    "border:1px solid rgba(0,255,157,.45);background:rgba(0,255,157,.14);color:#eafff6;font-weight:700;",
    "font-size:14.5px;cursor:pointer;font-family:inherit}",
    ".rgc .rgc-go:hover{background:rgba(0,255,157,.22)}",
    ".rgc .rgc-go[disabled]{opacity:.45;cursor:default}",
    ".rgc .rgc-skip{display:block;width:100%;text-align:center;background:none;border:none;margin-top:8px;",
    "color:rgba(243,244,242,.55);font-size:12.5px;cursor:pointer;font-family:inherit}",
    ".rgc .rgc-skip:hover{color:#fff}",
    ".rgc .rgc-note{font-size:11.5px;color:rgba(243,244,242,.5);margin:10px 0 0;line-height:1.5}",
    ".rgc .rgc-price{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;color:rgba(160,255,230,.8)}",
  ].join("");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;   // payload data renders via textContent only (XSS-safe)
    return n;
  }

  function ensureCss() {
    if (document.getElementById("rgc-css")) return;
    var s = el("style"); s.id = "rgc-css"; s.textContent = CSS;
    document.head.appendChild(s);
  }

  // Open the merchant checkout in a centered, sheet-sized popup. Returns the window
  // handle (so we can detect close) or null if the popup was blocked. No noopener:
  // we keep the handle. The size/position make it the "monitor window" the design
  // lane can frame (e.g. a retro-computer screen); on a native app this leg becomes
  // Shopify's Checkout Sheet Kit instead (see GIIIFT-RETAIL-V1-PLAN.md appendix).
  function openCheckout(url) {
    try {
      var w = 460, h = 760;
      var sw = (window.screen && window.screen.availWidth) || window.innerWidth || 1024;
      var sh = (window.screen && window.screen.availHeight) || window.innerHeight || 768;
      var sx = (window.screen && window.screen.availLeft) || 0;
      var sy = (window.screen && window.screen.availTop) || 0;
      var left = Math.round(sx + Math.max(0, (sw - w) / 2));
      var top = Math.round(sy + Math.max(0, (sh - h) / 2));
      return window.open(url, "giiift_checkout",
        "popup=yes,width=" + w + ",height=" + h + ",left=" + left + ",top=" + top) || null;
    } catch (_e) { return null; }
  }

  // After launching checkout we cannot read the merchant's cross-origin page, so we
  // ask the recipient to confirm on return. Honest, and it never blocks the balance.
  function mountReturnRow(card, productId, url, win) {
    var trk = function (ev) { try { if (window.giiift && window.giiift.track) window.giiift.track(ev, { productId: productId }); } catch (_e) {} };
    var row = el("div", "rgc-return");
    var done = el("button", "rgc-go", "All done ✓");
    var reopen = el("button", "rgc-skip", "Reopen the checkout window");
    row.appendChild(done); row.appendChild(reopen);
    card.appendChild(row);
    done.addEventListener("click", function () {
      trk("retail_checkout_confirmed");
      row.remove();
      card.appendChild(el("p", "rgc-note", "Nice, it's on its way. Anything unspent stays in your balance."));
    });
    reopen.addEventListener("click", function () {
      try { (win && !win.closed) ? win.focus() : (win = openCheckout(url)); } catch (_e) { win = openCheckout(url); }
    });
    // telemetry only: note when the window closes; the recipient still confirms via the button
    var iv = setInterval(function () {
      try { if (!win || win.closed) { clearInterval(iv); trk("retail_checkout_window_closed"); } } catch (_e) { clearInterval(iv); }
    }, 800);
  }

  // ---- "Pay from your GIIIFT wallet": the WalletConnect bridge row ----------
  // The merchant checkout cannot see a Privy embedded wallet (it lives in OUR
  // origin), so the recipient pays via WalletConnect: in the checkout they pick
  // WalletConnect, copy the connect link, and paste it here. The bridge island
  // (giiift-wallet-bridge.js, lazy ~870KB) pairs as the wallet peer and routes
  // every request to the user's own Privy provider behind explicit approval
  // sheets. Hidden unless WALLETCONNECT_PROJECT_ID is configured (dark-by-default).
  var bridgeLoading = null;
  function ensureBridge() {
    if (window.giiiftWalletBridge) return Promise.resolve(window.giiiftWalletBridge);
    if (bridgeLoading) return bridgeLoading;
    bridgeLoading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "/giiift-wallet-bridge.js"; s.async = true;
      var t = setTimeout(function () { reject(new Error("bridge-load-timeout")); }, 20000);
      window.addEventListener("giiift-wallet-bridge-ready", function onr() {
        window.removeEventListener("giiift-wallet-bridge-ready", onr);
        clearTimeout(t); resolve(window.giiiftWalletBridge);
      });
      s.onerror = function () { clearTimeout(t); reject(new Error("bridge-load-failed")); };
      document.head.appendChild(s);
    });
    return bridgeLoading;
  }
  function mountBridgeRow(card, productId) {
    if (!window.GIIIFT_WC_PROJECT_ID) return;            // not configured -> stay dark
    var trk = function (ev, extra) { try { if (window.giiift && window.giiift.track) window.giiift.track(ev, Object.assign({ productId: productId }, extra || {})); } catch (_e) {} };
    var det = el("details", "rgc-bridge");
    det.appendChild(el("summary", null, "Pay from your GIIIFT wallet (beta)"));
    det.appendChild(el("p", "rgc-note",
      "In the checkout window choose WalletConnect, tap \"Copy link\", then paste it here. " +
      "You approve the connection and the payment right on this page; your wallet never leaves GIIIFT."));
    var row = el("div", "rgc-row");
    var inp = el("input"); inp.placeholder = "wc:…"; inp.autocomplete = "off"; inp.spellcheck = false;
    var paste = el("button", "rgc-go", "Paste"); paste.style.flex = "0 0 78px"; paste.style.margin = "0";
    paste.style.background = "rgba(255,255,255,.06)"; paste.style.borderColor = "rgba(255,255,255,.16)";
    var go = el("button", "rgc-go", "Connect"); go.style.flex = "0 0 104px"; go.style.margin = "0";
    row.appendChild(inp); row.appendChild(paste); row.appendChild(go);
    det.appendChild(row);
    // one-tap paste: read the checkout's copied wc: link and connect immediately
    paste.addEventListener("click", async function () {
      try {
        var t = (await navigator.clipboard.readText() || "").trim();
        if (/^wc:/i.test(t)) { inp.value = t; go.click(); }
        else if (t) { inp.value = t; status.textContent = "That doesn't look like a WalletConnect link (it should start with wc:)."; }
        else status.textContent = "Clipboard is empty. In the checkout tap Copy link first.";
      } catch (e) { status.textContent = "Couldn't read the clipboard here: paste it into the box instead."; inp.focus(); }
    });
    var status = el("p", "rgc-note", "");
    det.appendChild(status);
    card.appendChild(det);

    go.addEventListener("click", async function () {
      var uri = inp.value.trim();
      if (!/^wc:/i.test(uri)) { status.textContent = "That doesn't look like a WalletConnect link. In the checkout, choose WalletConnect and tap Copy link."; return; }
      go.disabled = true; go.textContent = "Connecting…";
      try {
        var bridge = await ensureBridge();
        if (!window.giiiftWalletAddress) {
          status.textContent = "Log in first so your GIIIFT wallet is ready, then Connect again.";
          if (typeof window.giiiftLogin === "function") window.giiiftLogin();
          go.disabled = false; go.textContent = "Connect";
          return;
        }
        bridge.onStatus(function (st) {
          if (st.sessions && st.sessions.length) {
            status.textContent = "Connected to " + st.sessions[0].name + ". Approve the payment prompts as they appear here.";
          } else if (st.lastError === "log-in-first") {
            status.textContent = "Log in first so your GIIIFT wallet is ready, then Connect again.";
          }
        });
        await bridge.pair(uri);
        trk("retail_bridge_paired");
        status.textContent = status.textContent || "Connected. Approve the payment prompts as they appear here.";
        inp.value = "";
        go.textContent = "Connected";
      } catch (e) {
        trk("retail_bridge_error", { reason: (e && (e.reason || e.message)) || "" });
        status.textContent = "Couldn't connect: " + ((e && (e.reason || e.message)) || "try copying the link again") + ".";
        go.disabled = false; go.textContent = "Connect";
      }
    });
  }

  /**
   * Mount the customize card. opts: { productId, mount, from? }
   * Resolves to true if mounted, false if silently skipped (unknown product /
   * menu unavailable / bad input). Never throws.
   */
  async function mountCard(opts) {
    try {
      var productId = String((opts && opts.productId) || "").trim();
      var mount = opts && opts.mount;
      if (!productId || !mount || typeof window.giiiftRetailMenu !== "function") return false;

      var m = await window.giiiftRetailMenu();
      var product = (m.products || []).find(function (p) { return p.id === productId; });
      if (!product) return false;                       // unknown -> stay a balance gift, silently

      ensureCss();
      var card = el("div", "rgc");
      card.appendChild(el("h4", null, (opts.from ? opts.from + " picked" : "Your gift suggests") + ": " + product.title));
      card.appendChild(el("p", "rgc-sub",
        product.blurb + " From " + product.merchant + ". Take it, or keep the value: your balance covers either."));

      // variant picker (only when there is a real choice)
      var variantSel = null;
      if ((product.variants || []).length > 1) {
        var vWrap = el("div", "rgc-row");
        var vLab = el("label", null, "Choice"); vLab.style.flex = "0 0 70px";
        variantSel = el("select");
        product.variants.forEach(function (v) {
          var o = el("option", null, v.label); o.value = v.id; variantSel.appendChild(o);
        });
        vWrap.appendChild(vLab); vWrap.appendChild(variantSel);
        card.appendChild(vWrap);
      }

      // optional address block: best-effort merchant-checkout prefill only
      var det = el("details");
      det.appendChild(el("summary", null, "Add shipping address (optional, prefills the checkout)"));
      var grid = el("div", "rgc-grid");
      var fields = [
        ["firstName", "First name"], ["lastName", "Last name"],
        ["address1", "Address", "wide"], ["address2", "Apt / unit (optional)", "wide"],
        ["city", "City"], ["zip", "Postcode"], ["province", "State / region"], ["country", "Country"],
        ["email", "Email (for the order receipt)", "wide"],
      ];
      var inputs = {};
      fields.forEach(function (f) {
        var i = el("input", f[2] || ""); i.placeholder = f[1]; i.autocomplete = "on";
        inputs[f[0]] = i; grid.appendChild(i);
      });
      det.appendChild(grid);
      card.appendChild(det);

      var go = el("button", "rgc-go", "Continue to " + product.merchant.replace(/\s*\(PLACEHOLDER\)/i, "") + " checkout →");
      var price = el("div", "rgc-price",
        "$" + product.priceUSD + " item · your balance was funded with $" + product.fundUSD + " to cover shipping");
      card.appendChild(price);
      card.appendChild(go);

      var skip = el("button", "rgc-skip", "Keep it as balance instead");
      card.appendChild(skip);
      card.appendChild(el("p", "rgc-note",
        "Checkout happens on the merchant's own page and settles in USDC on Base from your wallet. " +
        "Anything unspent stays in your balance. Your address goes to the merchant only, never the sender."));

      skip.addEventListener("click", function () { card.remove(); });

      go.addEventListener("click", async function () {
        go.disabled = true; go.textContent = "Preparing checkout…";
        try {
          var params = { mandateId: "g-" + productId };
          if (variantSel) params.variantId = variantSel.value;
          Object.keys(inputs).forEach(function (k) { if (inputs[k].value.trim()) params[k] = inputs[k].value.trim(); });
          var r = await window.giiiftRetailResolve(productId, params);
          if (r && r.url && r.executable) {
            if (window.giiift && window.giiift.track) window.giiift.track("retail_checkout_open", { productId: productId });
            var win = openCheckout(r.url);
            if (!win) {
              // popup blocked -> full navigation to the SAME merchant checkout (still light: their rail)
              if (window.giiift && window.giiift.track) window.giiift.track("retail_checkout_popup_blocked", { productId: productId });
              window.location.href = r.url;
              return;
            }
            go.style.display = "none"; skip.style.display = "none";
            go.textContent = "Checkout opened ↗ finish there";
            price.textContent = "Finish in the checkout window. Anything unspent stays in your balance.";
            mountBridgeRow(card, productId);
            mountReturnRow(card, productId, r.url, win);
          } else {
            // dormant or merchant-not-live: honest state, balance remains the gift
            go.textContent = "Not available yet: it stays in your balance";
            if (window.giiift && window.giiift.track) window.giiift.track("retail_claim_dormant", { productId: productId, reason: (r && r.reason) || "" });
          }
        } catch (e) {
          go.textContent = "Not available yet: it stays in your balance";
        }
        setTimeout(function () { go.disabled = false; }, 1200);
      });

      mount.appendChild(card);
      if (window.giiift && window.giiift.track) window.giiift.track("retail_claim_card", { productId: productId });
      return true;
    } catch (e) {
      return false;                                     // never let retail break a claim
    }
  }

  window.giiiftRetailClaimCard = mountCard;
})();
