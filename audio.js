const clamp = (x, min=0, max=1) => Math.max(min, Math.min(max, x));
export const formatTime = secs => {
  if (!Number.isFinite(secs)) return '00:00';
  const s=Math.floor(Math.max(0,secs));
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
};
const createAudioContext = () => new (window.AudioContext || window.webkitAudioContext)();

export class AudioEngine {
  constructor(element) {
    this.element=element;
    this.file=null;
    this.url=null;
    this.context=null;
    this.analyser=null;
    this.mediaOutput=null;
    this.monitor=null;
    this.muted=false;
    this.spectrum=new Float32Array(64);
    this.fft=new Uint8Array(1024);
    this.energyAvg=.15;
    this.lastBass=0;
    this.lastBeat=-10;
    this.beatPulse=0;
    this.beatTimes=[];
    this.bpm=null;
    this.curve=null;
    this.duration=0;
    this.lastSample=null;
  }
  async activate() {
    if (!this.context) {
      this.context=createAudioContext();
      this.analyser=this.context.createAnalyser();
      this.analyser.fftSize=2048;
      this.analyser.smoothingTimeConstant=.70;
      this.mediaSource=this.context.createMediaElementSource(this.element);
      this.monitor=this.context.createGain();
      this.mediaOutput=this.context.createMediaStreamDestination();
      this.mediaSource.connect(this.analyser);
      this.analyser.connect(this.monitor);
      this.monitor.connect(this.context.destination);
      this.analyser.connect(this.mediaOutput);
      this.monitor.gain.value=this.muted?0:1;
    }
    if (this.context.state!=='running') await this.context.resume();
  }
  async load(file) {
    if (!file || !file.size) throw new Error('空の音楽ファイルは読み込めません。');
    this.element.pause();
    this.element.removeAttribute('src');
    this.element.load();
    if (this.url) URL.revokeObjectURL(this.url);
    this.file=file;
    this.url=URL.createObjectURL(file);
    this.element.src=this.url;
    this.element.load();
    this.curve=null;
    this.duration=0;
    this.spectrum.fill(0);
    this.energyAvg=.15;
    this.beatTimes=[];
    this.bpm=null;
    this.lastBeat=-10;
    this.beatPulse=0;
    await new Promise((resolve, reject) => {
      if (this.element.readyState>=1) return resolve();
      const ok=()=>{cleanup();resolve();};
      const fail=()=>{cleanup();reject(new Error('この音源はブラウザで再生できません。'));};
      const cleanup=()=>{this.element.removeEventListener('loadedmetadata',ok);this.element.removeEventListener('error',fail);};
      this.element.addEventListener('loadedmetadata',ok,{once:true});
      this.element.addEventListener('error',fail,{once:true});
    });
    this.duration=this.element.duration;
  }
  remove() {
    this.element.pause();
    this.element.removeAttribute('src');
    this.element.load();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url=null;this.file=null;this.curve=null;this.duration=0;
    this.spectrum.fill(0);this.bpm=null;this.beatTimes=[];
  }
  async play() {
    if (!this.file) throw new Error('音楽ファイルを選択してください。');
    await this.activate();
    await this.element.play();
  }
  pause() { this.element.pause(); }
  setMute(value) {
    this.muted=Boolean(value);
    if (this.monitor) this.monitor.gain.value=this.muted?0:1;
  }
  setCurve(curve) { this.curve=curve; }
  get recordingStream() { return this.mediaOutput?.stream || null; }
  snapshot(dt, clock) {
    this.beatPulse=Math.max(0,this.beatPulse-dt*2.4);
    const playing=this.file && this.analyser && !this.element.paused;
    if (!playing) {
      // Idle motion is intentional ambient art; it is not represented as music analysis.
      for (let i=0;i<64;i++) {
        const gentle=.12+.05*Math.sin(clock*.8+i*.23)+.035*Math.sin(clock*1.7-i*.13);
        this.spectrum[i]=clamp(gentle,0,.26);
      }
      return { bass: .08, mid:.07, treble:.06, beat:this.beatPulse*.3, energy:.25,
        loudness:.09, bands:this.spectrum, bpm:this.bpm, playing:false };
    }
    this.analyser.getByteFrequencyData(this.fft);
    const binHz=this.context.sampleRate/this.analyser.fftSize;
    let bass=0,mid=0,treble=0,nb=0,nm=0,nt=0,sum=0;
    for (let i=0;i<64;i++) {
      const f1=30*Math.pow(18000/30,i/64);
      const f2=30*Math.pow(18000/30,(i+1)/64);
      const start=Math.max(1,Math.floor(f1/binHz));
      const end=Math.min(this.fft.length-1,Math.max(start,Math.ceil(f2/binHz)));
      let value=0,count=0;
      for(let k=start;k<=end;k++){value+=this.fft[k];count++;}
      const v=clamp(Math.pow((value/Math.max(1,count))/255,.8)*1.27);
      this.spectrum[i]+=(v-this.spectrum[i])*.44;
      sum+=v;
      if(f1<160){bass+=v;nb++;}
      else if(f1<2400){mid+=v;nm++;}
      else {treble+=v;nt++;}
    }
    bass=clamp(bass/Math.max(1,nb)*1.35);
    mid=clamp(mid/Math.max(1,nm)*1.17);
    treble=clamp(treble/Math.max(1,nt)*1.16);
    const loudness=clamp(sum/64*1.36);
    const time=this.element.currentTime;
    const movingAvg=this.energyAvg;
    // Adaptive threshold and cooldown reduce false double triggering.
    const onset=bass>Math.max(.16,movingAvg*1.27)&&bass>this.lastBass+.045;
    if(onset && time-this.lastBeat>.23) {
      if(this.lastBeat>=0 && time-this.lastBeat<1.25 && time-this.lastBeat>.27) {
        this.beatTimes.push(time-this.lastBeat);
        if(this.beatTimes.length>16)this.beatTimes.shift();
      }
      this.lastBeat=time;
      this.beatPulse=1;
      if(this.beatTimes.length>=4) {
        const sorted=[...this.beatTimes].sort((a,b)=>a-b);
        const median=sorted[Math.floor(sorted.length/2)];
        let bpm=60/median;
        while(bpm<85)bpm*=2;
        while(bpm>180)bpm/=2;
        this.bpm=Math.round(bpm);
      }
    }
    this.energyAvg+=dt*Math.min(2,Math.max(.15,1.25))* (bass-this.energyAvg);
    this.lastBass=bass;
    const structure=this._trackEnergy(time);
    return {bass,mid,treble,loudness,energy:structure,beat:this.beatPulse,bpm:this.bpm,bands:this.spectrum,playing:true};
  }
  _trackEnergy(time) {
    if (!this.curve?.length || !this.duration) return .35;
    const idx=clamp(time/this.duration)*(this.curve.length-1);
    const i=Math.floor(idx), f=idx-i;
    return (this.curve[i]??.35)*(1-f)+(this.curve[i+1]??.35)*f;
  }
}
