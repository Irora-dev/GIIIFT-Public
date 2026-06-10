# GIIIFT — Public

A standalone **pre-launch teaser** for [GIIIFT](https://giiift). Full-bleed borealis
aurora with a custom GIIIFT panel box rotating in 3D — the box randomises every few
seconds and the aurora + CRT HUD slowly glide to match its colours.

Fully static, no build step. Serve the folder with any static host (or IPFS / Netlify):

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

### Files
- `index.html` — the page (aurora shader + spinning box + cycle/transition logic)
- `box-engine.js`, `box-panels.js`, `box-stickers.js` — the GIIIFT box renderer + panel designs
- `crt-overlay.js` — the CRT scanline + telemetry-HUD overlay
- `favicon.svg`

### /showcase — partner demo (generated, do not edit)

`showcase/**` and `netlify/edge-functions/showcase-gate.ts` are **generated** by the
private repo's `tools/export-showcase.mjs`: a password-gated, backend-free mirror of
the gifting flow for BD walkthroughs. Don't edit these files here — change the
private repo and re-export. The gate runs only on the Netlify deploy (locally the
pages serve ungated).

_The gift that keeps giving — coming soon._
