/**
 * Sound.
 * Nothing is created or started until the visitor turns sound on.
 *
 * The intended assets live in /public/audio (ambience.mp3, whoosh.mp3,
 * inspect.mp3). No audio generation tool was available in this environment, so
 * when those files are absent the engine synthesises a quiet winter bed — wind,
 * water, low room tone — and matching transition / inspection cues. Drop real
 * files in and they are used instead, no code change required.
 */

const ASSETS = {
  ambience: '/audio/ambience.mp3',
  whoosh: '/audio/whoosh.mp3',
  inspect: '/audio/inspect.mp3',
};

async function probe(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

function noiseBuffer(ctx, seconds = 4) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    // cheap pink-ish filter — softer than white for wind
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.22;
  }
  return buf;
}

export class Soundscape {
  constructor() {
    this.enabled = false;
    this.ctx = null;
    this.master = null;
    this.bed = null;
    this.files = {};
    this.lastCue = 0;
    this.cueActive = false;
    this.ready = false;
    this._listeners = new Set();
  }

  onChange(fn) {
    this._listeners.add(fn);
    fn(this.enabled);
  }

  _emit() {
    this._listeners.forEach((fn) => fn(this.enabled));
  }

  async toggle() {
    if (this.enabled) this.disable();
    else await this.enable();
    return this.enabled;
  }

  async enable() {
    if (this.enabled) return true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return false;

    if (!this.ctx) {
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.ctx.destination);
    }
    // some environments (no audio device) never resolve resume — don't hang
    // the toggle forever; the gain ramp simply finds nothing to play
    if (this.ctx.state === 'suspended') {
      await Promise.race([
        this.ctx.resume(),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
    }

    if (!this.ready) await this._prepare();

    this.enabled = true;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.9, t + 1.6);
    this._emit();
    return true;
  }

  disable() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0, t + 0.6);
    this.enabled = false;
    this._emit();
  }

  async _prepare() {
    this.ready = true;
    const [amb, whoosh, inspect] = await Promise.all([
      probe(ASSETS.ambience),
      probe(ASSETS.whoosh),
      probe(ASSETS.inspect),
    ]);
    this.files.ambience = amb;
    this.files.whoosh = whoosh;
    this.files.inspect = inspect;

    if (amb) {
      try {
        const buf = await fetch(amb).then((r) => r.arrayBuffer());
        const decoded = await this.ctx.decodeAudioData(buf);
        const src = this.ctx.createBufferSource();
        src.buffer = decoded;
        src.loop = true;
        const g = this.ctx.createGain();
        g.gain.value = 0.5;
        src.connect(g).connect(this.master);
        src.start();
        this.bed = { src, g };
      } catch {
        this._buildSynthBed();
      }
    } else {
      this._buildSynthBed();
    }
  }

  _buildSynthBed() {
    const ctx = this.ctx;
    const bed = ctx.createGain();
    bed.gain.value = 1;
    bed.connect(this.master);
    this.bed = { g: bed };

    const noise = noiseBuffer(ctx, 5);

    // wind — low, slowly breathing
    const wind = ctx.createBufferSource();
    wind.buffer = noise;
    wind.loop = true;
    const windLp = ctx.createBiquadFilter();
    windLp.type = 'lowpass';
    windLp.frequency.value = 430;
    windLp.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.42;
    const windLfo = ctx.createOscillator();
    windLfo.frequency.value = 0.052;
    const windLfoAmt = ctx.createGain();
    windLfoAmt.gain.value = 150;
    windLfo.connect(windLfoAmt).connect(windLp.frequency);
    wind.connect(windLp).connect(windGain).connect(bed);
    wind.start();
    windLfo.start();

    // water — a narrow band of movement against the pier
    const water = ctx.createBufferSource();
    water.buffer = noise;
    water.loop = true;
    water.playbackRate.value = 0.72;
    const waterBp = ctx.createBiquadFilter();
    waterBp.type = 'bandpass';
    waterBp.frequency.value = 1250;
    waterBp.Q.value = 0.7;
    const waterGain = ctx.createGain();
    waterGain.gain.value = 0.1;
    const waterLfo = ctx.createOscillator();
    waterLfo.frequency.value = 0.11;
    const waterLfoAmt = ctx.createGain();
    waterLfoAmt.gain.value = 0.055;
    waterLfo.connect(waterLfoAmt).connect(waterGain.gain);
    water.connect(waterBp).connect(waterGain).connect(bed);
    water.start();
    waterLfo.start();

    // room tone — a low, quiet pad
    const padGain = ctx.createGain();
    padGain.gain.value = 0.055;
    const padLp = ctx.createBiquadFilter();
    padLp.type = 'lowpass';
    padLp.frequency.value = 340;
    padLp.connect(padGain).connect(bed);

    [55, 82.41, 110, 164.81].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i > 1 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (i - 1.5) * 4;
      const g = ctx.createGain();
      g.gain.value = i > 1 ? 0.22 : 0.5;
      o.connect(g).connect(padLp);
      o.start();
    });

    const trem = ctx.createOscillator();
    trem.frequency.value = 0.07;
    const tremAmt = ctx.createGain();
    tremAmt.gain.value = 0.02;
    trem.connect(tremAmt).connect(padGain.gain);
    trem.start();

    this.noise = noise;
  }

  _duck(amount = 0.28, time = 0.5) {
    if (!this.bed?.g) return;
    const t = this.ctx.currentTime;
    const g = this.bed.g.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(Math.max(0.35, 1 - amount), t + 0.12);
    g.linearRampToValueAtTime(1, t + time);
  }

  /** Camera movement — once per transition. */
  whoosh(strength = 1) {
    if (!this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    this._duck(0.3, 1.1);

    if (this.files.whoosh) {
      const a = new Audio(this.files.whoosh);
      a.volume = Math.min(0.5, 0.34 * strength);
      a.play().catch(() => {});
      return;
    }

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.9;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(180, t);
    bp.frequency.exponentialRampToValueAtTime(1500, t + 0.55);
    bp.frequency.exponentialRampToValueAtTime(320, t + 1.0);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16 * strength, t + 0.16);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);

    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random() * 3, 1.15);
    src.stop(t + 1.2);
  }

  /** Inspection hover — delicate tonal cue, never overlapping. */
  cue(kind = 'inspect') {
    if (!this.enabled) return;
    const now = performance.now();
    if (this.cueActive || now - this.lastCue < 420) return;
    this.lastCue = now;

    if (this.files.inspect) {
      const a = new Audio(this.files.inspect);
      a.volume = 0.3;
      a.play().catch(() => {});
      return;
    }

    const ctx = this.ctx;
    const t = ctx.currentTime;
    this.cueActive = true;
    const base = kind === 'select' ? 880 : 1174.66;
    const ratios = kind === 'select' ? [1, 1.5] : [1, 1.5, 2.02];

    ratios.forEach((r, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * r;
      const g = ctx.createGain();
      const peak = (0.05 / (i + 1)) * (kind === 'select' ? 1.3 : 1);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34 + i * 0.05);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.5);
    });

    setTimeout(() => {
      this.cueActive = false;
    }, 380);
  }

  /** Reported to the UI so missing generated assets are stated, not implied. */
  get status() {
    return {
      enabled: this.enabled,
      ambience: this.files.ambience ? 'file' : 'synthesised',
      whoosh: this.files.whoosh ? 'file' : 'synthesised',
      inspect: this.files.inspect ? 'file' : 'synthesised',
    };
  }
}
