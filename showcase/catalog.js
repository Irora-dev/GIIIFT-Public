/* GIIIFT - curated marketplace catalog (static seed).
 *
 * This is the hand-curated, taste-led catalog the storefront renders. It is
 * deliberately a small, moderated set - "the coolest shop," not "everything
 * store" (see docs/MARKETPLACE_THESIS.md §5). Later this same shape is fed from
 * Supabase + partner APIs (Collector Crypt) via the /api/catalog edge function;
 * the static list stays as the offline / no-key fallback.
 *
 * Compliance shape (thesis §1, §5): every price is **USD** (the user spends
 * credit, not "trades crypto"); `chain` is internal routing detail the UI hides;
 * `partner` is the merchant-of-record that fulfils (GIIIFT routes/refers only).
 *
 * Item fields:
 *   id        unique slug
 *   title     display name
 *   sub       secondary line (artist / set / "provably-fair")
 *   emoji     visual placeholder (no hosted art yet) + `tone` accent colour
 *   priceUSD  price in USD (the only currency the shopper sees)
 *   category  "pack" | "single" | "art"
 *   partner   fulfilling partner (merchant-of-record)
 *   chain     settlement chain (HIDDEN from UI - routing only)
 *   game/set/rarity/condition   facets for collectibles (thesis §3.6)
 *   odds[]    published pull rates for packs (trust UI, thesis §4)
 *   buyback   instant-buyback % (trust spine, thesis §4)
 *   fmv       fair-market value for trend signal (thesis §3.7)
 *   referral  true → integration is a referral link only (e.g. MNSTR)
 *   href      partner deep-link for the "experience elsewhere" handoff
 */
(function () {
  var CATALOG = [
    /* ---- Packs (the hero "drops" - odds shown up front) ---- */
    {
      id: "cc-gacha-classic", title: "Classic Gacha Pack", sub: "Provably-fair · VRF",
      emoji: "🎴", tone: "#9945FF", priceUSD: 45, category: "pack",
      game: "Pokémon", partner: "Collector Crypt", chain: "Solana", buyback: 85,
      odds: [
        { label: "Chase · PSA 10", pct: 1.5 },
        { label: "Rare", pct: 12 },
        { label: "Uncommon", pct: 34 },
        { label: "Common", pct: 52.5 },
      ],
      href: "https://collectorcrypt.com/gacha",
    },
    {
      id: "cc-gacha-vintage", title: "Vintage Vault Pack", sub: "WOTC era · provably-fair",
      emoji: "🗝️", tone: "#C9A227", priceUSD: 120, category: "pack",
      game: "Pokémon", partner: "Collector Crypt", chain: "Solana", buyback: 85,
      odds: [
        { label: "Grail · 1st Ed", pct: 0.5 },
        { label: "Chase · PSA 9+", pct: 6 },
        { label: "Rare", pct: 28 },
        { label: "Base", pct: 65.5 },
      ],
      href: "https://collectorcrypt.com/gacha",
    },
    {
      id: "mnstr-strike-pack", title: "MNSTR Strike Pack", sub: "Graded · vaulted · ships physical",
      emoji: "📦", tone: "#FFD93D", priceUSD: 60, category: "pack",
      game: "Multi-TCG", partner: "MNSTR", chain: "MegaETH", buyback: 85, referral: true,
      odds: [
        { label: "Hit · graded slab", pct: 8 },
        { label: "Mid", pct: 34 },
        { label: "Base", pct: 58 },
      ],
      href: "https://mnstr.xyz/",
    },
    {
      id: "cc-gacha-mini", title: "Starter Rip", sub: "Your first pull · provably-fair",
      emoji: "✨", tone: "#4ECDC4", priceUSD: 12, category: "pack",
      game: "Pokémon", partner: "Collector Crypt", chain: "Solana", buyback: 85,
      odds: [
        { label: "Rare", pct: 10 },
        { label: "Uncommon", pct: 35 },
        { label: "Common", pct: 55 },
      ],
      href: "https://collectorcrypt.com/gacha",
    },

    /* ---- Graded singles (the faceted grid) ---- */
    {
      id: "cc-charizard-base-psa10", title: "Charizard · 1999 Base", sub: "Holo · PSA 10",
      emoji: "🔥", tone: "#FF6B35", priceUSD: 4200, category: "single",
      game: "Pokémon", set: "Base Set", rarity: "Holo Rare", condition: "PSA 10",
      partner: "Collector Crypt", chain: "Solana", buyback: 85, fmv: 4350,
      href: "https://collectorcrypt.com/",
    },
    {
      id: "cc-blastoise-base-psa9", title: "Blastoise · 1999 Base", sub: "Holo · PSA 9",
      emoji: "🌊", tone: "#3A7BD5", priceUSD: 880, category: "single",
      game: "Pokémon", set: "Base Set", rarity: "Holo Rare", condition: "PSA 9",
      partner: "Collector Crypt", chain: "Solana", buyback: 85, fmv: 910,
      href: "https://collectorcrypt.com/",
    },
    {
      id: "cc-pikachu-illustrator", title: "Pikachu · Promo", sub: "Red Cheeks · PSA 8",
      emoji: "⚡", tone: "#FFD93D", priceUSD: 320, category: "single",
      game: "Pokémon", set: "Promo", rarity: "Promo", condition: "PSA 8",
      partner: "Collector Crypt", chain: "Solana", buyback: 85, fmv: 305,
      href: "https://collectorcrypt.com/",
    },
    {
      id: "cc-umbreon-vmax", title: "Umbreon VMAX · Evolving Skies", sub: "Alt Art · PSA 10",
      emoji: "🌙", tone: "#7C5CFF", priceUSD: 540, category: "single",
      game: "Pokémon", set: "Evolving Skies", rarity: "Alt Art Secret", condition: "PSA 10",
      partner: "Collector Crypt", chain: "Solana", buyback: 85, fmv: 560,
      href: "https://collectorcrypt.com/",
    },
    {
      id: "cc-jordan-rookie", title: "Jordan · '86 Fleer RC", sub: "Basketball · PSA 7",
      emoji: "🏀", tone: "#E03A3E", priceUSD: 2600, category: "single",
      game: "Sports", set: "1986 Fleer", rarity: "Rookie", condition: "PSA 7",
      partner: "MNSTR", chain: "MegaETH", buyback: 85, referral: true, fmv: 2700,
      href: "https://mnstr.xyz/",
    },
    {
      id: "cc-lugia-neo-psa9", title: "Lugia · Neo Genesis", sub: "Holo · PSA 9",
      emoji: "🕊️", tone: "#9AA7B0", priceUSD: 760, category: "single",
      game: "Pokémon", set: "Neo Genesis", rarity: "Holo Rare", condition: "PSA 9",
      partner: "Collector Crypt", chain: "Solana", buyback: 85, fmv: 740,
      href: "https://collectorcrypt.com/",
    },
    {
      id: "cc-mewtwo-base-psa8", title: "Mewtwo · 1999 Base", sub: "Holo · PSA 8",
      emoji: "🔮", tone: "#A36BFF", priceUSD: 150, category: "single",
      game: "Pokémon", set: "Base Set", rarity: "Holo Rare", condition: "PSA 8",
      partner: "Collector Crypt", chain: "Solana", buyback: 85, fmv: 162,
      href: "https://collectorcrypt.com/",
    },

    /* ---- Art (take-rate vertical) ---- */
    {
      id: "art-aurora-07", title: "Aurora No. 7", sub: "by Lena Mirai · 1/1",
      emoji: "🌌", tone: "#4ECDC4", priceUSD: 180, category: "art",
      partner: "Foundation", chain: "Base", takeRate: 2.5,
      contract: "0x7c40c393dc0f283f318791d746d894ddd3693572", tokenId: "7", buyable: true,
      href: "https://opensea.io/assets/base/0x7c40c393dc0f283f318791d746d894ddd3693572/7",
    },
    {
      id: "art-tide-study", title: "Tide Study", sub: "by Kit Oyelaran · 1/1",
      emoji: "🌀", tone: "#3AD0C2", priceUSD: 95, category: "art",
      partner: "Foundation", chain: "Base", takeRate: 2.5,
      href: "#",
    },
    {
      id: "art-static-bloom", title: "Static Bloom", sub: "by V. Reyes · ed. 12",
      emoji: "🌸", tone: "#FF6FA5", priceUSD: 42, category: "art",
      partner: "Zora", chain: "Base", takeRate: 2.5,
      href: "#",
    },
    {
      id: "art-night-mode", title: "Night Mode", sub: "by Soma · 1/1",
      emoji: "🌃", tone: "#6C7BFF", priceUSD: 260, category: "art",
      partner: "Foundation", chain: "Base", takeRate: 2.5,
      contract: "0xd774557b647330c91bf44cfeab205095f7e6c367", tokenId: "1", buyable: true,
      href: "https://opensea.io/assets/base/0xd774557b647330c91bf44cfeab205095f7e6c367/1",
    },
    {
      id: "art-warmth", title: "Warmth", sub: "by Ada Côté · ed. 50",
      emoji: "🔆", tone: "#FFB23E", priceUSD: 18, category: "art",
      partner: "Zora", chain: "Base", takeRate: 2.5,
      href: "#",
    },

    /* ---- Approachable / low-ticket (so a small gift still converts) ---- */
    {
      id: "cc-energy-lot", title: "Holo Energy Lot", sub: "Starter collection · 5 cards",
      emoji: "🃏", tone: "#52D7A8", priceUSD: 8, category: "single",
      game: "Pokémon", set: "Mixed", rarity: "Holo", condition: "Raw NM",
      partner: "Collector Crypt", chain: "Solana", buyback: 80, fmv: 9,
      href: "https://collectorcrypt.com/",
    },
  ];

  /* Editorial shelves - the stacked, curated rows the home renders (thesis §2).
   * `kind:"balance"` is computed at runtime from the shopper's spendable USD.
   * Others filter the catalog; `ids` pins a hand-picked order. */
  var SHELVES = [
    { id: "under-balance", title: "Under your balance", kind: "balance",
      note: "Here's what your gift becomes today" },
    { id: "drops", title: "Trending drops", filter: { category: "pack" },
      note: "Open on the partner · odds shown up front, ~85% instant buyback" },
    { id: "pokemon", title: "Graded Pokémon", filter: { game: "Pokémon", category: "single" },
      note: "Vaulted & insured · redeem-to-ship or instant buyback" },
    { id: "artists", title: "From artists you'd love", filter: { category: "art" },
      note: "1/1s and editions, curated" },
    { id: "curator", title: "Curator's picks",
      ids: ["cc-umbreon-vmax", "art-night-mode", "cc-gacha-vintage", "cc-lugia-neo-psa9", "art-aurora-07"],
      note: "Hand-picked this week" },
  ];

  window.GIIIFT_CATALOG = CATALOG;
  window.GIIIFT_SHELVES = SHELVES;
  window.giiiftCatalogItem = function (id) {
    for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].id === id) return CATALOG[i];
    return null;
  };
})();
