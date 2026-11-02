/* =========================================================================
   NORTHBOUND — sky dome
   ========================================================================= */

const SKY_VERT = `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}`;

const SKY_FRAG = `
precision highp float;
varying vec3 vDir;
uniform vec3 uZenith, uHorizon, uSunColor, uCloudLit, uCloudDark, uSunDir;
uniform float uSunDisc, uSunHalo, uCloudCover, uCloudSharp, uStars, uTime, uHaze, uMoon;
uniform float uSunGlow;

float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0)), c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; }
  return s;
}

void main(){
  vec3 dir = normalize(vDir);
  float h = dir.y;

  /* base gradient */
  float t = pow(clamp(h, 0.0, 1.0), 0.52);
  vec3 col = mix(uHorizon, uZenith, t);

  /* warm haze band at the horizon */
  float haze = exp(-max(h, 0.0) * 7.0);
  col = mix(col, mix(uHorizon, uSunColor, 0.35 * uSunGlow), haze * uHaze);

  /* sun / moon */
  float sd = dot(dir, normalize(uSunDir));
  float disc = smoothstep(1.0 - uSunDisc, 1.0 - uSunDisc * 0.72, sd);
  float halo = pow(max(sd, 0.0), 14.0) * 0.55 + pow(max(sd, 0.0), 90.0) * 0.7;
  col += uSunColor * (disc * 3.4 + halo * uSunHalo);

  /* stars */
  if (uStars > 0.001 && h > -0.02) {
    vec2 sp = dir.xz / (h + 0.35) * 26.0;
    float n = hash21(floor(sp * 3.0));
    float star = smoothstep(0.990, 1.0, n) * (0.6 + 0.4 * sin(uTime * 2.0 + n * 40.0));
    float band = smoothstep(-0.1, 0.4, h);
    col += vec3(0.75, 0.82, 1.0) * star * uStars * band * 1.6;
  }

  /* clouds projected on a plane */
  if (h > -0.02) {
    vec2 cp = dir.xz / max(h + 0.14, 0.07);
    vec2 q = cp * 0.55 + vec2(uTime * 0.0026, uTime * 0.0009);
    vec2 warp = vec2(fbm(q * 1.7 + 3.0), fbm(q * 1.7 - 5.0)) - 0.5;
    float c = fbm(q * 1.35 + warp * 0.8);
    c = smoothstep(uCloudCover, uCloudCover + uCloudSharp, c);
    float fade = smoothstep(0.0, 0.16, h);
    c *= fade;
    float lightSide = smoothstep(-0.25, 0.9, dot(normalize(vec3(dir.x, 0.35, dir.z)), normalize(uSunDir)));
    vec3 cloudCol = mix(uCloudDark, uCloudLit, lightSide * (0.45 + 0.55 * c));
    cloudCol += uSunColor * pow(max(sd, 0.0), 6.0) * 0.35;
    col = mix(col, cloudCol, c * 0.95);
    /* moon halo through cloud */
    col += uSunColor * pow(max(sd, 0.0), 40.0) * 0.2 * c;
  }

  /* below horizon: fade to a deep haze */
  col = mix(col, uHorizon * 0.55, smoothstep(0.0, -0.22, h));

  gl_FragColor = vec4(col, 1.0);
}`;

function buildSky() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      uZenith: { value: glCol(0x2c5f96) },
      uHorizon: { value: glCol(0xd6d6c6) },
      uSunColor: { value: glCol(0xffd9a0) },
      uCloudLit: { value: glCol(0xf2e8d8) },
      uCloudDark: { value: glCol(0x7d8791) },
      uSunDir: { value: new THREE.Vector3(0.4, 0.3, -0.8) },
      uSunDisc: { value: 0.00035 },
      uSunHalo: { value: 1.0 },
      uCloudCover: { value: 0.52 },
      uCloudSharp: { value: 0.28 },
      uStars: { value: 0.0 },
      uTime: { value: 0 },
      uHaze: { value: 0.35 },
      uMoon: { value: 0.0 },
      uSunGlow: { value: 1.0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(2600, 40, 22), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.matrixAutoUpdate = false;
  return mesh;
}
