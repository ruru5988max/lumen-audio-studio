// Self-contained WebGL 2 shaders. No presets, footage, or textures are downloaded.
export const fullscreenVertex = `#version 300 es
precision highp float;
const vec2 P[3] = vec2[3](vec2(-1.,-1.), vec2(3.,-1.), vec2(-1.,3.));
out vec2 vUV;
void main(){vec2 p=P[gl_VertexID];vUV=p*.5+.5;gl_Position=vec4(p,0.,1.);}
`;

export const visualFragment = `#version 300 es
precision highp float;
#define PI 3.141592653589793
#define TAU 6.283185307179586
in vec2 vUV;
out vec4 fragColor;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uBeat;
uniform float uLoudness;
uniform float uIntensity;
uniform float uGlow;
uniform float uEnergy;
uniform float uMovement;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uSpectrum[64];

float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash21(i),hash21(i+vec2(1,0)),f.x),mix(hash21(i+vec2(0,1)),hash21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(8.2,3.7);a*=.5;}return v;}
float stroke(float dist,float thick){return 1.-smoothstep(thick,thick+fwidth(dist)*1.5,abs(dist));}
float glow(float d,float power){return exp(-max(0.,abs(d))*power);}
vec3 palette(float t){return mix(uColorA,uColorB,clamp(t,0.,1.));}
void main(){
  vec2 resolution = max(uResolution,vec2(1.));
  float unit=min(resolution.x,resolution.y);
  vec2 p=(gl_FragCoord.xy-.5*resolution)/unit;
  float t=uTime;
  float audio=clamp(uLoudness*uIntensity,0.,2.);
  float energy=clamp(uEnergy,0.,1.);
  // Slow camera drift is damped to protect the composition and keep UI-free export stable.
  p.x += .015*sin(t*.17)*uMovement*(.65+energy*.65);
  p.y += .012*cos(t*.13)*uMovement*(.65+energy*.65);
  vec2 q=p*2.;
  float r=length(p),ang=atan(p.y,p.x);
  float n=fbm(q*1.75+vec2(t*.026,-t*.019));
  float cloud=fbm(q*3.9+vec2(-t*.065,t*.035));
  float violet=(1.-smoothstep(.0,1.65,length(q)))*(.35+cloud*.65);
  vec3 col=vec3(.006,.008,.025);
  col+=mix(uColorA,uColorB,.5)*violet*.16;
  col+=uColorC*pow(max(0.,n-.38),2.6)*.16;
  // Deep-space dust, projected as tiny points on two spatial layers.
  for(int j=0;j<2;j++){
    float cell=j==0?67.:111.;
    vec2 st=q*cell+vec2(float(j)*83.,float(j)*39.);
    vec2 id=floor(st),local=fract(st)-.5;
    float seed=hash21(id);
    vec2 center=vec2(hash21(id+17.3),hash21(id+57.9))-.5;
    float dd=length(local-center*.76);
    float star=1.-smoothstep(.005,.023,dd);
    float twinkle=.68+.32*sin(t*(.6+seed*2.)+seed*45.);
    col+=mix(uColorB,vec3(.92,.96,1.),seed)*star*step(.981,seed)*twinkle*.42;
  }
  // Faint, concentric, offset orbital paths around the heart of the visual.
  vec2 tilt1=vec2(p.x, p.y*.76+p.x*.31);
  vec2 tilt2=vec2(p.x*.87-p.y*.18,p.y*.86+p.x*.12);
  float orbit1=length(tilt1)-.34;
  float orbit2=length(tilt2)-.302;
  col+=uColorA*stroke(orbit1,.0008)*.24;
  col+=uColorB*stroke(orbit2,.0013)*.20;
  col+=uColorA*glow(orbit1,25.)*.035*uGlow;
  col+=uColorB*glow(orbit2,30.)*.035*uGlow;
  // Neon spectrum: each angular sector samples its own frequency band.
  float wrapped=fract((ang+PI)/TAU);
  float sector=wrapped*64.;
  int bandIndex=clamp(int(floor(sector)),0,63);
  float b=clamp(uSpectrum[bandIndex],0.,1.);
  // Add a subtle musical envelope to the frequency spectrum.
  float radialStart=.352;
  float radialEnd=radialStart+.028+(.035+.135*b)*uIntensity*(.78+energy*.36);
  float edge=fract(sector);
  float slit=smoothstep(.12,.21,edge)*(1.-smoothstep(.78,.88,edge));
  float bar=(smoothstep(radialStart-.006,radialStart+.002,r)-smoothstep(radialEnd-.006,radialEnd+.004,r))*slit;
  vec3 barColor=palette(.5+.48*sin(ang*1.7+t*.16));
  col+=barColor*bar*(.87+audio*.9);
  // Analytic glow eliminates the need for multiple expensive blur passes on phones.
  float nearBar=smoothstep(radialStart-.08,radialStart+.01,r)*(1.-smoothstep(radialEnd-.025,radialEnd+.12,r));
  col+=barColor*nearBar*slit*.16*uGlow*(.6+b*.7);
  float innerRing=stroke(r-.337,.0018);
  float outerRing=stroke(r-.352,.0018);
  col+=uColorA*innerRing*.48+uColorB*outerRing*.58;
  col+=palette(.5+.5*sin(ang+t*.22))*(glow(r-.337,45.)*.065+glow(r-.352,37.)*.07)*uGlow;
  // Liquid iridescent sphere. Procedural plasma lines rotate independently.
  float coreRadius=.226+sin(ang*7.+t*.85)*.0018+.009*audio;
  float coreMask=1.-smoothstep(coreRadius-.003,coreRadius+.004,r);
  float depth=sqrt(max(.0,1.-pow(r/max(.001,coreRadius),2.)));
  float spin=ang*2.8 + t*(.22+uMid*.20) + fbm(p*7.+vec2(t*.11,-t*.08))*1.35;
  float swirls=sin(spin*3.3-r*55.+noise(p*15.+t*.21)*3.1);
  float brightFilaments=pow(max(0.,swirls),7.)*.8;
  float secondary=pow(max(0.,sin(spin*5.4+r*44.)),14.)*.47;
  float plasma=fbm(vec2(ang*3.0+t*.12, r*15.-t*.26));
  vec3 inside=mix(vec3(.018,.018,.055),uColorA*.26,clamp(plasma*.9+.17,0.,1.));
  inside+=uColorB*(brightFilaments*.55+secondary*.5)*(.28+.65*depth);
  inside+=uColorC*pow(max(0.,plasma-.46),2.2)*.65;
  float fresnel=pow(1.-depth,2.5);
  inside+=mix(uColorA,uColorB,.5+.5*sin(ang*2.2+t*.37))*fresnel*(.45+.45*audio);
  // Central silhouette, giving the spherical form dimensional depth.
  inside*=.58+.4*smoothstep(-.35,.8,p.y/coreRadius)+depth*.12;
  col=mix(col,inside,coreMask);
  // Border glow and aurora rim.
  float rim=stroke(r-coreRadius,.003);
  col+=palette(.5+.5*sin(ang*2.4+t*.19))*rim*(.45+uBass*.75);
  col+=palette(.5+.5*cos(ang*2.))*glow(r-coreRadius,29.)*.13*uGlow*(1.+audio*.7);
  // Refraction-like bright arc across the upper right of the orb.
  float arc=stroke(r-.244,.0016)*smoothstep(-.5,.8,sin(ang*1.25+.8));
  col+=uColorB*arc*.31;
  // Deep halo, scattered rays, and bass-driven corona.
  float halo=exp(-r*5.6)*(.12+.38*audio)*(.72+energy*.55);
  col+=uColorA*halo*.23;
  float spokes=pow(abs(sin(ang*13.5+t*.12)),60.)*exp(-r*2.8);
  col+=uColorB*spokes*.10*(.3+uTreble*2.)*(.8+energy*.4);
  // Expanding rings follow detected beats.
  float waveRadius=.33+(1.-uBeat)*.49;
  float wave=glow(r-waveRadius,105.)*uBeat;
  col+=mix(uColorA,uColorB,.55)*wave*.52*uGlow;
  float localGlow=glow(r-waveRadius,21.)*uBeat;
  col+=uColorA*localGlow*.042;
  // Warm highlight at the center, to keep the core visually anchored.
  float coreSpark=exp(-dot(p,p)*830.)*(.07+uMid*.22);
  col+=uColorB*coreSpark;
  // Compress highlights while preserving saturated glow.
  col=max(col,vec3(0.));
  col=1.-exp(-col*(1.05+.25*uGlow));
  col=pow(col,vec3(.89));
  float vignette=1.-smoothstep(.62,1.42,length(q));
  col*=.72+.28*vignette;
  fragColor=vec4(col,1.);
}
`;

export const particlesVertex = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBass;
uniform float uTreble;
uniform float uBeat;
uniform float uDensity;
uniform float uMovement;
out float vShade;
out float vDepth;
float hash(float p){return fract(sin(p*127.1+19.9)*43758.5453);}
void main(){
 float id=float(gl_VertexID);
 float seed=hash(id+2.);
 float size=hash(id+9.);
 if(seed>uDensity){gl_Position=vec4(3.,3.,1.,1.);gl_PointSize=1.;vShade=0.;vDepth=0.;return;}
 float theta=id*2.3999632+uTime*(.03+hash(id+5.)*.11)*uMovement;
 float radius=.20+pow(hash(id+14.),.72)*1.05;
 float spiral=radius*3.1+theta;
 vec2 pos=vec2(cos(spiral),sin(spiral))*radius;
 pos+=vec2(sin(id*.143+uTime*.09),cos(id*.091+uTime*.08))*.013;
 pos*=1.+uBass*.045;
 float pixelRatio=2.*min(uResolution.x,uResolution.y)/uResolution.x;
 gl_Position=vec4(pos.x*pixelRatio,pos.y*2.*min(uResolution.x,uResolution.y)/uResolution.y,0.,1.);
 float pSize=(.7+pow(size,5.)*2.9)*(min(uResolution.x,uResolution.y)/750.);
 gl_PointSize=clamp(pSize,1.,7.);
 vShade=seed;
 vDepth=clamp(1.-radius*.75,0.,1.);
}
`;
export const particlesFragment = `#version 300 es
precision highp float;
in float vShade;in float vDepth;out vec4 fragColor;
uniform vec3 uColorA;uniform vec3 uColorB;uniform float uTreble;uniform float uGlow;
void main(){float d=length(gl_PointCoord-.5)*2.;float a=(1.-smoothstep(.1,1.,d));a*=a;vec3 c=mix(uColorA,uColorB,vShade)*(.45+uTreble*.65);fragColor=vec4(c,a*vDepth*.7*uGlow);}
`;
