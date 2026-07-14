import { AudioFeatures, Settings, THEMES } from '../types';
import { VERT_SRC, FRAG_SRC } from '../shaders/voidPlasma';

export class VoidPlasmaGL {
  private glCanvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private locs: Record<string, WebGLUniformLocation | null> = {};

  constructor() {
    this.glCanvas = document.createElement('canvas');
    const gl = this.glCanvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('WebGL2 not supported');
    this.gl = gl;
    this.program = this.buildProgram();
    this.vao = this.buildQuad();
    this.cacheUniforms();
  }

  private compileShader(type: number, src: string): WebGLShader {
    const gl = this.gl;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(`Shader compile error:\n${log}`);
    }
    return s;
  }

  private buildProgram(): WebGLProgram {
    const gl = this.gl;
    const vs = this.compileShader(gl.VERTEX_SHADER, VERT_SRC);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAG_SRC);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link error:\n${gl.getProgramInfoLog(prog)}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  private buildQuad(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    const buf = gl.createBuffer()!;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  private cacheUniforms(): void {
    const names = [
      'u_res', 'u_time',
      'u_bass', 'u_mid', 'u_high', 'u_vol',
      'u_kick', 'u_snare', 'u_hat', 'u_beat', 'u_beatPhase',
      'u_intensity', 'u_speed', 'u_glow', 'u_complexity', 'u_particles',
      'u_c1', 'u_c2', 'u_c3',
    ];
    for (const n of names) {
      this.locs[n] = this.gl.getUniformLocation(this.program, n);
    }
  }

  private hexToNorm(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ];
  }

  resize(w: number, h: number): void {
    this.glCanvas.width  = w;
    this.glCanvas.height = h;
    this.gl.viewport(0, 0, w, h);
  }

  render(
    targetCanvas: HTMLCanvasElement,
    fx: AudioFeatures,
    rawTime: number,
    settings: Settings,
    theme: number,
    beatPhase: number,
  ): void {
    const w = targetCanvas.width;
    const h = targetCanvas.height;

    if (this.glCanvas.width !== w || this.glCanvas.height !== h) {
      this.resize(w, h);
    }

    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    const L = this.locs;
    gl.uniform2f(L.u_res!,       w, h);
    gl.uniform1f(L.u_time!,      rawTime);
    gl.uniform1f(L.u_bass!,      fx.bass);
    gl.uniform1f(L.u_mid!,       fx.mid);
    gl.uniform1f(L.u_high!,      fx.high);
    gl.uniform1f(L.u_vol!,       fx.vol);
    gl.uniform1f(L.u_kick!,      fx.kick);
    gl.uniform1f(L.u_snare!,     fx.snare);
    gl.uniform1f(L.u_hat!,       fx.hat);
    gl.uniform1f(L.u_beat!,      fx.beat);
    gl.uniform1f(L.u_beatPhase!, beatPhase);
    gl.uniform1f(L.u_intensity!, settings.intensity);
    gl.uniform1f(L.u_speed!,     settings.speed);
    gl.uniform1f(L.u_glow!,      settings.glow);
    gl.uniform1f(L.u_complexity!,settings.complexity);
    gl.uniform1f(L.u_particles!, settings.particles);

    const [c1r, c1g, c1b] = this.hexToNorm(THEMES[theme][0]);
    const [c2r, c2g, c2b] = this.hexToNorm(THEMES[theme][1]);
    const [c3r, c3g, c3b] = this.hexToNorm(THEMES[theme][2]);
    gl.uniform3f(L.u_c1!, c1r, c1g, c1b);
    gl.uniform3f(L.u_c2!, c2r, c2g, c2b);
    gl.uniform3f(L.u_c3!, c3r, c3g, c3b);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);

    // Blit GL output onto the main 2D canvas (used for recording)
    const ctx2d = targetCanvas.getContext('2d')!;
    ctx2d.setTransform(1, 0, 0, 1, 0, 0);
    ctx2d.drawImage(this.glCanvas, 0, 0, w, h);
  }
}
