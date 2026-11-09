import { fullscreenVertex, visualFragment, particlesVertex, particlesFragment } from './shaders.js';

function compile(gl, kind, code) {
  const shader = gl.createShader(kind);
  gl.shaderSource(shader, code);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`WebGL shader: ${message}`);
  }
  return shader;
}
function program(gl, vsSource, fsSource) {
  const p = gl.createProgram();
  const vs = compile(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSource);
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error(`WebGL link: ${message}`);
  }
  return p;
}

const COLORS = {
  aurora: [[1, .14, .61], [.20, .78, 1], [.41, .25, .95]],
  ember:  [[1, .29, .16], [1, .69, .20], [.78, .15, .65]],
  glacier:[[.10, .59, 1], [.42, .97, 1], [.49, .38, 1]],
};

export class VisualRenderer {
  constructor(canvas, frame, getAudio, onFrame) {
    this.canvas = canvas;
    this.frame = frame;
    this.getAudio = getAudio;
    this.onFrame = onFrame;
    this.settings = { palette: 'aurora', intensity: .75, glow: .8, particles: .7, aspect: '9:16', movement: 1 };
    this.exportSize = null;
    this.lastFrame = performance.now();
    this.elapsed = 0;
    this.lastUpdate = 0;
    this.fps = 60;
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('このブラウザは WebGL 2.0 に対応していません。');
    this.gl = gl;
    this.visual = program(gl, fullscreenVertex, visualFragment);
    this.particles = program(gl, particlesVertex, particlesFragment);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.uniforms = new Map();
    for (const [name, p] of [['visual', this.visual], ['particles', this.particles]]) {
      const locations = {};
      for (const key of ['uResolution','uTime','uBass','uMid','uTreble','uBeat','uLoudness','uIntensity','uGlow','uEnergy','uMovement','uColorA','uColorB','uColorC','uSpectrum[0]','uDensity']) {
        locations[key] = gl.getUniformLocation(p, key);
      }
      this.uniforms.set(name, locations);
    }
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(frame);
    this.resize();
    this._tick = this._tick.bind(this);
    this.raf = requestAnimationFrame(this._tick);
  }

  setOptions(options) {
    Object.assign(this.settings, options);
    if ('aspect' in options) this.resize();
  }
  setFPS(fps) { this.fps = fps; }
  setExportSize(size) { this.exportSize = size; this.resize(); }
  resize() {
    if (!this.gl) return;
    let w, h;
    if (this.exportSize) {
      ({ width: w, height: h } = this.exportSize);
    } else {
      const rect = this.frame.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.8);
      w = Math.round(Math.max(rect.width, 200) * dpr);
      h = Math.round(Math.max(rect.height, 200) * dpr);
      const max = 1600;
      const factor = Math.min(1, max / Math.max(w, h));
      w = Math.round(w * factor); h = Math.round(h * factor);
    }
    w = Math.max(64, w); h = Math.max(64, h);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  }
  _uniforms(p, key, a) {
    const gl=this.gl, loc=this.uniforms.get(key);
    gl.useProgram(p);
    gl.uniform2f(loc.uResolution, this.canvas.width, this.canvas.height);
    gl.uniform1f(loc.uTime, this.elapsed);
    gl.uniform1f(loc.uBass, a.bass);
    gl.uniform1f(loc.uMid, a.mid);
    gl.uniform1f(loc.uTreble, a.treble);
    gl.uniform1f(loc.uBeat, a.beat);
    gl.uniform1f(loc.uLoudness, a.loudness);
    gl.uniform1f(loc.uIntensity, this.settings.intensity);
    gl.uniform1f(loc.uGlow, this.settings.glow);
    gl.uniform1f(loc.uEnergy, a.energy);
    gl.uniform1f(loc.uMovement, this.settings.movement);
    const [c1,c2,c3] = COLORS[this.settings.palette] || COLORS.aurora;
    gl.uniform3fv(loc.uColorA, c1);
    gl.uniform3fv(loc.uColorB, c2);
    if (loc.uColorC !== null) gl.uniform3fv(loc.uColorC, c3);
    if (loc['uSpectrum[0]'] !== null) gl.uniform1fv(loc['uSpectrum[0]'], a.bands);
    if (loc.uDensity !== null) gl.uniform1f(loc.uDensity, this.settings.particles);
  }
  _tick(now) {
    this.raf = requestAnimationFrame(this._tick);
    if (document.hidden) return;
    const delta = now - this.lastFrame;
    if (delta < (1000 / this.fps - 1)) return;
    this.lastFrame = now;
    this.elapsed += Math.min(delta, 80) / 1000;
    const a = this.getAudio(Math.min(delta, 80) / 1000, this.elapsed);
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);
    gl.useProgram(this.visual);
    this._uniforms(this.visual, 'visual', a);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (this.settings.particles > .02) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      this._uniforms(this.particles, 'particles', a);
      gl.drawArrays(gl.POINTS, 0, 2100);
      gl.disable(gl.BLEND);
    }
    if (now - this.lastUpdate > 100) {
      this.lastUpdate = now;
      this.onFrame(a);
    }
  }
  dispose() {
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.gl.deleteProgram(this.visual);
    this.gl.deleteProgram(this.particles);
    this.gl.deleteVertexArray(this.vao);
  }
}
