import * as THREE from 'three';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class Inspect {
  constructor({ world, rig, overlay, onHoverChange }) {
    this.world = world;
    this.rig = rig;
    this.overlay = overlay;
    this.onHoverChange = onHoverChange;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-10, -10);
    this.active = false;
    this.mode = false; // "Explore the Structure"
    this.hoverPoint = new THREE.Vector3();
    this.hovered = false;
    this.wireTarget = 0;
    this.wireValue = 0;
    this.pending = false;

    this.svg = document.createElementNS(SVG_NS, 'svg');
    this.svg.setAttribute('class', 'guide');
    this.svg.setAttribute('preserveAspectRatio', 'none');
    overlay.appendChild(this.svg);

    this.groups = [];
    this.hitGroup = null;
    this._build();
  }

  _build() {
    const landmarks = this.world.pavilion.worldLandmarks;

    landmarks.forEach((lm) => {
      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'guide__el');

      const lead = document.createElementNS(SVG_NS, 'line');
      lead.setAttribute('class', 'guide__lead guide__line');
      lead.setAttribute('x1', '0');
      lead.setAttribute('y1', '0');
      lead.setAttribute('x2', '46');
      lead.setAttribute('y2', '0');

      const tick = document.createElementNS(SVG_NS, 'line');
      tick.setAttribute('class', 'guide__tick guide__line');
      tick.setAttribute('x1', '46');
      tick.setAttribute('y1', '0');
      tick.setAttribute('x2', '46');
      tick.setAttribute('y2', '-14');

      const bracket = document.createElementNS(SVG_NS, 'path');
      bracket.setAttribute('class', 'guide__bracket');
      bracket.setAttribute('d', 'M -7 -3 L -7 -7 L -3 -7');

      const bracket2 = document.createElementNS(SVG_NS, 'path');
      bracket2.setAttribute('class', 'guide__bracket');
      bracket2.setAttribute('d', 'M 7 3 L 7 7 L 3 7');

      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('class', 'guide__dot');
      dot.setAttribute('r', '1.7');

      const text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('class', 'guide__text');
      text.setAttribute('x', '54');
      text.setAttribute('y', '-16');
      text.textContent = `${lm.ref} · ${lm.label}`;

      const sub = document.createElementNS(SVG_NS, 'text');
      sub.setAttribute('class', 'guide__text guide__text--dim');
      sub.setAttribute('x', '54');
      sub.setAttribute('y', '-4');
      sub.textContent = `EL ${(lm.position.y).toFixed(2)} m`;

      g.append(bracket, bracket2, lead, tick, dot, text, sub);
      this.svg.appendChild(g);

      this.groups.push({ group: g, landmark: lm, lead, tick, bracket, bracket2, text, sub, dir: 1, wasOn: false });
    });

    // hover anchor ring
    this.hit = document.createElementNS(SVG_NS, 'g');
    this.hit.setAttribute('class', 'guide__el');
    this.hitRing = document.createElementNS(SVG_NS, 'circle');
    this.hitRing.setAttribute('class', 'guide__line');
    this.hitRing.setAttribute('r', '11');
    this.hitRing.setAttribute('stroke-dasharray', '3 4');
    this.hitCross = document.createElementNS(SVG_NS, 'circle');
    this.hitCross.setAttribute('class', 'guide__dot');
    this.hitCross.setAttribute('r', '1.4');
    this.hit.append(this.hitRing, this.hitCross);
    this.svg.appendChild(this.hit);
  }

  setMode(on) {
    this.mode = on;
    this.groups.forEach((g) => {
      g.group.classList.toggle('is-on', on || false);
    });
    this.hit.classList.toggle('is-on', on);
  }

  onPointerMove(clientX, clientY) {
    this.pointer.x = clientX;
    this.pointer.y = clientY;
    this.active = true;
    if (!this.pending) {
      this.pending = true;
      requestAnimationFrame(() => {
        this.pending = false;
        this._raycast();
      });
    }
  }

  onPointerLeave() {
    this.active = false;
    this._setHover(false);
  }

  _raycast() {
    if (!this.active || !this.world.pavilion?.mesh) return;
    const mesh = this.world.pavilion.mesh;
    const cam = this.world.camera;

    const rect = this.overlay.getBoundingClientRect();
    const nx = ((this.pointer.x - rect.left) / rect.width) * 2 - 1;
    const ny = -((this.pointer.y - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera({ x: nx, y: ny }, cam);

    const hits = this.raycaster.intersectObject(mesh, false);
    if (hits.length) {
      this.hoverPoint.copy(hits[0].point);
      this._setHover(true);
      this._selectGuides();
    } else {
      this._setHover(false);
    }
  }

  _setHover(on) {
    if (this.hovered === on) return;
    this.hovered = on;
    this.wireTarget = on ? 1 : 0;
    if (!on) {
      this.groups.forEach((g) => {
        if (!this.mode) g.group.classList.remove('is-on');
        g.wasOn = false;
      });
      if (!this.mode) this.hit.classList.remove('is-on');
    }
    this.onHoverChange?.(on);
  }

  _selectGuides() {
    const p = this.hoverPoint;
    const nearest = this.world.pavilion
      .worldLandmarks.map((lm, i) => ({ i, d: lm.world.distanceTo(p) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);

    const keep = new Set(nearest.map((n) => n.i));
    this.groups.forEach((g, i) => {
      const on = keep.has(i) || this.mode;
      if (on !== g.wasOn) {
        g.group.classList.toggle('is-on', on);
        g.wasOn = on;
      }
    });
  }

  update(dt, camera) {
    if (!this.world.pavilion) return;

    // wireframe opacity ramp
    const speed = this.hovered ? 6.5 : 4.2;
    this.wireValue += (this.wireTarget - this.wireValue) * Math.min(1, dt * speed);
    if (this.mode && !this.hovered) this.wireValue = Math.max(this.wireValue, 0.34);
    this.world.pavilion.setWire(this.wireValue < 0.01 ? 0 : this.wireValue * 0.9);

    if (this.hovered) {
      this.world.pavilion.wireUniforms.uCenter.value.copy(this.hoverPoint);
    }

    // project anchors to screen
    const w = this.overlay.clientWidth;
    const h = this.overlay.clientHeight;
    if (!w || !h) return;
    if (this.svg.getAttribute('viewBox') !== `0 0 ${w} ${h}`) {
      this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      this.svg.setAttribute('width', w);
      this.svg.setAttribute('height', h);
    }

    const v = new THREE.Vector3();

    this.groups.forEach((g) => {
      v.copy(g.landmark.position);
      v.project(camera);
      const visible = v.z < 1 && v.z > -1;
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;

      if (!visible) {
        g.group.style.display = 'none';
        return;
      }
      g.group.style.display = '';

      const dir = x > w * 0.62 ? -1 : 1;
      if (dir !== g.dir) {
        g.dir = dir;
        g.lead.setAttribute('x2', String(46 * dir));
        g.tick.setAttribute('x1', String(46 * dir));
        g.tick.setAttribute('x2', String(46 * dir));
        g.text.setAttribute('x', String(54 * dir));
        g.sub.setAttribute('x', String(54 * dir));
        g.text.setAttribute('text-anchor', dir > 0 ? 'start' : 'end');
        g.sub.setAttribute('text-anchor', dir > 0 ? 'start' : 'end');
        g.bracket.setAttribute('d', dir > 0 ? 'M -7 -3 L -7 -7 L -3 -7' : 'M 7 -3 L 7 -7 L 3 -7');
        g.bracket2.setAttribute('d', dir > 0 ? 'M 7 3 L 7 7 L 3 7' : 'M -7 3 L -7 7 L -3 7');
      }
      g.group.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    });

    // hover ring
    if (this.hovered || this.mode) {
      v.copy(this.hoverPoint).project(camera);
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;
      this.hit.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
      this.hit.classList.add('is-on');
      const pulse = 11 + Math.sin(performance.now() * 0.0022) * 1.6;
      this.hitRing.setAttribute('r', pulse.toFixed(2));
    } else {
      this.hit.classList.remove('is-on');
    }
  }
}
