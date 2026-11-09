// Optional ahead-of-time overview for the timeline. The playback FFT remains real-time.
// To protect iPhones, huge compressed files skip this step instead of consuming RAM.
export async function analyzeTrack(file) {
  if (file.size > 40 * 1024 * 1024) return null;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return null;
  const context=new Context();
  try {
    const data=await file.arrayBuffer();
    const decoded=await context.decodeAudioData(data);
    if (decoded.duration>900) return null;
    const left=decoded.getChannelData(0);
    const right=decoded.numberOfChannels>1?decoded.getChannelData(1):left;
    const buckets=360;
    const envelope=new Float32Array(buckets);
    for(let i=0;i<buckets;i++){
      const start=Math.floor(left.length*i/buckets);
      const end=Math.floor(left.length*(i+1)/buckets);
      const stride=Math.max(1,Math.floor((end-start)/800));
      let energy=0,count=0;
      for(let j=start;j<end;j+=stride){const x=(left[j]+right[j])*.5;energy+=x*x;count++;}
      envelope[i]=Math.sqrt(energy/Math.max(1,count));
    }
    const sorted=Array.from(envelope).sort((a,b)=>a-b);
    const floor=sorted[Math.floor(sorted.length*.1)]||0;
    const ceiling=sorted[Math.floor(sorted.length*.97)]||.2;
    const spread=Math.max(.025,ceiling-floor);
    const curve=Array.from(envelope,v=>Math.max(.04,Math.min(1,(v-floor)/spread)));
    // A little temporal smoothing avoids abrupt jumps in the generative mood.
    const smooth=curve.map((_,i)=>{
      let sum=0,den=0;
      for(let k=-3;k<=3;k++){const id=Math.min(curve.length-1,Math.max(0,i+k));const weight=4-Math.abs(k);sum+=curve[id]*weight;den+=weight;}
      return sum/den;
    });
    return {waveform:curve,curve:smooth,duration:decoded.duration};
  } finally { await context.close().catch(()=>{}); }
}
