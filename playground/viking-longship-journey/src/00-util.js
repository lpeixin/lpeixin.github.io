/* =========================================================================
   NORTHBOUND — utilities: math, noise, procedural textures, geometry helpers
   ========================================================================= */
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));
const fract = (x) => x - Math.floor(x);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0x9E3779B9);

function hash21(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}
function hash11(x) {
  const n = Math.sin(x * 78.233) * 43758.5453123;
  return n - Math.floor(n);
}
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash21(xi, yi), b = hash21(xi + 1, yi), c = hash21(xi, yi + 1), d = hash21(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function noise22(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const h = (a, b) => {
    const n1 = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
    const n2 = Math.sin(a * 269.5 + b * 183.3) * 43758.5453123;
    return [n1 - Math.floor(n1), n2 - Math.floor(n2)];
  };
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return [
    lerp(lerp(a[0], b[0], u), lerp(c[0], d[0], u), v) * 2 - 1,
    lerp(lerp(a[1], b[1], u), lerp(c[1], d[1], u), v) * 2 - 1,
  ];
}
function fbm2(x, y, oct = 4, lac = 2.02, gain = 0.5) {
  let s = 0, a = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); norm += a; a *= gain; f *= lac; }
  return s / norm;
}
function ridged2(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(noise2(x * f, y * f) * 2 - 1);
    s += a * n * n; norm += a; a *= 0.5; f *= 2.03;
  }
  return s / norm;
}

/* tileable value noise (period in lattice units) */
function pnoise2(x, y, px, py) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const wr = (a, b) => hash21(((a % px) + px) % px, ((b % py) + py) % py);
  const a = wr(xi, yi), b = wr(xi + 1, yi), c = wr(xi, yi + 1), d = wr(xi + 1, yi + 1);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function pfbm2(x, y, px, py, oct = 4, gain = 0.5) {
  let s = 0, a = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += a * pnoise2(x * f, y * f, px * f, py * f);
    norm += a; a *= gain; f *= 2;
  }
  return s / norm;
}
function pridge2(x, y, px, py, oct = 4) {
  let s = 0, a = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(pnoise2(x * f, y * f, px * f, py * f) * 2 - 1);
    s += a * n * n; norm += a; a *= 0.5; f *= 2;
  }
  return s / norm;
}

/* linear-space colour from an sRGB hex (rendering is linear, tone-mapped at the end) */
const glCol = (hex) => new THREE.Color(hex).convertSRGBToLinear();
const CV = new THREE.Vector2();
const CV3 = new THREE.Vector3();

/* ------------------------------------------------------------------ canvas */
function cnv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function makeTexture(canvas, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso;
  if (srgb) t.encoding = THREE.sRGBEncoding;
  t.needsUpdate = true;
  return t;
}
/* height field -> tangent-space normal map */
function normalMapFromHeight(h, S, strength = 2.0) {
  const c = cnv(S, S), ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S), d = img.data;
  const at = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * S + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
function grayTexture(arr, S, lo = 0, hi = 1) {
  const c = cnv(S, S), ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S), d = img.data;
  for (let i = 0; i < S * S; i++) {
    const v = clamp((arr[i] - lo) / (hi - lo), 0, 1) * 255;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/* ----------------------------------------------------------------- textiles */
function makeWoodTextures(S = 512, opts = {}) {
  const { planks = 5, tone = 0.52, warm = 1.0, seed = 1, grain = 1.0 } = opts;
  const r = mulberry32(seed);
  const c = cnv(S, S), ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S), d = img.data;
  const hgt = new Float32Array(S * S);
  const ph = S / planks;
  const plankTone = new Float32Array(planks);
  for (let i = 0; i < planks; i++) plankTone[i] = 0.82 + r() * 0.36;
  const knots = [];
  for (let i = 0; i < 5; i++) knots.push([r() * S, r() * S, 8 + r() * 16]);

  for (let y = 0; y < S; y++) {
    const pi = Math.floor(y / ph);
    const v = (y % ph) / ph;
    for (let x = 0; x < S; x++) {
      const u = x / S;
      /* grain: stretched along U */
      const g1 = fbm2(u * 5.0 + pi * 17.3, v * 46 + pi * 4.1, 4);
      const g2 = fbm2(u * 22 + pi * 3.1, v * 150, 3);
      let g = (g1 - 0.5) * 0.9 + (g2 - 0.5) * 0.35;
      /* knots */
      let knot = 0;
      for (const k of knots) {
        const dx = x - k[0], dy = (y - k[1]) * 2.2;
        const dd = Math.hypot(dx, dy) / k[2];
        if (dd < 2.4) knot += Math.exp(-dd * dd * 2.2);
      }
      g += knot * 0.22 * Math.sin(Math.atan2(y - knots[0][1], x - knots[0][0]) * 3.0);
      /* plank seam shadow */
      const seam = smoothstep(0.0, 0.035, v) * smoothstep(1.0, 0.965, v);
      const k = plankTone[pi] * (0.86 + g * 0.34 * grain) * (0.55 + 0.45 * seam);
      const base = tone;
      const cr = 255 * clamp(k * (base * 1.32 * warm), 0, 1);
      const cg = 255 * clamp(k * (base * 1.02), 0, 1);
      const cb = 255 * clamp(k * (base * 0.78 / Math.max(warm, 0.6)), 0, 1);
      const i4 = (y * S + x) * 4;
      d[i4] = cr; d[i4 + 1] = cg; d[i4 + 2] = cb; d[i4 + 3] = 255;
      hgt[y * S + x] = (seam - 0.5) * 0.8 + g * 0.55 + knot * 0.2;
    }
  }
  ctx.putImageData(img, 0, 0);
  const rough = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) rough[i] = 0.55 + (hgt[i] + 0.5) * 0.18;
  return {
    map: c,
    normal: normalMapFromHeight(hgt, S, 1.35),
    rough: grayTexture(rough, S, 0.3, 1.0),
  };
}

/* tileable fbm — the lattice period must equal the coordinate span or the
   texture shows a seam when repeated; keep freq and period in lockstep. */
function fbmT(u, v, F, G, oct = 4, gain = 0.5) {
  return pfbm2(u * F, v * G, F, G, oct, gain);
}
function ridgeT(u, v, F, G, oct = 3) {
  return pridge2(u * F, v * G, F, G, oct);
}

/* Fractured granite. Bands of bedding + two generations of thin fracture
   lines + vertical seepage streaks, on top of mineral grain. Deliberately low
   contrast so the repeat does not read as a pattern at distance. */
function makeRockTextures(S = 512, seed = 7) {
  const c = cnv(S, S), ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S), d = img.data;
  const hgt = new Float32Array(S * S);
  const rgh = new Float32Array(S * S);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;

      /* domain warp — kills the regularity of the value-noise lattice */
      const wx = fbmT(u, v, 3, 3, 3) - 0.5;
      const wy = fbmT(u + 0.37, v + 0.71, 3, 3, 3) - 0.5;
      const wu = u + wx * 0.16, wv = v + wy * 0.16;

      /* gneiss foliation — fine laminae stretched along the banding direction */
      const lam = pnoise2(wu * 3.0, wv * 26.0, 3.0, 26.0);
      const lam2 = pnoise2(wu * 7.0 + 3.3, wv * 58.0, 7.0, 58.0);
      /* broad tonal drift so large areas are not the same value */
      const bed = fbmT(wu, wv, 2.0, 2.0, 3);

      /* fractures come from the zero contour of a slowly varying field: a
         continuous curve network, unlike a threshold on fbm which gives blobs */
      const n1 = pnoise2(wu * 5.0 + 0.13, wv * 4.2 + 0.51, 5.0, 4.2);
      const n2 = pnoise2(wu * 9.0 + 4.7, wv * 8.4 + 2.3, 9.0, 8.4);
      const n3 = pnoise2(wu * 17.0 + 8.1, wv * 15.0 + 6.4, 17.0, 15.0);
      /* ... but only where a slower field lets them through, so they break
         into segments and vary in strength instead of reading as outlines */
      const seamMask = smoothstep(0.34, 0.62, fbmT(wu + 0.6, wv + 0.2, 3.5, 3.5, 3));
      const crack = Math.min(1, seamMask * (
        (1 - smoothstep(0.004, 0.026, Math.abs(n1 - 0.5))) * 1.00 +
        (1 - smoothstep(0.004, 0.019, Math.abs(n2 - 0.5))) * 0.62 +
        (1 - smoothstep(0.003, 0.013, Math.abs(n3 - 0.5))) * 0.34));

      /* vertical seepage staining */
      const stk = fbmT(u + 0.19, v, 22, 1.5, 3);

      /* mineral grain */
      const grit = fbmT(u, v, 60, 60, 2);
      const spk = fbmT(u, v, 132, 132, 2);

      let g = 0.385
        + (bed - 0.5) * 0.105
        + (lam - 0.5) * 0.110
        + (lam2 - 0.5) * 0.065
        + (stk - 0.5) * 0.070
        + (grit - 0.5) * 0.120
        + (spk - 0.5) * 0.060;
      g *= 1.0 - crack * 0.26;
      g = clamp(g, 0.09, 0.72);

      /* cool granite; warmth only where the iron-rich laminae sit */
      const warm = clamp((lam - 0.46) * 1.6 + (stk - 0.5) * 0.6, 0, 1);
      const i4 = (y * S + x) * 4;
      d[i4] = 255 * clamp(g * (1.005 + warm * 0.070), 0, 1);
      d[i4 + 1] = 255 * clamp(g * (1.000 + warm * 0.006), 0, 1);
      d[i4 + 2] = 255 * clamp(g * (1.020 - warm * 0.060), 0, 1);
      d[i4 + 3] = 255;

      const i = y * S + x;
      hgt[i] = (bed - 0.5) * 0.34 + (lam - 0.5) * 0.44 + (lam2 - 0.5) * 0.18
        - crack * 0.52 + (grit - 0.5) * 0.30 + (spk - 0.5) * 0.12;
      rgh[i] = 0.68 + crack * 0.20 + (spk - 0.5) * 0.14;
    }
  }
  ctx.putImageData(img, 0, 0);
  return {
    map: c,
    normal: normalMapFromHeight(hgt, S, 1.55),
    rough: grayTexture(rgh, S, 0.45, 1.0),
  };
}

function makeMossTextures(S = 512) {
  const c = cnv(S, S), ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S), d = img.data;
  const hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S * 4, v = y / S * 4;
      const clump = pfbm2(u * 2, v * 2, 8, 8, 4);
      const fine = pfbm2(u * 12 + 3, v * 12, 48, 48, 3);
      const dry = pfbm2(u * 0.9 + 11, v * 0.9, 4, 4, 3);
      const moss = smoothstep(0.36, 0.72, clump * 0.75 + fine * 0.35);
      const g1 = 0.10 + moss * 0.11 + (1 - dry) * 0.05;
      const i4 = (y * S + x) * 4;
      d[i4] = 255 * clamp(g1 * (0.85 + dry * 0.28), 0, 1);
      d[i4 + 1] = 255 * clamp(g1 * (1.18 + dry * 0.20), 0, 1);
      d[i4 + 2] = 255 * clamp(g1 * (0.66 + dry * 0.16), 0, 1);
      d[i4 + 3] = 255;
      hgt[y * S + x] = clump * 0.55 + fine * 0.45;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { map: c, normal: normalMapFromHeight(hgt, S, 1.0) };
}

function makeWaterNormal(S = 512) {
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S * TAU, v = y / S * TAU;
      let s = 0;
      s += Math.sin(u * 2 + v * 1.3) * 0.5;
      s += Math.sin(u * 3 - v * 4 + 1.7) * 0.32;
      s += Math.sin(u * 5 + v * 6 + 0.4) * 0.18;
      s += (fbm2(x / S * 8, y / S * 8, 3) - 0.5) * 0.7;
      h[y * S + x] = s;
    }
  }
  return normalMapFromHeight(h, S, 2.6);
}

function makeFoamTexture(S = 512) {
  const c = cnv(S, S), ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S * 14, v = y / S * 14;
      const n = fbm2(u, v, 5, 2.1, 0.55);
      const bub = smoothstep(0.44, 0.72, n);
      const i4 = (y * S + x) * 4;
      const val = 255 * clamp(bub * 0.95 + 0.08, 0, 1);
      d[i4] = d[i4 + 1] = d[i4 + 2] = val; d[i4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function makeSailTexture(W = 512, H = 512) {
  const c = cnv(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = '#d9cfba'; ctx.fillRect(0, 0, W, H);
  const stripes = 9;
  for (let i = 0; i < stripes; i += 2) {
    ctx.fillStyle = '#8d3630';
    ctx.fillRect(Math.floor(i * W / stripes), 0, Math.ceil(W / stripes), H);
  }
  /* weathering + weave */
  const img = ctx.getImageData(0, 0, W, H), d = img.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i4 = (y * W + x) * 4;
      const weave = ((x % 3 === 0) ? 0.965 : 1.0) * ((y % 3 === 0) ? 0.975 : 1.0);
      const dirt = 0.88 + fbm2(x / W * 7, y / H * 9, 4) * 0.22;
      const seam = (x % Math.floor(W / stripes) < 2) ? 0.94 : 1;
      const k = weave * dirt * seam;
      d[i4] = clamp(d[i4] * k, 0, 255);
      d[i4 + 1] = clamp(d[i4 + 1] * k, 0, 255);
      d[i4 + 2] = clamp(d[i4 + 2] * k, 0, 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function makeShieldTexture(kind, W = 256) {
  const c = cnv(W, W), ctx = c.getContext('2d');
  const cx = W / 2, cy = W / 2, R = W / 2;
  const palettes = [
    ['#b8433a', '#e0d6bf', '#3a3f36'],
    ['#d8cdb2', '#9a3f33', '#2f3b39'],
    ['#c9a24a', '#5b3a2a', '#e2d7c0'],
    ['#7d8c6a', '#d9cfb8', '#4a3a2c'],
  ];
  const p = palettes[kind % palettes.length];
  ctx.fillStyle = p[0]; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
  if (kind % 4 === 0) {
    ctx.fillStyle = p[1];
    for (let i = 0; i < 8; i++) {
      const a0 = i / 8 * TAU, a1 = (i + 1) / 8 * TAU;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = ctx.fillStyle === p[1] ? p[0] : p[1];
    }
  } else if (kind % 4 === 1) {
    ctx.fillStyle = p[1]; ctx.beginPath(); ctx.arc(cx, cy, R * 0.72, 0, TAU); ctx.fill();
    ctx.fillStyle = p[2]; ctx.beginPath(); ctx.arc(cx, cy, R * 0.42, 0, TAU); ctx.fill();
  } else if (kind % 4 === 2) {
    ctx.strokeStyle = p[1]; ctx.lineWidth = R * 0.16;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
    }
  } else {
    ctx.fillStyle = p[1];
    ctx.beginPath(); ctx.moveTo(cx, cy - R * 0.8); ctx.lineTo(cx + R * 0.8, cy); ctx.lineTo(cx, cy + R * 0.8); ctx.lineTo(cx - R * 0.8, cy); ctx.closePath(); ctx.fill();
  }
  /* planks + grime */
  const img = ctx.getImageData(0, 0, W, W), d = img.data;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const i4 = (y * W + x) * 4;
      const plank = (Math.abs(((x - cx) * 0.9 + (y - cy) * 0.4) % 14) < 1.4) ? 0.9 : 1;
      const dirt = 0.9 + fbm2(x / W * 8, y / W * 8, 3) * 0.2;
      const r = Math.hypot(x - cx, y - cy) / R;
      const wear = r > 0.9 ? 0.85 : 1;
      const k = plank * dirt * wear;
      /* weathered paint: knock the saturation back so the rack does not read
         as a row of fairground targets */
      const rr = d[i4], gg = d[i4 + 1], bb = d[i4 + 2];
      const lum = rr * 0.299 + gg * 0.587 + bb * 0.114;
      const mixS = 0.52;
      d[i4] = clamp((lum + (rr - lum) * mixS) * k * 0.80, 0, 255);
      d[i4 + 1] = clamp((lum + (gg - lum) * mixS) * k * 0.80, 0, 255);
      d[i4 + 2] = clamp((lum + (bb - lum) * mixS) * k * 0.80, 0, 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  /* rim + boss */
  ctx.strokeStyle = 'rgba(38,32,26,.85)'; ctx.lineWidth = W * 0.035;
  ctx.beginPath(); ctx.arc(cx, cy, R - W * 0.02, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#6b6b68'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.16, 0, TAU); ctx.fill();
  const g = ctx.createRadialGradient(cx - R * 0.05, cy - R * 0.05, 1, cx, cy, R * 0.16);
  g.addColorStop(0, 'rgba(230,232,226,.85)'); g.addColorStop(1, 'rgba(90,90,88,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 0.16, 0, TAU); ctx.fill();
  return c;
}

function makeGlowTexture(S = 128) {
  const c = cnv(S, S), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,236,196,1)');
  g.addColorStop(0.25, 'rgba(255,206,140,.55)');
  g.addColorStop(0.55, 'rgba(255,170,90,.16)');
  g.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  return c;
}

/* ----------------------------------------------------------------- geometry */
function mergeGeometries(list) {
  const geos = list.filter(Boolean);
  let total = 0;
  const prepared = [];
  for (const g of geos) {
    const ng = g.index ? g.toNonIndexed() : g;
    prepared.push(ng);
    total += ng.attributes.position.count;
  }
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let o = 0;
  for (const g of prepared) {
    const p = g.attributes.position.array, n = g.attributes.normal ? g.attributes.normal.array : null;
    const u = g.attributes.uv ? g.attributes.uv.array : null;
    const count = g.attributes.position.count;
    pos.set(p, o * 3);
    if (n) nor.set(n, o * 3);
    if (u) uv.set(u, o * 2);
    o += count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

/* orient a cylinder-like mesh (geometry along +Y, height 1, centred) between two points */
const _v0 = new THREE.Vector3(), _v1 = new THREE.Vector3(), _q0 = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
function setSegment(mesh, a, b, radiusScale = 1) {
  _v0.subVectors(b, a);
  const len = _v0.length() || 0.0001;
  mesh.position.copy(a).addScaledVector(_v0, 0.5);
  _v0.normalize();
  _q0.setFromUnitVectors(_up, _v0);
  mesh.quaternion.copy(_q0);
  mesh.scale.set(radiusScale, len, radiusScale);
}

function makeMat(opts) {
  const m = new THREE.MeshStandardMaterial(opts);
  return m;
}
