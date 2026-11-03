import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LANDMARK_NAMES, MODEL_SCALE } from '../data/content.js';

const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();

/**
 * A cheap normal map derived from the baked colour's luminance. The GLB ships
 * without one; this keeps raking winter light from looking like flat paint.
 */
function deriveNormalMap(sourceImg, renderer) {
  const size = 512;
  const c = ctxCreate(size, size);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(sourceImg, 0, 0, size, size);
  const src = ctx.getImageData(0, 0, size, size);
  const out = ctx.createImageData(size, size);
  const s = src.data;
  const d = out.data;

  const lum = (x, y) => {
    const i = ((((y % size) + size) % size) * size + (((x % size) + size) % size)) * 4;
    return (s[i] * 0.2126 + s[i + 1] * 0.7152 + s[i + 2] * 0.0722) / 255;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (lum(x + 1, y) - lum(x - 1, y)) * 2.4;
      const dy = (lum(x, y + 1) - lum(x, y - 1)) * 2.4;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      d[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      d[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      d[i + 2] = (1 / len) * 0.5 * 255 + 127.5;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

/**
 * Tripo sea: a single baked basecolour. We keep it intact — snow, vermilion
 * timber and gold leaf all survive — but run it through a light "polish" pass
 * that takes the edge off the generated noise, and derive a warm window mask
 * from the genuinely dark, low-chroma pixels (the glazed bays).
 */
function deriveTextures(sourceImg, renderer) {
  const w = sourceImg.width;
  const h = sourceImg.height;

  const base = document.createElement('canvas');
  base.width = w;
  base.height = h;
  const bctx = base.getContext('2d', { willReadFrequently: true });
  // micro-blur only to tame generated speckle — then re-assert the vermilion,
  // gold and glaze so the bake keeps its Punch where it matters
  bctx.filter = 'blur(0.5px) saturate(1.09) contrast(1.05)';
  bctx.drawImage(sourceImg, 0, 0);
  bctx.filter = 'none';

  // warm window mask
  const lit = ctxCreate(w, h);
  const lctx = lit.getContext('2d', { willReadFrequently: true });
  const src = bctx.getImageData(0, 0, w, h);
  const out = lctx.createImageData(w, h);
  const s = src.data;
  const d = out.data;

  const smooth = (edge0, edge1, x) => {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };

  for (let i = 0; i < s.length; i += 4) {
    const r = s[i] / 255;
    const g = s[i + 1] / 255;
    const b = s[i + 2] / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);

    // deep, low-chroma pixels = glazed bays
    const dark = smooth(0.26, 0.045, lum);
    const neutral = smooth(0.20, 0.05, chroma);
    // keep the very deepest red timber from lighting up
    const notRed = smooth(0.55, 0.85, r / (b + 0.06));

    const m = Math.min(1, dark * neutral * (1 - notRed * 0.85));
    d[i] = 255 * m;
    d[i + 1] = 176 * m;
    d[i + 2] = 104 * m;
    d[i + 3] = 255;
  }
  lctx.putImageData(out, 0, 0);

  // soften the mask so windows bloom rather than pixelate
  const soft = ctxCreate(w, h);
  const sctx = soft.getContext('2d');
  sctx.filter = 'blur(2.4px)';
  sctx.drawImage(lit, 0, 0);
  sctx.filter = 'none';

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const map = new THREE.CanvasTexture(base);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = Math.min(8, maxAniso);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;

  const emissiveMap = new THREE.CanvasTexture(soft);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.anisotropy = maxAniso;

  return { map, emissiveMap };
}

/**
 * Packed surface response (G = roughness, B = metalness) derived from the
 * bake: vermilion timber and gold leaf read as lacquer — smooth, faintly
 * metallic — while snow caps, walls and stone stay matte. One texture serves
 * both material slots, the standard ORM packing trick.
 */
function deriveSurfaceMap(sourceImg, renderer) {
  const size = 512;
  const c = ctxCreate(size, size);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.filter = 'blur(1.2px)';
  ctx.drawImage(sourceImg, 0, 0, size, size);
  ctx.filter = 'none';
  const src = ctx.getImageData(0, 0, size, size);
  const out = ctx.createImageData(size, size);
  const s = src.data;
  const d = out.data;

  for (let i = 0; i < s.length; i += 4) {
    const r = s[i] / 255;
    const g = s[i + 1] / 255;
    const b = s[i + 2] / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const chroma = Math.max(r, g, b) - Math.min(r, g, b);

    // strongly coloured paint = lacquered timber + gold
    const lacquer = Math.min(1, chroma * 2.4) * (0.4 + 0.6 * lum);

    // gold leaf: warm, bright, upper-mid luminance
    const gold =
      Math.max(0, Math.min(1, (r - b) * 2.6)) *
      Math.max(0, Math.min(1, (lum - 0.34) / 0.3)) *
      Math.max(0, Math.min(1, (0.88 - lum) / 0.2));

    const rough = 0.88 - 0.42 * lacquer;
    const metal = 0.05 + 0.72 * gold;

    d[i] = 0;
    d[i + 1] = rough * 255;
    d[i + 2] = metal * 255;
    d[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

function ctxCreate(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

const WIRE_VERT = /* glsl */ `
  uniform vec3 uCenter;
  uniform float uRadius;
  varying vec3 vWorld;
  varying float vMask;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    float d = distance(wp.xyz, uCenter);
    // irregular, feathered boundary
    float n = hash(floor(wp.xyz * 2.4)) * 0.55 + hash(floor(wp.xyz * 7.1)) * 0.45;
    float r = uRadius * (0.62 + n * 0.72);
    vMask = 1.0 - smoothstep(r * 0.35, r, d);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const WIRE_FRAG = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying vec3 vWorld;
  varying float vMask;

  void main() {
    if (vMask <= 0.001) discard;
    float shimmer = 0.72 + 0.28 * sin(uTime * 1.7 + vWorld.y * 2.6);
    float a = vMask * uOpacity * shimmer;
    gl_FragColor = vec4(uColor * (0.55 + vMask * 1.5), a);
  }
`;

export class Pavilion {
  constructor({ scale = MODEL_SCALE, renderer, onProgress } = {}) {
    this.scale = scale;
    this.renderer = renderer;
    this.group = new THREE.Group();
    this.landmarks = [];
    this.footprint = 4.6;
    this.height = scale;
    this.material = null;
    this.wireframe = null;
    this.ready = false;

    this.wireUniforms = {
      uCenter: { value: new THREE.Vector3(0, 4, 0) },
      uRadius: { value: 5.4 },
      uColor: { value: lin(0x9ce8ff) },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
    };
  }

  async load(onProgress) {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('/models/forma-pagoda.glb', (e) => {
      if (onProgress && e.total) onProgress(e.loaded / e.total);
    });

    let mesh = null;
    gltf.scene.traverse((o) => {
      if (o.isMesh) mesh = o;
    });
    if (!mesh) throw new Error('Pavilion mesh not found in GLB');

    const geo = mesh.geometry;
    geo.computeBoundingBox();
    const bb = geo.boundingBox;

    // ── polish the baked texture, derive warm window light ──
    let map = mesh.material.map;
    let normalMap = null;
    let emissiveMap = null;
    let surfaceMap = null;
    try {
      const img = map?.image;
      if (img && img.width) {
        const derived = deriveTextures(img, this.renderer);
        map = derived.map;
        emissiveMap = derived.emissiveMap;
        // derive a subtle normal map from texture luminance variation
        normalMap = deriveNormalMap(img, this.renderer);
        // per-pixel roughness/metalness so paint reads as lacquer
        surfaceMap = deriveSurfaceMap(img, this.renderer);
      }
    } catch (err) {
      console.warn('[forma] texture polish skipped:', err?.message);
    }

    this.material = new THREE.MeshPhysicalMaterial({
      map,
      normalMap,
      normalScale: normalMap ? new THREE.Vector2(0.5, 0.5) : null,
      color: 0xffffff,
      roughness: surfaceMap ? 1.0 : 0.78,
      metalness: surfaceMap ? 1.0 : 0.05,
      roughnessMap: surfaceMap,
      metalnessMap: surfaceMap,
      clearcoat: 0.7,
      clearcoatRoughness: 0.34,
      emissive: new THREE.Color(0xff9d4d),
      emissiveMap,
      emissiveIntensity: emissiveMap ? 1.02 : 0,
      envMapIntensity: 1.05,
      specularIntensity: 0.9,
      sheen: 0.35,
      sheenColor: new THREE.Color(0x9cc8e8),
      sheenRoughness: 0.7,
    });

    if (map) map.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    const m = new THREE.Mesh(geo, this.material);
    m.frustumCulled = false;
    // the GLB is normalised to a 1-unit height; bring it to architectural scale
    m.scale.setScalar(this.scale);
    m.position.y = 0.02;
    this.group.add(m);
    this.inner = m;

    this._extractLandmarks(geo);
    this._buildWireframe(geo);

    this.ready = true;
    this._emissiveBase = emissiveMap ? 1.02 : 0;
    return this;
  }

  /**
   * Grade the pavilion for the page theme. Daylight reads as pale limewash
   * timber with dry paint and quieter windows; night keeps the warm lacquer
   * and the interior glow.
   */
  setTheme(mode) {
    this.themeMode = mode === 'light' ? 'light' : 'dark';
    const light = this.themeMode === 'light';
    this._emissiveBase = this.material?.emissiveMap ? (light ? 0.42 : 1.02) : 0;
    if (this.material) {
      const m = this.material;
      if (light) {
        // >1 tints lift the baked texture toward a sun-bleached plum
        m.color.setRGB(1.16, 1.19, 1.22);
        m.clearcoat = 0.42;
        m.clearcoatRoughness = 0.52;
        m.envMapIntensity = 1.38;
        m.specularIntensity = 0.68;
        m.sheen = 0.2;
        m.sheenColor.set(0xdfeaf4);
        m.sheenRoughness = 0.78;
      } else {
        m.color.setRGB(1, 1, 1);
        m.clearcoat = 0.7;
        m.clearcoatRoughness = 0.34;
        m.envMapIntensity = 1.05;
        m.specularIntensity = 0.9;
        m.sheen = 0.35;
        m.sheenColor.set(0x9cc8e8);
        m.sheenRoughness = 0.7;
      }
      m.needsUpdate = true;
    }
    this.wireUniforms.uColor.value.copy(lin(light ? 0x0e7ca6 : 0x9ce8ff));
  }

  /** Geometry-derived anchor points: real eave corners and the finial. */
  _extractLandmarks(geo) {
    const pos = geo.attributes.position;
    const count = pos.count;
    const arr = pos.array;

    const bb = geo.boundingBox;
    const minY = bb.min.y;
    const hSpan = bb.max.y - minY;
    const tiers = 6;
    const pts = [];

    // per-tier eave corners, spiralling so brackets do not stack
    for (let t = 0; t < tiers; t++) {
      const y0 = minY + hSpan * (t / tiers) * 0.92;
      const y1 = minY + hSpan * ((t + 1) / tiers) * 0.92;
      const sector = (t * Math.PI) / 3 + Math.PI / 6;
      const half = 0.52;
      let bestR = -1;
      let bx = 0, by = 0, bz = 0;
      for (let i = 0; i < count; i++) {
        const iy = arr[i * 3 + 1];
        if (iy < y0 || iy > y1) continue;
        const ix = arr[i * 3];
        const iz = arr[i * 3 + 2];
        let a = Math.atan2(iz, ix);
        let dA = a - sector;
        while (dA > Math.PI) dA -= Math.PI * 2;
        while (dA < -Math.PI) dA += Math.PI * 2;
        if (Math.abs(dA) > half) continue;
        const r = Math.hypot(ix, iz);
        if (r > bestR) {
          bestR = r;
          bx = ix;
          by = iy;
          bz = iz;
        }
      }
      if (bestR > 0) pts.push(new THREE.Vector3(bx, by, bz));
    }

    // finial apex
    let topY = -Infinity;
    let apex = null;
    for (let i = 0; i < count; i++) {
      const y = arr[i * 3 + 1];
      if (y > topY) {
        topY = y;
        apex = new THREE.Vector3(arr[i * 3], y, arr[i * 3 + 2]);
      }
    }
    if (apex) pts.push(apex.clone().add(new THREE.Vector3(0, -0.04, 0)));

    // widest eave overall = ridge crest
    let widest = null;
    let widestR = -1;
    for (let i = 0; i < count; i++) {
      const r = Math.hypot(arr[i * 3], arr[i * 3 + 2]);
      if (r > widestR) {
        widestR = r;
        widest = new THREE.Vector3(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]);
      }
    }
    if (widest) pts.push(widest);

    // footprint = widest radius near the base
    let baseR = 0;
    for (let i = 0; i < count; i++) {
      if (arr[i * 3 + 1] > minY + hSpan * 0.06) continue;
      baseR = Math.max(baseR, Math.hypot(arr[i * 3], arr[i * 3 + 2]));
    }
    this.footprint = (baseR || 0.36) * this.scale;

    this.landmarks = pts.map((p, i) => {
      const world = p.clone().multiplyScalar(this.scale);
      world.y = p.y * this.scale + this.inner.position.y;
      return {
        index: i,
        label: LANDMARK_NAMES[i % LANDMARK_NAMES.length],
        ref: `L-${String(i + 1).padStart(2, '0')}`,
        position: world,
        local: p.clone(),
      };
    });
  }

  _buildWireframe(geo) {
    const wire = new THREE.WireframeGeometry(geo);
    const mat = new THREE.ShaderMaterial({
      vertexShader: WIRE_VERT,
      fragmentShader: WIRE_FRAG,
      uniforms: this.wireUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.wireframe = new THREE.LineSegments(wire, mat);
    this.wireframe.frustumCulled = false;
    this.wireframe.visible = false;
    // geometry is in the pavilion's own units; `inner` applies the scale
    this.inner.add(this.wireframe);
  }

  update(time) {
    if (!this.material) return;
    this.wireUniforms.uTime.value = time;
    // restrained breathing on the window light
    const base = this._emissiveBase ?? (this.material.emissiveMap ? 1.02 : 0);
    this.material.emissiveIntensity = base * (0.92 + 0.08 * Math.sin(time * 0.42));
  }

  setWire(opacity) {
    this.wireUniforms.uOpacity.value = opacity;
    if (this.wireframe) this.wireframe.visible = opacity > 0.004;
  }

  /** Pointer move in world units — already in the pavilion's scaled space. */
  setWireCenter(worldPoint) {
    // convert to the wireframe's local space (it is scaled by 1/scale)
    this.wireUniforms.uCenter.value.copy(worldPoint);
    this.wireUniforms.uRadius.value = Math.max(2.4, this.height * 0.42);
  }

  get worldLandmarks() {
    return this.landmarks.map((l) => ({ ...l, world: l.position.clone() }));
  }
}