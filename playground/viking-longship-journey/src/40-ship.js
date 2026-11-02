/* =========================================================================
   NORTHBOUND — the longship: clinker hull, rig, carvings, fittings
   ========================================================================= */

const HULL = {
  half: 2.78,
  zEnd: 12.2,
  beam(z) {
    const a = Math.min(Math.abs(z) / this.zEnd, 1);
    return Math.max(0.05, this.half * Math.pow(Math.max(0, 1 - Math.pow(a, 2.7)), 0.52));
  },
  sheer(z) {
    const a = Math.min(Math.abs(z) / this.zEnd, 1);
    return 1.80 + 1.55 * Math.pow(a, 3.2);
  },
  keel(z) {
    const a = Math.min(Math.abs(z) / this.zEnd, 1);
    return -1.52 + 1.58 * Math.pow(a, 4.2);
  },
  /* point on the hull cross-section: u 0 (keel) .. 1 (sheer), off = outward offset */
  point(z, u, off = 0) {
    const b = this.beam(z), top = this.sheer(z), bot = this.keel(z);
    const ang = u * Math.PI * 0.5;
    const x = b * Math.sin(ang);
    const y = bot + (top - bot) * (1 - Math.cos(ang));
    const dx = b * Math.cos(ang) * Math.PI * 0.5;
    const dy = (top - bot) * Math.sin(ang) * Math.PI * 0.5;
    const l = Math.hypot(dx, dy) || 1;
    const nx = dy / l, ny = -dx / l;
    return [x + nx * off, y + ny * off, nx, ny];
  },
};

function gridGeometry(nu, nv, fn) {
  const pos = [], uvs = [], idx = [];
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      const r = fn(i / nu, j / nv, i, j);
      pos.push(r[0], r[1], r[2]);
      uvs.push(r[3], r[4]);
    }
  }
  const row = nv + 1;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * row + j, b = (i + 1) * row + j, c = i * row + j + 1, d = (i + 1) * row + j + 1;
      idx.push(a, b, c, c, b, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* loft a chain of elliptical cross-sections along -Z. prof rows are
   [z, halfWidth, halfHeight, yOffset] — used for carved heads. */
function loftProfile(prof, seg = 12) {
  const pos = [], idx = [];
  const n = prof.length;
  for (let i = 0; i < n; i++) {
    const [z, rx, ry, oy] = prof[i];
    for (let j = 0; j < seg; j++) {
      const a = j / seg * TAU;
      pos.push(Math.cos(a) * rx, oy + Math.sin(a) * ry, z);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + (j + 1) % seg;
      const c = (i + 1) * seg + j, d = (i + 1) * seg + (j + 1) % seg;
      idx.push(a, c, b, b, c, d);
    }
  }
  const last = (n - 1) * seg;
  for (let j = 1; j < seg - 1; j++) {
    idx.push(0, j + 1, j);
    idx.push(last, last + j, last + j + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const SHIP = {
  root: new THREE.Group(),
  hull: new THREE.Group(),
  oars: [],
  oarOrigins: [],
  rowers: [],
  lanterns: [],
  sail: null,
  sailUniforms: null,
  parts: {},
  crewParts: [],

  build() {
    const M = {};
    const woodMap = TEX.wood;
    M.hull = new THREE.MeshStandardMaterial({
      map: woodMap.mapTex, normalMap: woodMap.normTex, roughnessMap: woodMap.roughTex,
      color: glCol(0xb0a08c), roughness: 0.84, metalness: 0.02, side: THREE.DoubleSide,
    });
    M.hull.map.repeat.set(1, 1);
    /* a wet band and a faint algae line where the hull meets the water — without
       it the boat reads as sitting on top of the fjord rather than in it */
    M.hull.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vLocalY;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalY = transformed.y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vLocalY;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float wl = vLocalY + 0.34;   /* local height of the waterline */
          float wet = smoothstep(0.42, -0.10, wl);
          diffuseColor.rgb *= mix(1.0, 0.46, wet);
          float algae = smoothstep(0.16, -0.42, wl);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.60, 0.78, 0.64), algae * 0.75);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.34, smoothstep(0.36, 0.0, vLocalY + 0.34));`);
    };
    M.inner = new THREE.MeshStandardMaterial({
      map: TEX.darkWood.mapTex, normalMap: TEX.darkWood.normTex,
      color: glCol(0x9a8368), roughness: 0.9, metalness: 0, side: THREE.DoubleSide,
    });
    M.deck = new THREE.MeshStandardMaterial({
      map: woodMap.mapTex, normalMap: woodMap.normTex, color: glCol(0x8a7a63), roughness: 0.93, metalness: 0,
    });
    M.darkWood = new THREE.MeshStandardMaterial({
      map: TEX.darkWood.mapTex, normalMap: TEX.darkWood.normTex, color: glCol(0x6f5b46), roughness: 0.88, metalness: 0,
    });
    M.carved = new THREE.MeshStandardMaterial({
      map: TEX.darkWood.mapTex, normalMap: TEX.darkWood.normTex, color: glCol(0x7a5a3d), roughness: 0.62, metalness: 0.04,
    });
    M.paint = new THREE.MeshStandardMaterial({ color: glCol(0x7c2f28), roughness: 0.68, metalness: 0.02 });
    M.iron = new THREE.MeshStandardMaterial({ color: glCol(0x2f3134), roughness: 0.44, metalness: 0.85 });
    M.rope = new THREE.MeshStandardMaterial({ color: glCol(0x9c8a6a), roughness: 0.98, metalness: 0 });
    M.cloth = new THREE.MeshStandardMaterial({ color: glCol(0x6d5a45), roughness: 0.95, metalness: 0 });
    M.clothRed = new THREE.MeshStandardMaterial({ color: glCol(0x6b3530), roughness: 0.95, metalness: 0 });
    M.clothBlue = new THREE.MeshStandardMaterial({ color: glCol(0x3c4a52), roughness: 0.95, metalness: 0 });
    M.clothGrey = new THREE.MeshStandardMaterial({ color: glCol(0x8b8577), roughness: 0.96, metalness: 0 });
    M.skin = new THREE.MeshStandardMaterial({ color: glCol(0xb98a6c), roughness: 0.86, metalness: 0 });
    M.hair = new THREE.MeshStandardMaterial({ color: glCol(0x4a3221), roughness: 0.95, metalness: 0 });
    M.lamp = new THREE.MeshStandardMaterial({ color: glCol(0xffd79a), emissive: glCol(0xffa94d), emissiveIntensity: 1.5, roughness: 0.5 });
    M.sail = new THREE.MeshStandardMaterial({ map: TEX.sail, color: glCol(0xa79c88), roughness: 0.96, metalness: 0, side: THREE.DoubleSide });
    SHIP.M = M;

    this.hull.position.set(0, 0, 0);
    this.root.add(this.hull);
    this.hull.add(new THREE.Group());

    this.buildHull(M);
    this.buildInterior(M);
    this.buildMastAndSail(M);
    this.buildProwAndStern(M);
    this.buildShields(M);
    this.buildFittings(M);
    return this.root;
  },

  buildHull(M) {
    const ST = 74;
    const NS = 13;
    const strakes = [];
    for (let k = 0; k < NS; k++) {
      const u0 = 0.035 + (k / NS) * 0.965;
      const u1 = 0.035 + ((k + 1) / NS) * 0.965;
      /* map each strake onto exactly one plank of the wood texture so the
         seam lands on the lap edge instead of carving the strake in five */
      const pv = (k % 5) * 0.2;
      const g = gridGeometry(ST, 1, (a, b) => {
        const z = -HULL.zEnd + a * HULL.zEnd * 2;
        const u = lerp(u0, u1, b);
        const off = lerp(0.085, 0.0, b);
        const p = HULL.point(z, u, off);
        return [p[0], p[1], z, a * 11.0, pv + b * 0.2];
      });
      strakes.push(g);
    }
    /* combine starboard strakes */
    const outer = mergeGeometries(strakes);
    const mesh = new THREE.Mesh(outer, M.hull);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.hull.add(mesh);

    /* port side: mirrored object keeps normals correct through the normal matrix */
    const meshP = new THREE.Mesh(outer, M.hull);
    meshP.scale.x = -1;
    meshP.castShadow = true;
    meshP.receiveShadow = true;
    this.hull.add(meshP);

    /* inner hull shell */
    const innerG = gridGeometry(64, 26, (a, b) => {
      const z = -HULL.zEnd + a * HULL.zEnd * 2;
      const u = 0.08 + b * 0.92;
      const p = HULL.point(z, u, -0.115);
      return [p[0], p[1], z, a * 8, b * 2];
    });
    const inner = new THREE.Mesh(innerG, M.inner);
    inner.receiveShadow = true;
    this.hull.add(inner);
    const innerP = inner.clone();
    innerP.scale.x = -1;
    innerP.material = M.inner;
    this.hull.add(innerP);

    /* keel */
    const keelPts = [];
    for (let i = 0; i <= 30; i++) {
      const z = -HULL.zEnd + (i / 30) * HULL.zEnd * 2;
      keelPts.push(new THREE.Vector3(0, HULL.keel(z) - 0.06, z));
    }
    const keelCurve = new THREE.CatmullRomCurve3(keelPts);
    const keel = new THREE.Mesh(new THREE.TubeGeometry(keelCurve, 40, 0.11, 6, false), M.darkWood);
    keel.castShadow = true;
    this.hull.add(keel);

    /* gunwale rails */
    for (const side of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const z = -HULL.zEnd + (i / 40) * HULL.zEnd * 2;
        const p = HULL.point(z, 1.0, 0.02);
        pts.push(new THREE.Vector3(side * p[0], p[1], z));
      }
      const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.072, 6, false), M.darkWood);
      rail.castShadow = true;
      this.hull.add(rail);
    }

    /* stem & stern posts */
    for (const sgn of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const a = i / 16;
        const z = sgn * HULL.zEnd;
        const y = lerp(HULL.keel(z), HULL.sheer(z) + 0.35, a);
        pts.push(new THREE.Vector3(0, y, z + sgn * Math.sin(a * Math.PI) * 0.12));
      }
      const post = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.13, 7, false), M.darkWood);
      post.castShadow = true;
      this.hull.add(post);
    }
  },

  buildInterior(M) {
    /* floor */
    const floorG = gridGeometry(48, 6, (a, b) => {
      const z = -10.4 + a * 20.8;
      const bm = HULL.beam(z) * 0.72;
      const x = lerp(-bm, bm, b);
      return [x, -0.56, z, a * 10, b * 2.2];
    });
    const floor = new THREE.Mesh(floorG, M.deck);
    floor.receiveShadow = true;
    this.hull.add(floor);

    /* ribs */
    const ribMat = M.darkWood;
    for (let i = 0; i < 21; i++) {
      const z = -10.8 + (i / 20) * 21.6;
      for (const side of [-1, 1]) {
        const pts = [];
        for (let j = 0; j <= 9; j++) {
          const u = 0.06 + (j / 9) * 0.93;
          const p = HULL.point(z, u, -0.135);
          pts.push(new THREE.Vector3(side * p[0], p[1], z));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        const rib = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.052, 5, false), ribMat);
        this.hull.add(rib);
      }
      /* floor timber */
      const beamW = HULL.beam(z) * 0.68;
      const ft = new THREE.Mesh(new THREE.BoxGeometry(beamW * 2, 0.09, 0.14), ribMat);
      ft.position.set(0, -0.6, z);
      this.hull.add(ft);
    }

    /* benches (thwarts) */
    this.benchZ = [-8.4, -6.6, -4.8, -3.0, 0.5, 2.3, 4.1, 5.9];
    this.benchZ.forEach((z) => {
      const w = HULL.beam(z) * 1.62;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.09, 0.44), M.deck);
      b.position.set(0, 0.93, z);
      b.castShadow = true; b.receiveShadow = true;
      this.hull.add(b);
      for (const sx of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.5, 0.3), M.darkWood);
        leg.position.set(sx * (w * 0.34), 0.17, z);
        this.hull.add(leg);
        const knee = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 1.4), M.darkWood);
        knee.position.set(sx * (w * 0.3), 0.5, z);
        knee.rotation.z = sx * 0.1;
        this.hull.add(knee);
      }
    });

    /* fore & aft decks */
    for (const [z0, z1, y] of [[-11.5, -9.0, 1.18], [7.4, 11.4, 1.26]]) {
      const g = gridGeometry(6, 4, (a, b) => {
        const z = lerp(z0, z1, a);
        const bm = HULL.beam(z) * 0.9;
        return [lerp(-bm, bm, b), y, z, a * 3, b * 2];
      });
      const d = new THREE.Mesh(g, M.deck);
      d.receiveShadow = true;
      this.hull.add(d);
      for (let i = 0; i < 5; i++) {
        const z = lerp(z0 + 0.2, z1 - 0.2, i / 4);
        const bm = HULL.beam(z) * 0.85;
        for (const sx of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 0.1), M.darkWood);
          post.position.set(sx * bm * 0.92, 0.35, z);
          this.hull.add(post);
        }
      }
    }

    /* mast fish + step */
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 2.6), M.darkWood);
    step.position.set(0, -0.48, -1.2);
    this.hull.add(step);
    const fish = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 1.9), M.darkWood);
    fish.position.set(0, 0.86, 0.55);
    this.hull.add(fish);
  },

  buildMastAndSail(M) {
    const mastZ = -1.2;
    const mastH = 8.9;
    const mastG = new THREE.CylinderGeometry(0.115, 0.175, mastH, 10);
    const mast = new THREE.Mesh(mastG, M.darkWood);
    mast.position.set(0, 1.05 + mastH / 2 - 0.4, mastZ);
    mast.castShadow = true;
    this.hull.add(mast);
    this.mastTop = 1.05 - 0.4 + mastH;

    /* masthead block */
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.4, 8), M.darkWood);
    head.position.set(0, this.mastTop - 0.2, mastZ);
    this.hull.add(head);

    /* yard */
    const yardY = 6.95;
    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 10.9, 8), M.darkWood);
    yard.rotation.z = Math.PI / 2;
    yard.position.set(0, yardY, mastZ - 0.12);
    yard.castShadow = true;
    this.hull.add(yard);
    this.yardY = yardY;

    /* sail */
    const sw = 10.0, sh = 4.75;
    const sg = new THREE.PlaneGeometry(sw, sh, 26, 20);
    const sailMat = M.sail.clone();
    sailMat.map = TEX.sail;
    const uniforms = { uTime: { value: 0 }, uBillow: { value: 1.15 }, uWind: { value: 0.5 } };
    sailMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      shader.uniforms.uBillow = uniforms.uBillow;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uBillow;\nuniform float uWind;')
        .replace('#include <beginnormal_vertex>', `
          float su = uv.x, sv = uv.y;
          float prof = pow(sin(su * 3.14159), 0.70) * sin(sv * 3.14159 * 0.92);
          float bA = prof * uBillow;
          float bB = sin(su * 11.0 + uTime * 1.2) * sin(sv * 6.0 - uTime * 0.8) * 0.09 * uBillow;
          float bC = sin(su * 5.0 - uTime * 0.5) * 0.13 * uBillow * sv;
          float dz = bA + bB + bC;
          float dU = (0.70 * pow(max(sin(su * 3.14159), 0.001), -0.30) * cos(su * 3.14159) * 3.14159
                      * sin(sv * 3.14159 * 0.92)) * uBillow * 0.35
                   + cos(su * 11.0 + uTime * 1.2) * 11.0 * sin(sv * 6.0 - uTime * 0.8) * 0.09 * uBillow
                   + cos(su * 5.0 - uTime * 0.5) * 5.0 * 0.13 * uBillow * sv;
          float dV = sin(su * 3.14159) * cos(sv * 3.14159 * 0.92) * 3.14159 * 0.92 * uBillow * 0.5
                   + sin(su * 11.0 + uTime * 1.2) * cos(sv * 6.0 - uTime * 0.8) * 6.0 * 0.09 * uBillow
                   + sin(su * 5.0 - uTime * 0.5) * 0.13 * uBillow;
          #include <beginnormal_vertex>
          objectNormal = normalize(vec3(-dU * 0.045, -dV * 0.045, 1.0));`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float foot = 1.0 - smoothstep(0.0, 0.20, sv);
          transformed.x *= mix(0.93, 1.0, sv);
          transformed.y += foot * 0.34 * (1.0 - cos(su * 6.28318)) * 0.5;
          transformed.z -= dz;`);
    };
    const sail = new THREE.Mesh(sg, sailMat);
    sail.position.set(0, yardY - sh / 2 + 0.05, mastZ - 0.05);
    sail.castShadow = true;
    this.hull.add(sail);
    this.sail = sail;
    this.sailUniforms = uniforms;

    /* rigging */
    const rope = (a, b, r = 0.019) => {
      const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      const sag = 0.06 * a.distanceTo(b);
      mid.y -= sag;
      const curve = new THREE.CatmullRomCurve3([a, mid, b]);
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, r, 4, false), M.rope);
      this.hull.add(m);
      return m;
    };
    const top = new THREE.Vector3(0, this.mastTop - 0.35, mastZ);
    rope(top, new THREE.Vector3(0, 2.9, -HULL.zEnd + 0.35), 0.022);
    rope(top, new THREE.Vector3(0, 2.75, HULL.zEnd - 0.35), 0.022);
    for (const sx of [-1, 1]) {
      rope(top, new THREE.Vector3(sx * 2.35, 1.95, -4.6), 0.02);
      rope(top, new THREE.Vector3(sx * 2.5, 1.95, 2.4), 0.02);
      rope(new THREE.Vector3(sx * 5.2, yardY, mastZ - 0.12), new THREE.Vector3(sx * 2.2, 1.98, HULL.zEnd - 1.2), 0.017);
      rope(new THREE.Vector3(sx * 5.2, yardY, mastZ - 0.12), new THREE.Vector3(sx * 2.0, 1.95, -HULL.zEnd + 2.0), 0.017);
      /* sheet */
      rope(new THREE.Vector3(sx * sw * 0.5, yardY - sh + 0.1, mastZ - 0.1), new THREE.Vector3(sx * 2.4, 1.9, 4.2), 0.016);
    }
    /* brace from yard centre up */
    rope(new THREE.Vector3(0, yardY, mastZ - 0.12), top, 0.018);
  },

  buildProwAndStern(M) {
    /* dragon neck curving forward from the stem */
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const a = i / 8;
      const z = -HULL.zEnd - 0.05 - Math.pow(a, 1.4) * 1.05;
      const y = HULL.sheer(-HULL.zEnd) + 0.2 + a * 1.55;
      pts.push(new THREE.Vector3(0, y, z));
    }
    const neckCurve = new THREE.CatmullRomCurve3(pts);
    const neck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 20, 0.23, 8, false), M.carved);
    neck.castShadow = true;
    this.hull.add(neck);

    const headY = pts[8].y + 0.12;
    const headZ = pts[8].z - 0.28;
    const head = new THREE.Group();
    head.position.set(0, headY, headZ);
    head.rotation.x = -0.10;
    this.hull.add(head);

    const carvedMat = new THREE.MeshStandardMaterial({
      map: TEX.darkWood.mapTex, normalMap: TEX.darkWood.normTex,
      color: glCol(0x6b4c33), roughness: 0.55, metalness: 0.03, side: THREE.DoubleSide,
    });

    /* skull + muzzle: one lofted form, deepest at the brow, tapering to a
       blunt nose that curls slightly down */
    const skullProf = [
      [0.58, 0.085, 0.080, 0.010],
      [0.40, 0.185, 0.175, 0.015],
      [0.20, 0.230, 0.210, 0.000],
      [0.00, 0.225, 0.195, -0.020],
      [-0.22, 0.190, 0.160, -0.050],
      [-0.44, 0.150, 0.130, -0.085],
      [-0.64, 0.112, 0.100, -0.120],
      [-0.80, 0.070, 0.070, -0.155],
      [-0.90, 0.038, 0.045, -0.185],
    ];
    const skull = new THREE.Mesh(loftProfile(skullProf, 12), carvedMat);
    skull.castShadow = true;
    head.add(skull);

    /* lower jaw, dropped open */
    const jawProf = [
      [0.30, 0.155, 0.055, 0],
      [0.06, 0.150, 0.052, 0],
      [-0.20, 0.128, 0.046, 0],
      [-0.46, 0.100, 0.038, 0],
      [-0.66, 0.058, 0.026, 0],
      [-0.76, 0.030, 0.018, 0],
    ];
    const jaw = new THREE.Mesh(loftProfile(jawProf, 10), carvedMat);
    jaw.position.set(0, -0.145, 0);
    jaw.rotation.x = -0.30;
    jaw.castShadow = true;
    head.add(jaw);

    /* dark mouth interior */
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.72), new THREE.MeshStandardMaterial({
      color: glCol(0x2a1612), roughness: 1, side: THREE.DoubleSide,
    }));
    mouth.position.set(0, -0.09, -0.38);
    mouth.rotation.x = -0.12;
    head.add(mouth);

    /* teeth: a row along each side of the upper jaw, plus a pair of fangs */
    const toothMat = new THREE.MeshStandardMaterial({ color: glCol(0xd6c9ac), roughness: 0.62 });
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const z = -0.30 - t * 0.42;
      const w = lerp(0.135, 0.055, t);
      for (const sx of [-1, 1]) {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.075 - t * 0.02, 5), toothMat);
        tooth.position.set(sx * w, -0.115 - t * 0.045, z);
        tooth.rotation.x = Math.PI;
        head.add(tooth);
      }
    }
    for (const sx of [-1, 1]) {
      const fang = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.14, 5), toothMat);
      fang.position.set(sx * 0.085, -0.11, -0.62);
      fang.rotation.x = Math.PI - 0.12;
      head.add(fang);
    }

    /* eyes under heavy brows, with a faint ember glow */
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.062, 10, 8), new THREE.MeshStandardMaterial({
        color: glCol(0x140f0c), roughness: 0.22, metalness: 0.25,
        emissive: glCol(0x6b2a06), emissiveIntensity: 1.1,
      }));
      eye.position.set(sx * 0.185, 0.075, -0.115);
      head.add(eye);
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), carvedMat);
      socket.position.set(sx * 0.185, 0.068, -0.10);
      socket.scale.set(0.85, 0.85, 0.55);
      head.add(socket);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.24), carvedMat);
      brow.position.set(sx * 0.185, 0.155, -0.11);
      brow.rotation.set(-0.25, 0, sx * 0.28);
      head.add(brow);
      /* swept-back horn */
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.62, 6), carvedMat);
      horn.position.set(sx * 0.135, 0.235, 0.30);
      horn.rotation.set(-0.95, 0, sx * 0.30);
      horn.castShadow = true;
      head.add(horn);
    }
    /* crest of spikes along the skull and down the nape */
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26 - t * 0.10, 4), carvedMat);
      sp.position.set(0, 0.205 - t * 0.02, 0.10 + t * 0.46);
      sp.rotation.x = -0.55 - t * 0.2;
      head.add(sp);
    }

    /* stern: carved spiral tail */
    const sPts = [];
    for (let i = 0; i <= 22; i++) {
      const a = i / 22;
      const ang = a * 2.6;
      const r = 0.75 * (1 - a * 0.72);
      sPts.push(new THREE.Vector3(Math.sin(ang) * 0.0, HULL.sheer(HULL.zEnd) + 0.25 + a * 0.95 + Math.sin(ang) * r * 0.4, HULL.zEnd + Math.cos(ang) * r * 0.5));
    }
    const stern = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sPts), 30, 0.12, 6, false), M.carved);
    stern.castShadow = true;
    this.hull.add(stern);
    const tailFin = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 5), M.carved);
    tailFin.position.set(0, HULL.sheer(HULL.zEnd) + 1.05, HULL.zEnd + 0.4);
    tailFin.rotation.x = 0.5;
    this.hull.add(tailFin);
  },

  buildShields(M) {
    /* cylinder axis is Y; rotate so the disc faces sideways along X */
    const geo = new THREE.CylinderGeometry(0.405, 0.405, 0.055, 22);
    geo.rotateZ(Math.PI / 2);
    const bossGeo = new THREE.SphereGeometry(0.11, 12, 8);
    const rimGeo = new THREE.TorusGeometry(0.410, 0.024, 6, 24);
    rimGeo.rotateY(Math.PI / 2);
    const mats = TEX.shields.map((t) => new THREE.MeshStandardMaterial({
      map: t, roughness: 0.82, metalness: 0.03, side: THREE.DoubleSide,
      normalMap: TEX.wood.normTex,
    }));
    const shields = [];
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const z = -9.2 + i * 2.25;
        const p = HULL.point(z, 0.955, 0.02);
        const s = new THREE.Mesh(geo, mats[i % 4]);
        s.position.set(side * (p[0] + 0.12), p[1] - 0.19, z);
        /* shields hang flat against the hull side, tipped out slightly */
        s.rotation.y = side > 0 ? 0 : Math.PI;
        s.rotation.z = side * 0.13;
        s.castShadow = true;
        this.hull.add(s);
        const rim = new THREE.Mesh(rimGeo, M.iron);
        rim.position.copy(s.position);
        rim.rotation.copy(s.rotation);
        this.hull.add(rim);
        const boss = new THREE.Mesh(bossGeo, M.iron);
        boss.position.set(s.position.x + side * 0.055, s.position.y, s.position.z);
        boss.scale.set(0.55, 1, 1);
        this.hull.add(boss);
        shields.push(s);
      }
    }
    this.shields = shields;
  },

  buildFittings(M) {
    /* barrels */
    const barrel = (x, z, s = 1) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.62, 12, 1), M.darkWood);
      body.position.y = 0.31;
      g.add(body);
      for (const y of [0.14, 0.48]) {
        const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.018, 4, 14), M.iron);
        hoop.rotation.x = Math.PI / 2;
        hoop.position.y = y;
        g.add(hoop);
      }
      g.position.set(x, 1.0, z);
      g.scale.setScalar(s);
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.hull.add(g);
    };
    barrel(0.6, 1.5); barrel(-0.55, 1.75, 0.9); barrel(0.35, 2.4, 0.75);

    /* crates */
    const crate = (x, y, z, w, h, d, rot = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.darkWood);
      m.position.set(x, y, z);
      m.rotation.y = rot;
      m.castShadow = true;
      this.hull.add(m);
      return m;
    };
    crate(-1.2, 1.25, 8.4, 0.8, 0.42, 0.6, 0.2);
    crate(-1.2, 1.68, 8.4, 0.72, 0.4, 0.55, -0.15);
    crate(1.15, 1.3, 9.2, 0.7, 0.5, 0.5, 0.5);

    /* rope coils */
    for (const [x, z] of [[-1.6, 4.4], [1.7, -8.9], [0.9, 9.8]]) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.075, 6, 14), M.rope);
      coil.rotation.x = Math.PI / 2;
      coil.position.set(x, 1.24, z);
      this.hull.add(coil);
    }

    /* sacks */
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.27, 1), M.clothGrey);
      s.scale.set(1, 0.8, 1.1);
      s.position.set(-1.9 + i * 0.42, 1.16, -9.6 - i * 0.1);
      s.castShadow = true;
      this.hull.add(s);
    }

    /* lanterns */
    const glowMat = new THREE.SpriteMaterial({ map: TEX.glow, color: glCol(0xffb066), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 });
    const lanternAt = (x, y, z, withLight) => {
      const g = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.24, 8), M.lamp);
      g.add(glass);
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.1, 8), M.iron);
      top.position.y = 0.17;
      g.add(top);
      const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.06, 8), M.iron);
      bot.position.y = -0.14;
      g.add(bot);
      for (let i = 0; i < 4; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.28, 0.012), M.iron);
        const a = i / 4 * TAU;
        bar.position.set(Math.cos(a) * 0.13, 0.02, Math.sin(a) * 0.13);
        g.add(bar);
      }
      const spr = new THREE.Sprite(glowMat);
      spr.scale.set(1.9, 1.9, 1);
      g.add(spr);
      g.position.set(x, y, z);
      if (withLight) {
        const l = new THREE.PointLight(glCol(0xffa95c), 1.6, 16, 2);
        l.position.set(0, 0, 0);
        g.add(l);
        this.lanterns.push(l);
      }
      this.hull.add(g);
      return g;
    };
    lanternAt(0, 2.28, 10.9, true);
    lanternAt(0, 2.55, -10.4, true);
    lanternAt(0.9, 1.62, -0.2, false);
    /* lantern posts */
    for (const [x, z, h] of [[0, 11.0, 1.1], [0, -10.5, 1.2]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, h, 6), M.darkWood);
      post.position.set(x, 1.25 + h / 2, z);
      this.hull.add(post);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.42), M.darkWood);
      arm.position.set(x, 1.25 + h, z - 0.18);
      this.hull.add(arm);
    }

    /* steering oar */
    const so = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 4.2, 8), M.darkWood);
    shaft.rotation.z = -0.36;
    so.add(shaft);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.46), M.darkWood);
    blade.position.set(0.72, -1.95, 0);
    blade.rotation.z = -0.36;
    so.add(blade);
    so.position.set(2.45, 1.85, 9.8);
    so.rotation.y = 0.24;
    so.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.hull.add(so);
    this.steeringOar = so;
  },
};
