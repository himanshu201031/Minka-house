import * as THREE from 'three';

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class CameraRig {
  constructor(camera, stages, { reducedMotion = false } = {}) {
    this.camera = camera;
    this.stages = stages;
    this.index = 0;
    this.reduced = reducedMotion;

    this.duration = reducedMotion ? 0.36 : 1.42;

    this.from = this._snapshot(stages[0]);
    this.to = this._snapshot(stages[0]);
    this.t = 1;
    this.direction = 1;

    this.pointer = new THREE.Vector2();
    this.pointerEased = new THREE.Vector2();
    this.parallaxAmount = reducedMotion ? 0 : 1;

    this._pos = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._sph = new THREE.Spherical();
    this._up = new THREE.Vector3(0, 1, 0);
    this._onSettle = null;
  }

  _snapshot(stage) {
    return {
      position: new THREE.Vector3(...stage.position),
      target: new THREE.Vector3(...stage.target),
      fov: stage.fov,
      roll: stage.roll || 0,
    };
  }

  setReduced(reduced) {
    this.reduced = reduced;
    this.parallaxAmount = reduced ? 0 : 1;
    this.duration = reduced ? 0.36 : 1.42;
  }

  setPointer(nx, ny) {
    // nx, ny in [-1, 1]
    this.pointer.set(nx, ny);
  }

  goto(index, { instant = false, onSettle = null } = {}) {
    const clamped = Math.max(0, Math.min(this.stages.length - 1, index));
    if (clamped === this.index && this.t >= 1) {
      if (onSettle) onSettle();
      return false;
    }
    this.direction = clamped > this.index ? 1 : -1;
    this.index = clamped;
    this.from = this._asCurrent();
    this.to = this._snapshot(this.stages[clamped]);
    this.t = instant ? 1 : 0;
    this._onSettle = onSettle;
    if (instant) {
      this.t = 1;
      this._applyAll();
      if (onSettle) onSettle();
      this._onSettle = null;
    }
    return true;
  }

  /** Current (mid-transition) state becomes the new origin. */
  _asCurrent() {
    const s = {
      position: this._pos.clone(),
      target: this._target.clone(),
      fov: this.camera.fov,
      roll: this._currentRoll || 0,
    };
    if (this.t === 0) {
      return { position: this.from.position.clone(), target: this.from.target.clone(), fov: this.from.fov, roll: this.from.roll };
    }
    return s;
  }

  get isAnimating() {
    return this.t < 1;
  }

  update(dt) {
    // spring the pointer so parallax never snaps or shakes
    const k = 1 - Math.pow(0.0018, Math.min(dt, 0.05));
    this.pointerEased.x += (this.pointer.x - this.pointerEased.x) * k;
    this.pointerEased.y += (this.pointer.y - this.pointerEased.y) * k;

    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.duration);
      if (this.t >= 1 && this._onSettle) {
        const cb = this._onSettle;
        this._onSettle = null;
        cb();
      }
    }

    this._applyAll();
  }

  _applyAll() {
    const e = easeInOutCubic(this.t);
    const p = this.from.position.clone().lerp(this.to.position, e);
    const tgt = this.from.target.clone().lerp(this.to.target, e);
    const fov = this.from.fov + (this.to.fov - this.from.fov) * e;
    const roll = this.from.roll + (this.to.roll - this.from.roll) * e;
    this._currentRoll = roll;

    // ── pointer parallax, composed on the spherical orbit ──
    const amp = this.parallaxAmount;
    if (amp > 0) {
      this._sph.setFromVector3(p.clone().sub(tgt));
      const px = this.pointerEased.x;
      const py = this.pointerEased.y;
      this._sph.theta += px * 0.115;
      this._sph.phi = THREE.MathUtils.clamp(this._sph.phi + py * 0.055, 0.22, Math.PI - 0.22);
      this._sph.radius *= 1 + py * 0.018 - Math.abs(px) * 0.004;
      p.copy(tgt).add(new THREE.Vector3().setFromSpherical(this._sph));
    }

    // portrait viewports get a wider lens so the pavilion keeps its edges
    const aspect = this.camera.aspect || 1.6;
    const narrow = Math.max(0, 0.95 - aspect);
    this.camera.fov = fov + narrow * 23;

    this.camera.position.copy(p);

    // near-horizontal roll keeps the horizon honest without a tilt effect
    const r = roll + (amp ? this.pointerEased.x * 0.012 : 0);
    this._up.set(Math.sin(r), Math.cos(r), 0).normalize();
    this.camera.up.copy(this._up);
    this.camera.lookAt(tgt);
    this.camera.updateProjectionMatrix();

    this._pos.copy(p);
    this._target.copy(tgt);
  }

  /** Live azimuth / elevation for the views panel. */
  readout() {
    const d = this.camera.position.clone().sub(this._target);
    const az = (THREE.MathUtils.radToDeg(Math.atan2(d.x, d.z)) + 360) % 360;
    const el = THREE.MathUtils.radToDeg(Math.asin(d.y / d.length()));
    return { az, el, dist: d.length() };
  }
}
