'use strict';
// ===== Wereldgeneratie (deterministisch per hoofdstuk) & botsingen =====
// Logica draait op een 2D-raster (px, 16 px per tegel); de 3D-renderer bouwt daarop.
const TS=16,MW=128,MH=96;
const T={FLOOR:0,WALL:1,GATE:2,LAVA:3};
let MAP=null;
const tc=t=>t*TS+8;
const DIR4=[[1,0],[-1,0],[0,1],[0,-1]];
const DIR8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

function rotMask(m,r){for(let i=0;i<r;i++)m=((m<<1)|(m>>3))&15;return m}
// Pijpenpuzzel: N=1 E=2 S=4 W=8
function pipeSolved(pp,rot){
  const {w,h,sr,kr,mask}=pp;const C=i=>rotMask(mask[i],rot[i]);const start=sr*w;
  if(!(C(start)&8))return false;const seen=new Set([start]),q=[start];
  while(q.length){const i=q.pop();const x=i%w,y=(i/w)|0,c=C(i);if(x===w-1&&y===kr&&(c&2))return true;
    for(const [b,dx,dy,ob] of [[1,0,-1,4],[2,1,0,8],[4,0,1,1],[8,-1,0,2]]){if(!(c&b))continue;
      const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const j=ny*w+nx;if(seen.has(j))continue;
      if(C(j)&ob){seen.add(j);q.push(j)}}}
  return false;
}
function pipePowered(pp,rot){// set van cellen die stroom krijgen vanaf de bron
  const {w,h,sr,mask}=pp;const C=i=>rotMask(mask[i],rot[i]);const start=sr*w;const seen=new Set();
  if(!(C(start)&8))return seen;seen.add(start);const q=[start];
  while(q.length){const i=q.pop();const x=i%w,y=(i/w)|0,c=C(i);
    for(const [b,dx,dy,ob] of [[1,0,-1,4],[2,1,0,8],[4,0,1,1],[8,-1,0,2]]){if(!(c&b))continue;
      const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=w||ny>=h)continue;const j=ny*w+nx;if(seen.has(j))continue;
      if(C(j)&ob){seen.add(j);q.push(j)}}}
  return seen;
}

function genMap(ch){
  const Z=ZONES[ch];const zid=Z.map||ch;const R=mulberry32(ZONES[zid].seed);
  const t=new Uint8Array(MW*MH);
  for(let i=0;i<t.length;i++)t[i]=R()<0.46?1:0;
  const at=(x,y)=>(x<0||y<0||x>=MW||y>=MH)?1:t[y*MW+x];
  for(let it=0;it<5;it++){const n=new Uint8Array(t.length);
    for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){let c=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)c+=at(x+i,y+j)?1:0;n[y*MW+x]=c>=5?1:0}
    t.set(n)}
  const set=(x,y,v)=>{if(x>1&&y>1&&x<MW-2&&y<MH-2)t[y*MW+x]=v};
  const circ=(cx,cy,r,v=0)=>{for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)if(x*x+y*y<=r*r+r)set(cx+x,cy+y,v)};
  const rect=(x0,y0,w,h,v=0)=>{for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++)set(x,y,v)};
  const jy=()=>Math.floor(R()*9)-4;
  const rooms={spawn:{x:13,y:48+jy()},puzzle:{x:56+Math.floor(R()*10),y:16},vault:{x:52+Math.floor(R()*14),y:80},front:{x:90,y:48},arena:{x:113,y:48}};
  const S=rooms.spawn,P=rooms.puzzle,V=rooms.vault,F=rooms.front,A=rooms.arena;
  const extra=[];for(let i=0;i<8;i++)extra.push({x:22+Math.floor(R()*66),y:8+Math.floor(R()*80)});
  const drunk=(a,b)=>{let x=a.x,y=a.y,g=0;
    while((Math.abs(x-b.x)>1||Math.abs(y-b.y)>1)&&g++<5000){
      if(R()<0.6){const dx=b.x-x,dy=b.y-y;if(Math.abs(dx)>Math.abs(dy)?R()<0.8:R()<0.2)x+=Math.sign(dx);else y+=Math.sign(dy)}
      else{const d=Math.floor(R()*4);x+=[1,-1,0,0][d];y+=[0,0,1,-1][d]}
      x=clamp(x,3,92);y=clamp(y,3,MH-4);circ(x,y,R()<0.25?2:1)}};
  rect(S.x-9,S.y-7,19,15);rect(P.x-8,P.y-6,17,13);circ(V.x,V.y,6);circ(F.x,F.y,5);
  for(const e of extra)circ(e.x,e.y,2+Math.floor(R()*3));
  drunk(S,P);drunk(S,V);drunk(P,F);drunk(V,F);drunk(S,F);drunk(P,V);
  for(const e of extra){let best=S,bd=1e9;for(const r of [S,P,V,F]){const d=(r.x-e.x)**2+(r.y-e.y)**2;if(d<bd){bd=d;best=r}}drunk(e,best)}
  // Baasgebied: alleen bereikbaar via de poort
  for(let y=0;y<MH;y++)for(let x=95;x<MW;x++)t[y*MW+x]=1;
  for(let y=-11;y<=11;y++)for(let x=-13;x<=13;x++)if((x*x)/169+(y*y)/121<=1)set(A.x+x,A.y+y,0);
  rect(86,46,16,5);
  for(let y=46;y<=50;y++)for(let x=96;x<=98;x++)t[y*MW+x]=T.GATE;
  // Flood fill vanaf spawn; onbereikbare vloer wordt muur
  const reach=new Uint8Array(MW*MH);const q=[S.y*MW+S.x];reach[q[0]]=1;
  while(q.length){const i=q.pop();const x=i%MW,y=(i/MW)|0;for(const [dx,dy] of DIR4){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=MW||ny>=MH)continue;const j=ny*MW+nx;if(reach[j]||t[j]===T.WALL)continue;reach[j]=1;q.push(j)}}
  for(let i=0;i<t.length;i++)if(t[i]!==T.WALL&&!reach[i])t[i]=T.WALL;
  // Lava (zone 3)
  if(ZONES[zid].lava){const L=new Uint8Array(MW*MH);for(let i=0;i<L.length;i++)L[i]=R()<0.42?1:0;
    for(let it=0;it<4;it++){const n=new Uint8Array(L.length);for(let y=1;y<MH-1;y++)for(let x=1;x<MW-1;x++){let c=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)c+=L[(y+j)*MW+x+i];n[y*MW+x]=c>=5?1:0}L.set(n)}
    const far=(x,y)=>[S,P,V,F].every(r=>(r.x-x)**2+(r.y-y)**2>81);
    for(let y=0;y<MH;y++)for(let x=0;x<93;x++){const i=y*MW+x;if(t[i]===T.FLOOR&&L[i]&&far(x,y))t[i]=T.LAVA}}
  const floors=[];for(let y=0;y<MH;y++)for(let x=0;x<94;x++)if(t[y*MW+x]===T.FLOOR)floors.push([x,y]);
  // Zekeringen (hoofdstuk 1)
  const fuses=[];let guard=0;
  while(fuses.length<3&&guard++<5000){const f=floors[Math.floor(R()*floors.length)];
    if((f[0]-S.x)**2+(f[1]-S.y)**2<26*26)continue;if(Math.abs(f[0]-P.x)<10&&Math.abs(f[1]-P.y)<8)continue;
    if(fuses.some(o=>(o[0]-f[0])**2+(o[1]-f[1])**2<18*18))continue;fuses.push(f)}
  // Pijpenraster 5x4
  const pw=5,ph=4,sr=Math.floor(R()*ph),kr=Math.floor(R()*ph);
  const path=[];const seen=new Set();
  const dfs=(x,y)=>{path.push([x,y]);seen.add(x+','+y);if(x===pw-1&&y===kr)return true;
    const dirs=[[1,0],[0,1],[0,-1],[-1,0]];for(let i=3;i>0;i--){const j=Math.floor(R()*(i+1));[dirs[i],dirs[j]]=[dirs[j],dirs[i]]}
    for(const [dx,dy] of dirs){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=pw||ny>=ph||seen.has(nx+','+ny))continue;if(dfs(nx,ny))return true}
    path.pop();return false};
  dfs(0,sr);
  const dirBit=(dx,dy)=>dx===1?2:dx===-1?8:dy===1?4:1;
  const mask=[];for(let i=0;i<pw*ph;i++)mask.push(R()<0.5?5:3);
  path.forEach((c,i)=>{let m=0;
    if(i===0)m|=8;else m|=dirBit(path[i-1][0]-c[0],path[i-1][1]-c[1]);
    if(i===path.length-1)m|=2;else m|=dirBit(path[i+1][0]-c[0],path[i+1][1]-c[1]);
    mask[c[1]*pw+c[0]]=m});
  const rot0=mask.map(()=>Math.floor(R()*4));
  const pipe={gx:P.x-2,gy:P.y-1,w:pw,h:ph,sr,kr,mask,rot0};
  if(pipeSolved(pipe,rot0)){const c=path[Math.min(1,path.length-1)];const i=c[1]*pw+c[0];rot0[i]=(rot0[i]+1)%4}
  // Drukplaten (hoofdstuk 2) & runen (hoofdstuk 3)
  const plates=[[P.x-5,P.y+3],[P.x,P.y-4],[P.x+5,P.y+3]];
  const crates=[[P.x-6,P.y-4],[P.x+6,P.y-4],[P.x,P.y+4]];
  const runes=[[P.x-5,P.y-3],[P.x+5,P.y-3],[P.x-5,P.y+3],[P.x+5,P.y+3]];
  const seq=[];while(seq.length<5){const r=Math.floor(R()*4);if(seq[seq.length-1]!==r)seq.push(r)}
  MAP={ch,zid,t,rooms,floors,fuses,pipe,plates,crates,runes,seq,
    spawnPx:{x:tc(S.x),y:tc(S.y+2)},ship:zid===1?{x:tc(S.x),y:tc(S.y-3)}:null,
    generator:{x:tc(P.x),y:tc(P.y-4)},pedestal:{x:tc(V.x),y:tc(V.y)},arenaPx:{x:tc(A.x),y:tc(A.y)},obelisk:{x:tc(P.x),y:tc(P.y)}};
  return MAP;
}

function tileAt(tx,ty){if(tx<0||ty<0||tx>=MW||ty>=MH)return T.WALL;return MAP.t[ty*MW+tx]}
function gateOpen(){return !!(ZS&&ZS.flags&&ZS.flags.gate)}
function solidT(tx,ty){const v=tileAt(tx,ty);return v===T.WALL||(v===T.GATE&&!gateOpen())}
function solidP(x,y){return solidT(Math.floor(x/TS),Math.floor(y/TS))}
function hitsWall(x,y,r){return solidP(x-r,y-r)||solidP(x+r,y-r)||solidP(x-r,y+r)||solidP(x+r,y+r)}
function moveC(o,dx,dy,r){
  const steps=Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/4)||1;const sx=dx/steps,sy=dy/steps;let hit=false;
  for(let i=0;i<steps;i++){if(!hitsWall(o.x+sx,o.y,r))o.x+=sx;else hit=true;if(!hitsWall(o.x,o.y+sy,r))o.y+=sy;else hit=true}
  return hit;
}
function los(x1,y1,x2,y2){const d=Math.hypot(x2-x1,y2-y1);const n=Math.ceil(d/6);
  for(let i=1;i<n;i++){const k=i/n;if(solidP(x1+(x2-x1)*k,y1+(y2-y1)*k))return false}return true}
function inArena(x){return x>99*TS}

// Vloertextuur: 16 texels per tegel, per zone eigen details + ambient occlusion langs muren; tweede canvas = gloeikaart
function buildFloorCanvases(){
  const zid=MAP.zid,pal=ZONES[zid].pal,R=mulberry32(ZONES[zid].seed+7);
  const c=document.createElement('canvas');c.width=MW*TS;c.height=MH*TS;const g=c.getContext('2d');
  const e=document.createElement('canvas');e.width=c.width;e.height=c.height;const ge=e.getContext('2d');
  ge.fillStyle='#000';ge.fillRect(0,0,e.width,e.height);
  // laagfrequente ruis tegen het 'tegelpatroon'
  const G=6,gw=Math.ceil(MW/G)+2,gh=Math.ceil(MH/G)+2,grid=[];for(let i=0;i<gw*gh;i++)grid.push(R());
  const noise=(x,y)=>{const gx=x/G,gy=y/G,ix=Math.floor(gx),iy=Math.floor(gy),fx=gx-ix,fy=gy-iy;const v=(a,b)=>grid[b*gw+a];
    return lerp(lerp(v(ix,iy),v(ix+1,iy),fx),lerp(v(ix,iy+1),v(ix+1,iy+1),fx),fy)};
  const mix=(c1,c2,t)=>{const a=hexRGB(c1),b=hexRGB(c2);return `rgb(${Math.round(lerp(a[0],b[0],t))},${Math.round(lerp(a[1],b[1],t))},${Math.round(lerp(a[2],b[2],t))})`};
  const px=(x,y,col,w,h)=>{g.fillStyle=col;g.fillRect(x,y,w||1,h||1)};
  const wallAt=(x,y)=>tileAt(x,y)===T.WALL;
  for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){const v=MAP.t[y*MW+x];const X=x*TS,Y=y*TS;
    if(v===T.WALL){px(X,Y,pal.wall,TS,TS);continue}
    if(v===T.LAVA){px(X,Y,'#d4420e',TS,TS);
      for(let k=0;k<3;k++){px(X+Math.floor(R()*12),Y+Math.floor(R()*12),'#5a1a08',3+Math.floor(R()*3),2+Math.floor(R()*3))}
      for(let k=0;k<6;k++)px(X+Math.floor(R()*15),Y+Math.floor(R()*15),R()<0.5?'#ffb030':'#fff27a',2,1);
      ge.fillStyle='#ff7a20';ge.fillRect(X,Y,TS,TS);continue}
    if(v===T.GATE){px(X,Y,'#23262e',TS,TS);for(let k=0;k<TS;k+=4)px(X,Y+k,'#2f343e',TS,1);continue}
    const arena=x>=99;
    if(arena){const base=(x+y)%2?pal.arena:shade(pal.arena,1.08);px(X,Y,base,TS,TS);
      px(X,Y,shade(pal.arena,1.3),TS,1);px(X,Y,shade(pal.arena,1.25),1,TS);px(X,Y+TS-1,shade(pal.arena,0.6),TS,1);px(X+TS-1,Y,shade(pal.arena,0.65),1,TS);
      for(let k=0;k<6;k++)px(X+1+Math.floor(R()*14),Y+1+Math.floor(R()*14),shade(pal.arena,R()<0.5?0.85:1.15));
      if(R()<0.12){const cx=X+4+Math.floor(R()*8);for(let k=0;k<5;k++)px(cx+k-(k>2?2:0),Y+3+k*2,shade(pal.arena,0.55))}
      continue}
    const n=noise(x,y);const base=n<0.5?mix(pal.floor[2],pal.floor[0],n*2):mix(pal.floor[0],pal.floor[1],(n-0.5)*2);
    px(X,Y,base,TS,TS);
    for(let k=0;k<14;k++)px(X+Math.floor(R()*TS),Y+Math.floor(R()*TS),R()<0.5?pal.speck:shade(pal.floor[0],0.8));
    if(zid===1){
      if(R()<0.55){const ry=Y+2+Math.floor(R()*12),rx=X+Math.floor(R()*6),l=5+Math.floor(R()*7);for(let k=0;k<l;k++)px(rx+k,ry+Math.round(Math.sin(k*0.7)),shade(pal.floor[1],1.18));for(let k=0;k<l;k++)px(rx+k,ry+1+Math.round(Math.sin(k*0.7)),shade(pal.floor[1],0.86))}
      if(R()<0.25){const sx=X+2+Math.floor(R()*11),sy=Y+2+Math.floor(R()*11);px(sx,sy,'#a88d6a',2,2);px(sx,sy,'#cdb38c');px(sx+1,sy+2,'#4e3b26',2,1)}
      if(R()<0.06){let cx=X+Math.floor(R()*TS),cy=Y+Math.floor(R()*TS);for(let k=0;k<10;k++){px(cx,cy,'#4a3622');cx+=Math.round(R()*2-0.5);cy+=Math.round(R()*2-0.5)}}
      if(R()<0.03){const sx=X+4+Math.floor(R()*6),sy=Y+4+Math.floor(R()*6);px(sx,sy,'#e9e2cf',5,1);px(sx+1,sy-1,'#e9e2cf',1,3);px(sx+3,sy-1,'#e9e2cf',1,3)}// botjes
    }
    if(zid===2){
      for(let k=0;k<6;k++){const gx=X+Math.floor(R()*15),gy=Y+2+Math.floor(R()*13);px(gx,gy-2,'#4fa548',1,2);px(gx+1,gy-1,'#3b8a3a',1,2)}
      if(R()<0.3){const mx=X+Math.floor(R()*10),my=Y+Math.floor(R()*10);px(mx,my,shade(pal.floor[2],0.75),5,4);px(mx+1,my-1,shade(pal.floor[2],0.75),3,6)}
      if(R()<0.12){const fx=X+2+Math.floor(R()*12),fy=Y+2+Math.floor(R()*12);const fc=pick(['#ff6ad5','#ffe14d','#9cf']);px(fx,fy,fc);px(fx-1,fy,fc);px(fx+1,fy,fc);px(fx,fy-1,fc);px(fx,fy+1,fc);px(fx,fy,'#fff');
        ge.fillStyle=fc;ge.fillRect(fx-1,fy-1,3,3)}
      if(R()<0.08){const lx=X+Math.floor(R()*10),ly=Y+Math.floor(R()*12);px(lx,ly,'#6b4a2a',4,2);px(lx+1,ly-1,'#8a6a3e',2,1)}
    }
    if(zid===3){
      const bx=X+(y%2?4:0);px(X,Y+7,shade(pal.floor[0],0.7),TS,1);px(bx+7,Y,shade(pal.floor[0],0.7),1,7);px(bx+3,Y+8,shade(pal.floor[0],0.7),1,8);
      px(X,Y+8,shade(pal.floor[0],1.18),TS,1);
      if(R()<0.16){let cx=X+Math.floor(R()*TS),cy=Y+Math.floor(R()*TS);for(let k=0;k<9;k++){px(cx,cy,'#ff6a1a');ge.fillStyle='#ff5a10';ge.fillRect(cx,cy,1,1);cx+=Math.round(R()*2-0.5);cy+=Math.round(R()*2-0.5)}}
      for(let k=0;k<4;k++)px(X+Math.floor(R()*TS),Y+Math.floor(R()*TS),'#6a6264');
    }
    // ambient occlusion langs muren
    const ao=(x0,y0,w,h,dir)=>{for(let k=0;k<5;k++){g.fillStyle=`rgba(0,0,0,${0.32*(1-k/5)})`;
      if(dir==='n')g.fillRect(x0,y0+k,w,1);if(dir==='s')g.fillRect(x0,y0+h-1-k,w,1);if(dir==='w')g.fillRect(x0+k,y0,1,h);if(dir==='e')g.fillRect(x0+w-1-k,y0,1,h)}};
    if(wallAt(x,y-1))ao(X,Y,TS,TS,'n');if(wallAt(x,y+1))ao(X,Y,TS,TS,'s');if(wallAt(x-1,y))ao(X,Y,TS,TS,'w');if(wallAt(x+1,y))ao(X,Y,TS,TS,'e');
  }
  // gloeiende runencirkel in de arena
  const A=MAP.arenaPx;ge.strokeStyle=pal.acc;g.strokeStyle=pal.acc;g.lineWidth=ge.lineWidth=2;
  for(const r of [44,64]){g.beginPath();g.arc(A.x,A.y,r,0,TAU);g.stroke();ge.beginPath();ge.arc(A.x,A.y,r,0,TAU);ge.stroke()}
  for(let i=0;i<12;i++){const a=i*TAU/12,x1=A.x+Math.cos(a)*48,y1=A.y+Math.sin(a)*48;g.fillStyle=pal.acc;g.fillRect(x1-2,y1-2,4,4);ge.fillStyle=pal.acc;ge.fillRect(x1-2,y1-2,4,4)}
  return {c,e};
}
