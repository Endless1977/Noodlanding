'use strict';
// ===== Hulpfuncties & invoer =====
const TAU = Math.PI * 2;
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const d2=(ax,ay,bx,by)=>{const dx=ax-bx,dy=ay-by;return dx*dx+dy*dy};
const rnd=(a,b)=>a+Math.random()*(b-a);
const irnd=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const deepCopy=o=>JSON.parse(JSON.stringify(o));
const angDiff=(a,b)=>{let d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d};
function fmtN(n){n=Math.floor(n);return n>=100000?Math.round(n/1000)+'k':n>=10000?(n/1000).toFixed(1)+'k':''+n}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function costStr(c,inv){return Object.entries(c).map(([k,v])=>{const ok=!inv||(inv[k]||0)>=v;return `<span class="cost ${ok?'':'lack'}" style="color:${MATS[k].c}">${v} ${MATS[k].n}</span>`}).join(' ')}
function canAfford(inv,c){for(const k in c)if((inv[k]||0)<c[k])return false;return true}
function payCost(inv,c){for(const k in c)inv[k]=(inv[k]||0)-c[k]}

// ===== Invoer (toetsenbord, muis, gamepad) =====
const Input={keys:{},tapped:{},mx:0,my:0,mdown:false,rdown:false,mtap:false,rtap:false,wheel:0,
  mdx:0,mdy:0,locked:false,pad:null,padB:[],padPrev:[],usePad:false,lx:0,ly:0,rx:0,ry:0};
addEventListener('keydown',e=>{
  if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'))return;
  if(['Tab','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(!e.repeat)Input.tapped[e.code]=true;Input.keys[e.code]=true;Input.usePad=false;
});
addEventListener('keyup',e=>{Input.keys[e.code]=false});
addEventListener('blur',()=>{Input.keys={};Input.mdown=Input.rdown=false});
addEventListener('mousemove',e=>{Input.mx=e.clientX;Input.my=e.clientY;if(Input.locked){Input.mdx+=e.movementX;Input.mdy+=e.movementY}});
document.addEventListener('pointerlockchange',()=>{Input.locked=!!document.pointerLockElement});

function pollPad(){
  const gp=navigator.getGamepads?navigator.getGamepads():[];let p=null;
  for(const g of gp)if(g&&g.connected){p=g;break}
  Input.padPrev=Input.padB;Input.padB=[];Input.pad=p;if(!p)return;
  for(let i=0;i<p.buttons.length;i++)Input.padB[i]=p.buttons[i].value>0.35;
  const dz=v=>Math.abs(v)<0.2?0:v;
  Input.lx=dz(p.axes[0]||0);Input.ly=dz(p.axes[1]||0);Input.rx=dz(p.axes[2]||0);Input.ry=dz(p.axes[3]||0);
  if(Input.padB.some(b=>b)||Math.abs(Input.lx)+Math.abs(Input.ly)+Math.abs(Input.rx)+Math.abs(Input.ry)>0.3)Input.usePad=true;
}
const padTap=i=>!!Input.padB[i]&&!Input.padPrev[i];
// Toetsbindingen. p = gamepad-knop (standaard layout)
const BIND={
  fire:{m:'l',p:7}, melee:{k:['KeyZ'],m:'r',p:6}, interact:{k:['KeyE'],p:0},
  ab0:{k:['KeyQ'],p:2}, ab1:{k:['KeyF'],p:3}, ab2:{k:['KeyG'],p:1}, ult:{k:['KeyR'],p:5},
  swap:{k:['KeyX'],p:4}, menu:{k:['Tab','KeyI'],p:9}, build:{k:['KeyB'],p:8},
  sprint:{k:['ShiftLeft','ShiftRight'],p:10}, w1:{k:['Digit1']}, w2:{k:['Digit2']},
  esc:{k:['Escape']}, map:{k:['KeyM']}, cam:{k:['KeyV'],p:15},
  zin:{k:['Equal','NumpadAdd'],p:12}, zout:{k:['Minus','NumpadSubtract'],p:13}
};
function held(a){const b=BIND[a];if(b.k)for(const k of b.k)if(Input.keys[k])return true;
  if(b.m==='l'&&Input.mdown)return true;if(b.m==='r'&&Input.rdown)return true;
  if(b.p!=null&&Input.padB[b.p])return true;return false}
function tap(a){const b=BIND[a];if(b.k)for(const k of b.k)if(Input.tapped[k])return true;
  if(b.m==='l'&&Input.mtap)return true;if(b.m==='r'&&Input.rtap)return true;
  if(b.p!=null&&padTap(b.p))return true;return false}
function endInput(){Input.tapped={};Input.mtap=Input.rtap=false;Input.wheel=0;Input.mdx=Input.mdy=0}
