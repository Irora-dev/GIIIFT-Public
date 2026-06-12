/* GIIIFT Marketplace — the receive-page spend shelf (M3, spec §6/§12 surface 4).
 *
 * When a gift carries a storefront ref (payload g.sr -> gift.shopRef), the reveal
 * gets a bare engine strip under the manifest: "[sender]'s picks", the sender's
 * own curation, with their attribution riding every item into the cart. The gift
 * does not just hand value over; it hands taste over.
 *
 * Self-sufficient: box.html stays light. This module lazy-loads its own deps
 * (engine, cards, sources, checkout, storefront lib) the first time it runs, and
 * it NEVER throws into the claim flow: any failure renders nothing.
 *
 * Dark by default: no payload carries g.sr until the wrap/send side stamps it
 * (GIIIFTStorefront.sendPayloadField). A bad/unknown ref falls back to the
 * GIIIFT editorial shelf only when opts.editorialFallback is set; otherwise
 * nothing renders and the claim is exactly what it was before.
 */
(function (global) {
  "use strict";
  var loading = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.async = false;          // preserve order across the dep chain
      s.onload = resolve; s.onerror = function () { reject(new Error("load " + src)); };
      document.head.appendChild(s);
    });
  }
  function ensureDeps() {
    if (global.GIIIFTMarket && global.GIIIFTStorefront && global.GIIIFTMarket.cartApi) return Promise.resolve();
    if (loading) return loading;
    var chain = [];
    if (!global.GIIIFTMarket) chain.push("/showcase/market-engine.js", "/showcase/market-cards.js", "/showcase/market-sources.js");
    if (!global.GIIIFTMarket || !global.GIIIFTMarket.cartApi) chain.push("/showcase/market-checkout.js");
    if (!global.GIIIFTStorefront) chain.push("/market-storefront.js");
    loading = chain.reduce(function (p, src) { return p.then(function () { return loadScript(src); }); }, Promise.resolve());
    return loading;
  }

  /* ---- pick-one (M6, §13b): the sender chose up to 3; the recipient chooses ONE ---- */
  var PICK_KEY = "giiift-pickone";   // { <ids joined>: chosenId } — survives reloads, per device
  function pickStore() { try { return JSON.parse(localStorage.getItem(PICK_KEY)) || {}; } catch (e) { return {}; } }
  function pickWrite(k, id) { try { var s = pickStore(); s[k] = id; localStorage.setItem(PICK_KEY, JSON.stringify(s)); } catch (e) {} }

  async function pickOneShelf(opts) {
    var GM = global.GIIIFTMarket;
    var ids = (opts.pickOne || []).slice(0, 3);
    var key = ids.slice().sort().join("|");
    var chosen = pickStore()[key] || null;
    // Part 3 3.6: the sender name is payload-controlled — escape happens downstream,
    // but cap the LENGTH here so a hostile 10k-char name can't wreck the layout
    var from = String((opts && opts.from) || "they").slice(0, 40);

    var host = document.createElement("div");
    host.style.marginTop = "26px";
    opts.mount.appendChild(host);
    GM.track("receive_shelf", { pickOne: ids.length, decided: !!chosen });

    var note = document.createElement("div");
    note.style.cssText = "margin:0 0 2px;font:600 13px Inter,sans-serif;color:rgba(238,240,244,.85)";
    host.appendChild(note);

    function paint() {
      note.textContent = chosen
        ? "You chose — it's yours. " + from + " picked well."
        : from + " picked " + ids.length + " — choose the ONE you want.";
      var old = host.querySelector(".gmk"); if (old) old.remove();
      var inner = document.createElement("div");
      host.appendChild(inner);
      GM.mount(inner, {
        key: "pick-one",
        bare: true, hero: false, search: false, sort: false, cart: false, credit: false,
        eyebrow: chosen ? "Your pick" : "Pick one · a gift from " + from,
        onPickLabel: chosen ? "Yours ✓" : "Choose this one",
        onPick: function (item) {
          if (chosen) return false;                    // decided is decided
          chosen = item.id; pickWrite(key, item.id);
          GM.track("pickone_choice", { id: item.id });
          paint();
          return true;
        },
        shelves: [{ kind: "row", title: chosen ? "You chose" : "One of these is yours",
          note: chosen ? "" : "tap to decide", query: { ids: chosen ? [chosen] : ids } }],
      });
    }
    paint();
    return true;
  }

  /**
   * Mount the shelf. opts: { mount, shopRef?, pickOne?, from?, editorialFallback? }
   * pickOne (M6) renders the choose-one strip and wins over the storefront shelf.
   * Resolves true when a shelf rendered, false when it (silently) did not.
   */
  async function spendShelf(opts) {
    try {
      var mountEl = opts && opts.mount; if (!mountEl) return false;
      var shopRef = String((opts && opts.shopRef) || "").toLowerCase();
      if (opts && opts.pickOne && opts.pickOne.length) {
        await ensureDeps();
        return await pickOneShelf(opts);
      }
      if (!shopRef && !(opts && opts.editorialFallback)) return false;
      await ensureDeps();
      var GM = global.GIIIFTMarket, SF = global.GIIIFTStorefront;

      var doc = shopRef ? await SF.get(shopRef).catch(function () { return null; }) : null;
      if (doc && doc.status !== "live") doc = null;
      if (!doc && !(opts && opts.editorialFallback)) return false;

      var host = document.createElement("div");
      host.style.marginTop = "26px";
      mountEl.appendChild(host);

      if (doc) {
        var from = String((opts && opts.from) || doc.name || doc.handle).slice(0, 40);   // Part 3 3.6
        GM.track("receive_shelf", { handle: doc.handle, demo: !!doc.demo });
        GM.mount(host, Object.assign(SF.viewConfig(doc, {
          eyebrow: from + " picked these",
          title: "Spend it like " + from + " would",
          search: false, sort: false, cart: false, credit: false,
        }), {
          // the reveal strip is ONE row of their first pins; the full storefront is a tap away
          shelves: [{ kind: "row", title: from + "'s picks", note: "from their storefront",
            query: { ids: (doc.shelves[0] || { items: [] }).items.slice(0, 8) } }],
        }));
        var more = document.createElement("a");
        more.href = "/s/" + doc.handle;
        more.textContent = "See all of " + from + "'s picks →";
        more.style.cssText = "display:inline-block;margin-top:4px;color:" + doc.theme.accent + ";font:600 13px Inter,sans-serif;text-decoration:none";
        host.appendChild(more);
      } else {
        GM.track("receive_shelf", { editorial: true });
        GM.mount(host, { bare: true, hero: false, search: false, sort: false, cart: false, credit: false,
          eyebrow: "Spend it well", title: "",
          shelves: [{ kind: "row", title: "Worth a look", note: "from the GIIIFT shop", query: { sort: "editorial", limit: 8 } }] });
      }
      return true;
    } catch (e) {
      return false;                          // never let the shelf break a claim
    }
  }

  global.giiiftMarketReceiveShelf = spendShelf;
})(typeof window !== "undefined" ? window : this);
