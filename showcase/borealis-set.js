/* GIIIFT — "borealis set" shared night backdrop.
 *
 * Drop  <script defer src="/showcase/borealis-set.js"></script>  on any page and it injects a
 * fixed, full-bleed backdrop behind the page content:
 *   • a WebGL aurora (one random hue → harmonious palette)
 *   • the night-town skyline (/borealis-town.png) with cool + black gradient overlays
 *   • a window-glow bloom that flickers
 * and sets  --pkg1 / --pkg2 / --pkg-accent  on :root so the GIIIFT van's neon stripe +
 * headlights track the aurora. Exposes window.GIIIFTSet = { pal, hex:{pkg1,pkg2,pkgAccent} }.
 *
 * Layering: aurora z-index var(--bset-z, 0), town +1, bloom +2. Put page content ABOVE
 * (position:relative; z-index >= 4). The page keeps its own van markup + drive keyframes.
 *
 * Options (set window.GIIIFT_SET before this script runs):
 *   townSrc   – image url   (default "/showcase/borealis-town.png")
 *   townBottom– css length  (default "-7vh")   // shift the town down
 *   townH     – css length  (default "clamp(310px, 55vh, 660px)")
 */
(function () {
  if (window.__giiiftSet) return;
  window.__giiiftSet = true;

  var OPT = window.GIIIFT_SET || {};
  // Town registry — one is picked at random each load so the send/receive scenes vary.
  // Each town carries its own van ground-line (vanBottom) so the van sits on its road/quay,
  // and an optional roadHide flag for towns that have their own ground (e.g. a quay).
  // A page may still force a single town via {townSrc,townBottom,townH,vanBottom} (back-compat).
  var TOWNS = OPT.towns || [
    { src: "/showcase/borealis-town.png", bottom: "-7vh", height: "clamp(310px, 55vh, 660px)", vanBottom: "50px", bgSize: "cover", bloom: true },
    // riverside town: full-width panorama (don't crop the mountains), sits low, barely-faded top, no bloom (bloom is tuned to borealis-town's window)
    { src: "/showcase/bg2-hq.png", bottom: "-13vh", height: "84vh", vanBottom: "3vh", roadHide: true, bgSize: "100% auto", bloom: false,
      mask: "linear-gradient(to top,#000 0,#000 52%,rgba(0,0,0,0.45) 64%,rgba(0,0,0,0.15) 72%,transparent 80%)",
      tintB: "linear-gradient(to top,rgba(6,8,20,.42) 0%,rgba(10,14,30,.15) 52%,transparent 100%)",
      tintA: "linear-gradient(to top,rgba(0,0,0,.5) 0,rgba(0,0,0,.14) 42%,transparent 76%)" }
  ];
  var PICK = OPT.townSrc
    ? { src: OPT.townSrc, bottom: OPT.townBottom || "-7vh", height: OPT.townH || "clamp(310px, 55vh, 660px)", vanBottom: OPT.vanBottom || "50px", bgSize: "cover", bloom: true }
    : TOWNS[Math.floor(Math.random() * TOWNS.length)];
  var TOWN = PICK.src, TBOT = PICK.bottom, TH = PICK.height;
  var BGSIZE = PICK.bgSize || "cover";
  var MASK = PICK.mask || "linear-gradient(to top,#000 0,#000 50%,rgba(0,0,0,.55) 74%,transparent 94%)";
  var TINTB = PICK.tintB || "linear-gradient(to top,rgba(4,7,18,.58) 0%,rgba(8,12,28,.46) 60%,rgba(16,22,42,.36) 100%)";
  var TINTA = PICK.tintA || "linear-gradient(to top,rgba(0,0,0,.9) 0,rgba(0,0,0,.6) 38%,rgba(0,0,0,.32) 66%,rgba(0,0,0,.12) 84%,transparent 96%)";
  var DO_BLOOM = PICK.bloom !== false;
  try {
    document.documentElement.style.setProperty("--van-bottom", PICK.vanBottom || "50px");
    if (PICK.roadHide) document.documentElement.setAttribute("data-bset-quay", "1");  // pages hide their road strip for quay towns
  } catch (e) {}
  var DO_AURORA = OPT.aurora !== false;   // set {aurora:false} to add only town+bloom (page brings its own sky)
  var SET_PAL = OPT.setPalette !== false; // set {setPalette:false} to leave --pkg* alone (page owns the palette)

  var CSS =
    ".bset-aurora{position:fixed;inset:0;width:100%;height:100%;z-index:var(--bset-z,0);display:block;pointer-events:none;background:#02040a}" +
    ".bset-town{position:fixed;left:0;right:0;bottom:" + TBOT + ";height:" + TH + ";z-index:calc(var(--bset-z,0) + 1);pointer-events:none;" +
      "background:url('" + TOWN + "') center bottom/" + BGSIZE + " no-repeat;" +
      "-webkit-mask-image:" + MASK + ";mask-image:" + MASK + "}" +
    ".bset-town::before{content:'';position:absolute;inset:0;background:" + TINTB + "}" +
    ".bset-town::after{content:'';position:absolute;inset:0;background:" + TINTA + "}" +
    ".bset-bloom{position:fixed;left:0;bottom:" + TBOT + ";width:100%;height:" + TH + ";z-index:calc(var(--bset-z,0) + 2);pointer-events:none;mix-blend-mode:screen;opacity:.75;" +
      "animation:bset-flutter 7.5s ease-in-out infinite;" +
      "-webkit-mask-image:linear-gradient(to top,transparent 0,transparent 35%,#000 48%,#000 78%,transparent 95%);" +
      "mask-image:linear-gradient(to top,transparent 0,transparent 35%,#000 48%,#000 78%,transparent 95%)}" +
    "@keyframes bset-flutter{0%{opacity:.74}6%{opacity:.81}9%{opacity:.64}12%{opacity:.80}20%{opacity:.76}28%{opacity:.85}31%{opacity:.69}34%{opacity:.82}44%{opacity:.77}52%{opacity:.72}60%{opacity:.86}63%{opacity:.67}66%{opacity:.81}76%{opacity:.75}85%{opacity:.84}88%{opacity:.70}100%{opacity:.76}}" +
    "@media (prefers-reduced-motion:reduce){.bset-bloom{animation:none;opacity:.75}}";

  /* ---------- palette: one random hue → harmonious aurora bands + accent ---------- */
  function hslToRgb(h, s, l) {
    h /= 360; var a = s * Math.min(l, 1 - l);
    var f = function (n) { var k = (n + h * 12) % 12; return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1))); };
    return [f(0), f(8), f(4)];
  }
  var hex2 = function (v) { return Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0"); };
  var rgbHex = function (rgb) { return "#" + rgb.map(hex2).join(""); };
  var sc = function (c, f) { return [Math.min(1, c[0] * f), Math.min(1, c[1] * f), Math.min(1, c[2] * f)]; };
  var mx = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };

  var hxArr = function (h) { h = String(h || "").replace("#", ""); if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join(""); var n = parseInt(h, 16) || 0; return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  // a box's three colours → the aurora palette (two bands + glow + dark sky)
  function palFromColors(c1, c2, ac) { var a = hxArr(c1), b = hxArr(c2), g = hxArr(ac); return { a1: a, a2: b, glow: g, sky0: sc(a, 0.12), sky1: sc(mx(a, b, 0.5), 0.22) }; }

  // initial colours: from OPT.colors (e.g. the box on the page) else a random harmonious hue
  var hex;
  if (OPT.colors && OPT.colors.c1) {
    hex = { pkg1: OPT.colors.c1, pkg2: OPT.colors.c2 || OPT.colors.c1, pkgAccent: OPT.colors.accent || OPT.colors.c1 };
  } else {
    var H = Math.random() * 360, off = 28 + Math.random() * 52, H2 = (H + off) % 360;
    hex = { pkg1: rgbHex(hslToRgb(H, 0.82, 0.46)), pkg2: rgbHex(hslToRgb(H2, 0.86, 0.56)), pkgAccent: rgbHex(hslToRgb((H + off / 2) % 360, 0.92, 0.72)) };
  }
  // live (cur) + target (tgt) palettes — the aurora eases cur → tgt so colours glide, never cut
  var cur = palFromColors(hex.pkg1, hex.pkg2, hex.pkgAccent), tgt = cur;

  function setVars() {
    var r = document.documentElement.style;
    r.setProperty("--pkg-accent", hex.pkgAccent);
    r.setProperty("--pkg1", hex.pkg1);
    r.setProperty("--pkg2", hex.pkg2);
  }

  // public — retint the whole set to a box's colours; the aurora glides there over ~2s
  function setColors(c1, c2, ac) {
    if (!c1) return; c2 = c2 || c1; ac = ac || c1;
    if (hex.pkg1 === c1 && hex.pkg2 === c2 && hex.pkgAccent === ac) return;
    hex.pkg1 = c1; hex.pkg2 = c2; hex.pkgAccent = ac;
    tgt = palFromColors(c1, c2, ac);
    if (SET_PAL) setVars();
  }
  window.GIIIFTSet = { hex: hex, setColors: setColors, town: PICK, get pal() { return cur; } };

  /* ---------- aurora shader ---------- */
  function runAurora(canvas) {
    var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) { canvas.style.background = "radial-gradient(120% 80% at 50% 100%, " + hex.pkg1 + "33, #02040a 70%)"; return; }
    var vs = "attribute vec4 p;void main(){gl_Position=p;}";
    var fs =
      "precision highp float;uniform vec2 u_resolution;uniform float u_time;uniform vec3 u_sky0;uniform vec3 u_sky1;uniform vec3 u_aurora1;uniform vec3 u_aurora2;uniform vec3 u_glow;" +
      "float hash(float n){return fract(sin(n)*1e4);}float hash(vec2 p){return fract(1e4*sin(17.0*p.x+p.y*0.1)*(0.1+abs(sin(p.y*13.0+p.x))));}" +
      "float noise(vec3 x){const vec3 step=vec3(110,241,171);vec3 i=floor(x);vec3 f=fract(x);float n=dot(i,step);vec3 u=f*f*(3.0-2.0*f);return mix(mix(mix(hash(n+dot(step,vec3(0,0,0))),hash(n+dot(step,vec3(1,0,0))),u.x),mix(hash(n+dot(step,vec3(0,1,0))),hash(n+dot(step,vec3(1,1,0))),u.x),u.y),mix(mix(hash(n+dot(step,vec3(0,0,1))),hash(n+dot(step,vec3(1,0,1))),u.x),mix(hash(n+dot(step,vec3(0,1,1))),hash(n+dot(step,vec3(1,1,1))),u.x),u.y),u.z);}" +
      "float fbm(vec3 p){float f=0.0;float w=0.5;for(int i=0;i<5;i++){f+=w*noise(p);p*=2.0;w*=0.5;}return f;}" +
      "float grain(vec2 uv,float t){float m=dot(uv,vec2(12.9898,78.233));return fract(sin(m+t)*43758.5453)*0.15;}" +
      "float makeStars(vec2 uv){float n=hash(uv*200.0);float s=smoothstep(0.99,1.0,n);s*=(sin(u_time*2.0+n*100.0)*0.5+0.5);return s;}" +
      "void main(){vec2 uv=gl_FragCoord.xy/u_resolution.xy;vec2 st=uv;st.x*=u_resolution.x/u_resolution.y;float t=u_time*0.15;vec3 skyColor=mix(u_sky0,u_sky1,uv.y);skyColor+=vec3(makeStars(st))*0.5;vec2 warp=st;warp.x+=sin(warp.y*3.0+t)*0.1;warp.y+=cos(warp.x*2.0-t*0.5)*0.1;vec3 p=vec3(warp.x*3.0,warp.y*0.5-t*0.8,t*0.5);float n1=fbm(p);float band1=smoothstep(0.2,0.7,n1);vec3 p2=vec3(warp.x*4.0-t,warp.y*0.6-t*1.2,t*0.7);float n2=fbm(p2);float band2=smoothstep(0.3,0.8,n2);vec3 auroraColor=mix(u_aurora1*0.3,u_aurora1,band1);auroraColor=mix(auroraColor,u_aurora2,band2*0.8);float hl=distance(uv,vec2(0.8,0.8));hl=smoothstep(1.0,0.0,hl);auroraColor=mix(auroraColor,u_glow,hl*band1*0.6);float edge=smoothstep(0.6,0.8,n1)*smoothstep(0.8,0.6,n1);auroraColor+=u_glow*edge*0.5;float alphaMask=smoothstep(-0.2,0.8,uv.y)*0.8;vec3 finalColor=skyColor+(auroraColor*alphaMask);float vig=uv.x*uv.y*(1.0-uv.x)*(1.0-uv.y);vig=clamp(pow(16.0*vig,0.25),0.0,1.0);finalColor*=vig;finalColor+=vec3(grain(uv,u_time))*0.6;finalColor=smoothstep(0.0,1.0,finalColor);gl_FragColor=vec4(finalColor,1.0);}";
    function mk(t, src) { var o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.error("[borealis-set]", gl.getShaderInfoLog(o)); return null; } return o; }
    var v = mk(gl.VERTEX_SHADER, vs), f = mk(gl.FRAGMENT_SHADER, fs); if (!v || !f) return;
    var prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error("[borealis-set] link", gl.getProgramInfoLog(prog)); return; }
    var lp = gl.getAttribLocation(prog, "p");
    var L = {}; ["u_resolution", "u_time", "u_sky0", "u_sky1", "u_aurora1", "u_aurora2", "u_glow"].forEach(function (n) { L[n] = gl.getUniformLocation(prog, n); });
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]), gl.STATIC_DRAW);
    var start = Date.now(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    function lerp(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
    (function frame() {
      var k = 0.02;   // ease the live palette toward the target → smooth colour transitions
      cur = { a1: lerp(cur.a1, tgt.a1, k), a2: lerp(cur.a2, tgt.a2, k), glow: lerp(cur.glow, tgt.glow, k), sky0: lerp(cur.sky0, tgt.sky0, k), sky1: lerp(cur.sky1, tgt.sky1, k) };
      var w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (w && h && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
      gl.useProgram(prog); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(lp);
      gl.uniform2f(L.u_resolution, canvas.width || 1, canvas.height || 1); gl.uniform1f(L.u_time, (Date.now() - start) / 1000.0);
      gl.uniform3f(L.u_sky0, cur.sky0[0], cur.sky0[1], cur.sky0[2]); gl.uniform3f(L.u_sky1, cur.sky1[0], cur.sky1[1], cur.sky1[2]);
      gl.uniform3f(L.u_aurora1, cur.a1[0], cur.a1[1], cur.a1[2]); gl.uniform3f(L.u_aurora2, cur.a2[0], cur.a2[1], cur.a2[2]); gl.uniform3f(L.u_glow, cur.glow[0], cur.glow[1], cur.glow[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); requestAnimationFrame(frame);
    })();
  }

  /* ---------- window-glow bloom (large warm windows + the hero arched window) ---------- */
  function runBloom(canvas, src) {
    var ctx = canvas.getContext("2d"); var img = new Image();
    function render() {
      if (!img.naturalWidth) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var W = canvas.clientWidth, Hc = canvas.clientHeight; if (!W || !Hc) return;
      var cw = Math.round(W * dpr), ch = Math.round(Hc * dpr);
      canvas.width = cw; canvas.height = ch;
      var o = document.createElement("canvas"); o.width = cw; o.height = ch; var oc = o.getContext("2d");
      var iw = img.naturalWidth, ih = img.naturalHeight, s = Math.max(cw / iw, ch / ih);
      var dw = iw * s, dh = ih * s; oc.drawImage(img, (cw - dw) / 2, ch - dh, dw, dh);
      var id; try { id = oc.getImageData(0, 0, cw, ch); } catch (e) { return; }
      var d = id.data;
      for (var i = 0; i < d.length; i += 4) {
        var r = d[i], g = d[i + 1], b = d[i + 2], luma = 0.299 * r + 0.587 * g + 0.114 * b;
        if (luma > 168 && (r - b) > 52) { d[i] = Math.min(255, r + 30); d[i + 1] = Math.round(g * 0.9); d[i + 2] = Math.round(b * 0.55); }
        else { d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; } d[i + 3] = 255;
      }
      oc.putImageData(id, 0, 0);
      var k = 0.13, sw = Math.max(1, Math.round(cw * k)), sh = Math.max(1, Math.round(ch * k));
      var sm = document.createElement("canvas"); sm.width = sw; sm.height = sh; var so = sm.getContext("2d"); so.imageSmoothingEnabled = true; so.drawImage(o, 0, 0, sw, sh);
      var sid = so.getImageData(0, 0, sw, sh), sd = sid.data;
      for (var j = 0; j < sd.length; j += 4) { var lum = 0.299 * sd[j] + 0.587 * sd[j + 1] + 0.114 * sd[j + 2]; if (lum < 100) { sd[j] = 0; sd[j + 1] = 0; sd[j + 2] = 0; } sd[j + 3] = 255; }
      so.putImageData(sid, 0, 0);
      ctx.clearRect(0, 0, cw, ch); ctx.globalCompositeOperation = "lighter"; ctx.imageSmoothingEnabled = true;
      ctx.filter = "blur(" + (2 * dpr) + "px)"; ctx.drawImage(sm, 0, 0, cw, ch);
      ctx.filter = "blur(" + (7 * dpr) + "px)"; ctx.drawImage(sm, 0, 0, cw, ch);
      // hero arched window — paint a warm glow up into the unlit arch
      var ARCH = { x: 1295, y: 925, rx: 50, ry: 75 }, ox = (cw - dw) / 2, oy = ch - dh;
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.filter = "blur(" + (2 * dpr) + "px)";
      ctx.translate(ox + ARCH.x * s, oy + ARCH.y * s); ctx.scale(ARCH.rx / ARCH.ry, 1);
      var rr = ARCH.ry * s, ag = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
      ag.addColorStop(0, "rgba(255,204,132,0.95)"); ag.addColorStop(0.55, "rgba(255,186,108,0.42)"); ag.addColorStop(1, "rgba(255,170,90,0)");
      ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.filter = "none"; ctx.globalCompositeOperation = "source-over";
    }
    var t; window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(render, 200); });
    img.addEventListener("load", render); img.src = src;
  }

  function mount() {
    if (document.getElementById("bset-css")) return;
    var st = document.createElement("style"); st.id = "bset-css"; st.textContent = CSS; document.head.appendChild(st);
    var town = document.createElement("div"); town.className = "bset-town"; town.setAttribute("aria-hidden", "true");
    var bloom = null;
    if (DO_BLOOM) { bloom = document.createElement("canvas"); bloom.className = "bset-bloom"; bloom.id = "bset-bloom"; bloom.setAttribute("aria-hidden", "true"); document.body.insertBefore(bloom, document.body.firstChild); }
    document.body.insertBefore(town, document.body.firstChild);
    if (DO_AURORA) {
      var aur = document.createElement("canvas"); aur.className = "bset-aurora"; aur.id = "bset-aurora"; aur.setAttribute("aria-hidden", "true");
      document.body.insertBefore(aur, document.body.firstChild);
      runAurora(aur);
    }
    if (SET_PAL) setVars();
    if (DO_BLOOM && bloom) runBloom(bloom, TOWN);
  }

  if (SET_PAL) setVars();   // set palette vars ASAP so the van's neon picks them up before mount
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
