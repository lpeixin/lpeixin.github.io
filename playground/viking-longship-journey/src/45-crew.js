/* =========================================================================
   NORTHBOUND — crew, oars, rowing cycle
   ========================================================================= */

/* ---- oar geometry (along +X, pivot at origin) ---- */
function makeOarGeometry() {
  const parts = [];
  const shaft = new THREE.CylinderGeometry(0.040, 0.052, 5.7, 7, 1);
  shaft.rotateZ(-Math.PI / 2);
  shaft.translate(-1.3 + 5.7 / 2, 0, 0);
  parts.push(shaft);
  const blade = new THREE.BoxGeometry(0.92, 0.34, 0.045);
  blade.translate(3.86, 0, 0);
  parts.push(blade);
  const tip = new THREE.BoxGeometry(0.2, 0.26, 0.045);
  tip.translate(4.4, 0, 0);
  parts.push(tip);
  const collar = new THREE.TorusGeometry(0.075, 0.022, 5, 10);
  collar.rotateY(Math.PI / 2);
  parts.push(collar);
  const handle = new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6);
  handle.rotateZ(-Math.PI / 2);
  handle.translate(-1.34, 0, 0);
  parts.push(handle);
  return mergeGeometries(parts);
}

/* ---- body parts ---- */
function cycl(rt, rb, h, seg = 8) { return new THREE.CylinderGeometry(rt, rb, h, seg); }

function makeRowerLook(i) {
  const tunics = [0x5b5341, 0x4a5449, 0x6d4a3a, 0x6a6150, 0x475257, 0x7a6247];
  const trousers = [0x3c3a33, 0x45443b, 0x353b3d, 0x4a4136];
  const hairC = [0x4a3221, 0x6b4a2c, 0x8a6a3f, 0x2e241c];
  return {
    tunic: glCol(tunics[i % tunics.length]),
    trousers: glCol(trousers[i % trousers.length]),
    hair: glCol(hairC[i % hairC.length]),
  };
}

function addStandingFigure(parent, x, y, z, rotY, opts = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const look = makeRowerLook(opts.seed || 0);
  const skin = new THREE.MeshStandardMaterial({ color: glCol(0xb98a6c), roughness: 0.88 });
  const tunicMat = new THREE.MeshStandardMaterial({ color: look.tunic, roughness: 0.95 });
  const trouserMat = new THREE.MeshStandardMaterial({ color: look.trousers, roughness: 0.96 });
  const hairMat = new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.98 });

  const legL = new THREE.Mesh(cycl(0.075, 0.065, 0.9, 7), trouserMat);
  legL.position.set(-0.1, 0.45, 0);
  const legR = legL.clone(); legR.position.x = 0.1;
  const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.26), new THREE.MeshStandardMaterial({ color: glCol(0x3a2c22), roughness: 0.9 }));
  bootL.position.set(-0.1, 0.05, 0.04);
  const bootR = bootL.clone(); bootR.position.x = 0.1;

  const torso = new THREE.Mesh(cycl(0.17, 0.22, 0.62, 9), tunicMat);
  torso.position.y = 1.13;
  const skirt = new THREE.Mesh(cycl(0.22, 0.26, 0.3, 9), tunicMat);
  skirt.position.y = 0.83;
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.028, 5, 12), new THREE.MeshStandardMaterial({ color: glCol(0x3b2a1d), roughness: 0.8 }));
  belt.rotation.x = Math.PI / 2; belt.position.y = 0.95;

  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.86, 10, 1, true), new THREE.MeshStandardMaterial({ color: opts.cloak || glCol(0x4b4438), roughness: 0.98, side: THREE.DoubleSide }));
  cloak.position.y = 1.16;

  const neck = new THREE.Mesh(cycl(0.055, 0.06, 0.1, 6), skin);
  neck.position.y = 1.46;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.108, 12, 10), skin);
  head.position.y = 1.58;
  head.scale.set(0.92, 1.08, 1.0);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.114, 12, 10), hairMat);
  hair.position.set(0, 1.6, -0.015);
  hair.scale.set(1, 1.0, 1.02);
  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 7), hairMat);
  beard.position.set(0, 1.5, 0.075);
  beard.rotation.x = 0.25;

  const armL = new THREE.Mesh(cycl(0.055, 0.045, 0.62, 6), tunicMat);
  armL.position.set(-0.245, 1.15, 0.02); armL.rotation.z = 0.12;
  const armR = armL.clone(); armR.position.x = 0.245; armR.rotation.z = -0.12;
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), skin);
  handL.position.set(-0.28, 0.85, 0.02);
  const handR = handL.clone(); handR.position.x = 0.28;

  g.add(legL, legR, bootL, bootR, torso, skirt, belt, cloak, neck, head, hair, beard, armL, armR, handL, handR);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  parent.add(g);
  return g;
}

function buildCrew() {
  const oarGeo = makeOarGeometry();
  const oarMat = SHIP.M.darkWood;
  const armGeo = new THREE.CylinderGeometry(0.052, 0.045, 1, 6);
  armGeo.translate(0, 0.5, 0);

  for (const side of [-1, 1]) {
    for (let i = 0; i < SHIP.benchZ.length; i++) {
      const bz = SHIP.benchZ[i];
      const port = HULL.point(bz, 0.94, 0);
      const ox = side * (port[0] + 0.12);
      const oy = 1.10;

      /* oar group */
      const og = new THREE.Group();
      og.position.set(ox, oy, bz);
      og.rotation.order = 'YXZ';
      og.rotation.y = side > 0 ? 0 : Math.PI;
      const oar = new THREE.Mesh(oarGeo, oarMat);
      oar.castShadow = true;
      og.add(oar);
      SHIP.hull.add(og);
      SHIP.oars.push({ g: og, side, z: bz, phase: 0, submerged: 0, lastTipY: 1, splashT: 0 });

      /* oarport collar */
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 5, 10), SHIP.M.rope);
      collar.position.set(ox, oy, bz);
      collar.rotation.y = Math.PI / 2;
      SHIP.hull.add(collar);

      /* rower */
      const rx = side * 1.24;
      const rz = bz - 0.22;
      const look = makeRowerLook(i * 2 + (side > 0 ? 0 : 1));
      const rg = new THREE.Group();
      rg.position.set(rx, 0.72, rz);
      SHIP.hull.add(rg);

      const skinMat = new THREE.MeshStandardMaterial({ color: glCol(0xb08063), roughness: 0.9 });
      const tunicMat = new THREE.MeshStandardMaterial({ color: look.tunic, roughness: 0.95 });
      const trouserMat = new THREE.MeshStandardMaterial({ color: look.trousers, roughness: 0.96 });
      const hairMat = new THREE.MeshStandardMaterial({ color: look.hair, roughness: 0.98 });

      const hips = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.3), trouserMat);
      hips.position.set(0, 0.0, 0.02);
      rg.add(hips);

      for (const sx of [-1, 1]) {
        const thigh = new THREE.Mesh(cycl(0.085, 0.07, 0.48, 6), trouserMat);
        thigh.position.set(sx * 0.11, -0.04, 0.25);
        thigh.rotation.x = Math.PI / 2 - 0.16;
        rg.add(thigh);
        const shin = new THREE.Mesh(cycl(0.065, 0.055, 0.7, 6), trouserMat);
        shin.position.set(sx * 0.12, -0.37, 0.48);
        shin.rotation.x = 0.1;
        rg.add(shin);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.22), new THREE.MeshStandardMaterial({ color: glCol(0x3a2c22), roughness: 0.9 }));
        foot.position.set(sx * 0.12, -0.71, 0.52);
        rg.add(foot);
      }

      const torsoPivot = new THREE.Group();
      torsoPivot.position.set(0, 0.08, 0);
      rg.add(torsoPivot);

      const torso = new THREE.Mesh(cycl(0.185, 0.215, 0.52, 8), tunicMat);
      torso.position.y = 0.25;
      torsoPivot.add(torso);
      const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.13, 0.24), tunicMat);
      shoulders.position.set(0, 0.48, 0);
      torsoPivot.add(shoulders);
      const belt = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.026, 5, 12), new THREE.MeshStandardMaterial({ color: glCol(0x3b2a1d), roughness: 0.8 }));
      belt.rotation.x = Math.PI / 2;
      belt.position.y = 0.06;
      torsoPivot.add(belt);
      const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.31, 0.66, 9, 1, true), new THREE.MeshStandardMaterial({ color: look.tunic, roughness: 0.98, side: THREE.DoubleSide }));
      cloak.position.y = 0.28;
      torsoPivot.add(cloak);
      const neck = new THREE.Mesh(cycl(0.05, 0.055, 0.09, 6), skinMat);
      neck.position.y = 0.56;
      torsoPivot.add(neck);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), skinMat);
      head.position.set(0, 0.66, 0.01);
      head.scale.set(0.92, 1.06, 1.0);
      torsoPivot.add(head);
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.111, 12, 9), hairMat);
      hair.position.set(0, 0.685, -0.012);
      torsoPivot.add(hair);
      const beard = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.18, 7), hairMat);
      beard.position.set(0, 0.587, 0.078);
      beard.rotation.x = 0.22;
      torsoPivot.add(beard);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.108, 10, 6, 0, TAU, 0, 1.1), new THREE.MeshStandardMaterial({ color: glCol(0x574433), roughness: 0.95 }));
      cap.position.set(0, 0.70, -0.01);
      torsoPivot.add(cap);

      rg.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

      /* arms (positioned in hull space each frame) */
      const arms = [];
      for (const sx of [-1, 1]) {
        const upper = new THREE.Mesh(armGeo, tunicMat);
        const fore = new THREE.Mesh(armGeo, tunicMat);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 7, 6), skinMat);
        upper.castShadow = fore.castShadow = true;
        SHIP.hull.add(upper); SHIP.hull.add(fore); SHIP.hull.add(hand);
        arms.push({ upper, fore, hand, sx });
      }

      SHIP.rowers.push({
        group: rg, torsoPivot, arms, side, x: rx, z: rz, benchZ: bz,
        oar: SHIP.oars[SHIP.oars.length - 1],
      });
    }
  }

  /* standing crew */
  addStandingFigure(SHIP.hull, 1.55, 1.26, 9.9, Math.PI * 0.72, { seed: 2, cloak: glCol(0x3f4a44) });
  addStandingFigure(SHIP.hull, -0.35, 1.18, -10.2, Math.PI, { seed: 4, cloak: glCol(0x5a4335) });
  addStandingFigure(SHIP.hull, -1.35, 0.02, -1.9, Math.PI * 0.9, { seed: 1, cloak: glCol(0x4a4a52) });
}

/* rowing cycle */
const OAR_KEYS = [
  { t: 0.00, sweep: -0.30, dip: -0.235, lean: -0.33 },
  { t: 0.09, sweep: -0.27, dip: -0.318, lean: -0.35 },
  { t: 0.48, sweep: 0.28, dip: -0.336, lean: 0.26 },
  { t: 0.56, sweep: 0.33, dip: -0.115, lean: 0.29 },
  { t: 0.86, sweep: -0.27, dip: -0.095, lean: -0.28 },
  { t: 1.00, sweep: -0.30, dip: -0.235, lean: -0.33 },
];
function oarPose(p) {
  p = ((p % 1) + 1) % 1;
  for (let i = 0; i < OAR_KEYS.length - 1; i++) {
    const a = OAR_KEYS[i], b = OAR_KEYS[i + 1];
    if (p >= a.t && p <= b.t) {
      const k = smoothstep(0, 1, (p - a.t) / (b.t - a.t));
      return {
        sweep: lerp(a.sweep, b.sweep, k),
        dip: lerp(a.dip, b.dip, k),
        lean: lerp(a.lean, b.lean, k),
      };
    }
  }
  return OAR_KEYS[0];
}

const _m4 = new THREE.Matrix4();
const _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _p3 = new THREE.Vector3();
const _handL = new THREE.Vector3(), _handR = new THREE.Vector3();

SHIP.updateCrew = function (dt, time, rowing, emitSplash) {
  const strokePeriod = 2.55;
  const phase = rowing ? (time / strokePeriod) % 1 : 0.62;
  const pose = oarPose(phase);

  for (const oar of SHIP.oars) {
    const g = oar.g;
    const sweep = pose.sweep;
    g.rotation.y = oar.side > 0 ? sweep : Math.PI - sweep;
    g.rotation.z = pose.dip;
    g.updateMatrix();

    /* blade tip in hull space */
    const tipLocal = _p1.set(4.45, 0, 0).applyMatrix4(g.matrix);
    oar.tipLocal = (oar.tipLocal || new THREE.Vector3()).copy(tipLocal);
    oar.bladeMid = (oar.bladeMid || new THREE.Vector3()).set(3.85, 0, 0).applyMatrix4(g.matrix);
  }

  /* arms + body */
  for (const r of SHIP.rowers) {
    const lean = pose.lean;
    r.torsoPivot.rotation.x = lean;

    const cosL = Math.cos(lean), sinL = Math.sin(lean);
    const baseY = 0.72 + 0.08;
    for (const arm of r.arms) {
      const sx = arm.sx;
      const shoulder = _p2.set(r.x + sx * 0.165, baseY + 0.47 * cosL, r.z + 0.47 * sinL);

      /* grip point along the loom */
      const gripX = -1.05 - (sx > 0 ? 0.0 : 0.14);
      const grip = _p3.set(gripX, 0, 0).applyMatrix4(r.oar.g.matrix);

      const d = shoulder.distanceTo(grip);
      const L = 0.34;
      const h = Math.sqrt(Math.max(0.001, L * L - Math.pow(d / 2, 2)));
      const mid = _handL.copy(shoulder).add(grip).multiplyScalar(0.5);
      const dir = _handR.copy(grip).sub(shoulder).normalize();
      const bend = new THREE.Vector3(sx * 0.85, -1.0, -0.25).normalize();
      const perp = bend.sub(dir.clone().multiplyScalar(bend.dot(dir))).normalize();
      const elbow = mid.clone().addScaledVector(perp, h);

      setSegment(arm.upper, shoulder, elbow, 1.0);
      setSegment(arm.fore, elbow, grip, 0.92);
      arm.hand.position.copy(grip);
    }
  }
};
