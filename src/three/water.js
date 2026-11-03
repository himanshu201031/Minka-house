import * as THREE from 'three';

const linear = (hex) => new THREE.Color(hex).convertSRGBToLinear();

const VERT = /* glsl */ `
  uniform mat4 uTextureMatrix;
  varying vec3 vWorld;
  varying vec4 vCoord;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vCoord = uTextureMatrix * wp;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform sampler2D uReflection;
  uniform vec3  uDeep;
  uniform vec3  uShallow;
  uniform vec3  uFoam;
  uniform vec3  uFogColor;
  uniform vec3  uKeyDir;
  uniform vec3  uKeyColor;
  uniform vec3  uCamPos;
  uniform vec2  uBaseHalf;
  uniform float uTime;
  uniform float uFogDensity;
  uniform float uRipple;
  uniform float uReflectStrength;

  varying vec3 vWorld;
  varying vec4 vCoord;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  // rounded-rect distance to the stone pier footprint
  float boxSdf(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }

  void main() {
    vec2 p = vWorld.xz;
    float t = uTime;

    // ── surface normal: three crossing wave trains plus swell ──
    vec2 slope = vec2(0.0);
    slope.x += sin(p.x * 0.42 + p.y * 0.19 + t * 0.52) * 0.030;
    slope.y += cos(p.y * 0.51 - p.x * 0.16 + t * 0.44) * 0.030;
    slope.x += sin(p.x * 1.45 - p.y * 0.92 + t * 0.86) * 0.013;
    slope.y += cos(p.y * 1.61 + p.x * 0.84 + t * 0.77) * 0.013;
    slope.x += sin(p.x * 3.70 + p.y * 2.60 - t * 1.35) * 0.006;
    slope.y += cos(p.y * 3.90 - p.x * 2.20 - t * 1.22) * 0.006;

    // concentric rings released from the pier
    float d = length(p);
    float ring = sin(d * 2.1 - t * 0.85) * exp(-d * 0.075) * 0.020;
    slope += normalize(p + 1e-5) * ring;

    // low-frequency swell so the whole plane breathes
    slope += vec2(
      sin(p.x * 0.11 + t * 0.19) * 0.012,
      cos(p.y * 0.13 - t * 0.17) * 0.012
    );

    vec3 n = normalize(vec3(-slope.x * uRipple, 1.0, -slope.y * uRipple));
    vec3 V = normalize(uCamPos - vWorld);

    // ── planar reflection with ripple distortion ──
    vec3 rp = vCoord.xyz / max(vCoord.w, 1e-4);
    vec2 uv = rp.xy;
    float dist = length(uCamPos - vWorld);
    vec2 warp = n.xz * (0.055 / (1.0 + dist * 0.022));

    vec3 refl = vec3(0.0);
    float wsum = 0.0;
    for (int i = 0; i < 4; i++) {
      float o = float(i) - 1.5;
      float w = 1.0 - abs(o) * 0.22;
      vec2 off = vec2(0.0, o * 0.0026);
      refl += texture2D(uReflection, clamp(uv + warp + off, vec2(0.002), vec2(0.998))).rgb * w;
      wsum += w;
    }
    refl /= wsum;

    // ── water body ──
    float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 4.0);
    fres = clamp(mix(0.045, 1.0, fres), 0.0, 0.97);

    vec3 body = mix(uDeep, uShallow, smoothstep(0.0, 60.0, dist) * 0.55 + 0.12);
    vec3 col = mix(body, refl * uReflectStrength, fres);

    // ── overcast key specular ──
    vec3 H = normalize(normalize(uKeyDir) + V);
    float spec = pow(max(dot(n, H), 0.0), 220.0);
    col += uKeyColor * spec * 1.15;

    // wide soft sheen across the swell
    float sheen = pow(max(dot(n, H), 0.0), 12.0) * 0.030;
    col += uKeyColor * sheen;

    // ── stone apron contact: foam, wet darkening ──
    float sdf = boxSdf(p, uBaseHalf, 0.55);
    float foamLine = smoothstep(0.36, 0.0, abs(sdf + 0.06));
    float foamWash = smoothstep(1.6, 0.0, sdf) * 0.22;
    float wet = smoothstep(2.6, 0.0, sdf);
    col = mix(col, uFoam, clamp(foamLine * 0.34 + foamWash * 0.3, 0.0, 0.42));
    col *= 1.0 - wet * 0.28;

    // ── atmospheric depth ──
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    col = mix(col, uFogColor, clamp(fog, 0.0, 0.94));

    // gentle horizon lift so the far water separates from the sky
    col += vec3(0.012, 0.020, 0.030) * smoothstep(24.0, 90.0, dist);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export class Water {
  constructor({ baseHalf = new THREE.Vector2(4.6, 4.6), fogColor = 0x0c1826, fogDensity = 0.013 } = {}) {
    this.reflectionTarget = new THREE.WebGLRenderTarget(1024, 512, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      type: THREE.HalfFloatType,
      depthBuffer: true,
      generateMipmaps: false,
    });

    this.textureMatrix = new THREE.Matrix4();
    this.virtualCamera = new THREE.PerspectiveCamera();
    this.reflectorPlane = new THREE.Plane();
    this._normal = new THREE.Vector3();
    this._planePos = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
    this._rot = new THREE.Matrix4();
    this._lookAt = new THREE.Vector3();
    this._view = new THREE.Vector3();
    this._target = new THREE.Vector3();

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uReflection: { value: this.reflectionTarget.texture },
        uTextureMatrix: { value: this.textureMatrix },
        uDeep: { value: linear(0x0a1727) },
        uShallow: { value: linear(0x17344a) },
        uFoam: { value: linear(0xdceef8) },
        uFogColor: { value: linear(fogColor) },
        uKeyDir: { value: new THREE.Vector3(-0.35, 0.78, 0.52).normalize() },
        uKeyColor: { value: linear(0xd6e9ff) },
        uCamPos: { value: new THREE.Vector3() },
        uBaseHalf: { value: baseHalf },
        uTime: { value: 0 },
        uFogDensity: { value: fogDensity },
        uRipple: { value: 1.15 },
        uReflectStrength: { value: 1.14 },
      },
    });

    const geo = new THREE.PlaneGeometry(520, 520, 1, 1);
    geo.rotateX(-Math.PI / 2);

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  setQuality(scale) {
    const w = Math.max(256, Math.round(window.innerWidth * scale));
    const h = Math.max(128, Math.round(window.innerHeight * scale * 0.62));
    this.reflectionTarget.setSize(w, h);
  }

  /** Theme hook — uniforms hold linear colours, so convert like the constructor does. */
  setPalette({ deep, shallow, fog, key } = {}) {
    const u = this.material.uniforms;
    if (deep !== undefined) u.uDeep.value.copy(linear(deep));
    if (shallow !== undefined) u.uShallow.value.copy(linear(shallow));
    if (fog !== undefined) u.uFogColor.value.copy(linear(fog));
    if (key !== undefined) u.uKeyColor.value.copy(linear(key));
  }

  /**
   * Render the mirrored world into the reflection target.
   * Follows the planar-reflection construction used by three's Reflector.
   */
  renderReflection(renderer, scene, camera) {
    const mesh = this.mesh;
    mesh.updateMatrixWorld();
    camera.updateMatrixWorld();

    this._planePos.set(0, 0, 0);
    this._camPos.setFromMatrixPosition(camera.matrixWorld);

    this._rot.extractRotation(mesh.matrixWorld);
    this._normal.set(0, 1, 0).applyMatrix4(this._rot);

    this._view.subVectors(this._planePos, this._camPos);
    if (this._view.dot(this._normal) > 0) return;
    this._view.reflect(this._normal).negate().add(this._planePos);

    this._rot.extractRotation(camera.matrixWorld);
    this._lookAt.set(0, 0, -1).applyMatrix4(this._rot).add(this._camPos);

    this._target.subVectors(this._planePos, this._lookAt);
    this._target.reflect(this._normal).negate().add(this._planePos);

    const vc = this.virtualCamera;
    vc.position.copy(this._view);
    vc.up.set(0, 1, 0).applyMatrix4(this._rot).reflect(this._normal);
    vc.lookAt(this._target);
    vc.far = camera.far;
    vc.near = camera.near;
    vc.fov = camera.fov;
    vc.aspect = camera.aspect;
    vc.updateProjectionMatrix();
    vc.updateMatrixWorld();

    this.textureMatrix.set(
      0.5, 0.0, 0.0, 0.5,
      0.0, 0.5, 0.0, 0.5,
      0.0, 0.0, 0.5, 0.5,
      0.0, 0.0, 0.0, 1.0,
    );
    this.textureMatrix.multiply(vc.projectionMatrix);
    this.textureMatrix.multiply(vc.matrixWorldInverse);
    this.textureMatrix.multiply(mesh.matrixWorld);

    mesh.visible = false;
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.reflectionTarget);
    renderer.clear();
    renderer.render(scene, vc);
    renderer.setRenderTarget(prevTarget);
    mesh.visible = true;
  }

  update(time, camera) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uCamPos.value.copy(camera.position);
  }
}
