import { AudioFeatures, Settings, THEMES } from '../types';

interface Particle {
  x: number; y: number; z: number;
  a: number; s: number; type: number;
}

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private particles: Particle[];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;
    this.particles = Array.from({ length: 600 }, () => ({
      x: Math.random(), y: Math.random(), z: Math.random(),
      a: Math.random() * 6.28, s: Math.random(),
      type: Math.floor(Math.random() * 3),
    }));
  }

  private hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
  }
  private lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
  private color(t: number, theme: number): string {
    const p = THEMES[theme].map(c => this.hexToRgb(c));
    t = ((t % 1) + 1) % 1;
    const [a, b] = t < 0.5 ? [p[0], p[1]] : [p[1], p[2]];
    const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    return `rgb(${this.lerp(a[0],b[0],u)},${this.lerp(a[1],b[1],u)},${this.lerp(a[2],b[2],u)})`;
  }
  private colorA(t: number, theme: number, alpha: number): string {
    const p = THEMES[theme].map(c => this.hexToRgb(c));
    t = ((t % 1) + 1) % 1;
    const [a, b] = t < 0.5 ? [p[0], p[1]] : [p[1], p[2]];
    const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    return `rgba(${this.lerp(a[0],b[0],u)|0},${this.lerp(a[1],b[1],u)|0},${this.lerp(a[2],b[2],u)|0},${alpha})`;
  }
  private rgbArr(t: number, theme: number): [number, number, number] {
    const p = THEMES[theme].map(c => this.hexToRgb(c));
    t = ((t % 1) + 1) % 1;
    const [a, b] = t < 0.5 ? [p[0], p[1]] : [p[1], p[2]];
    const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    return [this.lerp(a[0],b[0],u), this.lerp(a[1],b[1],u), this.lerp(a[2],b[2],u)];
  }
  private rand(seed: number): number {
    const x = Math.sin(seed + 1) * 43758.5453;
    return x - Math.floor(x);
  }

  render(fx: AudioFeatures, rawTime: number, settings: Settings, mode: string, theme: number): void {
    const { canvas, ctx } = this;
    const w = canvas.width, h = canvas.height;
    const t = rawTime * settings.speed;

    ctx.save();

    // Every style owns its temporal feel through its clear alpha
    const clears: Record<string,string> = {
      plasma:  'rgba(2,1,7,0.22)',   // Liquid: very long trail — paths ARE the texture
      tunnel:  '#010107',             // Tunnel: crisp — rings must read sharp and fast
      kaleido: 'rgba(2,1,7,0.45)',   // Bloom: medium — petals echo softly
      pulse:   '#010007',             // Pulse: pure dark — maximum graphic contrast
    };
    ctx.fillStyle = clears[mode] ?? '#020107';
    ctx.fillRect(0, 0, w, h);

    const zoom = 1 + fx.beat * 0.06 * settings.zoom;
    ctx.translate(w/2, h/2);
    ctx.scale(zoom, zoom);
    if (mode === 'plasma' || mode === 'kaleido') {
      ctx.rotate(Math.sin(t * 0.18) * 0.022 + fx.kick * settings.shake * 0.02);
    }
    ctx.translate(-w/2, -h/2);

    if (mode === 'plasma')  this.drawPlasma (w, h, t, fx, theme, settings);
    if (mode === 'tunnel')  this.drawTunnel (w, h, t, fx, theme, settings);
    if (mode === 'kaleido') this.drawKaleido(w, h, t, fx, theme, settings);
    if (mode === 'pulse')   this.drawPulse  (w, h, t, fx, theme, settings);

    // Pulse is minimal by nature — particles break its graphic identity
    if (mode !== 'pulse') this.drawParticles(w, h, t, fx, theme, settings);
    this.drawPost(w, h, fx, settings);
    ctx.restore();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // LIQUID
  // Emotion: the inside of a living organism viewed from within.
  // Technique: deep ocean of slow masses → mid currents → bright surface
  //            + caustic network (light refracting through the fluid surface)
  // ══════════════════════════════════════════════════════════════════════════
  private drawPlasma(w: number, h: number, t: number, fx: AudioFeatures, theme: number, settings: Settings): void {
    const ctx = this.ctx;
    const cx = w * 0.5, cy = h * 0.5;
    const minD = Math.min(w, h);

    ctx.globalCompositeOperation = 'lighter';

    // ── Layer 0: Deep ocean — 3 massive slow masses ───────────────────────
    // These define the dominant color fields. Colors are cool (deep theme end).
    for (let i = 0; i < 3; i++) {
      const phase = i / 3;
      const ax = (Math.sin(t*0.10+i*2.09)*0.44 + Math.sin(t*0.06+i*3.14)*0.22 + Math.sin(t*0.03+i*1.57)*0.12) * minD * 0.44;
      const ay = (Math.cos(t*0.08+i*1.73)*0.44 + Math.cos(t*0.05+i*2.44)*0.22 + Math.cos(t*0.03+i*0.87)*0.12) * minD * 0.44;
      const x = cx + ax;
      const y = cy + ay + fx.bass * 55;
      const rad = (minD * 0.50 + fx.bass * minD * 0.20 * settings.intensity) * (0.9 + 0.1 * Math.sin(t*0.5+i));
      const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
      // Cool at the deep base of each mass, warmer as we approach mid-layer
      gr.addColorStop(0,   this.colorA(phase * 0.4 + t*0.015, theme, 0.22));
      gr.addColorStop(0.5, this.colorA(phase * 0.4 + t*0.015 + 0.15, theme, 0.10));
      gr.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.283); ctx.fill();
    }

    // ── Layer 1: Mid currents — power-law distributed ─────────────────────
    // A few large, many small. Colors shift warmer as size increases.
    const midCount = 14 + Math.floor(settings.complexity * 8);
    const blobCenters: Array<{x:number,y:number,r:number,t:number}> = [];
    for (let i = 0; i < midCount; i++) {
      const phase = i / midCount;
      const sizePow = Math.pow(this.rand(i * 7 + 3), 2.0);
      const fA = 1 + Math.floor(i * 1.618) % 3 * 0.5;
      const fB = 1 + Math.floor(i * 2.414) % 4 * 0.4;
      const ax = (Math.sin(t*fA*0.13+i*2.39)*0.42 + Math.sin(t*0.07+i)*0.20 + Math.sin(t*fA*0.04+i*3.7)*0.12) * minD*(0.26+sizePow*0.20);
      const ay = (Math.cos(t*fB*0.10+i*1.73)*0.42 + Math.cos(t*0.09+i)*0.20 + Math.cos(t*fB*0.05+i*2.1)*0.12) * minD*(0.26+sizePow*0.20);
      const x = cx + ax + fx.bass * 100 * (phase - 0.5);
      const y = cy + ay + fx.mid  * 75  * (phase - 0.5);
      const rad = (28 + sizePow * minD * 0.36) * settings.intensity + fx.bass * 110;
      const alpha = 0.07 + sizePow * 0.22;
      // Warm color for large blobs, cool for small
      const warmShift = sizePow * 0.25;
      const colorT = phase * 0.6 + warmShift + t*0.028 + fx.mid*0.07;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0,    this.colorA(colorT, theme, alpha));
      gr.addColorStop(0.38, this.colorA(colorT + 0.12, theme, alpha * 0.5));
      gr.addColorStop(0.75, this.colorA(colorT + 0.22, theme, 0.03));
      gr.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.283); ctx.fill();
      // Store center for caustic pass
      if (sizePow > 0.3) blobCenters.push({x, y, r: rad, t: colorT});
    }

    // ── Layer 2: Surface details — small bright reactive dots ─────────────
    const surfCount = 8 + Math.floor(settings.complexity * 5);
    for (let i = 0; i < surfCount; i++) {
      const phase = i / surfCount;
      const a = phase * 6.283 + t * 0.36 + Math.sin(t * 0.55 + i) * 0.9;
      const r = minD * 0.10 + Math.sin(t * 0.7 + i * 1.3) * minD * 0.07 + fx.mid * minD * 0.10;
      const x = cx + Math.cos(a) * r * (0.7 + fx.bass * 0.3);
      const y = cy + Math.sin(a) * r;
      const rad = 18 + 38 * Math.abs(Math.sin(t * 1.1 + i)) + fx.high * minD * 0.05;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0,   this.colorA(0.7 + phase*0.2 + t*0.08, theme, 0.38 + fx.high * 0.22));
      gr.addColorStop(0.5, this.colorA(0.8 + phase*0.1 + t*0.06, theme, 0.10));
      gr.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.283); ctx.fill();
    }

    // ── Caustic network — light refracting through the fluid surface ──────
    // Thin bright tendrils connecting nearby blob centers.
    // This is the signature visual element that sells "liquid" vs "fog".
    const numCaustics = 10;
    ctx.globalAlpha = 1;
    for (let i = 0; i < numCaustics; i++) {
      const angle = i/numCaustics*6.283 + t*0.06 + Math.sin(t*0.28+i)*0.6;
      const r1 = minD * (0.06 + 0.10 * Math.abs(Math.sin(t*0.38+i*1.7)));
      const r2 = r1 + minD * (0.08 + fx.mid * 0.07 * Math.sin(t*0.5+i));
      const x1 = cx + Math.cos(angle) * r1;
      const y1 = cy + Math.sin(angle) * r1;
      const x2 = cx + Math.cos(angle + 0.6 + fx.mid*0.25) * r2;
      const y2 = cy + Math.sin(angle + 0.6 + fx.mid*0.25) * r2;
      const alpha = 0.06 + fx.high * 0.07;
      ctx.strokeStyle = this.colorA(i/numCaustics + t*0.04 + 0.6, theme, alpha);
      ctx.lineWidth   = 0.5 + fx.high * 1.2;
      const mx = (x1+x2)/2 + Math.sin(t*2.2+i*1.1)*25;
      const my = (y1+y2)/2 + Math.cos(t*1.8+i*0.9)*25;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(mx, my, x2, y2);
      ctx.stroke();
    }

    ctx.globalCompositeOperation = 'source-over';

    // ── Kick: concentric pressure rings ───────────────────────────────────
    if (fx.kick > 0.25) {
      ctx.globalCompositeOperation = 'lighter';
      for (let ring = 0; ring < 3; ring++) {
        const rRad = fx.kick * minD * (0.28 + ring * 0.12);
        const gr = ctx.createRadialGradient(cx,cy, rRad*0.5, cx,cy, rRad);
        gr.addColorStop(0,   'rgba(0,0,0,0)');
        gr.addColorStop(0.7, `rgba(255,255,255,${fx.kick * 0.07})`);
        gr.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.arc(cx, cy, rRad, 0, 6.283); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // BLOOM
  // Emotion: a flower opening in light — soft, alive, breathing.
  // Technique: filled petal layers from warm white core to saturated edge.
  //            The centre is ALWAYS glowing — it is a light source, not a beat
  //            response. Bass makes it breathe. Snare makes it explode.
  // ══════════════════════════════════════════════════════════════════════════
  private drawKaleido(w: number, h: number, t: number, fx: AudioFeatures, theme: number, settings: Settings): void {
    const ctx = this.ctx;
    const minD = Math.min(w, h);

    ctx.translate(w/2, h/2);
    ctx.globalCompositeOperation = 'lighter';

    // Layer config: [petals, maxLength, rotSpeed, reactive, alphaBase]
    // Color is derived separately: inner = warm palette start, outer = cool palette end
    type LayerDef = [number, number, number, keyof AudioFeatures, number];
    const layers: LayerDef[] = [
      [6,  0.50, 0.016, 'bass',  0.52],   // Outer — slow breathing, saturated cool
      [10, 0.33, 0.029, 'mid',   0.40],
      [14, 0.21, 0.052, 'high',  0.32],
      [8,  0.11, 0.088, 'beat',  0.42],
      [20, 0.05, 0.170, 'hat',   0.28],   // Inner core — fast, warm, bright
    ];

    for (let li = 0; li < layers.length; li++) {
      const [numPetals, baseLen, rotSpeed, reactive, alphaBase] = layers[li];
      const reactVal = fx[reactive] as number;
      const depth = li / (layers.length - 1); // 0=outer, 1=inner

      // All layers breathe with bass. Snare adds sudden push to outer layers.
      const breathe    = 1 + fx.bass * 0.40 * settings.intensity;
      const snapExpand = fx.snare * (1 - depth) * 0.85;
      const length  = minD * baseLen * breathe * (1 + snapExpand);
      const halfW   = length * (0.19 + fx.mid * 0.05);
      const rot     = t * rotSpeed * settings.speed + li * 0.40;

      // outer=cool end of palette, inner=warm start of palette, inner = warm start
      // This creates the "warm light source → cool outer glow" of a real bloom
      const colorOfs = (1 - depth) * 0.55; // outer=0.55, inner=0.0
      const colorAmt = alphaBase * (0.85 + depth * 0.15); // inner layers slightly brighter

      for (let p = 0; p < numPetals; p++) {
        const offset = li % 2 === 0 ? 0 : Math.PI / numPetals;
        const angle  = (p / numPetals) * Math.PI * 2 + rot + offset;
        const colorT = colorOfs + p/numPetals*0.06 + t*0.015;

        ctx.save();
        ctx.rotate(angle);

        const grad = ctx.createLinearGradient(0, 0, 0, length);
        // Inner end (base): near-white for inner layers, saturated for outer
        const baseWhiten = depth * 0.4; // inner = more white mixed in
        grad.addColorStop(0.0, `rgba(${255*baseWhiten|0},${255*baseWhiten|0},${255*baseWhiten|0},0)` );
        // Actually let's blend: deep warm color at base fading to transparent at tip
        grad.addColorStop(0.0, this.colorA(colorT,        theme, colorAmt));
        grad.addColorStop(0.4, this.colorA(colorT + 0.10, theme, colorAmt * 0.60));
        grad.addColorStop(1.0, this.colorA(colorT + 0.22, theme, 0.0));

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo( halfW, length*0.22,  halfW, length*0.78, 0, length);
        ctx.bezierCurveTo(-halfW, length*0.78, -halfW, length*0.22, 0, 0);
        ctx.fill();
        ctx.restore();
      }
    }

    // ── Constant warm core — the light source, always present ─────────────
    // This is what makes Bloom feel alive even in silence.
    const corePulse  = fx.beat * 0.06 + fx.bass * 0.04;
    const coreR = minD * (0.055 + corePulse);

    // Warm white centre
    const coreGrad = ctx.createRadialGradient(0,0,0, 0,0, coreR * 3.5);
    coreGrad.addColorStop(0.00, `rgba(255,248,235,${0.55 + fx.beat*0.40})`);
    coreGrad.addColorStop(0.20, `rgba(255,200,160,${0.25 + fx.bass*0.20})`);
    coreGrad.addColorStop(0.55, this.colorA(t*0.02, theme, 0.12));
    coreGrad.addColorStop(1.00, 'rgba(0,0,0,0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath(); ctx.arc(0, 0, coreR * 3.5, 0, Math.PI * 2); ctx.fill();

    // Sharp bright point
    const pointGrad = ctx.createRadialGradient(0,0,0, 0,0, coreR * 0.6);
    pointGrad.addColorStop(0, `rgba(255,255,255,${0.80 + fx.beat*0.20})`);
    pointGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pointGrad;
    ctx.beginPath(); ctx.arc(0, 0, coreR * 0.6, 0, Math.PI * 2); ctx.fill();

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // TUNNEL
  // Emotion: speed. Being pulled through a corridor of light.
  // Technique: perspective rings scroll continuously. 12 corridor beams
  //            converge at a glowing vanishing point. Near = warm, far = cool.
  //            Kick multiplies speed dramatically — you feel the acceleration.
  // ══════════════════════════════════════════════════════════════════════════
  private drawTunnel(w: number, h: number, t: number, fx: AudioFeatures, theme: number, settings: Settings): void {
    const ctx = this.ctx;
    const cx = w/2, cy = h/2;
    const minD = Math.min(w, h);

    ctx.globalCompositeOperation = 'lighter';

    // ── Corridor beams — the structural skeleton of the tunnel ─────────────
    // 12 beams = strong sense of a built space, not just concentric circles
    const numBeams = 12;
    for (let b = 0; b < numBeams; b++) {
      const angle = (b / numBeams) * Math.PI * 2 + t * 0.008;
      // Beams also have near/far colour gradient (warm near viewer)
      ctx.strokeStyle = this.color(b/numBeams * 0.4 + t*0.018, theme);
      ctx.lineWidth = 0.9;
      ctx.globalAlpha = 0.15 + fx.mid * 0.12;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * Math.max(w,h) * 1.3, cy + Math.sin(angle) * Math.max(w,h) * 1.3);
      ctx.stroke();
    }

    // ── Scrolling rings — perspective-projected ───────────────────────────
    // Kick dramatically multiplies speed: acceleration is FELT, not just seen.
    const numRings = 44;
    const kickAccel = 1 + fx.kick * 4.5 * settings.shake;
    const scrollSpeed = 0.36 * settings.speed * kickAccel;
    const focalLen = 0.052;

    for (let i = 0; i < numRings; i++) {
      const raw = ((i / numRings) + t * scrollSpeed) % 1.0;
      const safePos = ((raw % 1.0) + 1.0) % 1.0;
      const depth = 1.0 - safePos;

      if (depth < 0.048) continue;

      const radius = minD * focalLen / (depth + 0.011);
      if (radius > minD * 0.76) continue;

      const nearness = 1.0 - depth;
      const brightness = nearness * nearness * nearness;

      // Near rings = warm (palette tail ~0.85), far rings = cool (palette head ~0.05)
      // This creates atmospheric depth — warm rushing forward, cold receding
      const colorT = nearness * 0.80 + (1-nearness) * 0.05 + t * 0.04;

      ctx.strokeStyle = this.color(colorT, theme);
      ctx.lineWidth   = 0.4 + brightness * 5.5;
      ctx.globalAlpha = 0.05 + brightness * 0.88;

      const twist = depth * fx.mid * 0.30;
      ctx.beginPath();
      ctx.ellipse(cx, cy,
        radius * (1 + Math.sin(twist) * 0.04),
        radius * (1 - Math.sin(twist) * 0.04),
        twist * 0.45, 0, Math.PI * 2);
      ctx.stroke();

      // Inner highlight on near rings — the "shine" on the tunnel wall
      if (depth < 0.18 && brightness > 0.35) {
        ctx.globalAlpha = (0.18 - depth) * 3.5 * brightness * 0.55;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 0.87, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // ── Vanishing point — the destination at infinity ─────────────────────
    const vpGrad = ctx.createRadialGradient(cx,cy,0, cx,cy, minD*0.20);
    vpGrad.addColorStop(0,   `rgba(255,255,255,${0.20+fx.beat*0.35})`);
    vpGrad.addColorStop(0.35, this.colorA(0.05+t*0.03, theme, 0.10+fx.bass*0.10));
    vpGrad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = vpGrad;
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, w, h);

    // ── Kick: speed-burst radial flash ────────────────────────────────────
    if (fx.kick > 0.18) {
      const burst = ctx.createRadialGradient(cx,cy,0, cx,cy, minD*0.62*fx.kick);
      burst.addColorStop(0,   'rgba(0,0,0,0)');
      burst.addColorStop(0.55, `rgba(255,255,255,${fx.kick*0.14})`);
      burst.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = burst;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PULSE
  // Emotion: precision. The heartbeat of the music, made visible.
  // Technique: ONE mirrored waveform with a stable center axis. The axis is
  //            a constant reference. The waveform fills with amplitude. Beat
  //            fires a horizontal white flash — a visual downbeat marker.
  //            No particles. No decoration. Only rhythm.
  // ══════════════════════════════════════════════════════════════════════════
  private drawPulse(w: number, h: number, t: number, fx: AudioFeatures, theme: number, settings: Settings): void {
    const ctx = this.ctx;
    const cx = w/2, cy = h/2;

    ctx.globalCompositeOperation = 'lighter';

    // ── Center axis — the stable reference, always visible ────────────────
    ctx.strokeStyle = this.colorA(t*0.012, theme, 0.38);
    ctx.lineWidth   = 1;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(w, cy);
    ctx.stroke();

    // ── Waveform synthesis ─────────────────────────────────────────────────
    // Multi-frequency composition reads as genuinely musical.
    // Bass drives amplitude. High frequencies add fine texture at the edge.
    const maxAmp = h * 0.40 * settings.intensity;
    const amp    = maxAmp * (0.12 + fx.bass * 0.60 + fx.vol * 0.18);
    const spd    = t * settings.speed;

    const step = Math.ceil(w / 640);
    const pts: number[] = [];
    for (let x = 0; x <= w; x += step) {
      const p = x / w;
      const y = (
        Math.sin(p*Math.PI*2*2.1  + spd*1.5) * 0.34
      + Math.sin(p*Math.PI*2*4.7  + spd*2.3) * 0.23 * fx.mid
      + Math.sin(p*Math.PI*2*0.8  + spd*0.7) * 0.30 * fx.bass
      + Math.sin(p*Math.PI*2*9.3  + spd*4.1) * 0.09 * fx.high
      + Math.sin(p*Math.PI*2*17.6 + spd*6.2) * 0.04 * fx.hat
      ) * amp;
      pts.push(y);
    }

    const waveColor = this.color(t * 0.018, theme);

    // ── Waveform fill — the body of sound ─────────────────────────────────
    // Filled area gives visual weight and communicates energy level.
    ctx.fillStyle = this.colorA(t*0.018, theme, 0.07 + fx.bass*0.06);
    // Above axis
    ctx.beginPath();
    ctx.moveTo(0, cy);
    pts.forEach((y, i) => { ctx.lineTo(i * step, cy - y); });
    ctx.lineTo(w, cy); ctx.closePath(); ctx.fill();
    // Below axis (mirror)
    ctx.beginPath();
    ctx.moveTo(0, cy);
    pts.forEach((y, i) => { ctx.lineTo(i * step, cy + y); });
    ctx.lineTo(w, cy); ctx.closePath(); ctx.fill();

    // ── Waveform line — sharp and precise ─────────────────────────────────
    ctx.strokeStyle = waveColor;
    ctx.lineWidth   = 2;
    ctx.globalAlpha = 0.92;
    // Above
    ctx.beginPath();
    pts.forEach((y, i) => { i === 0 ? ctx.moveTo(i*step, cy-y) : ctx.lineTo(i*step, cy-y); });
    ctx.stroke();
    // Below (mirror)
    ctx.beginPath();
    pts.forEach((y, i) => { i === 0 ? ctx.moveTo(i*step, cy+y) : ctx.lineTo(i*step, cy+y); });
    ctx.stroke();

    ctx.globalCompositeOperation = 'source-over';

    // ── Beat: horizontal flash frame — the visual downbeat ────────────────
    // Pure horizontal — not radial, not circular. A flash frame like cinema.
    if (fx.beat > 0.28) {
      ctx.globalCompositeOperation = 'lighter';
      const intensity = (fx.beat - 0.28) * 0.72;
      const flashGrad = ctx.createLinearGradient(0, 0, 0, h);
      flashGrad.addColorStop(0,    'rgba(0,0,0,0)');
      flashGrad.addColorStop(0.40, `rgba(255,255,255,${intensity * 0.55})`);
      flashGrad.addColorStop(0.50, `rgba(255,255,255,${intensity})`);
      flashGrad.addColorStop(0.60, `rgba(255,255,255,${intensity * 0.55})`);
      flashGrad.addColorStop(1,    'rgba(0,0,0,0)');
      ctx.fillStyle = flashGrad;
      ctx.globalAlpha = 1;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }

    // ── Edge vignette — draws attention to the waveform ───────────────────
    const vig = ctx.createRadialGradient(cx, cy, h*0.04, cx, cy, Math.max(w,h)*0.65);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(1,0,7,0.90)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
  }

  // ── Particles ─────────────────────────────────────────────────────────────
  private drawParticles(w: number, h: number, t: number, fx: AudioFeatures, theme: number, settings: Settings): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    const [r1,g1,b1] = this.rgbArr(t*0.04,       theme);
    const [r2,g2,b2] = this.rgbArr(t*0.04 + .33,  theme);
    const [r3,g3,b3] = this.rgbArr(t*0.04 + .66,  theme);
    for (const p of this.particles) {
      p.y += (0.0007 + p.s*0.0013) * (1 + fx.high*5.5) * settings.particles;
      p.x += Math.sin(t*0.9+p.a*3)*0.00042 + Math.cos(t*1.1+p.a)*0.00028;
      if (fx.kick > 0.3) {
        const dx=p.x-.5, dy=p.y-.5, d=Math.sqrt(dx*dx+dy*dy)||.01;
        p.x += dx/d*.0028*fx.kick; p.y += dy/d*.0028*fx.kick;
      }
      if (p.y > 1.05) { p.y = -.02; p.x = Math.random(); }
      if (p.x < -.02) p.x = 1.02; if (p.x > 1.02) p.x = -.02;
      const depth = .2 + p.z*.8, x = p.x*w, y = p.y*h;
      let cr:number,cg:number,cb:number;
      if      (p.z<.33){cr=r1;cg=g1;cb=b1;}
      else if (p.z<.66){cr=r2;cg=g2;cb=b2;}
      else              {cr=r3;cg=g3;cb=b3;}
      const rad = (.7+p.s*2.8)*(1+fx.hat*2.8)*settings.particles*depth;
      ctx.fillStyle = `rgba(${cr|0},${cg|0},${cb|0},${(.05+p.s*.22)*depth*settings.particles})`;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 7); ctx.fill();
      if (p.s>.65 && settings.particles>.4) {
        ctx.fillStyle = `rgba(255,255,255,${p.s*.09*settings.particles*depth})`;
        ctx.beginPath(); ctx.arc(x, y, rad*.28, 0, 7); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ── Post FX ───────────────────────────────────────────────────────────────
  private drawPost(w: number, h: number, fx: AudioFeatures, settings: Settings): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'screen';
    const flash = (fx.kick*.26 + fx.snare*.14) * settings.glow;
    if (flash>.005){ctx.fillStyle=`rgba(255,255,255,${flash})`;ctx.fillRect(0,0,w,h);}
    if (settings.glow>.2 && (fx.beat>.1||fx.bass>.2)) {
      const bg = ctx.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,Math.min(w,h)*.55);
      bg.addColorStop(0,  `rgba(255,180,255,${(fx.beat*.09+fx.bass*.04)*settings.glow})`);
      bg.addColorStop(.45,`rgba(160,80,255,${(fx.beat*.04+fx.bass*.02)*settings.glow})`);
      bg.addColorStop(1,  'rgba(0,0,0,0)');
      ctx.fillStyle=bg; ctx.fillRect(0,0,w,h);
    }
    ctx.globalCompositeOperation='source-over';
    const vig=ctx.createRadialGradient(w*.5,h*.5,Math.min(w,h)*.12,w*.5,h*.5,Math.max(w,h)*.82);
    vig.addColorStop(0,'rgba(0,0,0,0)'); vig.addColorStop(.55,'rgba(0,0,0,0)');
    vig.addColorStop(1,`rgba(0,0,0,${.74+fx.bass*.10})`);
    ctx.fillStyle=vig; ctx.fillRect(0,0,w,h);
    if (settings.crt>0) {
      ctx.globalAlpha=settings.crt*.15; ctx.fillStyle='#000';
      const step=Math.max(2,Math.floor(h/360));
      for (let y=0;y<h;y+=step*2) ctx.fillRect(0,y,w,step);
      ctx.globalAlpha=settings.crt*.09;
      for (let i=0;i<550;i++){
        ctx.fillStyle=Math.random()>.5?'rgba(255,255,255,.9)':'rgba(0,0,0,.9)';
        ctx.fillRect(Math.random()*w,Math.random()*h,1.5,1.5);
      }
      ctx.globalAlpha=1;
    }
  }
}
