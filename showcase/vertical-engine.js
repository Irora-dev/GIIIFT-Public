/* GIIIFT - vertical funnel engine
 * ===========================================================================
 * One identity per audience, carried through the WHOLE journey: landing page,
 * wrap/send flow (suggested assets, recommended looks, copy, send animation),
 * the receive page (intro, copy, aurora), and the shop (shelves, spotlight,
 * boosted catalog). A "vertical" is a declarative config pack; pages stay
 * generic and ask this engine what to show.
 *
 * Load order: this file is a BLOCKING script (no defer), loaded right after
 * supabase-config.js and before any vertical pack + page inline script, so
 * parse-time scripts can resolve copy/theme synchronously.
 *
 * ── registering a vertical ─────────────────────────────────────────────────
 *   GIIIFTVertical.register({
 *     id: 'tcg',                    // [a-z0-9-], unique
 *     extends: 'core',              // inherit + sparsely override another vertical
 *     label: 'Trading Cards',
 *     tagline: 'Send a pack to crack',
 *     match: {
 *       paths:    ['/tcg','/cards'],          // landing paths that select it
 *       aliases:  ['cards','trading-cards'],  // extra ?v= values that map here
 *       keywords: ['pokemon','booster'],      // inference: note/message text
 *       tickers:  ['NFT'],                    // inference: gifted asset tickers
 *       rank: 10,                             // inference tie-break (higher wins)
 *     },
 *     theme: { hues:[..], vars:{'--accent-ui':..}, set:{c1,c2,accent} },
 *     copy:  { wrap:{..}, receive:{..}, shop:{..}, status:{send:[..], wormhole:[..]} },
 *     wrap:  { suggested:[..], quickAmounts:[..], defaults:{..}, presets:[..],
 *              patterns:[..], stickers:{featured:[..]}, panels:{featured:[..]} },
 *     transitions: { weights:{wormhole:2}, prefer:null },
 *     receive: { aurora:{c1,c2,accent}, unlock:{voice,theme} },
 *     shop:  { shelves:[..], boost:{game:[..]}, spotlight:[..] },
 *     landing: { eyebrow, title, sub, chips:[..], boxPreview:{..}, featured:[..] },
 *   });
 *
 * ── how the active vertical is decided (first source that answers wins) ────
 *   1. explicit URL param   ?v=tcg / ?vertical=tcg   (?v=core|off|0 clears)
 *   2. path                 /tcg (registered match.paths) or /v/tcg
 *   3. gift payload         the sender's vertical travels inside the gift
 *                           (pages pass it via resolve({ payload: id }))
 *   4. inference            keywords/tickers scored against the gift contents
 *   5. sticky session       last explicit/path/payload hit (24h, localStorage);
 *                           SKIPPED in demo mode (giiift-demo) — the showcase is
 *                           multi-partner, so only the walked link picks the voice
 *   6. 'core'               the plain GIIIFT experience
 * Sources 1-4 persist to the session, so the identity follows the user from
 * landing → wrap → receive → shop without every link carrying a param.
 *
 * ── page API ───────────────────────────────────────────────────────────────
 *   V.resolve(hints?)       (re)compute the active vertical. hints:
 *                           { payload:'tcg', items:['USDC','NFT ..'], text:['note',..] }
 *   V.id() / V.active()     active id / merged config
 *   V.is('tcg')             true for 'tcg' AND anything that extends it
 *   V.get('copy.wrap.fillTitle')           merged deep lookup (undefined if absent)
 *   V.text('copy.receive.spendCta', {amount:'$50'})   lookup + {token} fill
 *   V.applyTheme()          CSS vars + brand hues + borealis set colours
 *   V.applyTransitions(GIIIFTFinalize)     per-vertical weights / preferred fx
 *   V.stamp(payload)        adds payload.v = id (non-core), for the gift link
 *   V.link('/showcase/wrap.html')         href with ?v= appended when a vertical is active
 *   V.list() / V.find(id)   registered verticals / merged config for any id
 *   V.clear()               drop stickiness, back to core
 *   V.on(fn)                change listener; also fires 'giiift:vertical' on document
 * =========================================================================== */
(function () {
  'use strict';

  var STORE_KEY = 'giiift-vertical';
  var SESSION_TTL = 24 * 60 * 60 * 1000;   // sticky for a day, then back to core
  var INFER_MIN_SCORE = 2;                 // inference must clear this to fire

  var defs = {};          // id -> raw registered def
  var mergedCache = {};   // id -> merged config (invalidated on register)
  var activeId = 'core';
  var activeSource = 'default';
  var listeners = [];

  /* ---------- tiny utils ---------- */
  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function deepMerge(base, over) {
    // objects merge recursively; arrays + scalars REPLACE (predictable overrides)
    var out = {};
    var k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    for (k in over) {
      if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
      out[k] = (isObj(base[k]) && isObj(over[k])) ? deepMerge(base[k], over[k]) : over[k];
    }
    return out;
  }
  function readStore() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var rec = JSON.parse(raw);
      if (!rec || !rec.id || !defs[rec.id]) return null;
      if (rec.at && (Date.now() - rec.at) > SESSION_TTL) return null;
      return rec;
    } catch (e) { return null; }
  }
  function writeStore(id, src) {
    try {
      if (id === 'core') localStorage.removeItem(STORE_KEY);
      else localStorage.setItem(STORE_KEY, JSON.stringify({ id: id, src: src, at: Date.now() }));
    } catch (e) {}
  }
  function cleanId(v) {
    v = String(v == null ? '' : v).toLowerCase().trim();
    return /^[a-z0-9-]{1,24}$/.test(v) ? v : '';
  }

  /* ---------- merged config (walk the extends chain, root first) ---------- */
  function chainOf(id) {
    var chain = [], seen = {};
    var cur = id;
    while (cur && defs[cur] && !seen[cur]) {
      seen[cur] = true;
      chain.unshift(defs[cur]);
      cur = defs[cur].extends;
    }
    return chain;   // [root .. leaf]
  }
  function merged(id) {
    if (!defs[id]) id = 'core';
    if (mergedCache[id]) return mergedCache[id];
    var out = {};
    chainOf(id).forEach(function (def) { out = deepMerge(out, def); });
    out.id = id;   // the merge would otherwise leave the leaf id anyway; be explicit
    out.hidden = !!defs[id].hidden;   // NOT heritable: core is hidden, its children aren't
    mergedCache[id] = out;
    return out;
  }

  /* ---------- resolution sources ---------- */
  function aliasToId(v) {
    v = cleanId(v);
    if (!v) return '';
    if (defs[v]) return v;
    for (var id in defs) {
      var m = defs[id].match || {};
      if ((m.aliases || []).indexOf(v) !== -1) return id;
    }
    return '';
  }
  function fromParam() {
    var v = null;
    try {
      var p = new URLSearchParams(location.search);
      v = p.get('v') || p.get('vertical');
    } catch (e) {}
    if (v == null) return null;
    var c = String(v).toLowerCase().trim();
    if (c === 'core' || c === 'off' || c === '0' || c === 'none') return { id: 'core', src: 'param', clear: true };
    var id = aliasToId(c);
    return id ? { id: id, src: 'param' } : null;
  }
  function fromPath() {
    var path = '';
    try { path = String(location.pathname || '').replace(/\/+$/, '') || '/'; } catch (e) {}
    var vMatch = path.match(/^\/v\/([a-z0-9-]{1,24})$/i);            // generic /v/<id>
    if (vMatch) { var vid = aliasToId(vMatch[1]); if (vid) return { id: vid, src: 'path' }; }
    for (var id in defs) {
      var paths = (defs[id].match || {}).paths || [];
      for (var i = 0; i < paths.length; i++) {
        if (path === String(paths[i]).replace(/\/+$/, '')) return { id: id, src: 'path' };
      }
    }
    return null;
  }
  function fromPayload(hints) {
    var id = hints && aliasToId(hints.payload);
    return id ? { id: id, src: 'payload' } : null;
  }
  function fromInference(hints) {
    if (!hints) return null;
    var hayItems = (hints.items || []).join(' ').toLowerCase();
    var hayText = (hints.text || []).filter(Boolean).join(' ').toLowerCase();
    if (!hayItems && !hayText) return null;
    var best = null;
    for (var id in defs) {
      if (id === 'core') continue;
      var m = defs[id].match || {};
      var score = 0;
      (m.keywords || []).forEach(function (kw) {
        kw = String(kw).toLowerCase();
        if (kw && (hayText.indexOf(kw) !== -1 || hayItems.indexOf(kw) !== -1)) score += 2;
      });
      (m.tickers || []).forEach(function (tk) {
        tk = String(tk).toLowerCase();
        if (tk && hayItems.indexOf(tk) !== -1) score += 1;
      });
      if (score >= INFER_MIN_SCORE) {
        var rank = m.rank || 0;
        if (!best || score > best.score || (score === best.score && rank > best.rank)) {
          best = { id: id, score: score, rank: rank };
        }
      }
    }
    return best ? { id: best.id, src: 'infer' } : null;
  }
  // Demo mode (the public showcase sets giiift-demo on every page): the showcase is
  // multi-partner, not a TCG site, so a vertical must come from the LINK being walked
  // (?v=, /tcg path, payload v, or the gift's own content) — never from a sticky
  // session left by an earlier walk. Without this, one /tcg visit re-voices every
  // later generic reveal ("Pick your card") for 24h.
  function isDemo() {
    try { return localStorage.getItem('giiift-demo') === '1'; } catch (e) { return false; }
  }
  function fromSession() {
    if (isDemo()) return null;
    var rec = readStore();
    return rec ? { id: rec.id, src: 'session' } : null;
  }

  function notify() {
    listeners.forEach(function (fn) { try { fn(api.active()); } catch (e) {} });
    try { document.dispatchEvent(new CustomEvent('giiift:vertical', { detail: { id: activeId, source: activeSource } })); } catch (e) {}
  }

  /* ---------- public api ---------- */
  var api = {
    register: function (def) {
      if (!def || !cleanId(def.id)) { console.warn('[GIIIFT] ignoring invalid vertical', def); return api; }
      defs[def.id] = def;
      mergedCache = {};   // configs are merged lazily; new packs invalidate everything
      return api;
    },

    resolve: function (hints) {
      var hit = fromParam() || fromPath() || fromPayload(hints) || fromInference(hints) || fromSession()
        || { id: 'core', src: 'default' };
      if (hit.clear) writeStore('core', 'param');
      else if (!isDemo() && hit.src !== 'session' && hit.src !== 'default') writeStore(hit.id, hit.src);
      var changed = hit.id !== activeId;
      activeId = hit.id;
      activeSource = hit.src;
      if (changed) notify();
      return api.active();
    },

    id: function () { return activeId; },
    source: function () { return activeSource; },
    active: function () { return merged(activeId); },
    find: function (id) { return defs[cleanId(id)] ? merged(cleanId(id)) : null; },
    list: function () {
      var out = [];
      for (var id in defs) { var c = merged(id); out.push({ id: id, label: c.label || id, tagline: c.tagline || '', hidden: !!c.hidden }); }
      return out;
    },
    is: function (id) {
      id = cleanId(id);
      var cur = activeId;
      var seen = {};
      while (cur && !seen[cur]) {
        if (cur === id) return true;
        seen[cur] = true;
        cur = defs[cur] && defs[cur].extends;
      }
      return false;
    },

    get: function (path, fallback) {
      var node = merged(activeId);
      var parts = String(path || '').split('.');
      for (var i = 0; i < parts.length; i++) {
        if (node == null) return fallback;
        node = node[parts[i]];
      }
      return node == null ? fallback : node;
    },

    text: function (path, tokens) {
      var s = api.get(path);
      if (typeof s !== 'string') return '';
      if (tokens) {
        s = s.replace(/\{(\w+)\}/g, function (_, k) { return tokens[k] != null ? String(tokens[k]) : ''; });
        s = s.replace(/\s{2,}/g, ' ').trim();
      }
      return s;
    },

    // CSS vars + brand hues + borealis set colours, in one call. Safe pre-DOM-ready
    // (documentElement always exists by script time).
    applyTheme: function () {
      var th = api.get('theme') || {};
      var root = document.documentElement;
      root.setAttribute('data-vertical', activeId);
      if (th.vars) for (var k in th.vars) { try { root.style.setProperty(k, th.vars[k]); } catch (e) {} }
      if (th.hues && th.hues.length) {
        window.GIIIFT_BRAND_HUES = th.hues;
        if (window.giiiftBrand && window.giiiftBrand.apply) { try { window.giiiftBrand.apply(); } catch (e) {} }
      }
      if (th.set) {
        window.GIIIFT_SET = window.GIIIFT_SET || {};
        if (!window.GIIIFT_SET.colors) window.GIIIFT_SET.colors = {};
        window.GIIIFT_SET.colors.c1 = th.set.c1 || window.GIIIFT_SET.colors.c1;
        window.GIIIFT_SET.colors.c2 = th.set.c2 || window.GIIIFT_SET.colors.c2;
        window.GIIIFT_SET.colors.accent = th.set.accent || window.GIIIFT_SET.colors.accent;
        if (window.GIIIFTSet && window.GIIIFTSet.setColors) {
          try { window.GIIIFTSet.setColors(th.set.c1, th.set.c2, th.set.accent); } catch (e) {}
        }
      }
      return api;
    },

    // Per-vertical send-animation behaviour: reweight the registered transitions
    // and (optionally) prefer one outright. ?fx= still wins for QA.
    applyTransitions: function (engine) {
      engine = engine || window.GIIIFTFinalize;
      var t = api.get('transitions') || {};
      if (engine && engine.transitions && t.weights) {
        engine.transitions.forEach(function (tr) {
          if (t.weights[tr.id] != null) tr.weight = t.weights[tr.id];
        });
      }
      var forced = null;
      try { forced = new URLSearchParams(location.search).get('fx'); } catch (e) {}
      if (t.prefer && !forced && !window.__forceFx) window.__forceFx = t.prefer;
      return api;
    },

    // Stamp the vertical into an outgoing gift payload (receive side resolves it).
    stamp: function (payload) {
      if (payload && activeId !== 'core') payload.v = activeId;
      return payload;
    },

    // Internal-link helper: carry the vertical explicitly (?v=) so the link is
    // shareable; same-browser hops would survive on the session alone.
    link: function (url) {
      if (activeId === 'core') return url;
      return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(activeId);
    },

    // Encode a compact gift payload ({t,f,m,n,i,d}) into a self-contained receive
    // link, stamping the active vertical. Used for landing demo gifts and tests;
    // mirrors wrap.html's encoder exactly.
    giftLink: function (compact) {
      compact = compact || {};
      api.stamp(compact);
      var token = 'demo';
      try {
        token = btoa(unescape(encodeURIComponent(JSON.stringify(compact))))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      } catch (e) {}
      return '/showcase/box.html?g=' + token;
    },

    // Stable-sort catalog-shaped items so the vertical's games come first
    // (shop.boost.games). Shared by the shop rows and the receive page's
    // "what your credit becomes" strip.
    boostItems: function (list) {
      var boost = api.get('shop.boost');
      if (!boost || !boost.games || !list || !list.length) return list || [];
      var rank = function (it) {
        var i = boost.games.indexOf(it && it.game);
        return i === -1 ? boost.games.length : i;
      };
      return list.map(function (it, i) { return [it, i]; })
        .sort(function (a, b) { return (rank(a[0]) - rank(b[0])) || (a[1] - b[1]); })
        .map(function (p) { return p[0]; });
    },

    clear: function () { writeStore('core', 'clear'); activeId = 'core'; activeSource = 'default'; notify(); return api; },
    on: function (fn) { if (typeof fn === 'function') listeners.push(fn); return api; },
  };

  /* ───────────────────────── the core vertical ─────────────────────────────
   * The plain GIIIFT experience, expressed as config. Every string the pages
   * read through the engine lives here, so a vertical pack only overrides the
   * slots it cares about and everything else falls through to this. */
  api.register({
    id: 'core',
    label: 'GIIIFT',
    tagline: 'Send a gift, by link',
    hidden: true,   // not a marketing tile; it IS the default site
    theme: {
      // brand.js falls back to its own cool hues when this is absent
      set: { c1: '#7c3aed', c2: '#ec4899', accent: '#fde68a' },
    },
    copy: {
      // per-vertical display names for asset tickers (e.g. tcg renames NFT →
      // "Card pick"); applied on the wrap picker AND the receive manifest, so
      // both ends of a gift read in the same voice. Payloads still store tickers.
      assets: {},
      wrap: {
        docTitle: 'GIIIFT - Wrap a box',
        // step numbers follow the wrap flow order: NAME → DESIGN → FILL → NOTE → SEND
        nameBtn: 'Design the box →',
        nameHint: 'Tell us who it’s for, then dress the box for them.',
        designBtn: 'Fill the box →',
        fillEyebrow: '// step 3',
        fillTitle: 'Fill the box',
        fillSub: 'Search a coin or token, set an amount, and drop it into the open box.',
        searchPh: 'Search assets - BTC, Solana…',
        suggestTitle: '',                       // no suggestion rail on core
        amountLabel: 'How much?',
        addBtn: 'Drop it in',
        insideTitle: 'Inside the box',
        emptyNote: 'empty, drop something in',
        sealBtn: 'Seal the box →',
        sealingBtn: 'Sealing…',
        sealHintEmpty: 'Add at least one asset to seal.',
        sealHintReady: '{count} item{s} inside · ready to seal',
        textEyebrow: '// step 4 · note',
        textTitle: 'Add a note',
        textSub: 'The words that ride the box - they appear live as you type.',
        brandPh: 'Name Here',
        sublabelPh: 'A GIFT FOR YOU',
        notePh: 'with love',
        textHint: 'Add your note, then finalize your gift.',
        valueGuide: '',                        // verticals: "$50 ≈ a graded holo · $120 ≈ vintage" (hidden when empty)
        occasionTitle: 'Occasion',
        occasionHint: 'Optional · shapes what the shop shows them after they claim',
        notePromptsTitle: 'Need a line?',
        designEyebrow: '// step 2 · design',
        designTitle: 'Design the box',
        designSub: 'A designed box, or your own colours and pattern.',
        designHint: 'Pick a box design or your own colours, then fill it.',
        finalizeBtn: 'Finalize →',
        readyTitle: 'Your gift<br>is ready.',
        readySub: 'Email, phone, a link, their wallet, or a social handle. We handle the rest.',
        wrappedFor: 'Wrapped for {to} · {count} item{s}.',
        previewLabel: 'Preview the box',
      },
      receive: {
        docTitle: "You've got a gift - GIIIFT",
        prelude: 'You have a delivery on its way…',
        armedStatus: 'Delivered · tap to open',
        tapHint: 'Tap your gift to open',
        eyebrow: 'Your gift has arrived',
        openCta: 'Open your gift →',
        openingCta: 'Opening…',
        claimingCta: 'Claiming…',
        savedCta: 'Save to vault →',
        viewVaultCta: 'View in your vault →',
        spendCta: 'Spend your {amount} →',
        spendCtaZero: 'Spend it now →',
        manifestTitle: "What's inside",
        noteEyebrow: 'A note',
        forLabel: 'for',
        becomesTitle: 'Your {amount} → what it becomes',
        becomesNote: 'A taste · the full shop has more',
        trustLine: '',                          // verticals: "Vaulted & insured · redeem-to-ship or ~85% buyback"
        reciprocityCta: 'Send one back to {from} →',
      },
      shop: {
        balanceEyebrow: 'Your balance',
        balanceSub: 'Store credit at the coolest shop in the world. Spend it on graded cards, packs, and art. <b>Buy with GIIIFT, experience anywhere.</b>',
        searchPh: 'Search cards, packs, art, sets…',
        leadShelfTitle: '{occasion} from {from} → what it becomes',
        leadShelfTitleNoFrom: '{occasion} → what it becomes',
        leadNoun: 'Your gift',
        leadShelfNote: 'Hand-picked for what just landed',
        facets: { all: 'All', balance: 'Under your balance', pack: 'Packs', single: 'Cards', art: 'Art & NFTs', saved: '♥ Saved' },
        ripNote: 'Build the suspense in GIIIFT, then we deep-link you to {partner} for the one-by-one reveal. Your pull syncs back to your shelf.',
      },
      status: {
        send: [
          [0, 'Finalizing your GIIIFT', 'Finalizing'],
          [5600, 'Picking up your GIIIFT', 'Picking up'],
          [10400, 'Your GIIIFT is on its way', 'on its way'],
        ],
        wormhole: [
          [0, 'Finalizing your GIIIFT', 'Finalizing'],
          [3600, 'Folding space around it', 'Folding space'],
          [7400, 'Your GIIIFT is on its way', 'on its way'],
        ],
      },
    },
    wrap: {
      suggested: [],
      quickAmounts: ['0.1', '0.5', '1', '5', '10'],
      occasions: ['Birthday', 'Congrats', 'Thank you', 'Just because'],
      notePrompts: [],                          // verticals: one-tap message starters
      defaults: { sublabel: 'A GIFT FOR YOU', model: 'Model: GF-001' },
      presets: [],          // verticals prepend their own; the page keeps its base list
      patterns: null,       // null = leave the page's pattern order alone
      stickers: { featured: [] },
      panels: { featured: [] },
      randomFromPresets: false,
    },
    transitions: { weights: null, prefer: null },
    receive: { aurora: null, unlock: null },
    shop: { shelves: null, boost: null, spotlight: null },
    landing: null,
  });

  window.GIIIFTVertical = api;

  // First resolve happens immediately with URL + session only, so theme/copy are
  // correct at parse time; pages re-resolve with payload/item hints when they
  // know more (the receive page does this after decoding the gift).
  api.resolve();
})();
