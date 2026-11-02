/* =========================================================================
   NORTHBOUND — water: planar reflection, refraction, depth absorption,
   world-space ripples, wake foam. Rendered as one screen-space pass.
   ========================================================================= */

const WATER_FRAG = `
precision highp float;
varying vec2 vUv;

uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform sampler2D tRefl;
uniform sampler2D tHeight;
uniform sampler2D tWaterN;
uniform sampler2D tFoam;

uniform mat4 uInvViewProj;
uniform mat4 uReflMatrix;
uniform vec3 uCamPos;
uniform vec2 uRes;
uniform float uTime, uNear, uFar;
uniform vec3 uSunDir, uSunColor, uSkyAmb, uDeep, uShallow, uFogColor;
uniform float uFogDensity, uSunSpec, uAbsorb, uDetail, uWaveAmp, uUseShadow, uExposure;
uniform vec2 uHeightRect;
uniform float uHeightSize, uHeightTex;
uniform vec3 uShipPos;
uniform float uShipHeading, uSpeed, uShipShadow;
uniform vec4 uRipples[RIPPLES];
uniform int uRippleCount;
uniform float uReflectivity;
uniform float uDebug;

float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

float hAt(vec2 p){
  vec2 uv = (p - uHeightRect) / uHeightSize;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return -40.0;
  vec2 st = uv * uHeightTex - 0.5;
  vec2 i = floor(st), f = st - i;
  vec2 t0 = (i + 0.5) / uHeightTex;
  vec2 t1 = (i + 1.5) / uHeightTex;
  float a = texture2D(tHeight, t0).r;
  float b = texture2D(tHeight, vec2(t1.x, t0.y)).r;
  float c = texture2D(tHeight, vec2(t0.x, t1.y)).r;
  float d = texture2D(tHeight, t1).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float hNear(vec2 p){
  vec2 uv = (p - uHeightRect) / uHeightSize;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return -40.0;
  return texture2D(tHeight, uv).r;
}

/* layered surface waves: height gradient. Analytic, so it never aliases —
   this is what carries the surface at distance where the normal map would
   shimmer into streaks. */
vec2 waveGrad(vec2 p, float t){
  vec2 g = vec2(0.0);
  vec2 d1 = normalize(vec2(0.82, 0.57)); float k1 = 0.105; float a1 = 0.62;
  vec2 d2 = normalize(vec2(-0.46, 0.89)); float k2 = 0.20; float a2 = 0.38;
  vec2 d3 = normalize(vec2(0.95, -0.31)); float k3 = 0.42; float a3 = 0.17;
  vec2 d4 = normalize(vec2(0.18, 0.98)); float k4 = 0.83; float a4 = 0.085;
  g += d1 * k1 * a1 * cos(dot(d1, p) * k1 + t * 0.85);
  g += d2 * k2 * a2 * cos(dot(d2, p) * k2 + t * 1.15 + 1.7);
  g += d3 * k3 * a3 * cos(dot(d3, p) * k3 + t * 1.55 + 0.4);
  g += d4 * k4 * a4 * cos(dot(d4, p) * k4 + t * 2.1 + 2.6);
  return g * uWaveAmp;
}

vec3 toneMap(vec3 x){
  x *= uExposure;
  x = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  return clamp(x, 0.0, 1.0);
}
vec3 lin2srgb(vec3 c){
  return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(0.4166667)) - 0.055, step(vec3(0.0031308), c));
}

void main(){
  vec2 uv = vUv;
  vec3 sceneCol = texture2D(tScene, uv).rgb;
  float dep = texture2D(tDepth, uv).x;

  vec4 c4 = vec4(uv * 2.0 - 1.0, dep * 2.0 - 1.0, 1.0);
  vec4 wp4 = uInvViewProj * c4;
  vec3 wp = wp4.xyz / wp4.w;
  vec3 rdv = wp - uCamPos;
  float sceneT = length(rdv);
  vec3 rd = rdv / max(sceneT, 1e-5);

  bool isWater = false;
  vec3 hit = vec3(0.0);
  float tW = 0.0;
  if (dep < 0.99999 && rd.y < -0.0006 && uCamPos.y > 0.0) {
    tW = -uCamPos.y / rd.y;
    if (tW < 5000.0 && sceneT > tW - 0.03) {
      hit = uCamPos + rd * tW;
      float land = hAt(hit.xz);
      if (land < -0.035) isWater = true;
    }
  }

  vec3 col;
  if (uDebug > 0.5 && uDebug < 1.5) { gl_FragColor = vec4(isWater ? vec3(1.0, 0.0, 1.0) : vec3(0.0), 1.0); return; }
  if (!isWater) {
    col = sceneCol;
  } else {
    float wdepth = max(0.0, -hAt(hit.xz));
    vec3 V = normalize(uCamPos - hit);

    /* ---- surface normal : swell + detail + ripples ---- */
    vec2 grad = waveGrad(hit.xz, uTime);
    /* fine normal detail must fade with distance or grazing-view compression
       turns it into streaks along the view direction */
    float detailFade = 1.0 / (1.0 + tW * 0.016);
    vec3 nA = texture2D(tWaterN, hit.xz * 0.028 + vec2(uTime * 0.006, uTime * 0.010)).xyz * 2.0 - 1.0;
    vec3 nB = texture2D(tWaterN, hit.xz * 0.075 - vec2(uTime * 0.011, -uTime * 0.007)).xyz * 2.0 - 1.0;
    vec2 dn = (nA.xy * 0.62 + nB.xy * 0.52) * uDetail * detailFade;

    float foam = 0.0;
    float ripFoam = 0.0;
    for (int i = 0; i < RIPPLES; i++) {
      if (i >= uRippleCount) break;
      vec4 rp = uRipples[i];
      if (rp.w <= 0.001) continue;
      float age = uTime - rp.z;
      if (age < 0.0 || age > 3.6) continue;
      vec2 dv = hit.xz - rp.xy;
      float dist = length(dv) + 0.001;
      float radius = 0.30 + age * (0.62 + rp.w * 0.75);
      float ring = dist - radius;
      if (abs(ring) > 3.5) continue;
      float env = exp(-ring * ring * 1.5) * exp(-age * 1.25) * (0.45 + rp.w * 0.75) / (1.0 + dist * 0.10);
      float ph = ring * 4.2 - age * 1.6;
      vec2 dirv = dv / dist;
      grad += dirv * (-sin(ph)) * env * 0.20;
      dn += dirv * cos(ph) * env * 0.20;
      ripFoam += max(0.0, cos(ph)) * env * 0.26;
      foam += exp(-ring * ring * 7.0) * env * 0.035;
    }

    vec3 N = normalize(vec3(-grad.x * 2.2 + dn.x * 0.85, 1.0, -grad.y * 2.2 + dn.y * 0.85));

    /* ---- wake (ship-local) ---- */
    float ca = cos(uShipHeading), sa = sin(uShipHeading);
    vec2 rel = hit.xz - uShipPos.xz;
    vec2 lq = vec2(rel.x * ca - rel.y * sa, rel.x * sa + rel.y * ca);
    float lx = lq.x, lz = lq.y;
    float spd = clamp(uSpeed / 6.0, 0.0, 1.4);
    float trail = smoothstep(5.0, 11.0, lz);
    float behind = max(lz - 6.0, 0.0);
    float spread = 2.2 + behind * 0.36;
    float edge = abs(abs(lx) - spread);
    float vWake = exp(-edge * edge * 0.55) * trail * exp(-behind * 0.026) * (0.55 + 0.75 * spd);
    float churn = exp(-lx * lx / (2.2 + behind * 0.22)) * trail * exp(-behind * 0.055) * (0.4 + 0.9 * spd);
    float bow = smoothstep(-1.5, -8.0, lz) * exp(-pow(abs(lx) - 2.55, 2.0) * 1.6) * smoothstep(-13.5, -10.0, lz) * spd * 0.8;
    float foamTex = texture2D(tFoam, hit.xz * 0.13 + vec2(uTime * 0.006, 0.0)).r;
    float foamTex2 = texture2D(tFoam, hit.xz * 0.34 - vec2(0.0, uTime * 0.01)).r;
    float wakeFoam = (vWake * 0.75 + churn * 0.55 + bow) * (0.35 + 0.9 * foamTex2) * smoothstep(0.0, 0.6, foamTex + 0.25);
    foam += wakeFoam;

    /* ---- shoreline foam ---- */
    float shoreBand = 1.0 - smoothstep(0.0, 1.5 + 0.8 * sin(uTime * 0.7), wdepth);
    float shorePulse = 0.55 + 0.45 * sin(wdepth * 7.5 - uTime * 1.5 + foamTex * 6.0);
    foam += shoreBand * shorePulse * smoothstep(0.25, 0.75, foamTex) * 1.1;
    foam += ripFoam * 0.22 * smoothstep(0.2, 0.7, foamTex2);

    /* ---- reflections ---- */
    vec4 rc = uReflMatrix * vec4(hit, 1.0);
    vec2 ruv = rc.xy / max(rc.w, 0.0001);
    ruv += N.xz * (0.055 / (1.0 + tW * 0.015));
    vec2 ruvc = clamp(ruv, vec2(0.002), vec2(0.998));
    vec3 refl = texture2D(tRefl, ruvc).rgb;
    /* soften / hide invalid taps */
    float edgeFade = smoothstep(0.0, 0.02, ruv.x) * smoothstep(1.0, 0.98, ruv.x) * smoothstep(0.0, 0.02, ruv.y) * smoothstep(1.0, 0.98, ruv.y);
    refl = mix(uSkyAmb * 0.55, refl, edgeFade);

    float fres = 0.028 + 0.97 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
    fres = clamp(fres * uReflectivity, 0.0, 1.0);

    /* ---- refraction + absorption ---- */
    vec2 duv = N.xz * (0.055 / (1.0 + wdepth * 0.35)) * (1.0 / (1.0 + tW * 0.035));
    vec3 refr = texture2D(tScene, clamp(uv + duv, vec2(0.001), vec2(0.999))).rgb;
    float refrT = texture2D(tDepth, clamp(uv + duv, vec2(0.001), vec2(0.999))).x;
    if (refrT < dep - 0.00005) refr = sceneCol; /* don't pull in stuff in front of the surface */

    vec3 trans = exp(-vec3(0.46, 0.135, 0.088) * wdepth * uAbsorb);
    vec3 under = refr * trans + uDeep * (1.0 - trans) * 0.92;
    vec3 shallowTint = uShallow * (1.0 - smoothstep(0.0, 2.6, wdepth)) * 0.16;
    under += shallowTint * trans;

    if (uDebug > 1.5 && uDebug < 2.5) { gl_FragColor = vec4(pow(refl, vec3(0.4545)), 1.0); return; }
    if (uDebug > 2.5 && uDebug < 3.5) { float g = clamp(0.5 - wdepth * 0.05, 0.0, 1.0); gl_FragColor = vec4(vec3(g), 1.0); return; }
    if (uDebug > 3.5 && uDebug < 4.5) { gl_FragColor = vec4(N * 0.5 + 0.5, 1.0); return; }
    vec3 water = mix(under, refl, fres);

    /* ---- sun glitter ---- */
    vec3 H = normalize(uSunDir + V);
    float spec = pow(max(dot(N, H), 0.0), 620.0);
    float glint = pow(max(dot(N, H), 0.0), 40.0) * 0.16;
    water += uSunColor * (spec * 2.6 + glint) * uSunSpec;

    /* ---- shadow from cliffs (marched height field) ---- */
    float shadow = 1.0;
    if (uUseShadow > 0.5) {
      vec3 sp = hit + vec3(0.0, 0.35, 0.0) + uSunDir * 2.0;
      for (int s = 0; s < 7; s++) {
        sp += uSunDir * 14.0;
        if (hNear(sp.xz) > sp.y) { shadow = 0.0; break; }
      }
    }
    /* ship shadow */
    float shipShadow = smoothstep(1.05, 0.55, length(vec2(lx / 3.4, (lz - 1.0) / 13.0)));
    shadow = mix(shadow, min(shadow, 0.35), shipShadow * uShipShadow);

    water *= mix(0.72, 1.0, shadow);

    /* ---- foam composite ---- */
    foam = clamp(foam, 0.0, 1.6);
    vec3 foamCol = (uSkyAmb * 1.25 + uSunColor * 0.35) * mix(0.55, 1.0, shadow);
    water = mix(water, foamCol, clamp(foam, 0.0, 0.92) * 0.92);

    /* ---- atmospheric fog ---- */
    float fg = 1.0 - exp(-uFogDensity * uFogDensity * tW * tW);
    col = mix(water, uFogColor, clamp(fg, 0.0, 1.0));

    /* slight crest scatter for depth */
    col += uShallow * 0.02 * pow(max(N.y, 0.0), 2.0);
  }

  col = toneMap(max(col, 0.0));
  col = lin2srgb(col);
  col += (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

const WATER_VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const WATER = {
  MAX_RIPPLES: 20,
  ripples: [],
  rippleU: [],
  sceneRT: null,
  reflRT: null,
  reflCam: new THREE.PerspectiveCamera(),
  reflMatrix: new THREE.Matrix4(),
  mat: null,
  quad: null,
  quadScene: new THREE.Scene(),
  quadCam: new THREE.Camera(),
  w: 1, h: 1, rw: 1, rh: 1,
  quality: 1,

  init() {
    for (let i = 0; i < this.MAX_RIPPLES; i++) {
      this.ripples.push({ x: 0, z: 0, t0: -99, s: 0 });
      this.rippleU.push(new THREE.Vector4(0, 0, -99, 0));
    }
    this.mat = new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: {
        tScene: { value: null },
        tDepth: { value: null },
        tRefl: { value: null },
        tHeight: { value: TERRAIN.heightTex },
        tWaterN: { value: TEX.waterN },
        tFoam: { value: TEX.foam },
        uInvViewProj: { value: new THREE.Matrix4() },
        uReflMatrix: { value: this.reflMatrix },
        uCamPos: { value: new THREE.Vector3() },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uNear: { value: 0.3 },
        uFar: { value: 3000 },
        uSunDir: { value: new THREE.Vector3(0.4, 0.4, -0.8) },
        uSunColor: { value: glCol(0xffd9a0) },
        uSkyAmb: { value: glCol(0x8fa9b8) },
        uDeep: { value: glCol(0x0b2a2c) },
        uShallow: { value: glCol(0x2f7f6d) },
        uFogColor: { value: glCol(0xc8d6dd) },
        uFogDensity: { value: 0.0022 },
        uSunSpec: { value: 1.0 },
        uAbsorb: { value: 1.0 },
        uDetail: { value: 1.0 },
        uWaveAmp: { value: 1.0 },
        uUseShadow: { value: 1.0 },
        uExposure: { value: 1.0 },
        uHeightRect: { value: new THREE.Vector2(0, 0) },
        uHeightSize: { value: 1000 },
        uHeightTex: { value: 1024 },
        uShipPos: { value: new THREE.Vector3() },
        uShipHeading: { value: 0 },
        uSpeed: { value: 0 },
        uShipShadow: { value: 1.0 },
        uRipples: { value: this.rippleU },
        uRippleCount: { value: 0 },
        uReflectivity: { value: 1.0 },
        uDebug: { value: 0 },
      },
      defines: { RIPPLES: this.MAX_RIPPLES },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });

    const g = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(g, this.mat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  },

  setSize(w, h, reflScale = 0.5) {
    this.w = Math.max(2, Math.floor(w));
    this.h = Math.max(2, Math.floor(h));
    this.rw = Math.max(2, Math.floor(w * reflScale));
    this.rh = Math.max(2, Math.floor(h * reflScale));

    if (this.sceneRT) { this.sceneRT.depthTexture.dispose(); this.sceneRT.dispose(); }
    if (this.reflRT) this.reflRT.dispose();

    const depthTex = new THREE.DepthTexture(this.w, this.h, THREE.UnsignedIntType);
    depthTex.minFilter = depthTex.magFilter = THREE.NearestFilter;
    this.sceneRT = new THREE.WebGLRenderTarget(this.w, this.h, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      depthTexture: depthTex,
      stencilBuffer: false,
    });
    this.sceneRT.texture.generateMipmaps = false;
    this.reflRT = new THREE.WebGLRenderTarget(this.rw, this.rh, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false,
    });
    this.reflRT.texture.generateMipmaps = false;

    this.mat.uniforms.tScene.value = this.sceneRT.texture;
    this.mat.uniforms.tDepth.value = this.sceneRT.depthTexture;
    this.mat.uniforms.tRefl.value = this.reflRT.texture;
    this.mat.uniforms.uRes.value.set(this.w, this.h);
    this.mat.uniforms.uHeightRect.value.set(TERRAIN.rectX, TERRAIN.rectZ);
    this.mat.uniforms.uHeightSize.value = TERRAIN.rectSize;
    this.mat.uniforms.uHeightTex.value = TERRAIN.size;
  },

  addRipple(x, z, strength, now) {
    let slot = this.ripples[0];
    for (const r of this.ripples) {
      if (now - r.t0 > 7.0) { slot = r; break; }
      if (r.t0 < slot.t0) slot = r;
    }
    slot.x = x; slot.z = z; slot.t0 = now; slot.s = strength;
  },

  updateRipples(now) {
    let n = 0;
    for (const r of this.ripples) {
      const age = now - r.t0;
      if (age < 0 || age > 7.0) continue;
      const u = this.rippleU[n++];
      u.set(r.x, r.z, r.t0, r.s);
    }
    this.mat.uniforms.uRippleCount.value = n;
  },

  updateReflectionCamera(camera) {
    const cam = this.reflCam;
    const cp = camera.position;
    cam.position.set(cp.x, -cp.y, cp.z);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const target = new THREE.Vector3(cp.x + dir.x, -(cp.y + dir.y), cp.z + dir.z);
    upV.set(0, 1, 0).applyQuaternion(camera.quaternion);
    upV.y *= -1;
    cam.up.copy(upV);
    cam.lookAt(target);
    cam.fov = camera.fov;
    cam.aspect = camera.aspect;
    cam.near = camera.near;
    cam.far = camera.far;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

    this.reflMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.reflMatrix.multiply(cam.projectionMatrix);
    this.reflMatrix.multiply(cam.matrixWorldInverse);
  },

  render(renderer, scene, camera, time) {
    const u = this.mat.uniforms;
    this.updateReflectionCamera(camera);

    const cp0 = renderer.clippingPlanes && renderer.clippingPlanes[0];
    if (cp0) cp0.constant = 0.02;
    renderer.setRenderTarget(this.reflRT);
    renderer.render(scene, this.reflCam);
    if (cp0) cp0.constant = 1e6;

    renderer.setRenderTarget(this.sceneRT);
    renderer.render(scene, camera);

    renderer.setRenderTarget(null);
    u.uInvViewProj.value.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse).invert();
    u.uCamPos.value.copy(camera.position);
    u.uTime.value = time;
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    this.updateRipples(time);
    renderer.render(this.quadScene, this.quadCam);
  },
};

const reflPlane = new THREE.Plane();
const clipPlane = new THREE.Vector4();
const q = new THREE.Vector4();
const upV = new THREE.Vector3();
