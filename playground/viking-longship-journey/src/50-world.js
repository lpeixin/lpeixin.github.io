/* =========================================================================
   NORTHBOUND — environment: forests, rocks, settlements, waterfalls, birds
   ========================================================================= */

const WORLD = {
  trees: null, rocks: null, settlements: [], waterfalls: [], birds: [], smokeSources: [],
};

function worldAt(s, t) {
  s = ((s % 1) + 1) % 1;
  const p = ROUTE.getPointAt(s);
  const tan = ROUTE.getTangentAt(s);
  return new THREE.Vector3(p.x - tan.z * t, 0, p.z + tan.x * t);
}
function shoreDist(s) {
  return channelHalfWidth(s);
}

/* ---------- trees ---------- */
function mergeColored(list) {
  let total = 0;
  const prep = [];
  for (const [g, c] of list) {
    const ng = g.index ? g.toNonIndexed() : g;
    prep.push([ng, c]);
    total += ng.attributes.position.count;
  }
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
  let o = 0;
  for (const [g, c] of prep) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < n; i++) {
      col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b;
    }
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

function makeConifer(seed, H) {
  const r = mulberry32(seed);
  const parts = [];
  const barkC = glCol(0x2f2620);

  /* trunk: two slightly offset segments so it is not a perfect pole */
  const lower = new THREE.CylinderGeometry(0.055, 0.135, H * 0.62, 6, 2);
  lower.translate(0, H * 0.31, 0);
  parts.push([lower, barkC]);
  const upper = new THREE.CylinderGeometry(0.018, 0.058, H * 0.44, 5, 2);
  upper.translate(0, H * 0.82, 0);
  upper.rotateZ((r() - 0.5) * 0.05);
  parts.push([upper, barkC]);

  /* exposed branch stubs poking out between the foliage skirts */
  for (let i = 0; i < 5; i++) {
    const y = H * (0.32 + i * 0.13 + r() * 0.04);
    const len = H * (0.14 + r() * 0.08);
    const br = new THREE.CylinderGeometry(0.008, 0.026, len, 4);
    br.translate(0, len / 2, 0);
    br.rotateZ(1.15 + r() * 0.25);
    br.rotateY(r() * TAU);
    br.translate(0, y, 0);
    parts.push([br, barkC]);
  }

  /* foliage: whorls of drooping branch skirts. The jagged rim gives a spruce
     silhouette that a stack of primitives cannot. */
  const whorls = 12, segs = 11;
  const dark = glCol(0x141d15), mid = glCol(0x1b2619), lite = glCol(0x24321f);
  for (let w = 0; w < whorls; w++) {
    const tw = w / (whorls - 1);
    const yTop = H * (0.28 + tw * 0.70);
    const rOut = H * 0.215 * Math.pow(1 - tw, 0.72) * (0.80 + r() * 0.40);
    const droop = H * 0.085 * (0.45 + r() * 0.9);
    const apexY = yTop + droop * 0.7;
    const pos = [];
    for (let i = 0; i < segs; i++) {
      const a0 = i / segs * TAU + r() * 0.22;
      const a1 = (i + 1) / segs * TAU + r() * 0.22;
      const rr0 = rOut * (0.66 + r() * 0.55);
      const rr1 = rOut * (0.66 + r() * 0.55);
      const y0 = yTop - droop * (0.35 + r() * 1.0);
      const y1 = yTop - droop * (0.35 + r() * 1.0);
      pos.push(0, apexY, 0,
        Math.cos(a0) * rr0, y0, Math.sin(a0) * rr0,
        Math.cos(a1) * rr1, y1, Math.sin(a1) * rr1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    parts.push([g, w % 3 === 0 ? dark : (w % 3 === 1 ? mid : lite)]);
  }

  /* leader shoot at the crown */
  const tip = new THREE.ConeGeometry(0.09, H * 0.13, 5);
  tip.translate(0, H * 1.005, 0);
  parts.push([tip, mid]);

  return mergeColored(parts);
}

function buildForest(scene, count, tier) {
  const variants = [
    makeConifer(3, 11), makeConifer(17, 8.5), makeConifer(29, 14), makeConifer(41, 6.5),
  ];
  const buckets = [[], [], [], []];
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.97, metalness: 0, side: THREE.DoubleSide,
  });
  const total = count;
  let placed = 0, tries = 0;
  const away = BAYS.map((b) => worldAt(b.s, b.side * shoreDist(b.s) * 1.5));

  while (placed < total && tries < total * 14) {
    tries++;
    const s = rng();
    const side = rng() > 0.5 ? 1 : -1;
    const hw = shoreDist(s);
    const d = 30 + Math.pow(rng(), 1.5) * 240;
    const t = side * d;
    const p = worldAt(s, t);
    const h = heightAtWorld(p.x, p.z);
    if (h < 2.2 || h > 120) continue;
    const slope = slopeAtWorld(p.x, p.z);
    if (slope > 0.95) continue;
    let near = false;
    for (const a of away) if (a.distanceTo(p) < 26) { near = true; break; }
    if (near) continue;
    const v = Math.floor(rng() * variants.length);
    buckets[v].push([p.x, h - 0.3, p.z, 0.7 + rng() * 0.7, rng() * TAU, slope]);
    placed++;
  }

  const meshes = [];
  for (let v = 0; v < variants.length; v++) {
    const list = buckets[v];
    if (!list.length) continue;
    const m = new THREE.InstancedMesh(variants[v], mat, list.length);
    m.castShadow = tier !== 'low';
    m.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const c = new THREE.Color();
    for (let i = 0; i < list.length; i++) {
      const [x, y, z, sc, rot, slope] = list[i];
      dummy.position.set(x, y, z);
      dummy.rotation.set((rng() - 0.5) * 0.06, rot, (rng() - 0.5) * 0.06);
      dummy.scale.set(sc * (0.9 + rng() * 0.3), sc, sc * (0.9 + rng() * 0.3));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      const tint = 0.78 + rng() * 0.42;
      c.setRGB(tint, tint * (0.94 + rng() * 0.1), tint * 0.94);
      m.setColorAt(i, c);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.frustumCulled = false;
    scene.add(m);
    meshes.push(m);
  }
  WORLD.trees = meshes;
  return meshes;
}

/* ---------- rocks ---------- */
function makeRockGeo(seed, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const so = seed * 0.137;
  /* Displacement must be a function of position only: the icosahedron is
     non-indexed, so a per-vertex random offset tears the surface into shards. */
  const disp = (x, y, z) => {
    const n1 = noise2(x * 1.6 + so, y * 1.6 + z * 1.1);
    const n2 = noise2(x * 3.7 + z * 2.1, y * 3.7 - so);
    return 0.74 + n1 * 0.44 + n2 * 0.18;
  };
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const s = disp(x, y, z);
    p.setXYZ(i, x * s * 1.14, y * s * 0.70, z * s * 1.04);
  }
  g.computeVertexNormals();
  return g;
}

function buildRocks(scene, count) {
  const geos = [makeRockGeo(1), makeRockGeo(7), makeRockGeo(13, 0)];
  const mat = new THREE.MeshStandardMaterial({
    map: TEX.rock.mapTex, normalMap: TEX.rock.normTex, color: glCol(0x8d8d86),
    roughness: 0.95, metalness: 0, vertexColors: false,
  });
  mat.map.repeat.set(2, 2);
  const buckets = [[], [], []];
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 12) {
    tries++;
    const s = rng();
    const side = rng() > 0.5 ? 1 : -1;
    const hw = shoreDist(s);
    const t = side * (hw * (0.92 + rng() * 1.9));
    const p = worldAt(s, t);
    const h = heightAtWorld(p.x, p.z);
    if (h < -2.5) continue;
    if (h > 22 && rng() > 0.4) continue;
    const slope = slopeAtWorld(p.x, p.z);
    if (slope > 1.5) continue;
    buckets[Math.floor(rng() * 3)].push([p.x, h + 0.15, p.z, 0.7 + Math.pow(rng(), 2) * 5.5, rng() * TAU]);
    placed++;
  }
  const meshes = [];
  for (let v = 0; v < 3; v++) {
    if (!buckets[v].length) continue;
    const m = new THREE.InstancedMesh(geos[v], mat, buckets[v].length);
    m.castShadow = true; m.receiveShadow = true;
    const d = new THREE.Object3D();
    for (let i = 0; i < buckets[v].length; i++) {
      const [x, y, z, sc, rot] = buckets[v][i];
      d.position.set(x, y + sc * 0.12, z);
      d.rotation.set(rng() * 0.4, rot, rng() * 0.4);
      d.scale.set(sc, sc * (0.6 + rng() * 0.5), sc);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    scene.add(m);
    meshes.push(m);
  }
  WORLD.rocks = meshes;
}

/* ---------- cliff outcrops ----------
   A height field cannot express relief on a near-vertical face: adding to the
   height only slides points along the wall. Real boulders and slabs scattered
   on the slope are what actually break up the silhouette. */
function buildOutcrops(scene, count) {
  const geos = [makeRockGeo(5, 1), makeRockGeo(23, 1), makeRockGeo(61, 0)];
  const mat = new THREE.MeshStandardMaterial({
    map: TEX.rock.mapTex, normalMap: TEX.rock.normTex, color: glCol(0x6b675f),
    roughness: 0.97, metalness: 0,
  });
  const buckets = [[], [], []];
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 22) {
    tries++;
    const s = rng();
    const side = rng() > 0.5 ? 1 : -1;
    const hw = shoreDist(s);
    const t = side * (hw * (1.12 + Math.pow(rng(), 1.35) * 3.9));
    const p = worldAt(s, t);
    const h = heightAtWorld(p.x, p.z);
    if (h < 2.5 || h > 185) continue;
    const slope = slopeAtWorld(p.x, p.z, 3.0);
    if (slope < 0.5) continue;
    const size = 0.9 + Math.pow(rng(), 1.9) * 4.6;
    buckets[Math.floor(rng() * 3)].push([p.x, h - size * 0.34, p.z, size, rng() * TAU, slope]);
    placed++;
  }
  const meshes = [];
  for (let v = 0; v < 3; v++) {
    const list = buckets[v];
    if (!list.length) continue;
    const m = new THREE.InstancedMesh(geos[v], mat, list.length);
    m.castShadow = false; m.receiveShadow = true;
    const d = new THREE.Object3D();
    for (let i = 0; i < list.length; i++) {
      const [x, y, z, sc, rot, slope] = list[i];
      d.position.set(x, y, z);
      /* tilt with the slope so slabs lie against the wall rather than float */
      d.rotation.set(-Math.min(slope, 1.6) * 0.28 + (rng() - 0.5) * 0.3, rot, (rng() - 0.5) * 0.35);
      d.scale.set(sc * (0.9 + rng() * 0.75), sc * (0.42 + rng() * 0.42), sc * (0.8 + rng() * 0.6));
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    scene.add(m);
    meshes.push(m);
  }
  WORLD.outcrops = meshes;
  return meshes;
}

/* ---------- houses ---------- */
function prismGeometry(w, h, d) {
  const hw = w / 2, hd = d / 2;
  const v = [
    -hw, 0, -hd, hw, 0, -hd, 0, h, -hd,
    -hw, 0, hd, hw, 0, hd, 0, h, hd,
  ];
  const idx = [0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 0, 3, 5, 0, 5, 2];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function makeHouse(w, d, h, opts = {}) {
  const g = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({
    map: TEX.darkWood.mapTex, color: glCol(opts.tone || 0x8a7257), roughness: 0.92, metalness: 0,
  });
  wallMat.map = wallMat.map.clone();
  wallMat.map.needsUpdate = true;
  wallMat.map.repeat.set(w * 0.55, h * 0.55);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  wall.position.y = h / 2;
  g.add(wall);

  const roofMat = new THREE.MeshStandardMaterial({ color: glCol(opts.roof || 0x5c6042), roughness: 0.98, metalness: 0 });
  const roof = new THREE.Mesh(prismGeometry(w * 1.14, h * 0.62, d * 1.1), roofMat);
  roof.position.y = h;
  g.add(roof);
  /* ridge beam */
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, d * 1.16), SHIP.M.darkWood);
  ridge.position.y = h + h * 0.62;
  g.add(ridge);

  /* door */
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.75, 0.1), SHIP.M.darkWood);
  door.position.set(0, 0.88, d / 2 + 0.02);
  g.add(door);
  /* glowing windows */
  const winMat = new THREE.MeshStandardMaterial({ color: glCol(0xffd9a0), emissive: glCol(0xffa94d), emissiveIntensity: 1.5, roughness: 0.6 });
  for (const sx of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.08), winMat);
    win.position.set(sx * (w * 0.26), h * 0.62, d / 2 + 0.03);
    g.add(win);
  }
  /* corner posts */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, h + 0.15, 0.16), SHIP.M.darkWood);
    post.position.set(sx * w / 2, (h + 0.15) / 2, sz * d / 2);
    g.add(post);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildSettlements(scene) {
  const dockMat = SHIP.M.darkWood;
  const smokeSpots = [];
  for (const bay of BAYS) {
    const s0 = bay.s, side = bay.side;
    const hw = shoreDist(s0) * 1.42;
    const baseT = side * hw;
    const center = worldAt(s0, baseT);
    const groundY = heightAtWorld(center.x, center.z);
    if (groundY < -1) continue;
    const group = new THREE.Group();

    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      const s = s0 + (i - n / 2) * 0.0062 + (rng() - 0.5) * 0.002;
      const t = side * (hw * (1.0 + rng() * 0.55));
      const p = worldAt(s, t);
      const y = heightAtWorld(p.x, p.z);
      if (y < 0.4) continue;
      const w = 6 + rng() * 4, d = 8 + rng() * 5, h = 2.6 + rng() * 0.9;
      const house = makeHouse(w, d, h, { tone: rng() > 0.5 ? 0x8a7257 : 0x6f5a44, roof: rng() > 0.55 ? 0x5c6042 : 0x6a6a4c });
      house.position.set(p.x, y - 0.15, p.z);
      const face = Math.atan2(center.x - p.x, center.z - p.z);
      house.rotation.y = face;
      group.add(house);
      smokeSpots.push(new THREE.Vector3(p.x, y + h + h * 0.62, p.z));
      /* woodpile */
      if (rng() > 0.4) {
        for (let k = 0; k < 5; k++) {
          const log = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.5, 5), SHIP.M.darkWood);
          log.rotation.z = Math.PI / 2;
          log.rotation.y = face + 0.2;
          log.position.set(p.x + Math.cos(face) * (d * 0.6) + (rng() - 0.5) * 0.4, y + 0.12 + Math.floor(k / 3) * 0.22, p.z + Math.sin(face) * (d * 0.6) + (k % 3) * 0.24);
          group.add(log);
        }
      }
    }

    /* dock */
    const dockS = s0 - 0.0025;
    const dockT = side * (hw * 0.72);
    const dp = worldAt(dockS, dockT);
    const deckY = 0.85;
    const dockLen = Math.abs(hw * 0.55);
    const dock = new THREE.Group();
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, dockLen), dockMat);
    plank.position.set(0, deckY, dockLen / 2);
    plank.castShadow = true;
    dock.add(plank);
    for (let i = 0; i < 5; i++) {
      for (const sx of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 2.4, 6), dockMat);
        post.position.set(sx * 0.95, deckY - 1.2, dockLen * (i / 4));
        dock.add(post);
      }
    }
    dock.position.set(dp.x, 0, dp.z);
    dock.rotation.y = Math.atan2(-side * 0 + (center.x - dp.x), (center.z - dp.z)) + Math.PI / 2;
    group.add(dock);

    /* fire pit on the shore */
    const fp = worldAt(s0 + 0.004, side * hw * 0.98);
    const fy = heightAtWorld(fp.x, fp.z);
    if (fy > 0.2) {
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * TAU;
        const st = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), SHIP.M.darkWood);
        st.position.set(fp.x + Math.cos(a) * 0.7, fy + 0.12, fp.z + Math.sin(a) * 0.7);
        group.add(st);
      }
      smokeSpots.push(new THREE.Vector3(fp.x, fy + 0.5, fp.z));
    }

    scene.add(group);
    WORLD.settlements.push(group);
  }
  WORLD.smokeSources = smokeSpots;
}

/* ---------- waterfall ---------- */
const FALL_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FALL_FRAG = `
varying vec2 vUv;
uniform float uTime; uniform vec3 uTint; uniform float uSpeed; uniform float uOpacity;
float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  float a = hash21(i), b = hash21(i+vec2(1,0)), c = hash21(i+vec2(0,1)), d = hash21(i+vec2(1,1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }
void main(){
  vec2 uv = vUv;
  float t = uTime;
  float n = vnoise(vec2(uv.x * 9.0, uv.y * 2.2 - t * 5.5 * uSpeed));
  float n2 = vnoise(vec2(uv.x * 21.0 + 5.0, uv.y * 6.0 - t * 9.0 * uSpeed));
  float streak = smoothstep(0.42, 0.85, n * 0.65 + n2 * 0.55);
  float edge = smoothstep(0.0, 0.14, uv.x) * smoothstep(1.0, 0.86, uv.x);
  float fadeTop = smoothstep(1.0, 0.86, uv.y);
  float falloff = smoothstep(0.0, 0.12, uv.y);
  float a = streak * edge * (0.55 + 0.45 * fadeTop) * mix(0.6, 1.0, falloff);
  vec3 col = mix(uTint * 0.62, vec3(0.84, 0.88, 0.88), streak * 0.60);
  gl_FragColor = vec4(col, a * uOpacity);
}`;

function buildWaterfalls(scene) {
  for (const site of FALLS) {
    const hw = channelHalfWidth(site.s);
    const rp = ROUTE.getPointAt(site.s);
    const tan = ROUTE.getTangentAt(site.s);
    const nx = -tan.z, nz = tan.x;
    const base = new THREE.Vector3(rp.x + nx * site.side * hw * 1.03, 0, rp.z + nz * site.side * hw * 1.03);
    const inX = -nx * site.side, inZ = -nz * site.side;
    const yaw = Math.atan2(inX, inZ);

    const group = new THREE.Group();
    group.position.copy(base);
    group.rotation.y = yaw;

    const mkSheet = (w, zoff, speed, tint, opacity) => {
      const geo = new THREE.PlaneGeometry(w, site.h * 0.97, 1, 28);
      /* narrow at the lip, fanning out as it falls and breaks up */
      const pa = geo.attributes.position;
      for (let vi = 0; vi < pa.count; vi++) {
        const vy = (pa.getY(vi) / (site.h * 0.485)) * 0.5 + 0.5;
        pa.setX(vi, pa.getX(vi) * lerp(1.30, 0.52, clamp(vy, 0, 1)));
      }
      geo.computeVertexNormals();
      const mat = new THREE.ShaderMaterial({
        vertexShader: FALL_VERT, fragmentShader: FALL_FRAG,
        uniforms: { uTime: { value: 0 }, uTint: { value: glCol(tint) }, uSpeed: { value: speed }, uOpacity: { value: opacity } },
        transparent: true, depthWrite: false, side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(0, site.h * 0.485, zoff);
      group.add(m);
      return mat;
    };
    const mat = mkSheet(site.w * 1.9, 0.55, 1.0, 0xbcd4d8, 0.85);
    const mat2 = mkSheet(site.w * 2.9, 0.95, 0.72, 0xaec6cb, 0.45);
    const mat3 = mkSheet(site.w * 1.15, 0.3, 1.35, 0xd2e2e2, 0.62);

    /* rock face behind the sheets so the fall never reads against a void */
    const backMat = new THREE.MeshStandardMaterial({
      map: TEX.rock.mapTex, normalMap: TEX.rock.normTex,
      color: glCol(0x53504a), roughness: 0.92, side: THREE.DoubleSide,
    });
    backMat.map = TEX.rock.mapTex.clone();
    backMat.map.needsUpdate = true;
    backMat.map.repeat.set(3, 8);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(site.w * 2.5, site.h * 0.90), backMat);
    back.position.set(0, site.h * 0.42, -0.30);
    group.add(back);

    /* wet rock lip at the base */
    const lip = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 3.6, 1.6, 8, 1, true),
      new THREE.MeshStandardMaterial({ map: TEX.rock.mapTex, normalMap: TEX.rock.normTex, color: glCol(0x4a4a45), roughness: 0.8 })
    );
    lip.position.set(0, -0.4, 2.2);
    group.add(lip);

    scene.add(group);
    WORLD.waterfalls.push({
      group, mat, mat2, mat3,
      base, h: site.h,
      inflow: new THREE.Vector3(inX, 0, inZ),
      rippleT: Math.random() * 2,
    });
  }
}

/* ---------- birds ---------- */
function buildBirds(scene, n = 7) {
  const mat = new THREE.MeshStandardMaterial({ color: glCol(0x2a2a2c), roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), mat);
    body.scale.set(0.7, 0.7, 2.0);
    g.add(body);
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.34), mat);
    wingL.position.x = -0.78;
    const wingR = wingL.clone();
    wingR.position.x = 0.78;
    const pivotL = new THREE.Group(), pivotR = new THREE.Group();
    pivotL.add(wingL); pivotR.add(wingR);
    g.add(pivotL, pivotR);
    g.scale.setScalar(1.2);
    scene.add(g);
    WORLD.birds.push({
      g, pivotL, pivotR, body,
      cx: 0, cz: 0, r: 40 + rng() * 90, y: 26 + rng() * 34,
      a: rng() * TAU, speed: 0.07 + rng() * 0.09, flap: 2 + rng() * 1.6, ph: rng() * TAU,
    });
  }
}

function updateWorld(dt, time, shipPos) {
  for (const b of WORLD.birds) {
    b.a += b.speed * dt;
    b.cx = damp(b.cx, shipPos.x, 0.4, dt);
    b.cz = damp(b.cz, shipPos.z, 0.4, dt);
    const x = b.cx + Math.cos(b.a) * b.r;
    const z = b.cz + Math.sin(b.a) * b.r;
    b.g.position.set(x, b.y + Math.sin(time * 0.5 + b.ph) * 2.2, z);
    b.g.rotation.y = -b.a + Math.PI / 2;
    b.g.rotation.z = 0.16;
    const f = Math.sin(time * b.flap + b.ph);
    b.pivotL.rotation.z = f * 0.6 - 0.1;
    b.pivotR.rotation.z = -f * 0.6 + 0.1;
  }
  for (const w of WORLD.waterfalls) {
    w.mat.uniforms.uTime.value = time;
    if (w.mat2) w.mat2.uniforms.uTime.value = time * 1.17;
    if (w.mat3) w.mat3.uniforms.uTime.value = time * 0.93;
    w.rippleT -= dt;
    if (w.rippleT <= 0) {
      w.rippleT = 0.9;
      const px = w.base.x + w.inflow.x * 2.2 + (Math.random() - 0.5) * 3.0;
      const pz = w.base.z + w.inflow.z * 2.2 + (Math.random() - 0.5) * 3.0;
      WATER.addRipple(px, pz, 0.55 + Math.random() * 0.25, time);
    }
  }
  /* smoke + spray */
  WORLD._smokeT = (WORLD._smokeT || 0) + dt;
  if (WORLD._smokeT > 0.24) {
    WORLD._smokeT = 0;
    for (const p of WORLD.smokeSources) {
      FX.spawn(p.x + (Math.random() - 0.5) * 0.4, p.y, p.z + (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.35, 0.7 + Math.random() * 0.4, (Math.random() - 0.5) * 0.35,
        5.5 + Math.random() * 3, 2.4 + Math.random() * 1.4, 0.5, 0.52, 0.54);
    }
    for (const w of WORLD.waterfalls) {
      if (Math.random() > 0.35) MIST.spawnMist(w.base.x + w.inflow.x * 2.0, 1.2, w.base.z + w.inflow.z * 2.0, 3, 2.6, 1.7, 3.6);
    }
  }
}
