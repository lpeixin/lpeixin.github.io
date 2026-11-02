/* =========================================================================
   NORTHBOUND — input, camera direction, audio
   ========================================================================= */

const INPUT = {
  steer: 0, steerTarget: 0,
  throttle: 0.62, throttleTarget: 0.62,
  dragging: false, lx: 0, ly: 0,
  yaw: 0, pitch: 0, yawT: 0, pitchT: 0,
  dist: 19, distT: 19,
  lastInput: -99, touch: false,
};

const CAM = {
  mode: 'follow',
  pos: new THREE.Vector3(0, 8, 26),
  look: new THREE.Vector3(),
  fov: 55,
  shot: 0,
  shotT: 0,
  shotDur: 11,
  blend: 1,
  blendPos: new THREE.Vector3(),
  blendLook: new THREE.Vector3(),
  blendFov: 55,
  shake: 0,
};

const SHOTS = [
  { name: 'bow low', dur: 11, fov: 48 },
  { name: 'beam', dur: 12, fov: 42 },
  { name: 'crane', dur: 12, fov: 50 },
  { name: 'chase', dur: 10, fov: 52 },
  { name: 'prow', dur: 9, fov: 44 },
  { name: 'waterline', dur: 11, fov: 46 },
];

const _cp = new THREE.Vector3(), _cl = new THREE.Vector3();
function shotPose(i, t, ship, fwd, side) {
  const p = _cp.copy(ship);
  const l = _cl.copy(ship);
  const seek = Math.sin(t * 0.35) * 0.5 + 0.5;
  switch (i % SHOTS.length) {
    case 0:
      p.addScaledVector(fwd, 17 + Math.sin(t * 0.24) * 4).addScaledVector(side, 8.5).add(new THREE.Vector3(0, 1.55, 0));
      l.addScaledVector(fwd, 1).add(new THREE.Vector3(0, 2.1, 0));
      break;
    case 1:
      p.addScaledVector(side, 25 + Math.sin(t * 0.18) * 3).addScaledVector(fwd, -6 + t * 0.55).add(new THREE.Vector3(0, 5.2, 0));
      l.addScaledVector(fwd, 1.5).add(new THREE.Vector3(0, 2.0, 0));
      break;
    case 2:
      p.addScaledVector(fwd, 34 - t * 0.7).addScaledVector(side, -8 + Math.sin(t * 0.2) * 4).add(new THREE.Vector3(0, 30, 0));
      l.copy(ship).addScaledVector(fwd, 4).add(new THREE.Vector3(0, 1.2, 0));
      break;
    case 3:
      p.addScaledVector(fwd, -23 - Math.sin(t * 0.3) * 2).add(new THREE.Vector3(0, 5.6, 0));
      l.addScaledVector(fwd, 8).add(new THREE.Vector3(0, 2.4, 0));
      break;
    case 4:
      p.addScaledVector(fwd, 9.5).addScaledVector(side, 3.6).add(new THREE.Vector3(0, 3.9 + Math.sin(t * 0.4) * 0.4, 0));
      l.addScaledVector(fwd, 15).add(new THREE.Vector3(0, 3.2, 0));
      break;
    default:
      p.addScaledVector(side, 14).addScaledVector(fwd, -9 + t * 0.5).add(new THREE.Vector3(0, 0.85, 0));
      l.addScaledVector(side, 1).addScaledVector(fwd, 2).add(new THREE.Vector3(0, 1.9, 0));
  }
  return { p, l, fov: SHOTS[i % SHOTS.length].fov };
}

function updateCamera(dt, ctx) {
  const { shipPos, fwd, side, speed, time, paused } = ctx;
  const k = 1 - Math.exp(-3.4 * dt);

  if (CAM.mode === 'cinema') {
    CAM.shotT += dt;
    if (CAM.shotT > SHOTS[CAM.shot % SHOTS.length].dur) {
      CAM.shotT = 0;
      CAM.shot = (CAM.shot + 1) % SHOTS.length;
      CAM.blend = 0;
      CAM.blendPos.copy(CAM.pos);
      CAM.blendLook.copy(CAM.look);
      CAM.blendFov = CAM.fov;
    }
    const pose = shotPose(CAM.shot, CAM.shotT, shipPos, fwd, side);
    CAM.blend = Math.min(1, CAM.blend + dt / 1.35);
    const b = smoothstep(0, 1, CAM.blend);
    const tp = pose.p.clone().lerp(pose.l, 0);
    CAM.pos.lerpVectors(CAM.blendPos, tp, b);
    CAM.look.lerpVectors(CAM.blendLook, pose.l, b);
    CAM.fov = lerp(CAM.blendFov, pose.fov, b);
    /* gentle breathing */
    CAM.pos.x += Math.sin(time * 0.31) * 0.09;
    CAM.pos.y += Math.sin(time * 0.47 + 1.3) * 0.07;
  } else {
    const isOrbit = CAM.mode === 'orbit';
    const baseYaw = isOrbit ? 0 : Math.atan2(fwd.x, fwd.z);
    /* sit off the ship's axis: dead astern hides the whole vessel behind its
       own sail, a three-quarter angle reads far better */
    const yaw = baseYaw + INPUT.yaw + (isOrbit ? Math.PI : 0.46);
    const pitch = INPUT.pitch + (isOrbit ? 0.06 : 0.15);
    const dist = isOrbit ? INPUT.dist * 1.15 : INPUT.dist;
    const target = new THREE.Vector3().copy(shipPos).addScaledVector(fwd, isOrbit ? 0 : 2.0).add(new THREE.Vector3(0, 2.15, 0));
    const cp = new THREE.Vector3(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist + 1.2,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist
    );
    CAM.pos.lerp(cp, 1 - Math.exp(-5.5 * dt));
    CAM.look.lerp(target, 1 - Math.exp(-7.0 * dt));
    CAM.fov = lerp(CAM.fov, 53 + speed * 0.9, 1 - Math.exp(-2 * dt));
  }
}

/* ---------------------------------------------------------------- audio */
const AUDIO = {
  on: false, ctx: null, master: null,
  waterGain: null, windGain: null, rowGain: null,
  birdTimer: 6, strokeLast: -1,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;

    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2 + w * 0.15;
    }
    this.noise = buf;

    const mkLoop = (filterType, freq, q, gainVal) => {
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = filterType; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = gainVal;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
      return { src, f, g };
    };
    this.water = mkLoop('lowpass', 520, 0.7, 0.5);
    this.wind = mkLoop('bandpass', 720, 0.6, 0.12);

    /* slow modulation for lapping */
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lg = ctx.createGain(); lg.gain.value = 0.16;
    lfo.connect(lg); lg.connect(this.water.g.gain); lfo.start();

    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.06;
    const lg2 = ctx.createGain(); lg2.gain.value = 140;
    lfo2.connect(lg2); lg2.connect(this.wind.f.frequency); lfo2.start();
  },

  setOn(on) {
    this.on = on;
    if (on) {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(0.55, this.ctx.currentTime + 2.5);
    } else if (this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.6);
    }
  },

  bird() {
    const ctx = this.ctx, t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    const base = 1500 + Math.random() * 1400;
    o.frequency.setValueAtTime(base, t0);
    o.frequency.exponentialRampToValueAtTime(base * (1.3 + Math.random() * 0.8), t0 + 0.07);
    o.frequency.exponentialRampToValueAtTime(base * 0.85, t0 + 0.16);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.25);
  },

  stroke(strength) {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    /* thud */
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, t0);
    o.frequency.exponentialRampToValueAtTime(58, t0 + 0.16);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.11 * strength, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.3);
    /* splash */
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 500; f.Q.value = 0.9;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, t0);
    sg.gain.exponentialRampToValueAtTime(0.07 * strength, t0 + 0.03);
    sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    s.connect(f); f.connect(sg); sg.connect(this.master);
    s.start(t0); s.stop(t0 + 0.4);
  },

  update(dt, speed, phase) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.water.g.gain.setTargetAtTime(0.32 + speed * 0.05, t, 0.5);
    this.wind.g.gain.setTargetAtTime(0.06 + speed * 0.028, t, 0.8);
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      this.birdTimer = 7 + Math.random() * 16;
      if (Math.random() < 0.8) { this.bird(); if (Math.random() < 0.4) setTimeout(() => this.bird(), 180); }
    }
  },
};

/* ---------------------------------------------------------------- input */
function setupInput(canvas) {
  const down = (e) => {
    if (e.target !== canvas) return;
    INPUT.dragging = true;
    INPUT.lx = e.clientX; INPUT.ly = e.clientY;
    INPUT.lastInput = performance.now() / 1000;
    canvas.classList.add('dragging');
    canvas.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!INPUT.dragging) return;
    const dx = e.clientX - INPUT.lx, dy = e.clientY - INPUT.ly;
    INPUT.lx = e.clientX; INPUT.ly = e.clientY;
    if (CAM.mode === 'cinema') { CAM.mode = 'follow'; syncCamUI(); }
    INPUT.yawT -= dx * 0.0034;
    INPUT.pitchT = clamp(INPUT.pitchT + dy * 0.0026, -0.22, 0.72);
    INPUT.lastInput = performance.now() / 1000;
  };
  const up = (e) => {
    INPUT.dragging = false;
    canvas.classList.remove('dragging');
  };
  canvas.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    INPUT.distT = clamp(INPUT.distT + e.deltaY * 0.012, 9, 60);
    INPUT.lastInput = performance.now() / 1000;
  }, { passive: false });

  const keys = {};
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
    keys[k] = true;
    if (k === ' ') togglePause();
    if (k === 'h') toggleUI();
    if (k === 'f') toggleFull();
    if (k === '1') setCamera('follow');
    if (k === '2') setCamera('orbit');
    if (k === '3') setCamera('cinema');
    if (k === 'r') resetJourney();
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  INPUT.keys = keys;
  INPUT.touch = matchMedia('(pointer: coarse)').matches;
  if (INPUT.touch) document.getElementById('touch').classList.add('on');
}

function pollInput(dt) {
  const k = INPUT.keys || {};
  let s = 0;
  if (k['a'] || k['arrowleft']) s += 1;
  if (k['d'] || k['arrowright']) s -= 1;
  if (INPUT._touchSteer) s += INPUT._touchSteer;
  INPUT.steerTarget = clamp(s, -1, 1);

  let th = 0;
  if (k['w'] || k['arrowup']) th += 1;
  if (k['s'] || k['arrowdown']) th -= 1;
  if (INPUT._touchThrottle) th += INPUT._touchThrottle;
  if (th !== 0) INPUT.throttleTarget = clamp(INPUT.throttleTarget + th * dt * 0.55, 0, 1.35);

  INPUT.steer = damp(INPUT.steer, INPUT.steerTarget, 3.2, dt);
  INPUT.throttle = damp(INPUT.throttle, INPUT.throttleTarget, 1.6, dt);
  INPUT.yaw = damp(INPUT.yaw, INPUT.yawT, 4.5, dt);
  INPUT.pitch = damp(INPUT.pitch, INPUT.pitchT, 4.5, dt);
  INPUT.dist = damp(INPUT.dist, INPUT.distT, 3.0, dt);
}
