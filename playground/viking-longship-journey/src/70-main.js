/* =========================================================================
   NORTHBOUND — scene assembly, lighting presets, journey, main loop
   ========================================================================= */

const PRESETS = [
  {
    name: 'Morning', label: 'Morning',
    sunDir: [0.46, 0.245, -0.86], sunColor: 0xffdcc0, sunIntensity: 2.35,
    hemiSky: 0x9fc4e2, hemiGround: 0x323630, hemiIntensity: 1.32,
    fogColor: 0xb3c5cd, fogDensity: 0.00135, exposure: 1.02,
    sky: {
      zenith: 0x27578c, horizon: 0xc6d2cf, sunDisc: 0.0016, sunHalo: 1.15, cloudCover: 0.50, cloudSharp: 0.30,
      stars: 0.0, haze: 0.55, sunGlow: 1.0, cloudLit: 0xf4e7d4, cloudDark: 0x6f7b85,
    },
    water: { deep: 0x0a2325, shallow: 0x2b6b5d, skyAmb: 0x93aabb, sunSpec: 1.0, reflectivity: 1.0, detail: 1.0, absorb: 1.0 },
  },
  {
    name: 'Overcast', label: 'Overcast',
    sunDir: [0.16, 0.58, -0.80], sunColor: 0xdde6ea, sunIntensity: 0.85,
    hemiSky: 0xc2ccd0, hemiGround: 0x40423a, hemiIntensity: 1.05,
    fogColor: 0xa9b4b7, fogDensity: 0.0034, exposure: 1.12,
    sky: {
      zenith: 0x8e9ea9, horizon: 0xc3ccce, sunDisc: 0.0009, sunHalo: 0.55, cloudCover: 0.30, cloudSharp: 0.45,
      stars: 0.0, haze: 0.5, sunGlow: 0.55, cloudLit: 0xd6dde0, cloudDark: 0x879299,
    },
    water: { deep: 0x0b2429, shallow: 0x2f5c55, skyAmb: 0xa8b6bd, sunSpec: 0.22, reflectivity: 1.0, detail: 1.15, absorb: 0.95 },
  },
  {
    name: 'Moonlight', label: 'Moonlight',
    sunDir: [-0.42, 0.44, 0.79], sunColor: 0xa8c4ff, sunIntensity: 0.55,
    hemiSky: 0x2a3c5a, hemiGround: 0x0a0d12, hemiIntensity: 0.32,
    fogColor: 0x0e1826, fogDensity: 0.0028, exposure: 1.28,
    sky: {
      zenith: 0x060f1e, horizon: 0x1b2c3f, sunDisc: 0.0022, sunHalo: 0.75, cloudCover: 0.58, cloudSharp: 0.34,
      stars: 1.0, haze: 0.28, sunGlow: 0.25, cloudLit: 0x3d4d63, cloudDark: 0x131c28,
    },
    water: { deep: 0x040e16, shallow: 0x11333b, skyAmb: 0x2b3b52, sunSpec: 1.1, reflectivity: 1.0, detail: 0.95, absorb: 1.15 },
  },
];

let renderer, scene, camera, sky, terrain, sunLight, hemiLight, FOG, ship;
let paused = false, simTime = 0, presetIndex = 0;
let quality, dpr = 1, frameAvg = 16, dynScale = 1;

const JOURNEY = { s: 0.02, t: 0, tT: 0, yaw: 0, speed: 3.0, time: 0, dist: 0, auto: false, steerVis: 0 };
const CHAPTERS = [
  { at: 0.00, num: 'I', numZh: '一', title: 'The Still Water', sub: 'Where the fjord opens to the sea' },
  { at: 0.16, num: 'II', numZh: '二', title: 'The Narrowing', sub: 'Cliffs close around the channel' },
  { at: 0.33, num: 'III', numZh: '三', title: 'Falls of the High Shelf', sub: 'Meltwater from the summer snows' },
  { at: 0.50, num: 'IV', numZh: '四', title: 'Harbour of the Long Houses', sub: 'A settlement keeps its fire' },
  { at: 0.68, num: 'V', numZh: '五', title: 'The Deep Reach', sub: 'Still water, and the far ridge' },
  { at: 0.85, num: 'VI', numZh: '六', title: 'Northbound', sub: 'The last of the light' },
];

const I18N = {
  en: {
    pageTitle: 'Northbound — A Nordic Passage',
    pageDesc: 'An interactive 3D journey through a Nordic fjord aboard a Viking longship.',
    brandTitle: 'Northbound.',
    brandSub: 'A Nordic Passage',
    introTitle: 'Northbound<span style="opacity:.55">.</span>',
    introSub: 'A Nordic Passage',
    introLede: 'A wooden longship, a narrow fjord, and the low light of the north. Take the tiller and follow the water inland.',
    begin: 'Begin the voyage',
    hint: '<b>A</b> / <b>D</b> steer &nbsp;·&nbsp; <b>W</b> / <b>S</b> speed &nbsp;·&nbsp; drag to look',
    follow: 'Follow',
    followTitle: 'Follow camera',
    orbit: 'Orbit',
    orbitTitle: 'Orbit camera',
    cinema: 'Cinema',
    cinemaTitle: 'Cinematic camera',
    lightTitle: 'Change light',
    presets: {
      Morning: 'Morning',
      Overcast: 'Overcast',
      Moonlight: 'Moonlight',
    },
    auto: 'Auto',
    autoTitle: 'Automatic journey',
    sound: 'Sound',
    soundTitle: 'Sound',
    pause: 'Pause',
    pauseTitle: 'Pause',
    play: 'Play',
    playTitle: 'Resume',
    reset: 'Reset',
    resetTitle: 'Reset',
    full: 'Full',
    fullTitle: 'Fullscreen',
    hide: 'Hide',
    hideTitle: 'Hide interface',
    showTitle: 'Show interface',
    langTitle: 'Switch to Chinese (切换至中文)',
    touchLeft: 'Steer left',
    touchRight: 'Steer right',
    touchSlow: 'Slow down',
    touchFast: 'Speed up',
    chapterLabel: (c) => `Chapter ${c.num}`,
    chapters: [
      { title: 'The Still Water', sub: 'Where the fjord opens to the sea' },
      { title: 'The Narrowing', sub: 'Cliffs close around the channel' },
      { title: 'Falls of the High Shelf', sub: 'Meltwater from the summer snows' },
      { title: 'Harbour of the Long Houses', sub: 'A settlement keeps its fire' },
      { title: 'The Deep Reach', sub: 'Still water, and the far ridge' },
      { title: 'Northbound', sub: 'The last of the light' },
    ],
    errPrefix: 'Unable to start the scene: ',
  },
  zh: {
    pageTitle: '向北而行 — 北欧峡湾之旅',
    pageDesc: '乘坐维京长船穿行北欧峡湾的沉浸式 3D 交互之旅。',
    brandTitle: '向北而行.',
    brandSub: '北欧峡湾之旅',
    introTitle: '向北而行<span style="opacity:.55">.</span>',
    introSub: '北欧峡湾之旅',
    introLede: '一艘木制长船，一道幽狭峡湾，一抹北境的低垂天光。执起舵柄，顺水向内陆深处航行。',
    begin: '开启航程',
    hint: '<b>A</b> / <b>D</b> 转向 &nbsp;·&nbsp; <b>W</b> / <b>S</b> 航速 &nbsp;·&nbsp; 拖拽环视',
    follow: '跟随',
    followTitle: '跟随视角',
    orbit: '环绕',
    orbitTitle: '环绕视角',
    cinema: '电影',
    cinemaTitle: '电影运镜视角',
    lightTitle: '切换光影',
    presets: {
      Morning: '晨曦',
      Overcast: '阴霭',
      Moonlight: '月夜',
    },
    auto: '巡航',
    autoTitle: '自动巡航',
    sound: '音效',
    soundTitle: '环境音效',
    pause: '暂停',
    pauseTitle: '暂停',
    play: '继续',
    playTitle: '继续航行',
    reset: '重置',
    resetTitle: '重置航程',
    full: '全屏',
    fullTitle: '全屏显示',
    hide: '隐藏',
    hideTitle: '隐藏界面',
    showTitle: '显示界面',
    langTitle: '切换至英文 (Switch to English)',
    touchLeft: '向左转向',
    touchRight: '向右转向',
    touchSlow: '减速',
    touchFast: '加速',
    chapterLabel: (c) => `第${c.numZh}章`,
    chapters: [
      { title: '静水之畔', sub: '峡湾向大海敞开之处' },
      { title: '峡道渐窄', sub: '两岸峭壁夹峙水道' },
      { title: '高崖飞瀑', sub: '源自夏日积雪的融水' },
      { title: '长屋港湾', sub: '聚落守望着不熄的炉火' },
      { title: '幽深水道', sub: '静水无波，远山如脊' },
      { title: '向北而行', sub: '天际最后一抹余晖' },
    ],
    errPrefix: '无法启动场景：',
  },
};

function detectDefaultLang() {
  try {
    const saved = localStorage.getItem('nb_lang');
    if (saved === 'zh' || saved === 'en') return saved;
  } catch (_) {}
  const navLangs = (navigator.languages && navigator.languages.length)
    ? navigator.languages
    : [navigator.language || navigator.userLanguage || 'en'];
  for (const l of navLangs) {
    if (!l) continue;
    const low = String(l).toLowerCase();
    if (low.startsWith('zh')) return 'zh';
    if (low.startsWith('en')) return 'en';
  }
  return 'en';
}

let currentLang = detectDefaultLang();

const LOOK = {
  sunColor: glCol(0xffdcc0),
  sunDir: new THREE.Vector3(0.46, 0.235, -0.86).normalize(),
  sunIntensity: 2.35,
  hemiSky: glCol(0x9fc4e2),
  hemiGround: glCol(0x2f332c),
  hemiIntensity: 1.32,
  fogColor: glCol(0xb3c5cd),
  fogDensity: 0.00135,
  exposure: 1.02,
  sky: {
    zenith: glCol(0x2d5f96), horizon: glCol(0xcfd5ca), sunDisc: 0.0016, sunHalo: 1.15,
    cloudCover: 0.50, cloudSharp: 0.30, stars: 0, haze: 0.55, sunGlow: 1.0,
    cloudLit: glCol(0xf4e7d4), cloudDark: glCol(0x6f7b85),
  },
  water: {
    deep: glCol(0x0a2325), shallow: glCol(0x2b6b5d), skyAmb: glCol(0x93aabb),
    sunSpec: 1.0, reflectivity: 1.0, detail: 1.0, absorb: 1.0,
  },
};

const PRESET_COLORS = PRESETS.map((p) => ({
  sunColor: glCol(p.sunColor), hemiSky: glCol(p.hemiSky), hemiGround: glCol(p.hemiGround),
  fogColor: glCol(p.fogColor),
  sky: {
    zenith: glCol(p.sky.zenith), horizon: glCol(p.sky.horizon), cloudLit: glCol(p.sky.cloudLit), cloudDark: glCol(p.sky.cloudDark),
  },
  water: { deep: glCol(p.water.deep), shallow: glCol(p.water.shallow), skyAmb: glCol(p.water.skyAmb) },
}));

function applyLook(dt) {
  const P = PRESETS[presetIndex], C = PRESET_COLORS[presetIndex];
  const k = 1 - Math.exp(-1.35 * dt);
  LOOK.sunDir.lerp(new THREE.Vector3(...P.sunDir).normalize(), k).normalize();
  LOOK.sunColor.lerp(C.sunColor, k);
  LOOK.sunIntensity = damp(LOOK.sunIntensity, P.sunIntensity, 1.35, dt);
  LOOK.hemiSky.lerp(C.hemiSky, k);
  LOOK.hemiGround.lerp(C.hemiGround, k);
  LOOK.hemiIntensity = damp(LOOK.hemiIntensity, P.hemiIntensity, 1.35, dt);
  LOOK.fogColor.lerp(C.fogColor, k);
  LOOK.fogDensity = damp(LOOK.fogDensity, P.fogDensity, 1.35, dt);
  LOOK.exposure = damp(LOOK.exposure, P.exposure, 1.35, dt);

  const S = LOOK.sky, T = P.sky;
  S.zenith.lerp(C.sky.zenith, k);
  S.horizon.lerp(C.sky.horizon, k);
  S.cloudLit.lerp(C.sky.cloudLit, k);
  S.cloudDark.lerp(C.sky.cloudDark, k);
  S.sunDisc = damp(S.sunDisc, T.sunDisc, 1.35, dt);
  S.sunHalo = damp(S.sunHalo, T.sunHalo, 1.35, dt);
  S.cloudCover = damp(S.cloudCover, T.cloudCover, 1.35, dt);
  S.cloudSharp = damp(S.cloudSharp, T.cloudSharp, 1.35, dt);
  S.stars = damp(S.stars, T.stars, 1.35, dt);
  S.haze = damp(S.haze, T.haze, 1.35, dt);
  S.sunGlow = damp(S.sunGlow, T.sunGlow, 1.35, dt);

  const W = LOOK.water, U = P.water;
  W.deep.lerp(C.water.deep, k);
  W.shallow.lerp(C.water.shallow, k);
  W.skyAmb.lerp(C.water.skyAmb, k);
  W.sunSpec = damp(W.sunSpec, U.sunSpec, 1.35, dt);
  W.reflectivity = damp(W.reflectivity, U.reflectivity, 1.35, dt);
  W.detail = damp(W.detail, U.detail, 1.35, dt);
  W.absorb = damp(W.absorb, U.absorb, 1.35, dt);

  /* push */
  sunLight.color.copy(LOOK.sunColor);
  sunLight.intensity = LOOK.sunIntensity;
  hemiLight.color.copy(LOOK.hemiSky);
  hemiLight.groundColor.copy(LOOK.hemiGround);
  hemiLight.intensity = LOOK.hemiIntensity;
  FOG.color.copy(LOOK.fogColor);
  FOG.density = LOOK.fogDensity;
  renderer.setClearColor(LOOK.fogColor, 1);

  const su = sky.material.uniforms;
  su.uSunDir.value.copy(LOOK.sunDir);
  su.uSunColor.value.copy(LOOK.sunColor);
  su.uZenith.value.copy(S.zenith);
  su.uHorizon.value.copy(S.horizon);
  su.uCloudLit.value.copy(S.cloudLit);
  su.uCloudDark.value.copy(S.cloudDark);
  su.uSunDisc.value = S.sunDisc;
  su.uSunHalo.value = S.sunHalo;
  su.uCloudCover.value = S.cloudCover;
  su.uCloudSharp.value = S.cloudSharp;
  su.uStars.value = S.stars;
  su.uHaze.value = S.haze;
  su.uSunGlow.value = S.sunGlow;
  su.uTime.value = simTime;

  const wu = WATER.mat.uniforms;
  wu.uSunDir.value.copy(LOOK.sunDir);
  wu.uSunColor.value.copy(LOOK.sunColor);
  wu.uSkyAmb.value.copy(W.skyAmb);
  wu.uDeep.value.copy(W.deep);
  wu.uShallow.value.copy(W.shallow);
  wu.uFogColor.value.copy(LOOK.fogColor);
  wu.uFogDensity.value = LOOK.fogDensity;
  wu.uSunSpec.value = W.sunSpec;
  wu.uReflectivity.value = W.reflectivity;
  wu.uDetail.value = W.detail;
  wu.uAbsorb.value = W.absorb;
  wu.uExposure.value = LOOK.exposure;
  wu.uUseShadow.value = quality.shadows ? 1 : 0;
}

/* --------------------------------------------------------------- journey */
const _tan = new THREE.Vector3();
function updateJourney(dt) {
  const hw = channelHalfWidth(JOURNEY.s);
  const lim = hw - 9.5;

  let steer = INPUT.steer;
  if (JOURNEY.auto) {
    steer = Math.sin(simTime * 0.21) * 0.55;
    INPUT.throttleTarget = 0.72;
  }
  JOURNEY.steerVis = damp(JOURNEY.steerVis, steer, 2.5, dt);
  JOURNEY.tT = clamp(JOURNEY.tT + steer * 15.5 * dt, -lim, lim);
  if (JOURNEY.auto) JOURNEY.tT = clamp(JOURNEY.tT * 0.995 + Math.sin(simTime * 0.09) * 0.35 * dt * 15, -lim, lim);
  JOURNEY.t = damp(JOURNEY.t, JOURNEY.tT, 1.35, dt);

  const targetSpeed = INPUT.throttle * 7.6;
  JOURNEY.speed = damp(JOURNEY.speed, targetSpeed, 1.1, dt);

  const prevT = JOURNEY.t;
  JOURNEY.s = (JOURNEY.s + JOURNEY.speed * dt / ROUTE_LENGTH) % 1;
  JOURNEY.dist += JOURNEY.speed * dt;

  const p = ROUTE.getPointAt(JOURNEY.s);
  ROUTE.getTangentAt(JOURNEY.s, _tan);
  const nx = -_tan.z, nz = _tan.x;
  const routeYaw = Math.atan2(-_tan.x, -_tan.z);
  const latVel = (JOURNEY.t - prevT) / Math.max(dt, 1e-4);
  const targetYaw = routeYaw + clamp(latVel * 0.085, -0.55, 0.55);
  JOURNEY.yaw = damp(JOURNEY.yaw, targetYaw, 2.4, dt);

  const x = p.x + nx * JOURNEY.t;
  const z = p.z + nz * JOURNEY.t;

  /* hard collision guard: never sail into terrain */
  const ahead = 8 + JOURNEY.speed * 0.6;
  const fx = x - Math.sin(JOURNEY.yaw) * ahead, fz = z - Math.cos(JOURNEY.yaw) * ahead;
  const hAhead = heightAtWorld(fx, fz);
  if (hAhead > -2.4) {
    JOURNEY.speed *= 0.94;
    JOURNEY.tT *= 0.985;
    JOURNEY.t = damp(JOURNEY.t, JOURNEY.tT, 3.0, dt);
  }
  const hHere = heightAtWorld(x, z);
  if (hHere > -1.8) JOURNEY.t = damp(JOURNEY.t, 0, 3.0, dt);

  /* buoyancy */
  const bob = Math.sin(simTime * 0.9 + x * 0.02) * 0.075 + Math.sin(simTime * 1.37 + z * 0.015) * 0.045;
  SHIP.root.position.set(x, bob - 0.34, z);
  SHIP.root.rotation.order = 'YXZ';
  SHIP.root.rotation.y = JOURNEY.yaw;
  SHIP.root.rotation.x = Math.sin(simTime * 1.12 + 0.6) * 0.008 + JOURNEY.speed * 0.0012;
  SHIP.root.rotation.z = Math.sin(simTime * 0.83) * 0.013 - JOURNEY.steerVis * 0.035;
  SHIP.root.updateMatrixWorld(true);

  return { x, z };
}

/* ------------------------------------------------------------- splash fx */
const _tipW = new THREE.Vector3();
let lastSplashT = 0;
function updateSplashes(dt, time) {
  const period = 2.55;
  const phase = (time / period) % 1;
  for (let i = 0; i < SHIP.oars.length; i++) {
    const oar = SHIP.oars[i];
    if (!oar.tipLocal) continue;
    _tipW.copy(oar.tipLocal).applyMatrix4(SHIP.root.matrixWorld);
    const submerged = _tipW.y < -0.03;
    if (submerged && !oar.wasSub) {
      if (i % 2 === 0) {
        if (Math.abs(_tipW.z - CAM.pos.z) < 220) {
          WATER.addRipple(_tipW.x, _tipW.z, 0.85, time);
          for (let k = 0; k < 4; k++) {
            FX.spawn(_tipW.x + (Math.random() - 0.5) * 0.3, 0.05, _tipW.z + (Math.random() - 0.5) * 0.3,
              (Math.random() - 0.5) * 3.2, 1.6 + Math.random() * 2.4, (Math.random() - 0.5) * 3.2,
              0.5 + Math.random() * 0.45, 0.30 + Math.random() * 0.25, 0.78, 0.86, 0.88);
          }
        }
      }
      AUDIO.stroke(1.0);
    }
    if (!submerged && oar.wasSub) {
      for (let k = 0; k < 5; k++) {
        FX.spawn(_tipW.x, 0.08, _tipW.z,
          (Math.random() - 0.5) * 2.6, 2.2 + Math.random() * 2.6, (Math.random() - 0.5) * 2.6,
          0.5 + Math.random() * 0.5, 0.26 + Math.random() * 0.3, 0.8, 0.87, 0.9);
      }
      WATER.addRipple(_tipW.x, _tipW.z, 0.55, time);
    }
    oar.wasSub = submerged;
  }
  /* wake seeds, world space */
  if (time - lastSplashT > 0.5) {
    lastSplashT = time;
    const back = new THREE.Vector3(0, 0, 13).applyQuaternion(SHIP.root.quaternion).add(SHIP.root.position);
    WATER.addRipple(back.x, back.z, 0.5, time);
    const sideV = new THREE.Vector3(3.2, 0, 6).applyQuaternion(SHIP.root.quaternion).add(SHIP.root.position);
    WATER.addRipple(sideV.x, sideV.z, 0.35, time);
  }
}

/* ------------------------------------------------------------------ ui */
const $ = (id) => document.getElementById(id);
let uiTimer = 0;

function setCamera(mode) {
  CAM.mode = mode;
  if (mode !== 'cinema') { CAM.blend = 1; }
  else { CAM.blend = 0; CAM.blendPos.copy(CAM.pos); CAM.blendLook.copy(CAM.look); CAM.blendFov = CAM.fov; }
  if (mode === 'orbit') { INPUT.yawT = 0; INPUT.pitchT = 0.16; INPUT.distT = 22; }
  if (mode === 'follow') { INPUT.pitchT = 0.02; INPUT.distT = 19; }
  syncCamUI();
}
function syncCamUI() {
  for (const id of ['follow', 'orbit', 'cinema']) {
    $(`b-${id}`).classList.toggle('is-on', CAM.mode === id);
  }
}
function setPreset(i) {
  presetIndex = (i + PRESETS.length) % PRESETS.length;
  const pName = PRESETS[presetIndex].name;
  $('b-light').textContent = I18N[currentLang].presets[pName] || PRESETS[presetIndex].label;
  $('b-light').classList.add('is-on');
}
function togglePause() {
  paused = !paused;
  const L = I18N[currentLang];
  $('b-pause').classList.toggle('is-on', paused);
  $('b-pause').textContent = paused ? L.play : L.pause;
  $('b-pause').title = paused ? L.playTitle : L.pauseTitle;
}
function toggleUI() {
  document.body.classList.toggle('ui-hidden');
}
function toggleFull() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}
function resetJourney() {
  JOURNEY.s = 0.02; JOURNEY.t = 0; JOURNEY.tT = 0; JOURNEY.speed = 3; JOURNEY.dist = 0;
  INPUT.throttleTarget = 0.62; INPUT.throttle = 0.62; INPUT.steer = 0; INPUT.yawT = 0; INPUT.pitchT = 0.02;
  chapterIdx = -1;
  CAM.shot = 0; CAM.shotT = 0; CAM.blend = 1;
}
function toggleAuto() {
  JOURNEY.auto = !JOURNEY.auto;
  $('b-auto').classList.toggle('is-on', JOURNEY.auto);
}
function toggleSound() {
  AUDIO.setOn(!AUDIO.on);
  $('b-sound').classList.toggle('is-on', AUDIO.on);
}

let chapterIdx = -1, chapterTimer = 0;
function renderChapter(idx) {
  if (idx < 0 || idx >= CHAPTERS.length) return;
  const c = CHAPTERS[idx];
  const L = I18N[currentLang];
  const ch = L.chapters[idx];
  const el = $('chapter');
  if (!el || !ch) return;
  el.querySelector('.num').textContent = L.chapterLabel(c);
  el.querySelector('.ttl').innerHTML = `${ch.title}<br><em>${ch.sub}</em>`;
}
function updateChapters(dt) {
  let idx = 0;
  for (let i = 0; i < CHAPTERS.length; i++) if (JOURNEY.s >= CHAPTERS[i].at) idx = i;
  if (idx !== chapterIdx) {
    chapterIdx = idx;
    renderChapter(idx);
    $('chapter').classList.add('show');
    chapterTimer = 7.5;
  }
  if (chapterTimer > 0) {
    chapterTimer -= dt;
    if (chapterTimer <= 0) $('chapter').classList.remove('show');
  }
}

function setLang(lang, persist = true) {
  currentLang = lang === 'zh' ? 'zh' : 'en';
  if (persist) {
    try { localStorage.setItem('nb_lang', currentLang); } catch (_) {}
  }
  const L = I18N[currentLang];
  document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
  document.title = L.pageTitle;
  const descMeta = document.querySelector('meta[name="description"]');
  if (descMeta) descMeta.setAttribute('content', L.pageDesc);

  if ($('brand-title')) $('brand-title').textContent = L.brandTitle;
  if ($('brand-sub')) $('brand-sub').textContent = L.brandSub;
  if ($('intro-title')) $('intro-title').innerHTML = L.introTitle;
  if ($('intro-sub')) $('intro-sub').textContent = L.introSub;
  if ($('intro-lede')) $('intro-lede').textContent = L.introLede;
  if ($('begin')) $('begin').textContent = L.begin;
  if ($('hint')) $('hint').innerHTML = L.hint;

  if ($('b-follow')) { $('b-follow').textContent = L.follow; $('b-follow').title = L.followTitle; }
  if ($('b-orbit')) { $('b-orbit').textContent = L.orbit; $('b-orbit').title = L.orbitTitle; }
  if ($('b-cinema')) { $('b-cinema').textContent = L.cinema; $('b-cinema').title = L.cinemaTitle; }
  if ($('b-light')) {
    const pName = PRESETS[presetIndex] ? PRESETS[presetIndex].name : 'Morning';
    $('b-light').textContent = L.presets[pName] || pName;
    $('b-light').title = L.lightTitle;
  }
  if ($('b-auto')) { $('b-auto').textContent = L.auto; $('b-auto').title = L.autoTitle; }
  if ($('b-sound')) { $('b-sound').textContent = L.sound; $('b-sound').title = L.soundTitle; }
  if ($('b-pause')) {
    $('b-pause').textContent = paused ? L.play : L.pause;
    $('b-pause').title = paused ? L.playTitle : L.pauseTitle;
  }
  if ($('b-reset')) { $('b-reset').textContent = L.reset; $('b-reset').title = L.resetTitle; }
  if ($('b-full')) { $('b-full').textContent = L.full; $('b-full').title = L.fullTitle; }
  if ($('b-hide')) { $('b-hide').textContent = L.hide; $('b-hide').title = L.hideTitle; }
  if ($('dot')) $('dot').title = L.showTitle;
  if ($('b-lang')) $('b-lang').title = L.langTitle;
  if ($('intro-lang')) $('intro-lang').title = L.langTitle;

  if ($('t-left')) { $('t-left').title = L.touchLeft; $('t-left').setAttribute('aria-label', L.touchLeft); }
  if ($('t-right')) { $('t-right').title = L.touchRight; $('t-right').setAttribute('aria-label', L.touchRight); }
  if ($('t-slow')) { $('t-slow').title = L.touchSlow; $('t-slow').setAttribute('aria-label', L.touchSlow); }
  if ($('t-fast')) { $('t-fast').title = L.touchFast; $('t-fast').setAttribute('aria-label', L.touchFast); }

  renderChapter(chapterIdx >= 0 ? chapterIdx : 0);
}

function toggleLang() {
  setLang(currentLang === 'zh' ? 'en' : 'zh', true);
}

function setupUI() {
  $('b-follow').onclick = () => setCamera('follow');
  $('b-orbit').onclick = () => setCamera('orbit');
  $('b-cinema').onclick = () => setCamera('cinema');
  $('b-light').onclick = () => setPreset(presetIndex + 1);
  $('b-auto').onclick = toggleAuto;
  $('b-sound').onclick = toggleSound;
  $('b-pause').onclick = togglePause;
  $('b-reset').onclick = resetJourney;
  $('b-full').onclick = toggleFull;
  $('b-hide').onclick = toggleUI;
  $('dot').onclick = toggleUI;
  $('begin').onclick = beginVoyage;
  if ($('b-lang')) $('b-lang').onclick = toggleLang;
  if ($('intro-lang')) $('intro-lang').onclick = toggleLang;

  const hold = (id, on, off) => {
    const el = $(id);
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); });
    el.addEventListener('pointerup', (e) => { e.preventDefault(); off(); });
    el.addEventListener('pointerleave', off);
    el.addEventListener('pointercancel', off);
  };
  hold('t-left', () => { INPUT._touchSteer = 1; }, () => { INPUT._touchSteer = 0; });
  hold('t-right', () => { INPUT._touchSteer = -1; }, () => { INPUT._touchSteer = 0; });
  hold('t-fast', () => { INPUT._touchThrottle = 1; }, () => { INPUT._touchThrottle = 0; });
  hold('t-slow', () => { INPUT._touchThrottle = -1; }, () => { INPUT._touchThrottle = 0; });

  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'l') setPreset(presetIndex + 1);
  });
  syncCamUI();
  setPreset(0);
  setLang(currentLang, false);
}

/* --------------------------------------------------------- quality tiers */
function detectQuality() {
  const mem = navigator.deviceMemory || 8;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  let tier = 'high';
  if (mobile || cores <= 4 || mem <= 4) tier = 'medium';
  if (mobile && (cores <= 4 || mem <= 3)) tier = 'low';
  return {
    tier,
    pixelCap: tier === 'high' ? 1.75 : tier === 'medium' ? 1.4 : 1.1,
    trees: tier === 'high' ? 1100 : tier === 'medium' ? 700 : 380,
    rocks: tier === 'high' ? 320 : tier === 'medium' ? 200 : 120,
    outcrops: tier === 'high' ? 620 : tier === 'medium' ? 400 : 200,
    shadows: tier !== 'low',
    shadowSize: tier === 'high' ? 2048 : 1024,
    reflScale: tier === 'high' ? 0.5 : tier === 'medium' ? 0.4 : 0.32,
  };
}

/* ------------------------------------------------------------------ boot */
function init() {
  const canvas = $('c');
  quality = detectQuality();

  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, stencil: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.outputEncoding = THREE.LinearEncoding;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  /* one persistent clipping plane: clips the reflected pass only (constant toggled) */
  renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6)];
  renderer.localClippingEnabled = false;

  scene = new THREE.Scene();
  FOG = new THREE.FogExp2(LOOK.fogColor.getHex(), LOOK.fogDensity);
  FOG.color.copy(LOOK.fogColor);
  scene.fog = FOG;

  camera = new THREE.PerspectiveCamera(53, window.innerWidth / window.innerHeight, 0.35, 3200);
  camera.position.set(0, 8, 26);

  sky = buildSky();
  scene.add(sky);

  sunLight = new THREE.DirectionalLight(LOOK.sunColor.getHex(), LOOK.sunIntensity);
  sunLight.color.copy(LOOK.sunColor);
  sunLight.castShadow = quality.shadows;
  sunLight.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 260;
  const S = 100;
  sunLight.shadow.camera.left = -S; sunLight.shadow.camera.right = S;
  sunLight.shadow.camera.top = S; sunLight.shadow.camera.bottom = -S;
  sunLight.shadow.bias = -0.00022;
  sunLight.shadow.normalBias = 1.1;
  sunLight.shadow.camera.near = 40;
  scene.add(sunLight);
  scene.add(sunLight.target);

  hemiLight = new THREE.HemisphereLight(LOOK.hemiSky.getHex(), LOOK.hemiGround.getHex(), LOOK.hemiIntensity);
  hemiLight.color.copy(LOOK.hemiSky);
  hemiLight.groundColor.copy(LOOK.hemiGround);
  scene.add(hemiLight);

  buildTextures();
  terrain = buildTerrain();
  scene.add(terrain);
  scene.add(buildFarRidges());

  ship = SHIP.build();
  scene.add(SHIP.root);
  buildCrew();

  buildForest(scene, quality.trees, quality.tier);
  buildRocks(scene, quality.rocks);
  buildOutcrops(scene, quality.outcrops);
  buildSettlements(scene);
  buildWaterfalls(scene);
  buildBirds(scene, 7);
  FX.init(scene);
  WATER.init();

  setupInput(canvas);
  setupUI();
  onResize();
  window.addEventListener('resize', onResize);

  /* initial pose so the first frame is not at the origin */
  updateJourney(0.016);
  CAM.pos.set(0, 6, 20);
  CAM.look.copy(SHIP.root.position);

  const bar = $('loadbar').firstElementChild;
  bar.style.width = '100%';
  $('begin').disabled = false;

  requestAnimationFrame(loop);
}

let audioArmed = false;
function startAudioOnce() {
  if (audioArmed) return;
  audioArmed = true;
  $('b-sound').classList.add('is-on');
  AUDIO.setOn(true);
}

function beginVoyage() {
  const intro = $('intro');
  if (intro.classList.contains('gone')) return;
  intro.classList.add('gone');
  document.body.classList.remove('intro-up');
  startAudioOnce();
  setCamera('cinema');
  CAM.shot = 0;
  CAM.shotT = 0;
  CAM.blend = 0;
  CAM.blendPos.copy(CAM.pos);
  CAM.blendLook.copy(CAM.look);
  INPUT.throttleTarget = 0.7;
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, quality.pixelCap);
  const scale = dpr * dynScale;
  const bw = Math.max(2, Math.floor(w * scale));
  const bh = Math.max(2, Math.floor(h * scale));
  renderer.setSize(bw, bh, false);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  WATER.setSize(bw, bh, quality.reflScale);
}

let last = performance.now();
let frames = 0, qualityTimer = 0;

function loop(now) {
  requestAnimationFrame(loop);
  const rawDt = (now - last) / 1000;
  last = now;
  const dt = Math.min(0.05, rawDt);

  if (!paused) { simTime += dt; JOURNEY.time = simTime; }

  pollInput(paused ? 0 : dt);
  const sp = updateJourney(paused ? 0 : dt);
  SHIP.updateCrew(dt, simTime, true);
  if (!paused) updateSplashes(dt, simTime);

  const fwd = new THREE.Vector3(-Math.sin(JOURNEY.yaw), 0, -Math.cos(JOURNEY.yaw));
  const side = new THREE.Vector3(Math.cos(JOURNEY.yaw), 0, -Math.sin(JOURNEY.yaw));
  updateCamera(paused ? 0 : dt, {
    shipPos: SHIP.root.position, fwd, side, speed: JOURNEY.speed, time: simTime, paused,
  });

  camera.position.copy(CAM.pos);
  camera.lookAt(CAM.look);
  if (Math.abs(camera.fov - CAM.fov) > 0.01) { camera.fov = CAM.fov; camera.updateProjectionMatrix(); }

  /* shadow camera follows the ship */
  sunLight.position.copy(SHIP.root.position).addScaledVector(LOOK.sunDir, 110);
  sunLight.target.position.copy(SHIP.root.position);
  sunLight.target.updateMatrixWorld();
  renderer.shadowMap.needsUpdate = quality.shadows;

  sky.position.copy(camera.position);
  sky.updateMatrixWorld();

  applyLook(paused ? 0 : dt);
  WATER.mat.uniforms.uShipPos.value.copy(SHIP.root.position);
  WATER.mat.uniforms.uShipHeading.value = JOURNEY.yaw;
  WATER.mat.uniforms.uSpeed.value = JOURNEY.speed;
  SHIP.sailUniforms.uTime.value = simTime;
  SHIP.sailUniforms.uBillow.value = 0.42 + Math.min(0.5, JOURNEY.speed * 0.055) + Math.sin(simTime * 0.7) * 0.05;
  if (SHIP.M.lamp) SHIP.M.lamp.emissiveIntensity = presetIndex === 2 ? 2.6 : 1.4;

  updateWorld(dt, simTime, SHIP.root.position);
  FX.update(dt);
  updateChapters(dt);
  AUDIO.update(dt, JOURNEY.speed, 0);

  if (window.__RAWSCENE) {
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  } else {
    if (window.__RAWSCENE) {
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
  } else {
    WATER.render(renderer, scene, camera, simTime);
  }
  }

  /* adaptive resolution */
  frameAvg = frameAvg * 0.92 + rawDt * 1000 * 0.08;
  qualityTimer += rawDt;
  if (qualityTimer > 2.2) {
    qualityTimer = 0;
    if (frameAvg > 26 && dynScale > 0.62) { dynScale = Math.max(0.62, dynScale - 0.08); onResize(); }
    else if (frameAvg < 14.5 && dynScale < 1) { dynScale = Math.min(1, dynScale + 0.05); onResize(); }
  }
}

/* debug / test hooks */
window.NB = {
  get scene() { return scene; },
  get camera() { return camera; },
  get renderer() { return renderer; },
  SHIP, WATER, JOURNEY, CAM, INPUT, TERRAIN, ROUTE,
  get sky() { return sky; },
  get sunLight() { return sunLight; },
  get sky() { return sky; },
  get sunLight() { return sunLight; },
  probe(){
    let mn=1e9,mx=-1e9; const d=TERRAIN.data;
    for(let i=0;i<d.length;i+=97){ if(d[i]<mn)mn=d[i]; if(d[i]>mx)mx=d[i]; }
    return {rectX:TERRAIN.rectX,rectZ:TERRAIN.rectZ,size:TERRAIN.rectSize,tex:TERRAIN.size,mn,mx};
  }, TERRAIN, ROUTE,
  probe(){
    let mn=1e9,mx=-1e9; const d=TERRAIN.data;
    for(let i=0;i<d.length;i+=97){ if(d[i]<mn)mn=d[i]; if(d[i]>mx)mx=d[i]; }
    return {rectX:TERRAIN.rectX,rectZ:TERRAIN.rectZ,size:TERRAIN.rectSize,tex:TERRAIN.size,mn,mx};
  },
  freeze(v) { paused = v; },
  pose(px, py, pz, tx, ty, tz, fov) {
    CAM.mode = 'manual';
    CAM.pos.set(px, py, pz);
    CAM.look.set(tx, ty, tz);
    if (fov) CAM.fov = fov;
  },
  setPreset(i) { setPreset(i); },
  get lang() { return currentLang; },
  setLang(l, p = true) { setLang(l, p); },
  toggleLang() { toggleLang(); },
  rawScene(v) { window.__RAWSCENE = v; },
  rawScene(v) { window.__RAWSCENE = v; },
  heightAt: (x, z) => heightAtWorld(x, z),
  waterDebug(v) { WATER.mat.uniforms.uDebug.value = v; },
  ready() { return !!terrain; },
  info() {
    return {
      calls: renderer.info.render.calls,
      tris: renderer.info.render.triangles,
      frame: Math.round(frameAvg * 10) / 10,
      s: JOURNEY.s,
      pos: SHIP.root.position.toArray().map((v) => Math.round(v * 10) / 10),
    };
  },
};

window.addEventListener('DOMContentLoaded', () => {
  try {
    setLang(currentLang, false);
    init();
  } catch (err) {
    console.error(err);
    const e = document.getElementById('err');
    e.style.display = 'block';
    const prefix = (I18N[currentLang] && I18N[currentLang].errPrefix) || 'Unable to start the scene: ';
    e.textContent = prefix + (err && err.message ? err.message : err);
  }
});
