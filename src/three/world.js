import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Water } from './water.js';
import { Pavilion } from './model.js';

const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();

export const FOG_COLOR = 0x0d1b2a;
export const FOG_DENSITY = 0.0105;

/**
 * World palettes. The constructor boots in the dark "winter nocturne" grade;
 * main.js calls setTheme() immediately, and load() re-applies the palette
 * after the water and pier exist — so nothing is ever stuck mid-grade.
 */
export const THEMES = {
  dark: {
    sky: { zenith: 0x081322, horizon: 0x2b4662, low: 0x050a12, glow: 0x3f6386 },
    fog: 0x0d1b2a,
    fogDensity: 0.0105,
    hemi: { sky: 0xa8cdea, ground: 0x0b1726, intensity: 0.95 },
    key: { color: 0xd6e8ff, intensity: 1.75 },
    fill: { color: 0x5b9ac9, intensity: 0.72 },
    rim: { color: 0x9ce8ff, intensity: 0.55 },
    envIntensity: 0.72,
    exposure: 1.22,
    bloom: { high: 0.38, medium: 0.3, low: 0.24 },
    vignette: 0.34,
    foliage: 0x0a1420,
    treeSnow: 0x2b4157,
    rock: 0x101c2a,
    isletSnow: 0x8ba9c0,
    stone: 0x2c3d4d,
    edge: 0x1b2a38,
    pierSnow: 0x7d96a9,
    snow: 0xeaf6ff,
    warm: 28,
    water: { deep: 0x0a1727, shallow: 0x17344a, fog: 0x0d1b2a, key: 0xd6e9ff },
  },
  light: {
    sky: { zenith: 0xcfe0ee, horizon: 0xe7eef5, low: 0xf0f3f7, glow: 0xdce8f1 },
    fog: 0xd6e2ec,
    fogDensity: 0.0105,
    hemi: { sky: 0xffffff, ground: 0xaebecb, intensity: 1.05 },
    key: { color: 0xeef4ff, intensity: 1.9 },
    fill: { color: 0x9dbcd4, intensity: 0.5 },
    rim: { color: 0xffffff, intensity: 0.38 },
    envIntensity: 0.85,
    exposure: 1.02,
    bloom: { high: 0.18, medium: 0.14, low: 0.11 },
    vignette: 0.26,
    foliage: 0x2f4250,
    treeSnow: 0xe4ecf2,
    rock: 0x55636b,
    isletSnow: 0xc9d6df,
    stone: 0x8e99a3,
    edge: 0x6a7682,
    pierSnow: 0xdfe7ee,
    snow: 0xdde9f2,
    warm: 9,
    water: { deep: 0x57748a, shallow: 0x8fa9bd, fog: 0xd6e2ec, key: 0xffffff },
  },
};

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uZenith, uHorizon, uLow, uGlow, uKeyDir;
  varying vec3 vDir;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 c = mix(uHorizon, uZenith, smoothstep(0.50, 1.0, h));
    c = mix(uLow, c, smoothstep(0.0, 0.50, h));
    // overcast lift toward the key direction — light through cloud, no cloud shapes
    float k = max(dot(d, normalize(uKeyDir)), 0.0);
    c += uGlow * pow(k, 2.6) * 0.55 * smoothstep(0.42, 0.86, h);
    // horizon haze band
    c += uHorizon * 0.16 * (1.0 - smoothstep(0.0, 0.14, abs(h - 0.46)));
    // dither against banding
    c += (hash(gl_FragCoord.xy) - 0.5) * 0.006;
    gl_FragColor = vec4(c, 1.0);
  }
`;

function makeSky(theme = THEMES.dark) {
  const uniforms = {
    uZenith: { value: lin(theme.sky.zenith) },
    uHorizon: { value: lin(theme.sky.horizon) },
    uLow: { value: lin(theme.sky.low) },
    uGlow: { value: lin(theme.sky.glow) },
    uKeyDir: { value: new THREE.Vector3(-0.32, 0.7, 0.62).normalize() },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 20), mat);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

/* ── snow ─────────────────────────────────────────────────── */
function snowSprite(soft) {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  if (soft) {
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.35, 'rgba(226,242,252,0.42)');
    g.addColorStop(0.72, 'rgba(200,228,246,0.12)');
    g.addColorStop(1, 'rgba(190,220,240,0)');
  } else {
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(238,248,255,0.8)');
    g.addColorStop(0.8, 'rgba(210,235,250,0.18)');
    g.addColorStop(1, 'rgba(200,230,248,0)');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const SNOW_VERT = /* glsl */ `
  attribute float aSeed;
  uniform float uTime, uPixelRatio, uSize, uHeight, uSway, uSpeed;
  varying float vFade;
  void main() {
    vec3 p = position;
    float sp = uSpeed * (0.55 + aSeed * 0.9);
    p.y = mod(p.y - uTime * sp, uHeight);
    p.x += sin(uTime * 0.31 + aSeed * 6.283 + p.z * 0.22) * uSway;
    p.z += cos(uTime * 0.26 + aSeed * 4.117 + p.x * 0.18) * uSway * 0.72;
    p.y += sin(uTime * 0.44 + aSeed * 2.0) * 0.28;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float z = max(-mv.z, 0.5);
    gl_PointSize = clamp(uSize * uPixelRatio * (300.0 / z), 0.45, 8.0);
    vFade = smoothstep(6.0, 12.0, z) * (1.0 - smoothstep(58.0, 96.0, z));
  }
`;

const SNOW_FRAG = /* glsl */ `
  precision mediump float;
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying float vFade;
  void main() {
    vec4 tx = texture2D(uMap, gl_PointCoord);
    float a = tx.a * uOpacity * vFade;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * tx.rgb, a);
  }
`;

function makeSnowLayer({ count, size, speed, opacity, sway, soft, box }) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * box;
    pos[i * 3 + 1] = Math.random() * box;
    pos[i * 3 + 2] = (Math.random() - 0.5) * box;
    seed[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: SNOW_VERT,
    fragmentShader: SNOW_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: Math.min(2, window.devicePixelRatio || 1) },
      uSize: { value: size },
      uHeight: { value: box },
      uSway: { value: sway },
      uSpeed: { value: speed },
      uOpacity: { value: opacity },
      uColor: { value: new THREE.Color(0xeaf6ff) },
      uMap: { value: snowSprite(soft) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 6;
  points.userData.count = count;
  return points;
}

/* ── distant shore ────────────────────────────────────────── */
function makePine() {
  const foliage = [];
  const snow = [];
  const tiers = 4;
  let y = 0;
  for (let i = 0; i < tiers; i++) {
    const k = i / (tiers - 1);
    const r = 1.5 * (1 - k * 0.62);
    const h = 1.9 * (1 - k * 0.3);
    const cone = new THREE.ConeGeometry(r, h, 7, 1, true);
    cone.translate(0, y + h * 0.5, 0);
    foliage.push(cone);

    const cap = new THREE.ConeGeometry(r * 1.02, h * 0.28, 7, 1, true);
    cap.translate(0, y + h * 0.12, 0);
    snow.push(cap);
    y += h * 0.52;
  }
  return {
    foliage: BufferGeometryUtils.mergeGeometries(foliage),
    snow: BufferGeometryUtils.mergeGeometries(snow),
  };
}

function buildShore(group) {
  const { foliage, snow } = makePine();
  const count = 46;
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x0a1420,
    roughness: 1,
    metalness: 0,
  });
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0x2b4157,
    roughness: 0.9,
    metalness: 0,
  });

  const fMesh = new THREE.InstancedMesh(foliage, foliageMat, count);
  const sMesh = new THREE.InstancedMesh(snow, snowMat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  const clusters = [
    { a: 2.35, r: 62, spread: 26, n: 18 },
    { a: 3.5, r: 78, spread: 30, n: 14 },
    { a: 5.1, r: 70, spread: 22, n: 14 },
  ];

  let idx = 0;
  for (const c of clusters) {
    for (let i = 0; i < c.n && idx < count; i++, idx++) {
      const a = c.a + (Math.random() - 0.5) * 0.55;
      const rr = c.r + (Math.random() - 0.5) * c.spread;
      const s = 0.8 + Math.random() * 0.75;
      pos.set(Math.sin(a) * rr, -0.6, Math.cos(a) * rr);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI);
      scl.set(s, s * (0.85 + Math.random() * 0.5), s);
      m.compose(pos, q, scl);
      fMesh.setMatrixAt(idx, m);
      sMesh.setMatrixAt(idx, m);
    }
  }
  fMesh.count = idx;
  sMesh.count = idx;
  fMesh.instanceMatrix.needsUpdate = true;
  sMesh.instanceMatrix.needsUpdate = true;
  group.add(fMesh, sMesh);
  return { foliageMat, treeSnowMat: snowMat };
}

function buildIslets(group) {
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x101c2a,
    roughness: 0.96,
    metalness: 0,
    flatShading: true,
  });
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0x8ba9c0,
    roughness: 0.75,
    metalness: 0,
  });

  const spots = [
    { x: -19, z: -17, s: 1.5, r: 0.4 },
    { x: 24, z: 9, s: 1.15, r: 1.9 },
    { x: -8, z: 27, s: 0.85, r: 2.6 },
  ];

  for (const sp of spots) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(sp.s, 1), rockMat);
    rock.position.set(sp.x, -sp.s * 0.42, sp.z);
    rock.rotation.set(sp.r, sp.r * 1.7, sp.r * 0.6);
    rock.scale.set(1, 0.72, 0.9);
    group.add(rock);

    const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(sp.s * 0.86, 1), snowMat);
    cap.position.set(sp.x, sp.s * 0.06, sp.z);
    cap.rotation.copy(rock.rotation);
    cap.scale.set(1.02, 0.42, 0.92);
    group.add(cap);
  }

  return { rockMat, snowMat };
}

function stoneSurface() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#9aa6b0';
  ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 2600; i++) {
    const v = 110 + Math.random() * 70;
    ctx.fillStyle = `rgba(${v},${v + 6},${v + 12},${0.08 + Math.random() * 0.16})`;
    const r = Math.random() * 3.4;
    ctx.beginPath();
    ctx.arc(Math.random() * s, Math.random() * s, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // fine bedding lines
  ctx.strokeStyle = 'rgba(38,52,66,0.22)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 16; i++) {
    const y = Math.random() * s;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= s; x += 32) ctx.lineTo(x, y + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ── stone pier that carries the pavilion into the water ───── */
function buildPier(footprint) {
  const group = new THREE.Group();
  const r = footprint * 1.02;
  const depth = 3.2;

  const jitterGeo = (geo, amount = 1) => {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const ang = Math.atan2(z, x);
      const j =
        1 +
        (Math.sin(ang * 7 + y * 1.7) * 0.028 + Math.sin(ang * 13 - y * 2.9) * 0.018) * amount;
      pos.setX(i, x * j);
      pos.setZ(i, z * j);
    }
    geo.computeVertexNormals();
    return geo;
  };

  const geo = jitterGeo(new THREE.CylinderGeometry(r, r * 1.1, depth, 34, 3, false));
  const stoneMap = stoneSurface();

  const stone = new THREE.MeshStandardMaterial({
    color: 0x2c3d4d,
    map: stoneMap,
    roughness: 0.93,
    metalness: 0.03,
  });
  const pier = new THREE.Mesh(geo, stone);
  pier.position.y = 0.06 - depth / 2;
  group.add(pier);

  // snow lying on the apron — irregular, never a perfect disc
  const capGeo = jitterGeo(new THREE.CylinderGeometry(r * 1.03, r * 1.035, 0.22, 40, 2, false), 1.6);
  capGeo.translate(0, 0, 0);
  const snowMat = new THREE.MeshStandardMaterial({
    color: 0x7d96a9,
    map: stoneMap,
    roughness: 0.88,
    metalness: 0,
  });
  const cap = new THREE.Mesh(capGeo, snowMat);
  cap.position.y = 0.11;
  cap.rotation.y = 0.4;
  group.add(cap);

  // a few darker stones breaking the apron edge
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x1b2a38, roughness: 0.95 });
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42 + Math.random() * 0.22, 0), edgeMat);
    rock.position.set(Math.sin(a) * r * 1.01, 0.06, Math.cos(a) * r * 1.01);
    rock.scale.y = 0.55;
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    group.add(rock);
  }

  return { group, stoneMat: stone, snowMat, edgeMat };
}

/* ─────────────────────────────────────────────────────────────
   World
   ───────────────────────────────────────────────────────────── */
export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this._mode = 'dark';
    this.warmIntensity = 28;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.setClearColor(FOG_COLOR, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.5, 620);

    this.quality = 'high';
    this._dpr = 1;

    this._buildEnvironment();
    this._buildLights();
    this._buildPost();

    this.clock = new THREE.Clock();
    this.ready = false;
  }

  _buildEnvironment() {
    const th = THEMES[this._mode];
    const sky = makeSky(th);
    this.scene.add(sky.mesh);
    this.sky = sky;

    // env map from the same gradient so materials read as overcast daylight
    this._buildEnvMap();
    this.scene.environmentIntensity = th.envIntensity;

    this.shore = buildShore(this.scene);
    this.islets = buildIslets(this.scene);

    // snow — three depths, kept moving while the camera rests
    this.snowLayers = [
      makeSnowLayer({ count: 620, size: 0.5, speed: 1.55, opacity: 0.5, sway: 1.6, soft: true, box: 96 }),
      makeSnowLayer({ count: 1500, size: 0.38, speed: 1.1, opacity: 0.44, sway: 1.2, soft: true, box: 110 }),
      makeSnowLayer({ count: 2400, size: 0.24, speed: 0.78, opacity: 0.32, sway: 2.1, soft: false, box: 128 }),
    ];
    this.snowLayers.forEach((l) => this.scene.add(l));
    this.snowBase = this.snowLayers.map((l) => l.geometry.attributes.position.count);

    this._applyThemePalette();
  }

  /** PMREM capture of the current theme's sky — regenerated on theme swaps. */
  _buildEnvMap() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new THREE.Scene();
    const envSky = makeSky(THEMES[this._mode]);
    envSky.mesh.scale.setScalar(0.5);
    envScene.add(envSky.mesh);
    const env = pmrem.fromScene(envScene, 0.02);
    if (this.envMap && this.envMap.dispose) this.envMap.dispose();
    this.envMap = env.texture;
    this.scene.environment = this.envMap;
    pmrem.dispose();
  }

  _buildLights() {
    const hemi = new THREE.HemisphereLight(0xa8cdea, 0x0b1726, 0.95);
    this.scene.add(hemi);
    this.hemiLight = hemi;

    const key = new THREE.DirectionalLight(0xd6e8ff, 1.75);
    key.position.set(-16, 34, 24);
    this.scene.add(key);
    this.keyLight = key;

    const fill = new THREE.DirectionalLight(0x5b9ac9, 0.72);
    fill.position.set(22, 12, -18);
    this.scene.add(fill);
    this.fillLight = fill;

    const rim = new THREE.DirectionalLight(0x9ce8ff, 0.55);
    rim.position.set(4, 8, -26);
    this.scene.add(rim);
    this.rimLight = rim;

    // warm interior spill
    const warm = new THREE.PointLight(0xff9a4a, 30, 30, 2);
    warm.position.set(0, 6.4, 0);
    this.scene.add(warm);
    this.warmLight = warm;
  }

  _buildPost() {
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.58, 0.88);
    this.composer.addPass(this.bloom);

    this.composer.addPass(new OutputPass());

    this.finishPass = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0 },
        uVignette: { value: 0.34 },
        uGrain: { value: 0.022 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tDiffuse;
        uniform float uTime, uVignette, uGrain;
        varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main() {
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          // glass-like edge falloff
          vec2 d = vUv - 0.5;
          float v = 1.0 - dot(d, d) * uVignette * 1.55;
          c *= clamp(v, 0.0, 1.0);
          // fine grain keeps flat gradients alive
          float g = hash(vUv * 1024.0 + fract(uTime) * 91.7) - 0.5;
          c += g * uGrain;
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    this.finishPass.renderToScreen = true;
    this.composer.addPass(this.finishPass);
  }

  async load(onProgress) {
    this.pavilion = new Pavilion({ renderer: this.renderer });
    await this.pavilion.load(onProgress);
    this.scene.add(this.pavilion.group);
    this.pavilion.group.updateMatrixWorld(true);

    this.water = new Water({
      baseHalf: new THREE.Vector2(this.pavilion.footprint * 0.92, this.pavilion.footprint * 0.92),
      fogColor: FOG_COLOR,
      fogDensity: FOG_DENSITY,
    });
    this.scene.add(this.water.mesh);

    const pier = buildPier(this.pavilion.footprint);
    this.pier = pier;
    this.scene.add(pier.group);

    this.warmLight.position.set(0, this.pavilion.height * 0.5, 0);
    this.warmLight.distance = this.pavilion.height * 1.5;

    this.ready = true;
    // water and pier boot in the dark grade before this point; make sure they
    // land on the theme that is actually active
    this._applyThemePalette();
    this.resize();
  }

  /**
   * World-grade hook driven by main.js's theme toggle. Applies everything the
   * shaders and lights read: sky gradient, fog, environment, lamps, tree/rock/
   * pier materials, snow tint, water palette and the post grade.
   */
  setTheme(mode) {
    if (!THEMES[mode]) return;
    this._mode = mode;
    this._buildEnvMap();
    this._applyThemePalette();
  }

  get theme() {
    return this._mode;
  }

  _applyThemePalette() {
    const th = THEMES[this._mode];
    if (!th) return;

    this.scene.fog.color.set(th.fog);
    this.scene.fog.density = th.fogDensity;
    this.renderer.setClearColor(th.fog, 1);
    this.renderer.toneMappingExposure = th.exposure;
    this.scene.environmentIntensity = th.envIntensity;

    const u = this.sky.uniforms;
    u.uZenith.value.copy(lin(th.sky.zenith));
    u.uHorizon.value.copy(lin(th.sky.horizon));
    u.uLow.value.copy(lin(th.sky.low));
    u.uGlow.value.copy(lin(th.sky.glow));

    if (this.hemiLight) {
      this.hemiLight.color.set(th.hemi.sky);
      this.hemiLight.groundColor.set(th.hemi.ground);
      this.hemiLight.intensity = th.hemi.intensity;
    }
    if (this.keyLight) {
      this.keyLight.color.set(th.key.color);
      this.keyLight.intensity = th.key.intensity;
    }
    if (this.fillLight) {
      this.fillLight.color.set(th.fill.color);
      this.fillLight.intensity = th.fill.intensity;
    }
    if (this.rimLight) {
      this.rimLight.color.set(th.rim.color);
      this.rimLight.intensity = th.rim.intensity;
    }

    // material colours go through the standard sRGB → linear material pipeline
    if (this.shore) {
      this.shore.foliageMat.color.set(th.foliage);
      this.shore.treeSnowMat.color.set(th.treeSnow);
    }
    if (this.islets) {
      this.islets.rockMat.color.set(th.rock);
      this.islets.snowMat.color.set(th.isletSnow);
    }
    if (this.pier) {
      this.pier.stoneMat.color.set(th.stone);
      this.pier.snowMat.color.set(th.pierSnow);
      this.pier.edgeMat.color.set(th.edge);
    }

    // shader uniforms keep raw values, so pass through lin()
    for (const layer of this.snowLayers || []) {
      layer.material.uniforms.uColor.value.copy(lin(th.snow));
    }
    if (this.water) {
      this.water.setPalette(th.water);
    }
    if (this.pavilion) {
      this.pavilion.setTheme(this._mode);
    }
    if (this.warmLight) {
      this.warmIntensity = th.warm;
    }

    if (this.bloom) {
      this.bloom.strength = th.bloom[this.quality] ?? th.bloom.high;
    }
    if (this.finishPass) {
      this.finishPass.uniforms.uVignette.value = th.vignette;
    }
  }


  setQuality(tier) {
    this.quality = tier;
    const dpr = window.devicePixelRatio || 1;
    let scale = 1;
    if (tier === 'high') scale = Math.min(2, dpr);
    else if (tier === 'medium') scale = Math.min(1.5, Math.max(1, dpr * 0.8));
    else scale = 1;

    this._dpr = scale;
    this.renderer.setPixelRatio(scale);
    this.composer.setPixelRatio(scale);

    if (this.water) {
      this.water.setQuality(tier === 'high' ? 0.72 : tier === 'medium' ? 0.5 : 0.32);
    }
    this.bloom.enabled = tier !== 'low';
    const th = THEMES[this._mode];
    this.bloom.strength = th.bloom[tier] ?? th.bloom.high;
    this.finishPass.uniforms.uGrain.value = tier === 'low' ? 0.014 : 0.022;
    this.snowLayers.forEach((l, i) => {
      const k = tier === 'high' ? 1 : tier === 'medium' ? 0.68 : 0.4;
      l.geometry.setDrawRange(0, Math.floor(this.snowBase[i] * k));
    });
    this.resize();
  }

  get reflectionInterval() {
    return this.quality === 'high' ? 1 : this.quality === 'medium' ? 2 : 3;
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    if (!w || !h) return;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w * 0.5, h * 0.5);

    this.snowLayers.forEach((l) => {
      l.material.uniforms.uPixelRatio.value = this._dpr;
    });
    if (this.water) this.water.setQuality(this.quality === 'high' ? 0.72 : this.quality === 'medium' ? 0.5 : 0.32);
    this._frame = 0;
  }

  render(timeElapsed) {
    if (!this.ready) return;
    const t = timeElapsed;
    this._frame = (this._frame || 0) + 1;

    this.pavilion.update(t);
    this.snowLayers.forEach((l) => (l.material.uniforms.uTime.value = t));
    this.water.update(t, this.camera);
    this.finishPass.uniforms.uTime.value = t;
    this.warmLight.intensity = (this.warmIntensity ?? 28) + Math.sin(t * 0.42) * 2.2;

    if (this._frame % this.reflectionInterval === 0) {
      this.water.renderReflection(this.renderer, this.scene, this.camera);
    }

    this.composer.render();
  }
}
