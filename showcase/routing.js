/* GIIIFT — silent cross-chain routing (thesis §4 "the one hard wrinkle"). LIVE as of
 * marketplace M4, scaffold kept as the §8 fallback.
 *
 * The shopper's balance might be USDC on Base; Collector Crypt wants SOL/USDC on
 * Solana; MNSTR settles USDm on MegaETH. "Buy with us" therefore needs a quiet
 * cross-chain hop. We do this through a THIRD-PARTY BRIDGE (LI.FI), executed from
 * the user's own wallet — so GIIIFT *routes*, it never acts as exchanger or
 * custodies funds (the compliance wedge).
 *
 *   window.giiiftRouteQuote({ fromChain, fromToken, toChain, toToken, amountUSD, wallet })
 *     -> { ok, usd, route, etaSeconds, feeUSD, provider, executable, transactionRequest? }
 *   window.giiiftRouteExecute(quote, wallet) -> { hash }   // EVM legs, the user signs
 *
 * LIVE path: li.quest/v1/quote (keyless, CORS-friendly), only attempted when a wallet
 * address is present (LI.FI requires fromAddress). Any failure — offline, unsupported
 * chain, no wallet — degrades to the structured scaffold quote so the buy-sheet UX
 * renders identically. execute() sends the quote's transactionRequest from the user's
 * own wallet via window.giiiftSendTransaction (the nft-buy.js seam); non-EVM
 * destination legs stay quote-only until a Solana signer is wired.
 */
(function () {
  // chain hints: EVM ids are numbers; LI.FI addresses Solana by key
  var CHAINS = { Base: 8453, Ethereum: 1, Solana: "SOL", MegaETH: "megaeth", BSC: 56 };
  var LIFI_SUPPORTED = { Base: true, Ethereum: true, BSC: true, Solana: true };

  function scaffold(req) {
    // ~0.3% routing fee, a few seconds; same-chain is free/instant. Shape is final.
    var sameChain = req.fromChain === req.toChain;
    var feeUSD = sameChain ? 0 : Math.max(0.25, +(req.amountUSD * 0.003).toFixed(2));
    return {
      ok: true,
      usd: req.amountUSD,
      feeUSD: feeUSD,
      etaSeconds: sameChain ? 2 : 18,
      provider: sameChain ? "direct" : "li.fi",
      route: sameChain
        ? [req.fromChain]
        : [req.fromChain + " " + (req.fromToken || "USDC"), "→ bridge →", req.toChain + " " + (req.toToken || "USDC")],
      executable: false, // a live LI.FI quote with a transactionRequest flips this true
    };
  }

  async function getQuote(req) {
    if (req.fromChain === req.toChain) return scaffold(req);
    if (!req.wallet || !LIFI_SUPPORTED[req.fromChain] || !LIFI_SUPPORTED[req.toChain]) return scaffold(req);
    try {
      // USDC legs are 6-decimals; symbols are accepted so no token-address table needed
      var r = await fetch("https://li.quest/v1/quote?" + new URLSearchParams({
        fromChain: String(CHAINS[req.fromChain]), toChain: String(CHAINS[req.toChain]),
        fromToken: req.fromToken || "USDC", toToken: req.toToken || "USDC",
        fromAmount: String(Math.round(req.amountUSD * 1e6)),
        fromAddress: req.wallet,
      }));
      if (!r.ok) return scaffold(req);
      var j = await r.json();
      var est = j.estimate || {};
      var fees = 0;
      (est.feeCosts || []).forEach(function (f) { fees += Number(f.amountUSD || 0); });
      (est.gasCosts || []).forEach(function (g) { fees += Number(g.amountUSD || 0); });
      return {
        ok: true,
        usd: req.amountUSD,
        feeUSD: +fees.toFixed(2),
        etaSeconds: Number(est.executionDuration || 18),
        provider: "li.fi" + (j.tool ? ":" + j.tool : ""),
        route: [req.fromChain + " " + (req.fromToken || "USDC"), "→ " + (j.tool || "bridge") + " →", req.toChain + " " + (req.toToken || "USDC")],
        executable: !!(j.transactionRequest && typeof CHAINS[req.fromChain] === "number"),
        transactionRequest: j.transactionRequest || null,
        // M9 pickup (audit 2.8): what the allowance leg needs to run before the bridge tx
        approvalAddress: est.approvalAddress || null,
        fromTokenAddress: (j.action && j.action.fromToken && j.action.fromToken.address) || null,
        fromAmount: est.fromAmount || String(Math.round(req.amountUSD * 1e6)),
      };
    } catch (e) { return scaffold(req); }
  }

  // ---- ERC-20 allowance leg (audit 2.8) ------------------------------------
  // LI.FI's transactionRequest pulls the source token via transferFrom, so a fresh
  // wallet reverts until the quote's approvalAddress is approved for fromAmount.
  // Read the current allowance through the user's own provider when it exposes
  // eth_call; if the read is unavailable/fails we still send the approve (a
  // redundant approve is a cent of gas on Base; a skipped one reverts the leg).
  var NATIVE_TOKEN = /^0x0{40}$|^0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee$/i;
  function pad32(hex) { var h = String(hex || "").replace(/^0x/, "").toLowerCase(); return ("0".repeat(64) + h).slice(-64); }
  function allowanceData(owner, spender) { return "0xdd62ed3e" + pad32(owner) + pad32(spender); }
  function approveData(spender, amount) { return "0x095ea7b3" + pad32(spender) + pad32(BigInt(amount).toString(16)); }

  async function ensureAllowance(quote, wallet) {
    if (!quote || !quote.fromTokenAddress || NATIVE_TOKEN.test(quote.fromTokenAddress)) return { needed: false, reason: "native-or-unknown-token" };
    if (!quote.approvalAddress) return { needed: false, reason: "no-approval-address" };
    var want;
    try { want = BigInt(quote.fromAmount || "0"); } catch (e) { want = BigInt(0); }
    if (want <= BigInt(0)) return { needed: false, reason: "zero-amount" };

    var current = null;
    var prov = window.giiiftWalletProvider;
    if (wallet && prov && typeof prov.request === "function") {
      try {
        var res = await prov.request({
          method: "eth_call",
          params: [{ to: quote.fromTokenAddress, data: allowanceData(wallet, quote.approvalAddress) }, "latest"],
        });
        if (typeof res === "string" && /^0x[0-9a-fA-F]*$/.test(res)) current = BigInt(res === "0x" ? "0x0" : res);
      } catch (e) { current = null; }   // unreadable -> approve anyway (comment above)
    }
    if (current !== null && current >= want) return { needed: false, allowance: current.toString() };

    if (typeof window.giiiftSendTransaction !== "function") throw new Error("no-wallet");
    var chainId = Number(quote.transactionRequest && quote.transactionRequest.chainId) || 8453;
    var approveHash = await window.giiiftSendTransaction(
      { to: quote.fromTokenAddress, data: approveData(quote.approvalAddress, want), value: "0x0" },
      { chainId: chainId }
    );
    return { needed: true, approveHash: approveHash };
  }

  async function execute(quote, wallet) {
    if (!quote || !quote.executable || !quote.transactionRequest) throw new Error("quote not executable — re-quote with a connected wallet");
    if (typeof window.giiiftSendTransaction !== "function") throw new Error("no-wallet");
    // ERC-20 source legs: approve the bridge's spender first (audit 2.8)
    var approval = await ensureAllowance(quote, wallet || null);
    // the user's OWN wallet signs the bridge tx (EVM source legs; Privy covers them)
    var tx = quote.transactionRequest;
    var hash = await window.giiiftSendTransaction(
      { to: tx.to, data: tx.data, value: tx.value || "0x0", gasLimit: tx.gasLimit },
      { chainId: Number(tx.chainId) || 8453 }
    );
    return approval && approval.approveHash ? { hash: hash, approveHash: approval.approveHash } : { hash: hash };
  }

  window.giiiftRouteQuote = getQuote;
  window.giiiftRouteExecute = execute;
  window.giiiftRouteEnsureAllowance = ensureAllowance;   // exposed for rails + the test gate
  window.GIIIFT_CHAINS = CHAINS;
})();
