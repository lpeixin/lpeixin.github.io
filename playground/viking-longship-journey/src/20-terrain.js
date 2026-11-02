/* =========================================================================
   NORTHBOUND — the fjord: route, terrain, height field
   ========================================================================= */

const ROUTE = (() => {
  const pts = [];
  const N = 16;
  for (let i = 0; i < N; i++) {
    const a = i / N * TAU;
    const r = 452 + 26 * Math.sin(3 * a + 0.6) + 9 * Math.sin(5 * a + 2.0) + 4 * Math.sin(7 * a + 4.1);
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  const c = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
  c.arcLengthDivisions = 2400;
  return c;
})();

const ROUTE_LENGTH = ROUTE.getLength();

/* channel half-width at s */
function channelHalfWidth(s) {
  return 30.5 + 6.2 * Math.sin(s * TAU * 3 + 1.1) + 4.0 * Math.sin(s * TAU * 7 + 2.4) + 2.1 * Math.sin(s * TAU * 13 + 0.3);
}

/* waterfalls: a vertical rock face cut into the shore */
const FALLS = [
  { s: 0.132, side: 1, h: 58, w: 3.0 },
  { s: 0.404, side: -1, h: 66, w: 3.4 },
  { s: 0.663, side: 1, h: 52, w: 2.6 },
  { s: 0.888, side: -1, h: 62, w: 3.1 },
];

/* bays: wider, flatter ground for settlements */
const BAYS = [
  { s: 0.085, side: -1, w: 0.030, name: 'Settlement' },
  { s: 0.305, side: 1, w: 0.036, name: 'Settlement' },
  { s: 0.545, side: -1, w: 0.026, name: 'Settlement' },
  { s: 0.795, side: 1, w: 0.032, name: 'Settlement' },
];
function bayFactor(s, side) {
  let f = 0;
  for (const b of BAYS) {
    if (b.side !== side) continue;
    let ds = Math.abs(s - b.s);
    ds = Math.min(ds, 1 - ds);
    f = Math.max(f, Math.exp(-Math.pow(ds / b.w, 2)));
  }
  return f;
}

/* cliff height multiplier varying along the route */
function cliffScale(s) {
  return 0.72 + 0.62 * fbm2(s * 9.0 + 3.1, 4.7, 3) + 0.22 * Math.sin(s * TAU * 2.2);
}

const TERRAIN = {
  NS: 660,
  OFFS: (() => {
    const a = [0];
    let d = 0;
    const near = [2.2, 2.4, 2.5, 2.5, 2.5, 2.6, 2.6, 2.7, 2.7, 2.8, 2.9, 3.0, 3.0, 3.2, 3.3, 3.5, 3.6, 3.8, 4.0, 4.2, 4.4, 4.7, 5.0, 5.3, 5.7];
    for (const step of near) { d += step; a.push(d); }
    for (let i = 0; i < 9; i++) { d += 6.2; a.push(d); }
    for (let i = 0; i < 6; i++) { d += 9.5; a.push(d); }
    a.push(205);
    const out = [0];
    for (let i = a.length - 1; i >= 1; i--) out.unshift(-a[i]);
    for (let i = 1; i < a.length; i++) out.push(a[i]);
    return out;
  })(),
  data: null,
  size: 0,
  rectX: 0, rectZ: 0, rectSize: 0,
  mesh: null,
};

function terrainHeightAt(s, t) {
  const side = t >= 0 ? 1 : -1;
  const d = Math.abs(t);
  const bay = bayFactor(s, side);
  const hw = channelHalfWidth(s) * (1 + 0.42 * bay);
  let dn = d / hw;

  /* in a bay the flat shelf reaches further out before the cliff */
  let dnE = dn < 1 ? dn : 1 + (dn - 1) * (1 - 0.55 * bay);

  let h;
  if (dnE < 0.70) {
    h = -10.6 + 3.0 * dnE * dnE;
  } else if (dnE < 1.0) {
    h = lerp(-9.1, -0.85, smoothstep(0.70, 1.0, dnE));
  } else if (dnE < 1.26) {
    h = lerp(-0.85, 1.7, smoothstep(1.0, 1.26, dnE));
    h = lerp(h, 2.6, bay * smoothstep(1.0, 1.08, dnE) * 0.8);
  } else if (dnE < 2.05) {
    h = lerp(1.7, 10.0, smoothstep(1.26, 2.05, dnE));
    h = lerp(h, 4.2 + (dnE - 1.26) * 2.2, bay * 0.85);
  } else if (dnE < 3.35) {
    h = lerp(10.0, 68.0 * cliffScale(s), smoothstep(2.05, 3.35, dnE));
    h = lerp(h, lerp(6.0, 52.0 * cliffScale(s), smoothstep(1.5, 3.35, dnE)), bay * 0.55);
  } else if (dnE < 5.1) {
    h = lerp(68.0 * cliffScale(s), 172.0 * cliffScale(s), smoothstep(3.35, 5.1, dnE));
  } else if (dnE < 6.7) {
    h = lerp(172.0 * cliffScale(s), 252.0 * cliffScale(s) + 26, smoothstep(5.1, 6.7, dnE));
  } else {
    h = 252.0 * cliffScale(s) + 26 + (dnE - 6.7) * 14.0;
  }

  /* horizontal bedding terraces on the cliff band: a height field can only
     express ledges as steps, and stepped strata are exactly what a fjord wall
     looks like. Noise is added afterwards so the steps are never straight. */
  if (dnE > 1.85 && dnE < 6.6) {
    const terr = 17.5;
    const k = h / terr;
    const fl = Math.floor(k);
    const fr = k - fl;
    const stepped = (fl + smoothstep(0.40, 0.74, fr)) * terr;
    const wgt = smoothstep(1.85, 2.55, dnE) * (1 - smoothstep(5.7, 6.6, dnE));
    h = lerp(h, stepped, wgt * 0.40);
  }

  /* world position for noise (continuous across the seam) */
  const u = s - Math.floor(s);
  const p = ROUTE.getPointAt(u);
  const tan = ROUTE.getTangentAt(u);
  const nx = -tan.z, nz = tan.x;
  const wx = p.x + nx * t, wz = p.z + nz * t;

  const nFar = smoothstep(0.94, 1.5, dnE);
  const nMid = smoothstep(1.02, 1.9, dnE);
  const big = fbm2(wx * 0.0055 + 11, wz * 0.0055 - 7, 4) - 0.5;
  h += big * 55 * smoothstep(1.6, 4.5, dnE);
  const ridged = ridged2(wx * 0.016 - 3, wz * 0.016 + 5, 4);
  h += (ridged - 0.45) * 36 * smoothstep(2.2, 4.5, dnE) * cliffScale(s);
  /* buttresses and gullies carved into the wall ~13 m apart */
  h += (ridged2(wx * 0.075 + 1.7, wz * 0.075 - 2.4, 3) - 0.42) * 5.4 * smoothstep(1.85, 3.0, dnE) * (0.6 + 0.5 * cliffScale(s));
  h += (fbm2(wx * 0.045, wz * 0.045, 3) - 0.5) * 7.5 * nMid;
  h += (fbm2(wx * 0.13 + 5, wz * 0.13 - 2, 3) - 0.5) * 1.9 * nMid;
  h += (fbm2(wx * 0.32, wz * 0.32, 2) - 0.5) * 0.55 * nFar;

  /* small offshore rocks and shelves near the shore */
  if (dn > 0.95 && dn < 1.35) {
    const shelf = fbm2(wx * 0.06 - 4, wz * 0.06 + 8, 3);
    h += (shelf - 0.5) * 2.6;
  }
  /* waterfall notch: vertical rock face at the shoreline */
  for (let i = 0; i < FALLS.length; i++) {
    const f = FALLS[i];
    if (f.side !== side) continue;
    let ds = Math.abs(s - f.s);
    ds = Math.min(ds, 1 - ds);
    if (ds > 0.014) continue;
    const infl = Math.exp(-Math.pow(ds / 0.0055, 2));
    const ramp = smoothstep(hw * 1.04, hw * 1.46, d);
    const target = lerp(-2.0, f.h * (1 + 0.15 * Math.sin(ds * 2000)), Math.pow(ramp, 1.35));
    h = lerp(h, target, infl * 0.86);
  }

  /* the channel floor is never below the hull's draft */
  if (dn < 0.72) h = Math.min(h, -6.2);
  return h;
}

function buildTerrain() {
  const NS = TERRAIN.NS, OFFS = TERRAIN.OFFS, NT = OFFS.length;
  const verts = new Float32Array((NS + 1) * NT * 3);
  const uvs = new Float32Array((NS + 1) * NT * 2);
  const colors = new Float32Array((NS + 1) * NT * 3);
  const idx = [];
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;

  for (let i = 0; i <= NS; i++) {
    const s = i / NS;
    const u = s % 1;
    const p = ROUTE.getPointAt(u);
    const tan = ROUTE.getTangentAt(u);
    const nx = -tan.z, nz = tan.x;
    for (let j = 0; j < NT; j++) {
      const t = OFFS[j];
      const h = terrainHeightAt(u, t);
      const x = p.x + nx * t, z = p.z + nz * t;
      const k = (i * NT + j);
      verts[k * 3] = x; verts[k * 3 + 1] = h; verts[k * 3 + 2] = z;
      uvs[k * 2] = s * 26; uvs[k * 2 + 1] = t * 0.05;
      const v = 0.82 + fbm2(x * 0.05, z * 0.05, 3) * 0.3;
      colors[k * 3] = v; colors[k * 3 + 1] = v; colors[k * 3 + 2] = v;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
  }
  for (let i = 0; i < NS; i++) {
    for (let j = 0; j < NT - 1; j++) {
      const a = i * NT + j, b = (i + 1) * NT + j, c = i * NT + j + 1, d = (i + 1) * NT + j + 1;
      idx.push(a, c, b, c, d, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();

  /* ---- height field bake (for water depth, collision, placement) ---- */
  const S = 1024;
  const pad = 40;
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const sizeW = Math.max(maxX - minX, maxZ - minZ) + pad * 2;
  const data = new Float32Array(S * S).fill(-999);
  const inv = S / sizeW;
  const ox = cx - sizeW / 2, oz = cz - sizeW / 2;
  const toI = (x) => (x - ox) * inv;
  const toJ = (z) => (z - oz) * inv;

  for (let i = 0; i < NS; i++) {
    for (let j = 0; j < NT - 1; j++) {
      const iA = i * NT + j, iB = (i + 1) * NT + j, iC = i * NT + j + 1, iD = (i + 1) * NT + j + 1;
      rasterTri(verts, iA, iB, iC, toI, toJ, data, S, inv, ox, oz);
      rasterTri(verts, iC, iB, iD, toI, toJ, data, S, inv, ox, oz);
    }
  }
  for (let k = 0; k < S * S; k++) if (data[k] < -900) data[k] = -46;

  TERRAIN.data = data; TERRAIN.size = S;
  TERRAIN.rectX = cx - sizeW / 2; TERRAIN.rectZ = cz - sizeW / 2; TERRAIN.rectSize = sizeW;

  const hTex = new THREE.DataTexture(data, S, S, THREE.RedFormat, THREE.FloatType);
  hTex.minFilter = hTex.magFilter = THREE.NearestFilter;
  hTex.wrapS = hTex.wrapT = THREE.ClampToEdgeWrapping;
  hTex.needsUpdate = true;
  TERRAIN.heightTex = hTex;

  const rock = TEX.rock, moss = TEX.moss;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.96, metalness: 0.0, vertexColors: true,
    dithering: true,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRock = { value: rock.mapTex };
    shader.uniforms.uRockN = { value: rock.normTex };
    shader.uniforms.uMoss = { value: moss.mapTex };
    shader.uniforms.uMossN = { value: moss.normTex };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <project_vertex>', `
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNrm = normalize(mat3(modelMatrix) * objectNormal);
        #include <project_vertex>`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWNrm;
        uniform sampler2D uRock; uniform sampler2D uRockN;
        uniform sampler2D uMoss; uniform sampler2D uMossN;
        float nbHash(vec2 p){ p = fract(p * vec2(127.1, 311.7)); p += dot(p, p + 34.56); return fract(p.x * p.y); }
        float nbNoise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(nbHash(i), nbHash(i + vec2(1.0, 0.0)), u.x),
                     mix(nbHash(i + vec2(0.0, 1.0)), nbHash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float nbFbm(vec2 p){
          float s = 0.0, a = 0.5;
          for (int i = 0; i < 3; i++) { s += a * nbNoise(p); p *= 2.07; a *= 0.5; }
          return s / 0.875;
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 wn = normalize(vWNrm);
        vec3 wb = pow(abs(wn), vec3(6.0));
        wb /= max(wb.x + wb.y + wb.z, 0.0001);
        vec2 uvR = vWPos.xz;
        if (wb.y < 0.5) { uvR = (wb.x > wb.z) ? vWPos.zy : vWPos.xy; }
        uvR *= 0.34;
        vec3 rockA = pow(texture2D(uRock, uvR).rgb, vec3(2.2));
        vec3 rockB = pow(texture2D(uRock, uvR * 3.7 + 0.37).rgb, vec3(2.2));
        vec3 rockC = rockA * (0.62 + rockB * 0.95);
        vec3 mossC = pow(texture2D(uMoss, uvR * 1.55).rgb, vec3(2.2));

        /* world-space structure: the tiled texture is too fine to read at
           distance, so bedding planes and vertical gullies live here */
        vec2 q = vec2(vWPos.x * 0.7071 + vWPos.z * 0.7071, vWPos.y);
        float macro = nbFbm(q * 0.024);
        float meso  = nbFbm(q * 0.105 + 11.7);
        float steep = 1.0 - clamp(wn.y, 0.0, 1.0);

        /* bedding: near-horizontal seams that follow the wall */
        float bedWarp = nbFbm(q * 0.020 + 3.4) * 3.0;
        float bedN = nbNoise(vec2(q.x * 0.016, q.y * 0.30 + bedWarp));
        float bed = smoothstep(0.46, 0.72, bedN);
        float ledge = smoothstep(0.60, 0.92, bedN);           /* thin hard bands */

        /* gullies: noise stretched vertically so water runs down the face */
        float gully = nbNoise(vec2(q.x * 0.085, q.y * 0.010 + 5.1));
        gully = smoothstep(0.30, 0.78, gully);

        float slope = clamp(wn.y, 0.0, 1.0);
        float patchN = texture2D(uRock, vWPos.xz * 0.0021 + 0.2).r;
        float patchBig = texture2D(uRock, vWPos.xz * 0.0082 + 0.31).r;
        float high = smoothstep(95.0, 205.0, vWPos.y);

        /* vegetation clings to ledges and benches, never to a sheer face */
        float veg = smoothstep(0.28, 0.56, patchBig * 0.55 + patchN * 0.60);
        veg *= mix(0.06, 1.0, smoothstep(0.30, 0.78, slope));
        veg *= smoothstep(0.6, 3.0, vWPos.y) * (1.0 - high * 0.75);
        vec3 mossLit = pow(texture2D(uMoss, uvR * 1.35).rgb, vec3(2.2)) * 4.2;

        /* lichen: near-black speckle on exposed rock */
        float lich = smoothstep(0.52, 0.86, nbNoise(q * 0.42 + 17.0)) * steep;
        lich *= smoothstep(0.35, 0.70, nbNoise(q * 0.09 + 4.0));

        vec3 bare = rockC * 1.12 * vec3(0.97, 1.00, 1.03);
        vec3 albedo = mix(bare, mossLit, veg * 0.90);
        albedo = mix(albedo, rockC * 1.42, high * 0.42);
        albedo = mix(albedo, albedo * vec3(0.46, 0.52, 0.44), lich * 0.58);

        /* tonal relief — the dominant cue that this is rock, not sand */
        float relief = 0.46 + 0.98 * macro + (meso - 0.5) * 0.50;
        relief *= mix(1.0, 0.74 + 0.48 * bed, steep);          /* bedding bands */
        relief *= mix(1.0, 0.82 + 0.36 * gully, steep * 0.9);  /* wet gullies */
        albedo *= relief * (0.94 + 0.16 * ledge);

        /* damp shadowed rock cools toward blue-grey; exposed rock stays warm */
        albedo = mix(albedo, albedo * vec3(0.74, 0.86, 1.06), clamp((1.05 - relief) * 0.8, 0.0, 0.75));

        float wet = smoothstep(2.6, 0.15, vWPos.y);
        albedo *= mix(1.0, 0.34, wet * 0.9);
        float var = 0.78 + 0.42 * pow(texture2D(uRock, vWPos.xz * 0.006 + 0.5).r, 2.2);
        albedo *= var;
        diffuseColor.rgb *= albedo;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.94, 0.74, wet);
        roughnessFactor = mix(roughnessFactor, 0.99, veg);`)
      .replace('#include <normal_fragment_maps>', `
        vec3 upT = abs(wn.y) > 0.92 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
        vec3 tx = normalize(cross(upT, wn));
        vec3 tz = cross(wn, tx);
        vec3 mapN = texture2D(uRockN, uvR).xyz * 2.0 - 1.0;
        vec3 mapN3 = texture2D(uRockN, uvR * 4.3 + 0.21).xyz * 2.0 - 1.0;
        vec3 mapN2 = texture2D(uMossN, uvR * 2.2).xyz * 2.0 - 1.0;
        /* broad undulation, plus relief stretched down the wall as gullies */
        vec3 macroN = texture2D(uRockN, vec2(uvR.x * 0.10, uvR.y * 0.028) + 0.5).xyz * 2.0 - 1.0;
        mapN = normalize(mix(mapN + mapN3 * 0.6, mapN2, veg * 0.9));
        mapN.xy *= 1.20;
        vec3 wN = normalize(tx * (mapN.x * 0.50 + macroN.x * 0.55)
                          + tz * (mapN.y * 0.50 + macroN.y * 0.55)
                          + wn * max(mapN.z, 0.40));
        normal = normalize((viewMatrix * vec4(wN, 0.0)).xyz);`);
  };
  mat.customProgramCacheKey = () => 'terrain-v1';

  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  TERRAIN.mesh = mesh;
  return mesh;
}

function rasterTri(verts, iA, iB, iC, toI, toJ, data, S, inv, ox, oz) {
  const ax = verts[iA * 3], az = verts[iA * 3 + 2], ah = verts[iA * 3 + 1];
  const bx = verts[iB * 3], bz = verts[iB * 3 + 2], bh = verts[iB * 3 + 1];
  const cx = verts[iC * 3], cz = verts[iC * 3 + 2], ch = verts[iC * 3 + 1];
  const x0 = Math.floor(toI(Math.min(ax, bx, cx))), x1 = Math.ceil(toI(Math.max(ax, bx, cx)));
  const y0 = Math.floor(toJ(Math.min(az, bz, cz))), y1 = Math.ceil(toJ(Math.max(az, bz, cz)));
  if (x1 < 0 || y1 < 0 || x0 >= S || y0 >= S) return;
  const xa = Math.max(0, x0), xb = Math.min(S - 1, x1);
  const ya = Math.max(0, y0), yb = Math.min(S - 1, y1);
  const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
  if (Math.abs(d) < 1e-9) return;
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      const wx = (x + 0.5) / inv + ox, wz = (y + 0.5) / inv + oz;
      const w0 = ((bz - cz) * (wx - cx) + (cx - bx) * (wz - cz)) / d;
      const w1 = ((cz - az) * (wx - cx) + (ax - cx) * (wz - cz)) / d;
      const w2 = 1 - w0 - w1;
      if (w0 < -0.002 || w1 < -0.002 || w2 < -0.002) continue;
      const h = w0 * ah + w1 * bh + w2 * ch;
      const k = y * S + x;
      if (h > data[k]) data[k] = h;
    }
  }
}

function heightAtWorld(x, z) {
  if (!TERRAIN.data) return -20;
  const S = TERRAIN.size, inv = S / TERRAIN.rectSize;
  const fx = (x - TERRAIN.rectX) * inv - 0.5;
  const fz = (z - TERRAIN.rectZ) * inv - 0.5;
  const x0 = Math.floor(fx), z0 = Math.floor(fz);
  const tx = fx - x0, tz = fz - z0;
  const at = (i, j) => {
    const ii = clamp(i, 0, S - 1), jj = clamp(j, 0, S - 1);
    return TERRAIN.data[jj * S + ii];
  };
  const a = lerp(at(x0, z0), at(x0 + 1, z0), tx);
  const b = lerp(at(x0, z0 + 1), at(x0 + 1, z0 + 1), tx);
  return lerp(a, b, tz);
}
function slopeAtWorld(x, z, d = 2.0) {
  const hx = heightAtWorld(x + d, z) - heightAtWorld(x - d, z);
  const hz = heightAtWorld(x, z + d) - heightAtWorld(x, z - d);
  return Math.hypot(hx, hz) / (2 * d);
}

/* distant ridge silhouettes beyond the fjord walls */
function buildFarRidges() {
  const group = new THREE.Group();
  for (let layer = 0; layer < 2; layer++) {
    const R = 1050 + layer * 420;
    const segs = 150;
    const pos = [], idx = [];
    const count = segs + 1;
    for (let i = 0; i <= segs; i++) {
      const a = i / segs * TAU;
      const n = fbm2(Math.cos(a) * 2.2 + layer * 5, Math.sin(a) * 2.2, 4);
      const n2 = ridged2(Math.cos(a) * 4 + 3, Math.sin(a) * 4, 3);
      const h = 130 + n * 210 + n2 * 140 + layer * 70;
      pos.push(Math.cos(a) * R, -30, Math.sin(a) * R);
      pos.push(Math.cos(a) * (R - 120), h, Math.sin(a) * (R - 120));
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2, b = (i + 1) * 2, c = i * 2 + 1, d = (i + 1) * 2 + 1;
      idx.push(a, c, b, c, d, b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({
      color: glCol(layer === 0 ? 0x39433f : 0x2b3a3d), roughness: 1, metalness: 0, fog: true,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}
