/* GIIIFT — shared price lookup.
 *
 * window.giiiftPrices(["BTC","ETH",...]) -> { BTC: 64000.1, ETH: 3500.4, ... }  (USD per unit)
 *
 * Source order:
 *   1) Alchemy, via our server-side proxy at /api/prices (key stays on the server).
 *   2) CoinGecko (keyless) fills any gaps — and is the sole source locally, where
 *      the Netlify edge function isn't running.
 * Any failure just yields fewer/zero prices; callers keep their snapshot values.
 */
(function () {
  // symbol -> CoinGecko id (mirrors the assets offered on the create page)
  var CG = {
    BTC: "bitcoin", ETH: "ethereum", USDC: "usd-coin", USDT: "tether", DAI: "dai",
    SOL: "solana", BNB: "binancecoin", XRP: "ripple", ADA: "cardano", DOGE: "dogecoin",
    AVAX: "avalanche-2", DOT: "polkadot", MATIC: "matic-network", LINK: "chainlink",
    LTC: "litecoin", TRX: "tron", UNI: "uniswap", ATOM: "cosmos", XLM: "stellar",
    ZEC: "zcash", XMR: "monero", NEAR: "near", APT: "aptos", ARB: "arbitrum",
    OP: "optimism", SHIB: "shiba-inu", PEPE: "pepe",
  };

  async function fromProxy(symbols) {
    try {
      var r = await fetch("/api/prices?symbols=" + symbols.join(","), { headers: { accept: "application/json" } });
      if (!r.ok) return {};
      var j = await r.json();
      return (j && j.prices) || {};
    } catch (e) { return {}; }
  }

  async function fromCoinGecko(symbols) {
    var ids = symbols.map(function (s) { return CG[s]; }).filter(Boolean);
    if (!ids.length) return {};
    try {
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, 4000);
      var r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=" + ids.join(",") + "&vs_currencies=usd", { signal: ctrl.signal });
      clearTimeout(timer);
      if (!r.ok) return {};
      var j = await r.json();
      var out = {};
      symbols.forEach(function (s) {
        var id = CG[s];
        if (id && j[id] && j[id].usd != null) out[s] = j[id].usd;
      });
      return out;
    } catch (e) { return {}; }
  }

  window.giiiftPrices = async function (symbols) {
    symbols = Array.from(new Set((symbols || []).map(function (s) { return String(s || "").toUpperCase(); }).filter(Boolean)));
    if (!symbols.length) return {};
    var out = await fromProxy(symbols);
    var missing = symbols.filter(function (s) { return out[s] == null; });
    if (missing.length) {
      var cg = await fromCoinGecko(missing);
      for (var k in cg) out[k] = cg[k];
    }
    return out;
  };
})();
