// The encoder is selected at runtime. Never put a .mp4 extension on WebM bytes.
function pickMime() {
  if (!window.MediaRecorder) return null;
  const types=[
    'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return types.find(type=>MediaRecorder.isTypeSupported(type)) || null;
}
export const availableExportType=()=>pickMime()?.startsWith('video/mp4')?'MP4':pickMime()?'WebM':null;
function getDimensions(aspect, shortEdge) {
  const x=Number(shortEdge);
  if(aspect==='16:9')return {width:Math.round(x*16/9),height:x};
  if(aspect==='1:1')return {width:x,height:x};
  return {width:x,height:Math.round(x*16/9)};
}
export class Exporter {
  constructor(audio,renderer) {
    this.audio=audio;this.renderer=renderer;this.isRecording=false;this.stop=null;
  }
  async record({aspect,size,duration,fps,onProgress,onStatus}) {
    if(this.isRecording)throw new Error('すでに書き出し中です。');
    if(!this.audio.file)throw new Error('音源を選択してください。');
    if(!this.renderer.canvas.captureStream)throw new Error('このブラウザはCanvasの録画に対応していません。');
    const mime=pickMime();
    if(!mime)throw new Error('このブラウザはMP4/WebMの録画に対応していません。');
    const dimensions=getDimensions(aspect,size);
    const maxTime=duration==='full'?this.audio.duration:Math.min(Number(duration),this.audio.duration);
    if(!Number.isFinite(maxTime)||maxTime<=0)throw new Error('音源の長さが取得できません。');
    let wakeLock=null,videoStream=null,recorder=null,interval=null,ended=null,segments=[];
    let cleaned=false;
    const clean=async()=>{
      if(cleaned)return;
      cleaned=true;
      if(interval!==null)clearInterval(interval);
      if(ended)this.audio.element.removeEventListener('ended',ended);
      this.audio.pause();
      if(videoStream)videoStream.getVideoTracks().forEach(track=>track.stop());
      this.renderer.setExportSize(null);
      this.renderer.setFPS(60);
      this.isRecording=false;
      this.stop=null;
      try{await wakeLock?.release();}catch{}
    };
    try{
      await this.audio.activate();
      this.audio.pause();
      this.audio.element.currentTime=0;
      this.renderer.setExportSize(dimensions);
      this.renderer.setFPS(Number(fps));
      // Camera and real-time WebAudio share one HTMLMediaElement timebase.
      videoStream=this.renderer.canvas.captureStream(Number(fps));
      const mix=new MediaStream([...videoStream.getVideoTracks(),...this.audio.recordingStream.getAudioTracks()]);
      recorder=new MediaRecorder(mix,{mimeType:mime,videoBitsPerSecond:Number(size)>=2160?35000000:Number(size)>=1080?15000000:8000000,audioBitsPerSecond:192000});
      recorder.ondataavailable=e=>{if(e.data.size>0)segments.push(e.data);};
      if(navigator.wakeLock?.request)try{wakeLock=await navigator.wakeLock.request('screen');}catch{}
      onStatus?.(`REC ${dimensions.width} × ${dimensions.height} · ${fps} FPS`);
      this.isRecording=true;
      const finish=new Promise((resolve,reject)=>{
        recorder.onerror=e=>reject(new Error(e.error?.message||'録画に失敗しました。'));
        recorder.onstop=()=>{
          if(!segments.length)return reject(new Error('動画データを記録できませんでした。'));
          const type=recorder.mimeType||mime;
          const extension=type.toLowerCase().includes('mp4')?'mp4':'webm';
          const blob=new Blob(segments,{type});
          const url=URL.createObjectURL(blob);
          const anchor=document.createElement('a');
          anchor.href=url;
          anchor.download=`LUMEN_NeonSpectrum_${aspect.replace(':','x')}_${size}p.${extension}`;
          document.body.append(anchor);anchor.click();anchor.remove();
          setTimeout(()=>URL.revokeObjectURL(url),60_000);
          resolve({bytes:blob.size,extension});
        };
      });
      recorder.start(1000);
      ended=()=>{if(recorder?.state==='recording')recorder.stop();};
      this.audio.element.addEventListener('ended',ended);
      this.stop=()=>{if(recorder?.state==='recording')recorder.stop();};
      await this.audio.play();
      interval=setInterval(()=>{
        const current=this.audio.element.currentTime;
        onProgress?.(Math.min(1,current/maxTime));
        if(current>=maxTime-.055&&recorder?.state==='recording')recorder.stop();
      },130);
      return await finish;
    } catch(error) {
      if(recorder?.state==='recording')recorder.stop();
      throw error;
    } finally { await clean(); }
  }
}
