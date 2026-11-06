'use strict';
// ===== Gesynthetiseerde retro-geluiden (WebAudio) =====
let AC=null,MASTER=null,MUTED=false;const lastSfx={};
function ac(){if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();MASTER=AC.createGain();MASTER.gain.value=0.6;MASTER.connect(AC.destination)}catch(e){}}
  if(AC&&AC.state==='suspended')AC.resume();return AC}
function tone(f,dur,type,vol,slide,delay){const a=ac();if(!a)return;const t0=a.currentTime+(delay||0);const o=a.createOscillator(),g=a.createGain();
  o.type=type||'square';o.frequency.setValueAtTime(f,t0);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(20,f*slide),t0+dur);
  g.gain.setValueAtTime(vol||0.05,t0);g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);o.connect(g);g.connect(MASTER);o.start(t0);o.stop(t0+dur+0.02)}
let NOISE=null;
function noise(dur,vol,lp){const a=ac();if(!a)return;if(!NOISE){NOISE=a.createBuffer(1,a.sampleRate,a.sampleRate);const d=NOISE.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
  const s=a.createBufferSource();s.buffer=NOISE;const f=a.createBiquadFilter();f.type='lowpass';f.frequency.value=lp||2000;const g=a.createGain();
  g.gain.setValueAtTime(vol||0.1,a.currentTime);g.gain.exponentialRampToValueAtTime(0.0001,a.currentTime+dur);s.connect(f);f.connect(g);g.connect(MASTER);s.start();s.stop(a.currentTime+dur)}
const SFX={
  bolt:()=>tone(880,0.07,'square',0.025,0.5), pellet:()=>noise(0.14,0.09,1500), cryo:()=>tone(1400,0.12,'triangle',0.03,0.6),
  plasma:()=>tone(320,0.16,'sawtooth',0.035,0.4), rail:()=>{tone(1800,0.2,'sawtooth',0.03,0.2);noise(0.15,0.05,4000)},
  arc:()=>{tone(600,0.08,'sawtooth',0.025,2);noise(0.06,0.04,6000)}, flame:()=>noise(0.07,0.025,900), sonic:()=>tone(200,0.3,'sine',0.06,3),
  hit:()=>noise(0.04,0.03,3000), kill:()=>{noise(0.15,0.06,1200);tone(200,0.12,'square',0.03,0.3)}, mine:()=>tone(500,0.08,'triangle',0.04,0.7),
  boom:()=>{noise(0.45,0.16,700);tone(90,0.4,'sine',0.08,0.4)}, pickup:()=>tone(1200,0.05,'triangle',0.03,1.5),
  lvl:()=>{[523,659,784,1046].forEach((f,i)=>tone(f,0.14,'square',0.04,1,i*0.08))}, hurt:()=>tone(160,0.15,'sawtooth',0.05,0.5),
  click:()=>tone(1000,0.03,'square',0.02), swing:()=>noise(0.1,0.05,2500), throw:()=>tone(400,0.12,'triangle',0.04,2),
  dash:()=>noise(0.15,0.06,3000), shield:()=>tone(500,0.3,'sine',0.05,2), charge:()=>tone(300,0.5,'sawtooth',0.03,4),
  zap:()=>{noise(0.05,0.05,8000);tone(1200,0.05,'square',0.02,0.5)}, roar:()=>{tone(80,0.8,'sawtooth',0.08,0.6);noise(0.6,0.08,500)},
  gate:()=>{[200,300,400,600].forEach((f,i)=>tone(f,0.25,'sine',0.06,1,i*0.12))}, rune:()=>tone(880,0.25,'sine',0.06,1.5),
  wrong:()=>tone(150,0.4,'square',0.06,0.5), build:()=>{tone(300,0.08,'square',0.04);tone(450,0.1,'square',0.04,1,0.08)},
  turret:()=>tone(1100,0.04,'square',0.012,0.6), victory:()=>{[392,523,659,784,1046,1318].forEach((f,i)=>tone(f,0.25,'square',0.05,1,i*0.12))}
};
function sfx(n){if(MUTED)return;const f=SFX[n];if(!f)return;const now=performance.now();if(now-(lastSfx[n]||0)<35)return;lastSfx[n]=now;try{f()}catch(e){}}
