import { AudioEngine, formatTime } from './audio.js';
import { VisualRenderer } from './renderer.js';
import { analyzeTrack } from './track-analysis.js';
import { Exporter, availableExportType } from './exporter.js';

const $=id=>document.getElementById(id);
const audio=new AudioEngine($('audio'));
let renderer,exporter,analysis=null,loadingId=0,recording=false;
let toastHandle;
const toast=message=>{
  const el=$('stage-toast');el.textContent=message;el.classList.add('show');
  clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.classList.remove('show'),4000);
};
function status(message){$('player-status').textContent=message;}
function fileLabel(file){return file.name.replace(/\.(mp3|wav|m4a|aac|ogg|flac)$/i,'');}

try {
  renderer=new VisualRenderer($('visualizer'),$('stage-frame'),(dt,t)=>audio.snapshot(dt,t),updateMeters);
  exporter=new Exporter(audio,renderer);
  $('system-status').textContent='WEBGL 2 READY';
} catch(error) {
  $('system-status').textContent='WEBGL UNAVAILABLE';
  $('system-status').style.color='#ff9dbe';
  toast(error.message);
  console.error(error);
}
function updateMeters(s) {
  for(const [key,value] of [['bass',s.bass],['mid',s.mid],['treble',s.treble]]) {
    const amount=s.playing?Math.round(Math.min(1,value)*100):0;
    $(`${key}-meter`).style.width=`${amount}%`;
    $(`${key}-value`).textContent=`${amount}%`;
  }
  $('beat-pip').classList.toggle('active',s.playing&&s.beat>.7);
  $('bpm-value').textContent=s.bpm?`${s.bpm} BPM`:'— BPM';
  $('live-label').textContent=recording?'RENDERING':s.playing?'AUDIO REACTIVE':'DEMO MOTION';
  if(audio.file) {
    $('current-time').textContent=formatTime(audio.element.currentTime);
    $('duration').textContent=formatTime(audio.element.duration);
    const percent=audio.element.duration?audio.element.currentTime/audio.element.duration:0;
    $('seek').value=String(Math.round(percent*1000));
    $('timeline-played').style.width=`${percent*100}%`;
  }
}
function applyUIHasFile(hasFile) {
  $('play').disabled=!hasFile||recording;
  $('export-button').disabled=!hasFile||!renderer;
  $('seek').disabled=!hasFile||recording;
  $('file-info').classList.toggle('hidden',!hasFile);
  $('dropzone').classList.toggle('hidden',hasFile);
  $('play-symbol').innerHTML='<path d="M8 5.5l10.5 6.5L8 18.5v-13z"/>';
  $('play').setAttribute('aria-label','再生');
  if(!hasFile){$('player-title').textContent='音源を読み込むと同期します';$('current-time').textContent='00:00';$('duration').textContent='00:00';$('timeline-played').style.width='0';status('READY FOR AUDIO');}
  drawWaveform();
}
async function loadFile(file) {
  if(recording) return;
  const current=++loadingId;
  try {
    if(!file.type.startsWith('audio/')&&!/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name))throw new Error('音楽ファイルを選択してください。');
    status('LOADING AUDIO');
    await audio.load(file);
    if(current!==loadingId)return;
    analysis=null;
    $('file-input').value='';
    $('track-name').textContent=file.name;
    $('player-title').textContent=fileLabel(file);
    $('track-meta').textContent=`${formatTime(audio.duration)} · ${(file.size/1024/1024).toFixed(1)} MB`;
    applyUIHasFile(true);
    status('AUDIO LOADED');
    toast('音楽を読み込みました。再生して映像を同期してください。');
    // Optional overview analysis never blocks playback.
    analyzeTrack(file).then(result=>{
      if(current!==loadingId||audio.file!==file)return;
      analysis=result;
      audio.setCurve(result?.curve||null);
      drawWaveform();
      if(result)status('ANALYSIS READY');
    }).catch(error=>{if(current===loadingId){console.warn('Waveform analysis skipped',error);status('REALTIME ANALYSIS');}});
  } catch(error) { if(current===loadingId){status('LOAD FAILED');toast(error.message);} }
}
$('file-input').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)loadFile(file);});
const drop=$('dropzone');
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragging');});
drop.addEventListener('dragleave',()=>drop.classList.remove('dragging'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('dragging');if(e.dataTransfer.files?.[0])loadFile(e.dataTransfer.files[0]);});
drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('file-input').click();}});
$('remove-file').addEventListener('click',()=>{loadingId++;audio.remove();analysis=null;applyUIHasFile(false);});
$('play').addEventListener('click',async()=>{
  try{
    if(audio.element.paused){await audio.play();status('PLAYING');}
    else{audio.pause();status('PAUSED');}
  }catch(error){toast(error.message);}
  syncPlay();
});
function syncPlay(){
  const playing=!audio.element.paused;
  $('play-symbol').innerHTML=playing?'<path d="M7 5h4v14H7zm6 0h4v14h-4z"/>':'<path d="M8 5.5l10.5 6.5L8 18.5v-13z"/>';
  $('play').setAttribute('aria-label',playing?'一時停止':'再生');
}
audio.element.addEventListener('play',syncPlay);
audio.element.addEventListener('pause',syncPlay);
audio.element.addEventListener('ended',()=>{syncPlay();if(!recording)status('FINISHED');});
$('restart').addEventListener('click',()=>{if(audio.file&&!recording)audio.element.currentTime=0;});
$('seek').addEventListener('input',e=>{if(!recording&&audio.file&&audio.duration)audio.element.currentTime=audio.duration*Number(e.target.value)/1000;});
$('mute').addEventListener('click',()=>{
  audio.setMute(!audio.muted);
  $('mute').style.color=audio.muted?'#e75d9e':'';
  $('mute').setAttribute('aria-label',audio.muted?'ミュートを解除':'ミュート');
});
for(const button of document.querySelectorAll('[data-palette]'))button.addEventListener('click',()=>{
  document.querySelectorAll('[data-palette]').forEach(el=>{el.classList.toggle('selected',el===button);el.setAttribute('aria-checked',String(el===button));});
  renderer?.setOptions({palette:button.dataset.palette});
});
for(const [id,key] of [['intensity','intensity'],['glow','glow'],['particles','particles']]){
  $(id).addEventListener('input',e=>{
    const value=Number(e.target.value);
    $(`${id}-value`).textContent=`${value}%`;
    renderer?.setOptions({[key]:value/100});
  });
}
for(const button of document.querySelectorAll('[data-aspect]'))button.addEventListener('click',()=>{
  const aspect=button.dataset.aspect;
  document.querySelectorAll('[data-aspect]').forEach(el=>{el.classList.toggle('selected',el===button);el.setAttribute('aria-pressed',String(el===button));});
  $('stage-frame').className=`stage-frame ratio-${aspect==='16:9'?'landscape':aspect==='1:1'?'square':'portrait'}`;
  renderer?.setOptions({aspect});
  requestAnimationFrame(()=>renderer?.resize());
});

function drawWaveform(){
  const canvas=$('waveform'),rect=canvas.getBoundingClientRect();
  if(!rect.width)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  canvas.width=Math.floor(rect.width*dpr);canvas.height=Math.floor(rect.height*dpr);
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
  const data=analysis?.waveform;
  const columns=Math.floor(rect.width/3),height=canvas.height;
  for(let i=0;i<columns;i++){
    const v=data?.[Math.floor(i/columns*data.length)]??(.16+Math.abs(Math.sin(i*.53)*Math.cos(i*.17))*.18);
    const amplitude=(.17+v*.8)*height*.46;
    const center=height*.5;
    const gradient=ctx.createLinearGradient(0,center-amplitude,0,center+amplitude);
    gradient.addColorStop(0,'#ac67b0');gradient.addColorStop(.5,'#653a88');gradient.addColorStop(1,'#328ca6');
    ctx.fillStyle=gradient;
    ctx.fillRect(i*3*dpr,center-amplitude,Math.max(1,1.5*dpr),amplitude*2);
  }
}
new ResizeObserver(drawWaveform).observe($('waveform'));
drawWaveform();

$('export-note').textContent=availableExportType()?`書き出し形式: ${availableExportType()}（ブラウザ依存）。リアルタイム録画のため、端末負荷に影響されます。`:'このブラウザでは動画の書き出しに対応していません。';
$('export-button').addEventListener('click',async()=>{
  if(recording){exporter?.stop?.();return;}
  if(!exporter||!audio.file)return;
  recording=true;
  $('export-label').textContent='STOP RECORDING';
  $('export-button').disabled=false;
  $('play').disabled=true;
  $('seek').disabled=true;
  $('export-progress').classList.remove('hidden');
  $('export-progress-bar').style.width='0%';
  try {
    const result=await exporter.record({
      aspect:renderer.settings.aspect,
      size:Number($('render-size').value),
      duration:$('render-duration').value,
      fps:Number($('render-fps').value),
      onProgress:x=>{$('export-progress-bar').style.width=`${Math.round(x*100)}%`;},
      onStatus:status
    });
    toast(`動画を保存しました: ${result.extension.toUpperCase()} · ${(result.bytes/1024/1024).toFixed(1)} MB`);
    status('EXPORT COMPLETE');
  }catch(error){toast(error.message);status('EXPORT FAILED');console.error(error);}
  finally{
    recording=false;
    $('export-label').textContent='EXPORT VIDEO';
    $('export-progress').classList.add('hidden');
    applyUIHasFile(Boolean(audio.file));
  }
});

const dialog=$('help-dialog');
$('help-button').addEventListener('click',()=>dialog.showModal());
$('help-close').addEventListener('click',()=>dialog.close());
$('help-ok').addEventListener('click',()=>dialog.close());
applyUIHasFile(false);
