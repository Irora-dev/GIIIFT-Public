/**
 * GIIIFT — password gate for the PUBLIC showcase mirror (giiift.com/showcase).
 *
 * SOURCE OF TRUTH lives in the private repo at tools/showcase-public/
 * showcase-gate.ts; tools/export-showcase.mjs copies it into the public
 * repo's netlify/edge-functions/. Edit it there, re-export — never here.
 *
 * This is the BD-partner front door for the flow demo that ships with it
 * under /showcase/** (see docs/PUBLIC_SHOWCASE.md in the private repo). It
 * differs from the private deploy's per-partner PIN gate (SHOWCASE_PINS) on
 * purpose: one shared password, handed over in the outreach note, zero
 * Netlify setup needed for the page to exist.
 *
 *   - access key      = SHOWCASE_KEY env if set, else "2026". The default is
 *     deliberate: the gated content sits in this public repo anyway, so the
 *     gate is exclusivity for the live URL, not secrecy — and the page must
 *     work the moment the repo deploys, with no env step to forget.
 *   - valid cookie    -> serve the file (+ noindex everywhere; no-store for
 *     HTML, short private cache for the heavy assets)
 *   - POST right key  -> set cookie, 303 back to the path they asked for
 *     (query string included, so /showcase/?p=courtyard personalization
 *     survives the unlock)
 *   - anything else   -> branded lock screen, 401
 *
 * Rotating: set SHOWCASE_KEY in the Netlify env and redeploy — outstanding
 * cookies die with the key because the session hash binds it.
 */

import type { Context } from "https://edge.netlify.com";

declare const Netlify: { env: { get(key: string): string | undefined } };

const COOKIE = "giiift_show";
const MAX_AGE = 7 * 86_400; // long enough to revisit during a deal conversation
const DEFAULT_KEY = "2026";

const LOCK_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow, noarchive",
};

function accessKey(): string {
  return (Netlify.env.get("SHOWCASE_KEY") || DEFAULT_KEY).trim() || DEFAULT_KEY;
}

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

/** Constant-time-ish comparison (pattern kept from the private gates). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sessionHash(key: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`showpub1|${key}`));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}

function lockScreen(wrong: boolean): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>GIIIFT — Partner Showcase</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0d0c;
    font:15px/1.5 Inter,ui-sans-serif,system-ui,sans-serif;color:#f3f4f2}
  .card{text-align:center;padding:24px}
  .lockup{display:flex;align-items:center;justify-content:center;gap:11px;margin-bottom:26px}
  .word{font-weight:900;font-size:20px;letter-spacing:-.012em}
  .word .i1{color:#FF3B6F}.word .i2{color:#FFD93D}.word .i3{color:#4ECDC4}
  .tag{font-family:"JetBrains Mono",monospace;font-size:10.5px;letter-spacing:.16em;
    text-transform:uppercase;color:rgba(243,244,242,.42);margin-bottom:30px}
  form{display:flex;gap:8px;justify-content:center}
  input{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);
    color:#f3f4f2;border-radius:11px;padding:12px 15px;font:inherit;width:220px;text-align:center;
    font-family:"JetBrains Mono",monospace;letter-spacing:.2em}
  input:focus{outline:none;border-color:rgba(0,255,157,.5)}
  button{background:rgba(0,255,157,.12);border:1px solid rgba(0,255,157,.42);
    color:#00FF9D;border-radius:11px;padding:12px 20px;font:inherit;font-weight:700;cursor:pointer}
  .w{margin-top:20px;font-size:12.5px;color:#ff8aa6}
  .h{margin-top:26px;font-size:12px;color:rgba(243,244,242,.42)}
  .h a{color:rgba(243,244,242,.64)}
</style></head><body>
<div class="card">
  <div class="lockup">
    <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#151816"/><rect x="15.5" y="31" width="9.6" height="26" rx="2" fill="#FF3B6F"/><rect x="27.2" y="31" width="9.6" height="26" rx="2" fill="#FFD93D"/><rect x="38.9" y="31" width="9.6" height="26" rx="2" fill="#4ECDC4"/><rect x="12.5" y="29.5" width="39" height="7" rx="2.4" fill="#f3f4f2"/><ellipse cx="23.5" cy="18.5" rx="11" ry="7" transform="rotate(-16 23.5 18.5)" fill="#FF3B6F"/><ellipse cx="40.5" cy="18.5" rx="11" ry="7" transform="rotate(16 40.5 18.5)" fill="#4ECDC4"/><rect x="28.4" y="12.5" width="7.2" height="14.5" rx="2.2" fill="#FFD93D"/></svg>
    <span class="word">G<span class="i1">I</span><span class="i2">I</span><span class="i3">I</span>FT</span>
  </div>
  <div class="tag">Partner showcase · invite only</div>
  <form method="post" autocomplete="off">
    <input type="password" name="key" placeholder="access code" autofocus>
    <button type="submit">Enter →</button>
  </form>
  ${wrong ? '<div class="w">That code didn\'t open it. Check our note.</div>' : ""}
  <div class="h">Got here without a code? <a href="mailto:hello@giiift.com">hello@giiift.com</a></div>
</div>
</body></html>`;
}

export default async (request: Request, context: Context) => {
  const key = accessKey();
  const url = new URL(request.url);

  // Already in -> serve the underlying static file, hardened.
  const got = readCookie(request, COOKIE);
  if (got && safeEqual(got, await sessionHash(key))) {
    const res = await context.next();
    const headers = new Headers(res.headers);
    headers.set("x-robots-tag", "noindex, nofollow, noarchive");
    const isHtml = (headers.get("content-type") || "").includes("text/html");
    headers.set("cache-control", isHtml ? "no-store" : "private, max-age=600");
    return new Response(res.body, { status: res.status, headers });
  }

  // Key entry. Redirect back to whatever path they were unlocking, query
  // intact (?p=<partner> personalizes the landing).
  if (request.method === "POST") {
    let attempt = "";
    try {
      const form = await request.formData();
      attempt = String(form.get("key") || "").trim();
    } catch { /* fall through to the lock screen */ }
    if (attempt && safeEqual(attempt, key)) {
      const headers = new Headers(LOCK_HEADERS);
      headers.set("location", url.pathname + url.search);
      headers.append(
        "set-cookie",
        `${COOKIE}=${await sessionHash(key)}; Max-Age=${MAX_AGE}; Path=/showcase; HttpOnly; Secure; SameSite=Lax`,
      );
      return new Response(null, { status: 303, headers });
    }
    return new Response(lockScreen(true), { status: 401, headers: LOCK_HEADERS });
  }

  return new Response(lockScreen(false), { status: 401, headers: LOCK_HEADERS });
};

export const config = { path: ["/showcase", "/showcase/*"] };
