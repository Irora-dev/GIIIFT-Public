/* GIIIFT vertical pack - TRADING CARDS (+ pokemon / onepiece flavors)
 * ===========================================================================
 * The TCG funnel from docs/TCG_FUNNEL.md, expressed as config: "send a pack
 * to crack". A sender wraps USD store credit as a booster; the recipient rips
 * it open from a link and picks a real graded card up to its value.
 *
 * Three verticals register here:
 *   tcg       the generic trading-card funnel        /tcg  /cards
 *   pokemon   electric flavor, extends tcg           /pokemon
 *   onepiece  grand-line flavor, extends tcg         /onepiece
 *
 * pokemon/onepiece only override what differs (palette, flavor copy, sticker
 * picks, shop boost); everything else falls through tcg, then core. That
 * inheritance chain is the pattern for every future flavor: copy this file's
 * tail, change the slots that matter.
 *
 * Load AFTER vertical-engine.js (blocking, no defer).
 * =========================================================================== */
(function () {
  'use strict';
  var V = window.GIIIFTVertical;
  if (!V) { console.warn('[GIIIFT] vertical engine missing; tcg pack not registered'); return; }

  /* ───────────────────────────── TCG (the base funnel) ─────────────────── */
  V.register({
    id: 'tcg',
    extends: 'core',
    label: 'Trading Cards',
    tagline: 'Send a pack to crack',
    match: {
      paths: ['/tcg', '/cards'],
      aliases: ['cards', 'trading-cards'],
      keywords: ['tcg', 'booster', 'pack to crack', 'graded card', 'holo', 'psa 10', 'rip it'],
      tickers: [],
      rank: 5,
    },
    theme: {
      hues: [266, 286, 46],                                  // violet sky, gold pop
      vars: { '--accent-ui': '#FFD34D' },
      set: { c1: '#7c3aed', c2: '#f59e0b', accent: '#fde68a' },
    },
    copy: {
      assets: { NFT: 'Card pick' },   // the NFT slot reads as a card pick in this flow
      wrap: {
        docTitle: 'GIIIFT - Build their box',
        fillTitle: 'Build their box',
        fillSub: 'Stack pack credit, card picks, and your note in one box. They rip it open from a single link.',
        searchPh: 'Search assets - USDC, BTC…',
        suggestTitle: 'Box recipes',
        amountLabel: 'How much?',
        addBtn: 'Pack it in',
        insideTitle: 'In the box',
        emptyNote: 'empty, start stacking',
        sealBtn: 'Shrink-wrap it →',
        sealingBtn: 'Shrink-wrapping…',
        sealHintEmpty: 'Stack at least one thing to wrap.',
        sealHintReady: '{count} item{s} in the box · ready to wrap',
        textTitle: 'Write on the wrapper',
        textSub: 'The words on the wrapper - they appear live as you type.',
        brandPh: 'Chase Box',
        sublabelPh: 'A PACK TO CRACK',
        notePh: 'pull something rare',
        textHint: 'Add your message, then finalize the haul.',
        valueGuide: '$25 ≈ starter slabs · $50 ≈ a graded holo · $120+ ≈ vintage territory',
        designTag: 'foil',   // composes '// step N · foil' — the number follows the flow order
        designTitle: 'Foil the pack',
        designSub: 'A designed box, or your own foil and colours.',
        designBtn: 'Pack the box →',
        designHint: 'Pick the foil, then stack the haul.',
        readyTitle: 'Their box<br>is ready.',
        readySub: 'Send it to their email, phone, or wallet. They rip it open from a link.',
        wrappedFor: 'A box for {to} · {count} item{s} inside.',
        previewLabel: 'Preview the box',
      },
      receive: {
        docTitle: "You've got a box - GIIIFT",
        prelude: 'A box is on its way to you…',
        armedStatus: 'Delivered · tap to crack it',
        tapHint: 'Tap your box to open',
        eyebrow: 'Your box has arrived',
        openCta: 'Rip it open →',
        openingCta: 'Ripping…',
        claimingCta: 'Claiming your pull…',
        savedCta: 'Save to your collection →',
        viewVaultCta: 'View your collection →',
        spendCta: 'Pick your card with {amount} →',
        spendCtaZero: 'Pick your card →',
        manifestTitle: 'The haul',
        becomesTitle: 'Your {amount}, your pick',
        becomesNote: 'Three that fit · the shop has the rest',
        trustLine: 'Vaulted & insured · redeem-to-ship or ~85% instant buyback',
        reciprocityCta: 'Rip one back for {from} →',
      },
      shop: {
        balanceEyebrow: 'Your pack value',
        balanceSub: 'Store credit at the coolest card shop in the world. Pick a graded card or a pack up to your value. <b>Vaulted, insured, redeem-to-ship.</b>',
        searchPh: 'Search cards, sets, grades…',
        leadShelfTitle: '{occasion} from {from} → pick your card',
        leadShelfTitleNoFrom: '{occasion} → pick your card',
        leadNoun: 'Your pack',
        leadShelfNote: 'Everything here fits the credit that just landed',
        facets: { all: 'All', balance: 'Fits your pack', pack: 'Packs', single: 'Cards', art: 'Art & NFTs', saved: '♥ Saved' },
        ripNote: 'Build the suspense in GIIIFT, then we deep-link you to {partner} for the one-by-one rip. Your pull syncs back to your collection.',
      },
      status: {
        send: [
          [0, 'Shrink-wrapping your pack', 'Shrink-wrapping'],
          [5600, 'Loading the booster crate', 'Loading'],
          [10400, 'Your pack is on its way', 'on its way'],
        ],
        wormhole: [
          [0, 'Shrink-wrapping your pack', 'Shrink-wrapping'],
          [3600, 'Riding the holo stream', 'holo stream'],
          [7400, 'Your pack is on its way', 'on its way'],
        ],
      },
    },
    wrap: {
      // recipes: one tap stacks the whole bundle (items) + seeds the note.
      // amount stays the headline price (and the ?pack= key from the landing).
      suggested: [
        { label: '$25 · Starter Box', amount: 25, glyph: '🎴', hint: 'pack credit + your note',
          items: [['USDC', 25]], note: 'a pack to crack, on me' },
        { label: '$50 · Booster Box', amount: 50, glyph: '⚡', hint: 'pack credit + a card pick',
          items: [['USDC', 40], ['NFT', 1]], note: 'for the chase + a binder pick' },
        { label: '$100 · Chase Box', amount: 100, glyph: '🏆', hint: 'big-pull credit + a grail pick',
          items: [['USDC', 90], ['NFT', 1]], note: 'go pull something rare' },
      ],
      quickAmounts: ['10', '25', '50', '100', '250'],
      occasions: ['Birthday', 'Big win', 'Set complete', 'Just because'],
      notePrompts: ['go pull something rare', 'for the binder', 'chase the grail', 'rip it on camera'],
      defaults: { sublabel: 'A PACK TO CRACK', model: 'SET: GF-BASE', pattern: 'grid' },
      presets: [
        { name: 'Holo Chase', finish: 'holo', cardboard: '#bfa9ff', cardboard2: '#b8f0ff', accent: '#ffffff', pattern: 'none' },
        { name: 'First Edition', finish: 'gradient', cardboard: '#7c3aed', cardboard2: '#f59e0b', accent: '#fde68a', pattern: 'grid' },
        { name: 'Shadow Rare', finish: 'gradient', cardboard: '#111827', cardboard2: '#4c1d95', accent: '#ffd34d', pattern: 'rings' },
        { name: 'Grail Red', finish: 'gradient', cardboard: '#dc2626', cardboard2: '#7f1d1d', accent: '#fcd34d', pattern: 'plus' },
      ],
      randomFromPresets: true,
      patterns: ['grid', 'checker', 'plus', 'rings', 'dots', 'stripes', 'chevron', 'crosshatch', 'waves', 'diagonal', 'weave'],
      stickers: { featured: ['g-rare-star', 'g-hp', 'g-super'], groups: ['game'] },
      panels: { featured: ['holo', 'pkmn-front'] },
    },
    transitions: {
      weights: { wormhole: 2.5, iris: 1 },   // the pack riding the holo tunnel IS the brand moment
      prefer: null,
    },
    receive: {
      aurora: { c1: '#7c3aed', c2: '#f59e0b', accent: '#fde68a' },
      unlock: { voice: 'heist', theme: 'gadget', label: 'Crack it to rip it' },
    },
    shop: {
      shelves: [
        { id: 'under-balance', title: 'Under your pack value', kind: 'balance',
          note: 'Rip-ready: everything here fits your credit' },
        { id: 'drops', title: 'Packs to crack', filter: { category: 'pack' },
          note: 'Open on the partner · odds up front, ~85% instant buyback' },
        { id: 'singles', title: 'Graded chase cards', filter: { category: 'single' },
          note: 'Vaulted & insured · redeem-to-ship or instant buyback' },
        { id: 'curator', title: "Collector's picks",
          ids: ['cc-charizard-base-psa10', 'cc-gacha-vintage', 'cc-umbreon-vmax', 'mnstr-strike-pack', 'cc-lugia-neo-psa9'],
          note: 'Hand-picked this week' },
      ],
      boost: { games: ['Pokémon', 'Multi-TCG', 'Sports', 'One Piece'] },
      spotlight: ['cc-charizard-base-psa10', 'cc-gacha-vintage', 'cc-umbreon-vmax'],
    },
    landing: {
      eyebrow: 'GIIIFT × TRADING CARDS',
      title: 'Send a <em>haul</em><br>they\'ll rip<br>open.',
      sub: 'One link, a whole box of the hobby: pack credit, card picks, a note from you. They rip it open and choose what gets real.',
      ctaPrimary: 'Build a box →',
      ctaSecondary: 'Browse the card shop',
      closingTitle: 'Ready to build their box?',
      chips: ['A pack to crack inside', 'USD credit underneath', '~85% instant buyback', 'Redeem-to-ship real cards'],
      how: [
        { n: '01', t: 'You build the box', d: 'Stack credit, picks, and your note. Foil it your way.' },
        { n: '02', t: 'They rip it open', d: 'One link. A wallet appears under it, silently.' },
        { n: '03', t: 'They pick what gets real', d: 'Graded slabs, sealed packs, shipped to their door.' },
      ],
      demoLabel: 'Try the full reveal →',
      demoGift: {
        t: 'you', f: 'GIIIFT', m: 'Demo Box', n: 'rip it open · this one is on us',
        i: [['USDC', '40'], ['NFT', '1']],
        d: { c: '#17181d', k: '#0b0c0f', x: '#ffd34d', p: 'none', s: 'A HAUL TO RIP', md: 'SET: GF-DEMO' },
      },
      // the hero box is tappable: these voice the hint + the post-rip caption
      ripHint: 'tap to rip it',
      ripCaption: 'One link. They tap, it rips, the haul is theirs.',
      // the journey strip: the concept, shown not told (k picks the visual)
      journeyEyebrow: 'the unlock',
      journeyTitle: 'Real value that travels like a text',
      journey: [
        { k: 'build', t: 'Stack the box', d: 'Pack credit, a card pick, your note. One box.' },
        { k: 'send', t: 'Text the link', d: 'The whole box travels as one link. Any chat works.' },
        { k: 'rip', t: 'They rip it open', d: 'No app, no account. A wallet appears under it, silently.' },
        { k: 'real', t: 'It gets real', d: 'They pick the card; the slab ships to their door.' },
      ],
      tiersTitle: 'Pick a box to build',
      tiersNote: 'Recipes, one tap · everything lands in a single link',
      occasionsTitle: 'Make it an occasion',
      pullsTitle: 'Pulled through GIIIFT',
      pullsNote: 'Real cards, real grades',
      pulls: [
        { emoji: '🔥', title: 'Charizard · 1999 Base', grade: 'PSA 10', price: 4200, tone: '#FF6B35' },
        { emoji: '🌙', title: 'Umbreon VMAX · Evolving Skies', grade: 'PSA 10', price: 540, tone: '#7C5CFF' },
        { emoji: '🕊️', title: 'Lugia · Neo Genesis', grade: 'PSA 9', price: 760, tone: '#9AA7B0' },
        { emoji: '⚡', title: 'Pikachu · Red Cheeks Promo', grade: 'PSA 8', price: 320, tone: '#FFD93D' },
      ],
      featured: ['cc-charizard-base-psa10', 'cc-gacha-vintage', 'cc-umbreon-vmax', 'mnstr-strike-pack'],
      faqTitle: 'The straight answers',
      faq: [
        { q: 'Will they really get the card?', a: 'Yes. Every card is a real graded slab, vaulted and insured with the partner. They redeem-to-ship to their door, hold it vaulted, or take the ~85% instant buyback.' },
        { q: 'Is this crypto?', a: 'Under the hood, value moves on rails they never see. What they receive is USD store credit at a card shop: dollars in, a card out. No app, no seed phrase, no exchange.' },
        { q: 'Who actually sells the card?', a: 'Partner shops are the merchant of record and fulfil every order. GIIIFT routes the purchase from the recipient\'s own balance and never holds funds.' },
        { q: 'What if my gift is too small for the card they want?', a: 'Their credit never expires and they can top up the difference. Anything left over after a pick stays spendable.' },
      ],
      boxPreview: {
        shape: 'present',
        palette: { c1: '#17181d', c2: '#0b0c0f', accent: '#ffd34d', angle: 160, finish: 'gradient' },
        faces: {
          front: { panel: 'tcg-crate' },
          right: { panel: 'tcg-crate-side' },
          left: { pattern: 'none', layers: [{ t: 'decal', id: 'g-rare-star', x: 0.5, y: 0.5, w: 0.34, h: 0.34, rotate: -6 }] },
          top: { pattern: 'none' },
        },
        // the haul that bursts out when the hero box is ripped on the landing
        items: [
          { ticker: 'USDC', amount: '40', color: '#2775CA' },
          { ticker: 'NFT', amount: '1', color: '#B06CF0', glyph: '🎴' },
          { ticker: 'NFT', amount: '1', color: '#FFD34D', glyph: '✦' },
        ],
        meta: { brand: 'BOOSTER' },
      },
    },
  });

  /* ───────────────────────────── POKEMON flavor ────────────────────────── */
  V.register({
    id: 'pokemon',
    extends: 'tcg',
    label: 'Pokémon',
    tagline: 'Gift a booster, spark a pull',
    match: {
      paths: ['/pokemon', '/pkmn'],
      aliases: ['pkmn', 'poke'],
      keywords: ['pokemon', 'pokémon', 'pikachu', 'charizard', 'pokeball', 'poké ball', 'base set', 'evolving skies'],
      rank: 10,
    },
    theme: {
      hues: [48, 210, 0],                                    // electric yellow, sky blue, a red flash
      vars: { '--accent-ui': '#FFCC00' },
      set: { c1: '#1d4ed8', c2: '#facc15', accent: '#fde047' },
    },
    copy: {
      wrap: {
        brandPh: 'Volt Pack',
        sublabelPh: 'GOTTA RIP IT',
        notePh: 'go pull something rare',
      },
      receive: {
        prelude: 'A booster is on its way to you…',
      },
      status: {
        send: [
          [0, 'Shrink-wrapping your booster', 'Shrink-wrapping'],
          [5600, 'Charging it up', 'Charging'],
          [10400, 'Your booster is on its way', 'on its way'],
        ],
        wormhole: [
          [0, 'Shrink-wrapping your booster', 'Shrink-wrapping'],
          [3600, 'Riding the thunder stream', 'thunder stream'],
          [7400, 'Your booster is on its way', 'on its way'],
        ],
      },
    },
    wrap: {
      defaults: { sublabel: 'GOTTA RIP IT', model: 'NO. 025 // GF', pattern: 'grid' },
      presets: [
        { name: 'Electric', finish: 'gradient', cardboard: '#1d4ed8', cardboard2: '#facc15', accent: '#fde047', pattern: 'grid' },
        { name: 'Ember', finish: 'gradient', cardboard: '#dc2626', cardboard2: '#f97316', accent: '#fde68a', pattern: 'plus' },
        { name: 'Tidal', finish: 'gradient', cardboard: '#1e40af', cardboard2: '#06b6d4', accent: '#e0f2fe', pattern: 'waves' },
        { name: 'Overgrow', finish: 'gradient', cardboard: '#166534', cardboard2: '#4ade80', accent: '#ecfccb', pattern: 'dots' },
        { name: 'Holo Chase', finish: 'holo', cardboard: '#bfa9ff', cardboard2: '#b8f0ff', accent: '#ffffff', pattern: 'none' },
        { name: 'Master', finish: 'gradient', cardboard: '#581c87', cardboard2: '#d946ef', accent: '#f5d0fe', pattern: 'rings' },
      ],
      stickers: { featured: ['g-pokeball', 'g-bolt', 'g-fire', 'g-water', 'g-grass', 'g-rare-star'], groups: ['game'] },
      panels: { featured: ['pkmn-front', 'pkmn-side', 'holo'] },
    },
    receive: {
      aurora: { c1: '#1d4ed8', c2: '#facc15', accent: '#fde047' },
    },
    shop: {
      shelves: [
        { id: 'under-balance', title: 'Under your pack value', kind: 'balance',
          note: 'Rip-ready: everything here fits your credit' },
        { id: 'pokemon', title: 'Graded Pokémon', filter: { game: 'Pokémon', category: 'single' },
          note: 'Vaulted & insured · redeem-to-ship or instant buyback' },
        { id: 'drops', title: 'Packs to crack', filter: { category: 'pack' },
          note: 'Open on the partner · odds up front, ~85% instant buyback' },
        { id: 'curator', title: 'Trainer picks',
          ids: ['cc-charizard-base-psa10', 'cc-umbreon-vmax', 'cc-gacha-vintage', 'cc-pikachu-illustrator', 'cc-lugia-neo-psa9'],
          note: 'Hand-picked this week' },
      ],
      boost: { games: ['Pokémon'] },
      spotlight: ['cc-charizard-base-psa10', 'cc-umbreon-vmax', 'cc-gacha-classic'],
    },
    landing: {
      eyebrow: 'GIIIFT × POKÉMON',
      title: 'Gift a<br><em>booster</em>.<br>Spark the pull.',
      sub: 'Wrap real value as a Pokémon booster. They rip it from a link and pick a real graded card, Charizard energy included. Crypto stays invisible.',
      ctaPrimary: 'Build a booster →',
      ctaSecondary: 'Browse graded Pokémon',
      closingTitle: 'Ready to spark a pull?',
      demoGift: {
        t: 'you', f: 'GIIIFT', m: 'Demo Booster', n: 'rip it open · this one is on us',
        i: [['USDC', '40'], ['NFT', '1']],
        d: { c: '#1d4ed8', k: '#facc15', x: '#fde047', p: 'grid', s: 'GOTTA RIP IT', md: 'NO. 025 // DEMO' },
      },
      featured: ['cc-charizard-base-psa10', 'cc-umbreon-vmax', 'cc-pikachu-illustrator', 'cc-gacha-classic'],
      boxPreview: {
        shape: 'present',
        palette: { c1: '#1d4ed8', c2: '#facc15', accent: '#fde047', angle: 135, finish: 'gradient' },
        faces: {
          front: { panel: 'pkmn-front' },
          right: { panel: 'pkmn-side' },
          left: { pattern: 'grid', layers: [{ t: 'decal', id: 'g-pokeball', x: 0.5, y: 0.42, w: 0.4, h: 0.4 }, { t: 'decal', id: 'g-bolt', x: 0.76, y: 0.78, w: 0.26, h: 0.26, rotate: 12 }] },
          top: { pattern: 'grid' },
        },
        items: [
          { ticker: 'USDC', amount: '40', color: '#2775CA' },
          { ticker: 'NFT', amount: '1', color: '#FFCC00', glyph: '⚡' },
          { ticker: 'NFT', amount: '1', color: '#EE1515', glyph: '🎴' },
        ],
        meta: { brand: 'VOLT CRATE' },
      },
    },
  });

  /* ───────────────────────────── ONE PIECE flavor ──────────────────────── */
  V.register({
    id: 'onepiece',
    extends: 'tcg',
    label: 'One Piece',
    tagline: 'Send a bounty worth chasing',
    match: {
      paths: ['/onepiece', '/one-piece'],
      aliases: ['op', 'one-piece'],
      keywords: ['one piece', 'luffy', 'grand line', 'straw hat', 'devil fruit', 'op tcg', 'bounty'],
      rank: 10,
    },
    theme: {
      hues: [0, 42, 220],                                    // pirate crimson, doubloon gold, deep sea
      vars: { '--accent-ui': '#FFB23E' },
      set: { c1: '#b91c1c', c2: '#f59e0b', accent: '#fcd34d' },
    },
    copy: {
      wrap: {
        docTitle: 'GIIIFT - Wrap a bounty',
        fillTitle: 'Load the bounty',
        fillSub: 'Fill the chest with pack credit (USD they spend on real cards) or any treasure you like.',
        brandPh: 'Grand Line Pack',
        sublabelPh: 'A BOUNTY FOR YOU',
        notePh: 'set sail, pull a grail',
        sealBtn: 'Seal the chest →',
        sealingBtn: 'Sealing the chest…',
        insideTitle: 'Inside the chest',
        readyTitle: 'Your bounty<br>is ready.',
      },
      receive: {
        docTitle: "You've got a bounty - GIIIFT",
        prelude: 'A bounty is on its way to you…',
        armedStatus: 'Ashore · tap to open the chest',
        tapHint: 'Tap your bounty to open',
        eyebrow: 'Your bounty has arrived',
        openCta: 'Open the chest →',
        manifestTitle: 'Inside the chest',
      },
      shop: {
        balanceEyebrow: 'Your bounty',
        leadShelfTitle: '{occasion} from {from} → claim your bounty',
        leadShelfTitleNoFrom: '{occasion} → claim it in cards',
        leadNoun: 'Your bounty',
      },
      status: {
        send: [
          [0, 'Sealing your bounty', 'Sealing'],
          [5600, 'Charting the Grand Line', 'Charting'],
          [10400, 'Your bounty is on its way', 'on its way'],
        ],
        wormhole: [
          [0, 'Sealing your bounty', 'Sealing'],
          [3600, 'Crossing the Grand Line', 'Grand Line'],
          [7400, 'Your bounty is on its way', 'on its way'],
        ],
      },
    },
    wrap: {
      defaults: { sublabel: 'A BOUNTY FOR YOU', model: 'SET: OP-01', pattern: 'diagonal' },
      presets: [
        { name: 'Straw Hat', finish: 'gradient', cardboard: '#b91c1c', cardboard2: '#f59e0b', accent: '#fcd34d', pattern: 'diagonal' },
        { name: 'Grand Line', finish: 'gradient', cardboard: '#0c4a6e', cardboard2: '#14b8a6', accent: '#bae6fd', pattern: 'waves' },
        { name: 'Wanted', finish: 'matte', cardboard: '#a87a48', cardboard2: '#6f4a28', accent: '#f6f1e4', pattern: 'none' },
        { name: 'Emperor', finish: 'gradient', cardboard: '#18181b', cardboard2: '#7f1d1d', accent: '#fbbf24', pattern: 'crosshatch' },
        { name: 'Log Pose', finish: 'holo', cardboard: '#bfa9ff', cardboard2: '#b8f0ff', accent: '#ffffff', pattern: 'none' },
      ],
      stickers: { featured: ['g-rare-star', 'st-star', 'ind-faction'], groups: ['game', 'street'] },
      panels: { featured: ['kraft', 'kraft-side'] },
    },
    receive: {
      aurora: { c1: '#b91c1c', c2: '#f59e0b', accent: '#fcd34d' },
    },
    shop: {
      // No One Piece inventory in the seed catalog yet: lead with an honest OP
      // shelf (its emptyNote tells the story) and float multi-TCG partners up.
      shelves: [
        { id: 'under-balance', title: 'Under your bounty', kind: 'balance',
          note: 'Everything here fits the credit that just landed' },
        { id: 'onepiece', title: 'One Piece singles', filter: { game: 'One Piece', category: 'single' },
          note: 'Vaulted & insured · redeem-to-ship or instant buyback',
          emptyNote: 'OP singles land with our partners soon · multi-TCG drops below carry OP pulls today' },
        { id: 'drops', title: 'Packs to crack', filter: { category: 'pack' },
          note: 'Open on the partner · odds up front, ~85% instant buyback' },
        { id: 'curator', title: "Navigator's picks",
          ids: ['mnstr-strike-pack', 'cc-gacha-vintage', 'cc-jordan-rookie', 'cc-gacha-classic'],
          note: 'Hand-picked this week' },
      ],
      boost: { games: ['One Piece', 'Multi-TCG'] },
      spotlight: ['mnstr-strike-pack', 'cc-gacha-vintage', 'cc-charizard-base-psa10'],
    },
    landing: {
      eyebrow: 'GIIIFT × ONE PIECE',
      title: 'Send a<br><em>bounty</em><br>worth chasing.',
      sub: 'Wrap real value as a treasure chest. They open it from a link and claim it in real graded cards. The Grand Line, minus the shipwrecks.',
      ctaPrimary: 'Wrap a bounty →',
      ctaSecondary: 'Browse the card shop',
      closingTitle: 'Ready to set sail?',
      demoGift: {
        t: 'you', f: 'GIIIFT', m: 'Demo Bounty', n: 'open the chest · this one is on us',
        i: [['USDC', '40'], ['NFT', '1']],
        d: { c: '#b91c1c', k: '#f59e0b', x: '#fcd34d', p: 'diagonal', s: 'A BOUNTY FOR YOU', md: 'SET: OP-DEMO' },
      },
      tiersTitle: 'Pick a bounty to send',
      pullsTitle: 'Claimed through GIIIFT',
      featured: ['mnstr-strike-pack', 'cc-gacha-vintage', 'cc-jordan-rookie', 'cc-gacha-classic'],
      boxPreview: {
        shape: 'present',
        palette: { c1: '#b91c1c', c2: '#f59e0b', accent: '#fcd34d', angle: 135, finish: 'gradient' },
        faces: {
          front: { panel: 'kraft', panelText: { msg: 'set sail', fragile: 'WANTED', avion: 'GRAND LINE', stamp: 'OP' } },
          right: { panel: 'kraft-side', panelText: { way: 'THIS WAY UP', stamp: 'OP' } },
          left: { pattern: 'diagonal', layers: [{ t: 'decal', id: 'st-star', x: 0.5, y: 0.5, w: 0.4, h: 0.4, rotate: -8 }] },
          top: { pattern: 'diagonal' },
        },
        items: [
          { ticker: 'USDC', amount: '40', color: '#2775CA' },
          { ticker: 'NFT', amount: '1', color: '#F59E0B', glyph: '🏴‍☠️' },
          { ticker: 'NFT', amount: '1', color: '#FCD34D', glyph: '🎴' },
        ],
        meta: { brand: 'BOUNTY' },
      },
    },
  });

  /* ──────────────── TCG-PACK: the A/B narrative variant ───────────────────
   * The experiment arm for the narrative question: same funnel, but the OLD
   * single-pack "send a pack to crack" story instead of the haul/box story.
   * Hidden (never listed in switchers/tiles); reach it at /v/tcg-pack or
   * ?v=pack, and point ad channels at one arm or the other to let the
   * k-factor and AOV decide the narrative. */
  V.register({
    id: 'tcg-pack',
    extends: 'tcg',
    label: 'Trading Cards · Pack',
    tagline: 'Send a pack to crack',
    hidden: true,
    match: { paths: [], aliases: ['pack'], keywords: [], rank: 0 },
    copy: {
      wrap: {
        docTitle: 'GIIIFT - Build a pack',
        fillTitle: 'Build the pack',
        fillSub: 'Load it with pack credit (USD they spend on real cards) or any asset you like.',
        suggestTitle: 'One-tap packs',
        insideTitle: 'Inside the pack',
        emptyNote: 'empty, load it up',
        sealHintEmpty: 'Load at least one thing to wrap.',
        sealHintReady: '{count} item{s} inside · ready to wrap',
        textTitle: 'Name the pack',
        brandPh: 'Chase Pack',
        designHint: 'Dress the booster, then finalize your pack.',
        readyTitle: 'Your pack<br>is ready.',
        wrappedFor: 'Wrapped for {to} · {count} item{s} inside.',
        previewLabel: 'Preview the pack',
      },
      receive: {
        docTitle: "You've got a pack - GIIIFT",
        prelude: 'A pack is on its way to you…',
        tapHint: 'Tap your pack to open',
        eyebrow: 'Your pack has arrived',
        manifestTitle: 'Inside the pack',
      },
    },
    wrap: {
      suggested: [
        { label: '$25 · Starter Pack', ticker: 'USDC', amount: 25, glyph: '🎴', hint: 'store credit · they pick the card' },
        { label: '$50 · Booster Pack', ticker: 'USDC', amount: 50, glyph: '⚡', hint: 'the classic gift' },
        { label: '$100 · Chase Pack', ticker: 'USDC', amount: 100, glyph: '🏆', hint: 'big-pull territory' },
      ],
    },
    landing: {
      title: 'Send a<br><em>pack</em> to<br>crack.',
      sub: 'Wrap real value as a booster. They rip it open from a link, then pick a real graded card up to its value. No app, no wallet talk, no seed phrase.',
      ctaPrimary: 'Build a pack →',
      closingTitle: 'Ready to drop a pack?',
      chips: ['USD store credit underneath', 'Graded & vaulted cards', '~85% instant buyback', 'Redeem-to-ship real cards'],
      how: [
        { n: '01', t: 'You build the pack', d: 'Pick a value, foil the booster, write the wrapper.' },
        { n: '02', t: 'They rip it open', d: 'One link. A wallet appears under it, silently.' },
        { n: '03', t: 'They pick a real card', d: 'Graded, vaulted, shipped to their door if they want it.' },
      ],
      demoGift: {
        t: 'you', f: 'GIIIFT', m: 'Demo Pack', n: 'rip it open · this one is on us',
        i: [['USDC', '50']],
        d: { c: '#17181d', k: '#0b0c0f', x: '#ffd34d', p: 'none', s: 'A PACK TO CRACK', md: 'SET: GF-DEMO' },
      },
      tiersTitle: 'Pick a pack to send',
      tiersNote: 'Store credit underneath · they pick the card',
    },
  });

  // Re-resolve now that the packs exist: the engine's first pass ran with only
  // core registered, so a /tcg path or stored session can land properly.
  V.resolve();
})();
