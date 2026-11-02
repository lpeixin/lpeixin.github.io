/* =========================================================================
   NORTHBOUND — particle system (spray, mist, smoke)
   ========================================================================= */

const FX = {
  MAX: 700,
  pts: null,
  pos: null,
  vel: null,
  life: null,
  maxLife: null,
  size: null,
  alpha: null,
  col: null,
  cursor: 0,
  count: 0,

  init(scene) {
    const N = this.MAX;
    this.pos = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3);
    this.life = new Float32Array(N);
    this.maxLife = new Float32Array(N).fill(1);
    this.size = new Float32Array(N);
    this.alpha = new Float32Array(N);
    this.col = new Float32Array(N * 3);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);

    const mat = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
        varying float vA; varying vec3 vC;
        void main(){
          vA = aAlpha; vC = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * (260.0 / max(-mv.z, 0.1));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying float vA; varying vec3 vC;
        void main(){
          vec2 d = gl_PointCoord - vec2(0.5);
          float r = length(d);
          if (r > 0.5) discard;
          float a = smoothstep(0.5, 0.06, r) * vA;
          gl_FragColor = vec4(vC, a);
        }`,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    this.pts = new THREE.Points(geo, mat);
    this.pts.frustumCulled = false;
    scene.add(this.pts);
  },

  spawn(x, y, z, vx, vy, vz, life, size, r, g, b) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.MAX;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life;
    this.size[i] = size;
    this.alpha[i] = 1;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
  },

  update(dt) {
    const N = this.MAX;
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const t = Math.max(0, this.life[i] / this.maxLife[i]);
      this.vel[i * 3 + 1] -= 9.2 * dt;
      this.vel[i * 3] *= 0.985;
      this.vel[i * 3 + 2] *= 0.985;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = t * t * 0.9;
      this.size[i] *= 0.995;
    }
    const g = this.pts.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
  },
};

const MIST = {
  spawnMist(x, y, z, n, spread, rise, size) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const r = Math.random() * spread;
      FX.spawn(x + Math.cos(a) * r, y + Math.random() * 1.5, z + Math.sin(a) * r,
        (Math.random() - 0.5) * 0.6, rise * (0.5 + Math.random()), (Math.random() - 0.5) * 0.6,
        2.4 + Math.random() * 2.6, size * (0.6 + Math.random() * 0.9), 0.62, 0.68, 0.7);
    }
  },
};
