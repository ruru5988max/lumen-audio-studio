import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatTime } from '../src/audio.js';
import { visualFragment, fullscreenVertex, particlesVertex, particlesFragment } from '../src/shaders.js';
assert.equal(formatTime(61.9), '01:01');
assert.equal(formatTime(0), '00:00');
assert.equal(formatTime(NaN), '00:00');
for(const shader of [visualFragment, fullscreenVertex, particlesVertex, particlesFragment]) {
  assert.ok(shader.startsWith('#version 300 es'));
  assert.ok(shader.includes('void main()'));
}
assert.ok(visualFragment.includes('uniform float uSpectrum[64]'));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
for(const id of ['visualizer','file-input','play','render-size','render-duration','export-button','waveform'])assert.ok(html.includes(`id="${id}"`));
console.log('LUMEN static smoke tests passed.');
