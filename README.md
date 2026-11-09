# LUMEN — Audio Visual Studio

A high-fidelity, audio-reactive visual studio that runs in your browser. Upload a song and the procedural neon composition responds to kick/bass, mid frequencies, treble, and detected onsets in real time. No music files or analytics are uploaded to a server.

![LUMEN badge](assets/favicon.svg)

## Current version: 1.0 — Neon Spectrum

- **WebGL 2 / GLSL 300 es**: animated liquid-like core, 64-band circular spectrum, orbital rings, glowing shockwaves, and 2,100 GPU particles. No copyrighted footage or templates.
- **Live Web Audio FFT**: adaptive bass-onset pulse detection, separate BASS/MID/TREBLE, tentative BPM estimate after multiple intervals.
- **Track overview**: optional local decode to produce a real waveform/energy envelope (files over 40 MB or 15 minutes skip this pass; live FFT still works).
- **Controls**: 3 cinematic color schemes, intensity, glow, particle density, aspect ratios 9:16 / 16:9 / 1:1.
- **Audio + video export**: browser-native MediaRecorder. Tests MP4 support first and otherwise uses WebM. Supports 15/30/60 seconds/full track and HD, FHD, optional 4K (only on sufficiently capable devices). 30/60 fps are targets, not guaranteed fixed-rate offline encoding.
- **Phone-friendly UI**: works in modern browsers with WebGL2, Web Audio, MediaRecorder, and `canvas.captureStream`. Export support differs among browsers; real-time playback has broader support.
- **No server or npm dependencies**: static HTML, CSS, and JS modules. Upload directly to GitHub Pages.

## Run locally

```sh
cd lumen-audio-studio
python3 -m http.server 4173
# open http://localhost:4173
```

Or use `npx serve .` if you already have Node.js. Because it uses ES modules, don't open `index.html` with a `file://` URL.

## Deploy to GitHub Pages

1. On GitHub, create a new **public** repository named `lumen-audio-studio` (or use a private repository if your plan supports private Pages).
2. Extract and upload **the contents** of this directory, including `index.html`, `assets/`, `src/`, `.nojekyll`, `README.md`.
3. In **Settings → Pages → Build and deployment**, select **Deploy from a branch**, `main`, `/ (root)`.
4. Visit `https://YOUR_USERNAME.github.io/lumen-audio-studio/` once Pages reports deployment success.

This project does not include any GitHub authentication tokens and does not require a backend.

## Audio and recording requirements

- Upload a local audio file and press **Play** to unlock the Web Audio graph (required by mobile autoplay policies).
- The visualizer and the waveform analyzer run **locally**. Sample rates and source encoding depend on browser decode support.
- To export, choose aspect, resolution, length, and fps. Keep the tab visible and screen awake until done. The recorder captures the audio graph and the WebGL canvas into a single file.
- `MediaRecorder.isTypeSupported` determines the real MIME/container. The code **never** renames WebM data with `.mp4`.
- If MP4 export isn't available in your current browser, use WebM or convert it externally with FFmpeg:

  ```sh
  ffmpeg -i output.webm -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -c:a aac -b:a 192k output.mp4
  ```

- Browser exports are **real-time captures**. Heavy 4K scenes can drop frames. For deterministic 4K/60fps production rendering, add a frame-stepped server renderer and FFmpeg pipeline in V2.
- Track-analysis labels are deliberately avoided; a peak is not proof of a chorus. BPM detection is heuristic and can be wrong on syncopated or unusual recordings.

## Architecture

```text
index.html                   Layout, mobile-first controls, export settings
assets/style.css             UI, dark studio palette, responsive layout
src/main.js                  UI state, timeline, file loading, UI controls
src/audio.js                 Web Audio analysis, onset detection, audio capture graph
src/track-analysis.js        Optional full-track local waveform/energy overview
src/renderer.js              WebGL2 lifecycle, uniform binding, resolution, GPU draws
src/shaders.js               Procedural core / circular spectrum / particle GLSL
src/exporter.js              Real-time MP4-or-WebM-with-audio export
```

## Performance

Rendering is a single full-screen procedural shader plus one additive GPU point pass, rather than a large dynamic 3D scene graph. Preview resolution scales with the display and is capped at 1,600 pixels on the longest edge. Export resolution is independent of preview resolution. To keep phones responsive, start with 720p/30 fps and lower particle density.

## Development priorities

1. Validate visually and functionally on desktop Chrome and iOS Safari hardware.
2. Add deterministic frame-by-frame offline renderer for guaranteed high-quality MP4.
3. Add smarter local section segmentation and MIDI/stem-based effects (optional).
4. Expand to Cosmic Reaction and Liquid Motion presets after Neon Spectrum quality passes acceptance tests.

See [docs/QUALITY_BAR.md](docs/QUALITY_BAR.md) for acceptance criteria and known limitations.
