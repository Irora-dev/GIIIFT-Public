/* GIIIFT - direct NFT buy with a GIIIFT fee-on-top (client side).
 *
 * Pairs with the /api/nft-buy edge function. The split:
 *   - giiiftBuyQuote(item)  -> the transparent price breakdown (item + GIIIFT fee
 *                              = total), computed locally so the UI can always
 *                              show honest pricing, even before execution is wired.
 *   - giiiftBuyNft(item)    -> resolves the real order from /api/nft-buy and signs
 *                              the returned step(s) from the USER'S OWN embedded
 *                              wallet (window.giiiftSendTransaction). NON-CUSTODIAL:
 *                              GIIIFT never holds the buyer's funds; the fee is an
 *                              on-chain recipient baked into the order.
 *
 * Scope = unique NFTs / digital art (the NFT carve-out). Fungible token swaps are
 * deliberately out of scope here and remain gated (see routing.js, quote-only).
 *
 * Both reject with a typed `reason` ('no-wallet' | 'not-enabled' | 'order-…') so
 * the buy sheet can fall back gracefully to the partner link.
 */
(function () {
  var CHAIN_ID = { base: 8453, ethereum: 1 };
  function feeBps() {
    var b = parseInt(window.GIIIFT_FEE_BPS, 10);
    return b > 0 ? b : 250; // 2.5% default; overridable via deploy config
  }
  function chainKey(item) {
    var c = String((item && item.chain) || "base").toLowerCase();
    if (c === "eth" || c === "1" || c === "mainnet") return "ethereum";
    if (c === "8453") return "base";
    return c === "ethereum" ? "ethereum" : "base";
  }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

  // Buyable = a unique on-chain item we can resolve an order for.
  function isBuyable(item) {
    return !!(item && item.buyable && item.contract && item.tokenId != null &&
      (item.priceUSD > 0) && CHAIN_ID[chainKey(item)]);
  }

  // Transparent, local price breakdown for the UI.
  function quote(item) {
    var bps = feeBps();
    var price = Number(item && item.priceUSD) || 0;
    var fee = round2(price * bps / 10000);
    return { itemUSD: round2(price), feeBps: bps, feeUSD: fee, totalUSD: round2(price + fee), currency: "USD" };
  }

  function taker() {
    if (window.giiiftWalletAddress) return window.giiiftWalletAddress;
    try { return (window.giiiftAuth && window.giiiftAuth.user && window.giiiftAuth.user.wallet && window.giiiftAuth.user.wallet.address) || null; }
    catch (e) { return null; }
  }

  function fail(reason, extra) { var e = new Error(reason); e.reason = reason; if (extra) e.detail = extra; return e; }

  // Resolve the order (with fee) and sign it from the user's own wallet.
  async function buy(item) {
    if (!isBuyable(item)) throw fail("not-buyable");
    var who = taker();
    if (!who) throw fail("no-wallet");
    if (typeof window.giiiftSendTransaction !== "function") throw fail("no-wallet");

    var chain = chainKey(item);
    var res;
    try {
      res = await fetch("/api/nft-buy", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ chain: chain, contract: item.contract, tokenId: String(item.tokenId), taker: who, priceUsd: item.priceUSD }),
      });
    } catch (e) { throw fail("not-enabled", String(e)); }
    if (!res || !res.ok) throw fail("not-enabled");

    var data = await res.json();
    if (!data || !data.configured) throw fail("not-enabled", data && data.reason);
    if (!data.executable || !(data.steps && data.steps.length)) throw fail(data && data.reason ? data.reason : "order-unavailable");

    var chainId = data.chainId || CHAIN_ID[chain];
    var hashes = [];
    for (var i = 0; i < data.steps.length; i++) {
      var step = data.steps[i];
      for (var j = 0; j < step.items.length; j++) {
        var tx = step.items[j].data;
        if (!tx || !tx.to) continue;
        // user signs from their own wallet - GIIIFT only handed it the tx
        var hash = await window.giiiftSendTransaction(tx, { chainId: tx.chainId || chainId });
        hashes.push(hash);
      }
    }
    return { ok: true, txHashes: hashes, breakdown: data.breakdown || quote(item), chain: chain };
  }

  window.giiiftBuyQuote = quote;
  window.giiiftBuyNft = buy;
  window.giiiftIsBuyable = isBuyable;
})();
