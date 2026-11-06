'use strict';
// ===== Host-simulatie: vijanden, projectielen, puzzels, bazen, gebouwen, finale =====
let W=null,HW=null; // W = runtime wereld, HW = opgeslagen wereld (of tijdelijke kopie bij herhaling)
function newWorld(){return{story:1,won:false,storage:{},zones:{},parts:{}}}
function zoneSave(key){if(!HW.zones[key])HW.zones[key]={buildings:[],flags:{fuses:[],gate:false,pipes:null,mb:false,vault:false,boss:false,fixed:false}};return HW.zones[key]}
function nPlayers(){return Math.max(1,Object.keys(W.players).length)}
function hpScale(){return 1+0.6*(nPlayers()-1)}
function fxPush(f){playFx(f);if(Net.nConns())W.fx.push(f)}
function toastAll(m,c){Net.bcast({t:'toast',m,c})}
function dirty(){W.dirty=true}

function hostStartChapter(ch,replay){
  if(replay){HW=deepCopy(SAVE.wsnaps[ch]||SAVE.world);if(!SAVE.wsnaps[ch])delete HW.zones[ch]}
  else{HW=SAVE.world;if(!SAVE.wsnaps[ch]){const s=deepCopy(SAVE.world);delete s.zones[ch];SAVE.wsnaps[ch]=s}}
  const zsv=zoneSave(ch),base=zoneSave(ZONES[ch].map||ch);
  const prevPlayers=W?W.players:{};
  MAP=genMap(ch);
  if(!zsv.flags.pipes)zsv.flags.pipes=MAP.pipe.rot0.slice();
  W={ch,replay,t:0,ents:new Map(),proj:[],nid:1,players:prevPlayers,fx:[],snapT:0,spawnT:3,nodeT:0,flowT:0,flow:null,
    bT:{},runeOn:{},plateProg:0,finale:{state:'idle',t:0},dirty:true,waveT:0,zsT:0,saveT:0};
  for(const id in W.players){W.players[id].x=MAP.spawnPx.x;W.players[id].y=MAP.spawnPx.y}
  ZS={ch,replay,flags:zsv.flags,buildings:base.buildings,storage:HW.storage,parts:HW.parts,story:HW.story,won:HW.won,
    plates:[0,0,0],plateProg:0,runeProg:0,finale:W.finale};
  // Initiële entiteiten
  const Z=ZONES[ch];
  for(let i=0;i<Z.nodeCap*0.85;i++){const f=MAP.floors[Math.floor(Math.random()*MAP.floors.length)];
    if(d2(tc(f[0]),tc(f[1]),MAP.spawnPx.x,MAP.spawnPx.y)<(7*TS)**2)continue;spawnEnt(pick(Z.nodes),tc(f[0]),tc(f[1]))}
  if(ch===2)for(const c of MAP.crates)spawnEnt('crate',tc(c[0]),tc(c[1]));
  if(ch<=3){if(!zsv.flags.mb){const e=spawnEnt(Z.mb,MAP.pedestal.x,MAP.pedestal.y+20);e.home={x:e.x,y:e.y}}
    if(!zsv.flags.boss)spawnEnt(Z.boss,MAP.arenaPx.x,MAP.arenaPx.y)}
  Net.bcast({t:'chapter',ch,replay},true);
  enterChapterLocal(ch,replay);
  Net.bcast({t:'zs',zs:ZS},true);
  hostSaveWorld();
}
function hostSaveWorld(){if(W&&!W.replay)writeSave()}
function hostNextChapter(){
  const next=W.ch+1;if(next>4)return;
  saveGame();
  hostStartChapter(next,next<SAVE.world.story);
}

function spawnEnt(k,x,y,extra){
  const d=ENEMIES[k]||{};
  const e={id:W.nid++,k,x,y,hp:d.hp||1,mhp:d.hp||1,ar:d.armor||0,mar:d.armor||0,st:0,aux:0,def:d,t:0,cd:1+Math.random(),
    chill:0,frozen:0,burn:0,burnDps:0,flash:0,at:2,face:0};
  if(d.hp&&d.ai&&!d.boss){const m=hpScale();e.hp*=m;e.mhp*=m}
  if(extra)Object.assign(e,extra);
  W.ents.set(e.id,e);return e;
}
function isHittable(e){const d=e.def;return d.hp&&!d.crate&&!e.dead&&(!d.boss||e.active)}
function entR(e){return (e.def.r||6)*(e.def.scale||1)}

// ---------- Berichten van spelers ----------
function hostRecv(pid,m){
  if(!W)return;
  switch(m.t){
    case 'hello':{W.players[pid]={id:pid,name:m.name,color:m.color,x:MAP.spawnPx.x,y:MAP.spawnPx.y,hp:1,mhp:1,dn:0,seen:W.t};
      Net.to(pid,{t:'welcome',ch:W.ch,replay:W.replay,id:pid});Net.to(pid,{t:'zs',zs:ZS});
      toastAll(`${m.name} doet mee!`,'#8f8');break}
    case 'p':{let o=W.players[pid];if(!o){if(pid!=='h')return;o=W.players.h={id:'h'}}Object.assign(o,m.s);o.id=pid;o.seen=W.t;break}
    case 'shots':for(const s of m.s)W.proj.push({x:s.x,y:s.y,vx:s.vx,vy:s.vy,d:s.d,r:s.r||2,l:s.l,k:s.k,o:pid,pierce:s.pc||0,hit:null,
      chill:s.ch||0,shat:s.sh||0,burn:s.bu||0,chain:s.cn||0,kw:s.kw||0,crit:s.cr||0});break;
    case 'melee':doMelee(pid,m);break;
    case 'abil':doAbility(pid,m);break;
    case 'use':doUse(pid,m);break;
    case 'store':HW.storage[m.mat]=(HW.storage[m.mat]||0)+m.amt;dirty();break;
    case 'take':if((HW.storage[m.mat]||0)>=m.amt&&m.amt>0){HW.storage[m.mat]-=m.amt;Net.to(pid,{t:'gain',items:{[m.mat]:m.amt},raw:1});dirty()}break;
    case 'build':doBuild(pid,m);break;
    case 'repair':{const f=ZS.flags;if(W.ch!==4||f.fixed)break;
      if(![1,2,3].every(i=>HW.parts[i])){Net.to(pid,{t:'toast',m:'Nog niet alle scheepsonderdelen gevonden.',c:'#f88'});break}
      if(!canAfford(HW.storage,REPAIR)){Net.to(pid,{t:'toast',m:'Niet genoeg materialen in de gedeelde opslag.',c:'#f88'});break}
      payCost(HW.storage,REPAIR);f.fixed=true;dirty();toastAll('Het ontsnappingsschip is gerepareerd!','#ff8');hostSaveWorld();break}
    case 'launch':if(pid==='h'&&W.ch===4&&ZS.flags.fixed&&W.finale.state==='idle'){W.finale.state='launch';W.finale.t=0;dirty();
      toastAll('LANCEERSEQUENTIE GESTART — houd 90 seconden stand bij het schip!','#ff8')}break;
    case 'revive':Net.to(m.id,{t:'revive'});break;
  }
}
function hostPlayerLeft(pid){const p=W&&W.players[pid];if(!p)return;delete W.players[pid];toastAll(`${p.name||'Speler'} heeft het spel verlaten`,'#fa8')}

function doMelee(pid,m){
  for(const e of W.ents.values()){if(!isHittable(e))continue;const rr=m.r+entR(e);if(d2(e.x,e.y,m.x,m.y)>rr*rr)continue;
    if(Math.abs(angDiff(m.a,Math.atan2(e.y-m.y,e.x-m.x)))>1.2&&d2(e.x,e.y,m.x,m.y)>100)continue;
    dmgEnt(e,m.d*(e.def.node?1.6:1),{crit:0},pid);
    if(!e.def.boss&&!e.def.node&&!e.dead){const a=Math.atan2(e.y-m.y,e.x-m.x);moveC(e,Math.cos(a)*10,Math.sin(a)*10,entR(e)*0.8)}}
}
function aoe(x,y,r,d,src,pid,fn){for(const e of [...W.ents.values()]){if(!isHittable(e))continue;const rr=r+entR(e);if(d2(e.x,e.y,x,y)<rr*rr){dmgEnt(e,d,src,pid);if(fn&&!e.dead)fn(e)}}}
function doAbility(pid,m){
  switch(m.id){
    case 'grenade':{const dist=Math.hypot(m.tx-m.x,m.ty-m.y)||1,sp=220;
      W.proj.push({k:'gren',x:m.x,y:m.y,vx:(m.tx-m.x)/dist*sp,vy:(m.ty-m.y)/dist*sp,l:dist/sp,o:pid,d:m.d,rad:m.rad,burn:m.burn,r:3});break}
    case 'cryonova':fxPush(['ring',m.x,m.y,m.rad,'#aef']);fxPush(['snd','cryo']);
      aoe(m.x,m.y,m.rad,m.d,{},pid,e=>{if(e.def.boss)e.chill=100;else if(!e.def.node){e.frozen=m.fz;e.chill=0}});break;
    case 'barrier':spawnEnt('dome',m.x,m.y,{r:m.rad,aux:m.rad,life:m.dur,refl:m.refl,owner:pid});break;
    case 'drone':spawnEnt('hdrone',m.x||0,m.y||0,{owner:pid,life:m.dur,heal:m.heal,range:m.range,aux:m.range,ht:0});break;
    case 'shock':fxPush(['ring',m.x,m.y,m.rad,'#ff8']);aoe(m.x,m.y,m.rad,m.d,{},pid);break;
    case 'orbital':spawnEnt('orb',m.tx,m.ty,{life:1.1,d:m.d,owner:pid,aux:50});fxPush(['snd','charge']);break;
    case 'storm':spawnEnt('storm',m.x,m.y,{owner:pid,life:6,d:m.d,zt:0});break;
    case 'phoenix':Net.bcast({t:'phoenix'});fxPush(['ring',m.x||0,m.y||0,120,'#fd6']);break;
  }
}
function doUse(pid,m){
  const f=ZS.flags;
  switch(m.what){
    case 'fuse':if(W.ch===1&&!f.fuses.includes(m.i)){f.fuses.push(m.i);toastAll(`Zekering gevonden (${f.fuses.length}/3)`,'#ffe14d');fxPush(['snd','pickup']);checkGate1();dirty();hostSaveWorld()}break;
    case 'pipe':if(W.ch===1&&!f.gate){f.pipes[m.i]=(f.pipes[m.i]+1)%4;fxPush(['snd','click']);checkGate1();dirty()}break;
    case 'pedestal':if(f.mb){Net.to(pid,{t:'weapon',id:ZONES[W.ch].key});if(!f.vault){f.vault=true;dirty()}}break;
    case 'portal':if(pid!=='h'){Net.to(pid,{t:'toast',m:'Alleen de host kan naar het volgende hoofdstuk.'});break}if(f.boss)hostNextChapter();break;
  }
}
function checkGate1(){const f=ZS.flags;if(!f.gate&&f.fuses.length>=3&&pipeSolved(MAP.pipe,f.pipes))openGate('De energieleiding is hersteld — de tempelpoort gaat open!')}
function openGate(msg){ZS.flags.gate=true;dirty();toastAll(msg,'#8ff');fxPush(['snd','gate']);hostSaveWorld()}
function doBuild(pid,m){
  const B=BUILDINGS[m.k];const tx=m.tx,ty=m.ty;let ok=B&&tileAt(tx,ty)===T.FLOOR&&tx<94;
  if(ok)for(const b of ZS.buildings)if(Math.abs(b.tx-tx)<2&&Math.abs(b.ty-ty)<2)ok=false;
  const P=MAP.rooms.puzzle;if(ok&&Math.abs(tx-P.x)<9&&Math.abs(ty-P.y)<7)ok=false;
  if(ok&&MAP.ship&&Math.abs(tx*TS+8-MAP.ship.x)<40&&Math.abs(ty*TS+8-MAP.ship.y)<28)ok=false;
  if(!ok){Net.to(pid,{t:'refund',c:B?B.cost:{},m:'Kan hier niet bouwen'});return}
  ZS.buildings.push({id:Math.random().toString(36).slice(2,8),k:m.k,tx,ty});dirty();fxPush(['snd','build']);hostSaveWorld();
}

// ---------- Schade ----------
function dmgEnt(e,dmg,src,pid){
  if(e.dead||!(dmg>0))return;src=src||{};
  const isKey=src.kw&&(src.kw==='*'||e.def.key===src.kw);
  if(e.ar>0){
    if(isKey){e.ar-=dmg;e.flash=0.1;fxPush(['dmg',e.x,e.y,Math.round(dmg),2]);
      if(e.ar<=0){e.ar=0;e.vuln=10;fxPush(['txt',e.x,e.y,'PANTSER GEBROKEN!','#ffe14d']);fxPush(['boom',e.x,e.y,40,'#ffe14d']);
        toastAll(`${e.def.n}: pantser gebroken — 10 s kwetsbaar!`,'#ffe14d')}}
    else if(W.t-(e.immT||0)>0.7){e.immT=W.t;fxPush(['txt',e.x,e.y,'IMMUUN','#9ab'])}
    return}
  let d=dmg;
  if(src.shat&&e.frozen>0){d*=src.shat;e.frozen=0;e.chill=0;fxPush(['txt',e.x,e.y,'VERBRIJZELD!','#9df']);fxPush(['boom',e.x,e.y,18,'#bdf'])}
  e.hp-=d;e.flash=0.08;
  if(!e.def.node)fxPush(['dmg',e.x+rnd(-4,4),e.y,Math.round(d),src.crit?1:0]);else fxPush(['hit',e.x,e.y,'#ccc']);
  if(e.hp<=0)killEnt(e,pid);
}
function onHit(e,p){
  if(e.dead)return;
  if(p.chill&&!e.def.node){e.chill+=p.chill*28;if(e.chill>=100){if(e.def.boss)e.chill=100;else{e.frozen=2.2;e.chill=0}}}
  if(p.burn&&!e.def.node){e.burn=3;e.burnDps=Math.max(e.burnDps,p.burn);e.burnBy=p.o}
  if(p.chain){const hit=new Set([e.id]);let from=e;
    for(let i=0;i<p.chain;i++){let best=null,bd=80*80;for(const o of W.ents.values()){if(hit.has(o.id)||!isHittable(o)||o.def.node)continue;const dd=d2(o.x,o.y,from.x,from.y);if(dd<bd){bd=dd;best=o}}
      if(!best)break;hit.add(best.id);fxPush(['zap',from.x,from.y,best.x,best.y]);dmgEnt(best,p.d*0.6,{kw:p.kw},p.o);from=best}}
}
function killEnt(e,pid){
  e.dead=true;W.ents.delete(e.id);const d=e.def;
  if(d.drop)for(const mat in d.drop){const [a,b]=d.drop[mat];let amt=irnd(a,b);if(amt<=0)continue;
    const piles=d.boss||d.mb?4:1;for(let i=0;i<piles;i++){const part=Math.ceil(amt/piles);if(part<=0)continue;
      spawnEnt('loot',e.x+rnd(-8,8),e.y+rnd(-8,8),{mat,amt:part,aux:MAT_KEYS.indexOf(mat),life:90,vx:rnd(-40,40),vy:rnd(-40,40)})}}
  if(d.xp)Net.bcast({t:'xp',a:d.xp});
  fxPush(['boom',e.x,e.y,d.boss?60:d.node?10:14,d.node?'#ccc':'#f84']);fxPush(['snd',d.node?'mine':'kill']);
  if(d.mb){ZS.flags.mb=true;dirty();toastAll('De kluis is ontgrendeld! Pak het unieke wapen.','#ffe14d');hostSaveWorld()}
  if(d.boss)bossKilled(e);
}
function bossKilled(e){
  const f=ZS.flags;f.boss=true;HW.parts[W.ch]=true;HW.story=Math.max(HW.story,Math.min(4,W.ch+1));ZS.story=HW.story;dirty();
  toastAll(`${e.def.n} verslagen! Scheepsonderdeel gevonden: ${PARTS[W.ch]}. De poort in de arena is open.`,'#ff8');
  fxPush(['snd','victory']);hostSaveWorld();
}
function hurtPlayer(pid,dmg,kind){Net.to(pid,{t:'hurt',d:dmg,k:kind||''})}

// ---------- Vijanden ----------
function alivePlayers(){return Object.values(W.players).filter(p=>!p.dn&&p.hp>0&&p.x!=null)}
function nearestPlayer(x,y,maxD){let best=null,bd=maxD*maxD;for(const p of alivePlayers()){const d=d2(x,y,p.x,p.y);if(d<bd){bd=d;best=p}}return best}
function nearestEnemy(x,y,maxD){let best=null,bd=maxD*maxD;for(const e of W.ents.values()){if(!isHittable(e)||e.def.node)continue;const d=d2(x,y,e.x,e.y);if(d<bd){bd=d;best=e}}return best}
function buildFlow(){
  const N=MW*MH;const f=W.flow||(W.flow=new Int16Array(N));f.fill(-1);const q=new Int32Array(N);let h=0,tl=0;
  for(const p of alivePlayers()){const i=Math.floor(p.y/TS)*MW+Math.floor(p.x/TS);if(i>=0&&i<N&&f[i]<0){f[i]=0;q[tl++]=i}}
  while(h<tl){const i=q[h++];const x=i%MW,y=(i/MW)|0;const dv=f[i]+1;if(dv>70)continue;
    for(const [dx,dy] of DIR4){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=MW||ny>=MH)continue;const j=ny*MW+nx;if(f[j]>=0||solidT(nx,ny))continue;f[j]=dv;q[tl++]=j}}
}
function flowDir(x,y){const tx=Math.floor(x/TS),ty=Math.floor(y/TS);const f=W.flow;if(!f)return null;const c=f[ty*MW+tx];if(!(c>=0))return null;
  let best=null,bv=c;for(const [dx,dy] of DIR8){const nx=tx+dx,ny=ty+dy;if(solidT(nx,ny))continue;if(dx&&dy&&(solidT(tx+dx,ty)||solidT(tx,ty+dy)))continue;
    const v=f[ny*MW+nx];if(v>=0&&v<bv){bv=v;best=[dx,dy]}}
  if(!best)return null;const gx=(tx+best[0])*TS+8-x,gy=(ty+best[1])*TS+8-y;const L=Math.hypot(gx,gy)||1;return[gx/L,gy/L]}
function stepToward(e,tx,ty,spd,dt){let dx=tx-e.x,dy=ty-e.y;const L=Math.hypot(dx,dy)||1;dx/=L;dy/=L;
  if(!e.def.fly&&!los(e.x,e.y,tx,ty)){const fd=flowDir(e.x,e.y);if(fd){dx=fd[0];dy=fd[1]}}
  moveC(e,dx*spd*dt,dy*spd*dt,entR(e)*0.8)}
function shootE(e,a,shot,dmg){W.proj.push({x:e.x,y:e.y,vx:Math.cos(a)*shot.spd,vy:Math.sin(a)*shot.spd,d:dmg!=null?dmg:e.def.dmg,r:3,l:3,k:shot.k||'eb',o:'e',
  fx:shot.k==='ep'?'poison':shot.k==='ef'?'burn':''})}
function ringShots(e,n,shot,dmg,off){for(let i=0;i<n;i++)shootE(e,(off||0)+i*TAU/n,shot,dmg)}
function puddle(x,y,r,life,dps,kind){spawnEnt(kind==='lava'?'pl':'pp',x,y,{r,aux:r,life,dps,kind,tt:0.5})}

function aiUpdate(e,dt){
  const d=e.def;
  if(e.flash>0)e.flash-=dt;
  if(e.burn>0){e.burn-=dt;e.burnAcc=(e.burnAcc||0)+e.burnDps*dt;if(e.burnAcc>=5){const b=e.burnAcc;e.burnAcc=0;dmgEnt(e,b,{},e.burnBy)}if(e.burn<=0)e.burnDps=0}
  if(e.dead)return;
  if(e.vuln>0){e.vuln-=dt;if(e.vuln<=0){e.ar=e.mar*0.7;fxPush(['txt',e.x,e.y,'PANTSER HERSTELD','#8cf'])}}
  if(e.frozen>0){e.frozen-=dt;return}
  if(e.chill>0)e.chill=Math.max(0,e.chill-dt*15);
  const slow=1-Math.min(0.5,e.chill/200);
  e.cd-=dt;e.t+=dt;
  if(d.boss){bossAI(e,dt,slow);return}
  let tg;
  if(d.mb){tg=nearestPlayer(e.home.x,e.home.y,260);
    if(tg&&!e.scaled){e.scaled=1;const s=hpScale();e.mhp=d.hp*s;e.hp=e.mhp}
    if(!tg){if(d2(e.x,e.y,e.home.x,e.home.y)>100)stepToward(e,e.home.x,e.home.y,d.spd,dt);e.hp=Math.min(e.mhp,e.hp+e.mhp*0.05*dt);return}}
  else tg=nearestPlayer(e.x,e.y,280);
  if(!tg){if(!(e.wt>0)){e.wt=rnd(1,3);e.wa=rnd(0,TAU)}e.wt-=dt;moveC(e,Math.cos(e.wa)*d.spd*0.3*dt,Math.sin(e.wa)*d.spd*0.3*dt,entR(e)*0.8);return}
  e.face=tg.x<e.x?1:0;
  const dist=Math.sqrt(d2(e.x,e.y,tg.x,tg.y));const reach=entR(e)+9;
  const melee=(mul)=>{if(dist<reach&&e.cd<=0){e.cd=0.9;hurtPlayer(tg.id,d.dmg*(mul||1),'')}};
  if(d.ai==='melee'){stepToward(e,tg.x,tg.y,d.spd*slow,dt);melee();return}
  if(d.ai==='ranged'){const see=los(e.x,e.y,tg.x,tg.y);
    if(dist>d.range*0.8||!see)stepToward(e,tg.x,tg.y,d.spd*slow,dt);
    else if(dist<d.range*0.45)moveC(e,(e.x-tg.x)/dist*d.spd*0.7*dt*slow,(e.y-tg.y)/dist*d.spd*0.7*dt*slow,entR(e)*0.8);
    if(see&&dist<d.range&&e.cd<=0){e.cd=1/d.rate*rnd(0.8,1.3);shootE(e,Math.atan2(tg.y-e.y,tg.x-e.x),d.shot)}return}
  if(d.ai==='charger'||d.ai==='mb'){
    if(e.chg>0){e.chg-=dt;const hit=moveC(e,e.cvx*dt,e.cvy*dt,entR(e)*0.8);
      if(dist<reach+4&&!e.chHit){e.chHit=1;hurtPlayer(tg.id,d.dmg*1.5,'')}if(hit)e.chg=0;return}
    if(e.wu>0){e.wu-=dt;if(e.wu<=0){const a=Math.atan2(tg.y-e.y,tg.x-e.x);const sp=d.spd*(d.mb?5:4);e.cvx=Math.cos(a)*sp;e.cvy=Math.sin(a)*sp;e.chg=0.6;e.chHit=0}return}
    if(d.mb){e.at-=dt;if(e.at<=0){e.at=rnd(3,4.5);
      if(e.k==='mb1'){for(let i=0;i<2;i++)spawnEnt('crawler',e.x+rnd(-20,20),e.y+rnd(-20,20))}
      if(e.k==='mb2'){const a=Math.atan2(tg.y-e.y,tg.x-e.x);for(let i=-2;i<=2;i++)shootE(e,a+i*0.22,{spd:130,k:'ep'});puddle(tg.x,tg.y,22,5,10,'poison')}
      if(e.k==='mb3'){ringShots(e,12,{spd:120,k:'ef'},d.dmg*0.6,e.t)}}}
    if(dist<140&&e.cd<=0&&los(e.x,e.y,tg.x,tg.y)){e.wu=0.6;e.cd=d.mb?2.2:2.6;return}
    stepToward(e,tg.x,tg.y,d.spd*slow,dt);if(dist<reach&&(e.mcd||0)<=0){e.mcd=0.9;hurtPlayer(tg.id,d.dmg,'')}e.mcd=(e.mcd||0)-dt;
  }
}
function bossAI(e,dt,slow){
  const d=e.def,ax=MAP.arenaPx.x,ay=MAP.arenaPx.y;
  const ps=alivePlayers().filter(p=>inArena(p.x));
  if(!e.active){if(ps.length){e.active=true;e.t=0;e.at=2;const s=hpScale();e.mhp=d.hp*s;e.hp=e.mhp;e.mar=d.armor*s;e.ar=e.mar;
      toastAll(`⚠ ${d.n} ontwaakt! Alleen de ${WEAPONS[d.key].n} doorbreekt het pantser.`,'#ff6');fxPush(['snd','roar'])}return}
  if(!ps.length){e.idle=(e.idle||0)+dt;if(e.idle>8){e.active=false;e.hp=e.mhp;e.ar=e.mar;e.vuln=0;e.x=ax;e.y=ay;e.idle=0}return}
  e.idle=0;
  let tg=ps[0];for(const p of ps)if(d2(p.x,p.y,e.x,e.y)<d2(tg.x,tg.y,e.x,e.y))tg=p;
  const rage=e.hp<e.mhp*0.5?1.4:1;e.at-=dt*rage;e.face=tg.x<e.x?1:0;
  const ang=Math.atan2(tg.y-e.y,tg.x-e.x),dist=Math.sqrt(d2(e.x,e.y,tg.x,tg.y));
  if(e.k==='boss1'){
    if(!(e.stomp>0)&&dist>60)moveC(e,Math.cos(ang)*d.spd*slow*dt,Math.sin(ang)*d.spd*slow*dt,14);
    if(e.burst>0){e.bt-=dt;if(e.bt<=0){e.bt=0.14;e.burst--;shootE(e,ang+rnd(-0.08,0.08),{spd:170,k:'eb'},d.dmg*0.6)}}
    if(e.stomp>0){e.stomp-=dt;e.wu=e.stomp;if(e.stomp<=0){e.wu=0;fxPush(['ring',e.x,e.y,90,'#fc6']);fxPush(['snd','boom']);
      for(const p of ps)if(d2(p.x,p.y,e.x,e.y)<90*90)hurtPlayer(p.id,d.dmg*1.3,'')}}
    if(e.at<=0){const ph=e.ph=((e.ph||0)+1)%4;e.at=2.3;
      if(ph===0)ringShots(e,16,{spd:120,k:'eb'},d.dmg*0.6,e.t);
      if(ph===1){e.burst=6;e.bt=0}
      if(ph===2)for(let i=0;i<3;i++)spawnEnt('drone',e.x+rnd(-30,30),e.y+rnd(-30,30));
      if(ph===3){e.stomp=0.8;fxPush(['txt',e.x,e.y,'!!','#f44'])}}
  }else if(e.k==='boss2'){
    if(e.spiral>0){e.spiral-=dt;e.sa=(e.sa||0)+dt*2.2;e.bt-=dt;if(e.bt<=0){e.bt=0.09;for(let k=0;k<3;k++)shootE(e,e.sa+k*TAU/3,{spd:110,k:'ep'},d.dmg*0.5)}}
    if(e.at<=0){const ph=e.ph=((e.ph||0)+1)%4;e.at=2.7;
      if(ph===0){e.spiral=2.6;e.bt=0}
      if(ph===1)for(let i=0;i<2;i++)spawnEnt('vine',e.x+rnd(-40,40),e.y+rnd(-40,40));
      if(ph===2)for(const p of ps)puddle(p.x,p.y,26,6,10,'poison');
      if(ph===3)for(let i=-4;i<=4;i++)shootE(e,ang+i*0.11,{spd:150,k:'ep'},d.dmg*0.7)}
  }else if(e.k==='boss3'){
    if(e.lw>0){e.lw-=dt;e.wu=e.lw;if(e.lw<=0){e.wu=0;e.lunge=0.7;e.lvx=Math.cos(ang)*330;e.lvy=Math.sin(ang)*330;e.lhit=0}}
    else if(e.lunge>0){e.lunge-=dt;moveC(e,e.lvx*dt,e.lvy*dt,14);
      if(!e.lhit&&dist<30){e.lhit=1;hurtPlayer(tg.id,d.dmg*1.4,'burn')}
      e.trT=(e.trT||0)-dt;if(e.trT<=0){e.trT=0.12;puddle(e.x,e.y,14,4,14,'lava')}}
    else{e.pt=(e.pt||0)+dt*0.6*rage;const tx=ax+Math.sin(e.pt)*120,ty=ay+Math.sin(e.pt*1.7)*95;const a=Math.atan2(ty-e.y,tx-e.x);
      moveC(e,Math.cos(a)*d.spd*slow*dt,Math.sin(a)*d.spd*slow*dt,14)}
    if(e.at<=0&&!(e.lunge>0)&&!(e.lw>0)){const ph=e.ph=((e.ph||0)+1)%4;e.at=2.1;
      if(ph===0)for(let i=-3;i<=3;i++)shootE(e,ang+i*0.15,{spd:170,k:'ef'},d.dmg*0.6);
      if(ph===1){e.lw=0.6;fxPush(['txt',e.x,e.y,'!!','#f44'])}
      if(ph===2)ringShots(e,18,{spd:110,k:'ef'},d.dmg*0.55,e.t);
      if(ph===3){for(let i=0;i<3;i++)puddle(ax+rnd(-150,150),ay+rnd(-120,120),24,6,14,'lava');puddle(tg.x,tg.y,24,6,14,'lava')}}
  }
}

// ---------- Hoofdlus host ----------
function stBits(e){return (e.frozen>0?1:0)|(e.burn>0?2:0)|(e.chill>0?4:0)|(e.flash>0?8:0)|(e.vuln>0?16:0)|(e.wu>0?32:0)|(e.active?64:0)|(e.face?128:0)}
function findSpawnSpot(minD,maxD,cx,cy){
  for(let tries=0;tries<30;tries++){const f=MAP.floors[Math.floor(Math.random()*MAP.floors.length)];const x=tc(f[0]),y=tc(f[1]);
    if(cx!=null){if(d2(x,y,cx,cy)>maxD*maxD||d2(x,y,cx,cy)<minD*minD)continue}
    else{let md=1e9;for(const p of Object.values(W.players))if(p.x!=null)md=Math.min(md,Math.sqrt(d2(x,y,p.x,p.y)));if(md<minD||md>maxD)continue}
    if(W.ch<4&&d2(x,y,MAP.spawnPx.x,MAP.spawnPx.y)<(10*TS)**2)continue;
    return{x,y}}
  return null;
}
function hostTick(dt){
  W.t+=dt;
  for(const id in W.players)if(id!=='h'&&W.t-(W.players[id].seen||0)>20&&!Net.conns[id])delete W.players[id];
  W.flowT-=dt;if(W.flowT<=0){W.flowT=0.4;buildFlow()}
  // Spawnen
  const Z=ZONES[W.ch],np=nPlayers();let cap=Z.cap+3*(np-1),rate=1.2;
  if(W.ch===4){if(W.finale.state==='launch'){cap=22+4*np;rate=0.45}}
  let cnt=0,nodes=0;for(const e of W.ents.values()){if(e.def.ai&&!e.def.boss&&!e.def.mb)cnt++;if(e.def.node)nodes++}
  W.spawnT-=dt;
  if(W.spawnT<=0&&cnt<cap){W.spawnT=rate;
    const p=W.ch===4&&W.finale.state==='launch'?findSpawnSpot(260,480,MAP.ship.x,MAP.ship.y):findSpawnSpot(240,520);
    if(p)spawnEnt(pick(Z.enemies),p.x,p.y)}
  W.nodeT-=dt;if(W.nodeT<=0){W.nodeT=2.5;if(nodes<Z.nodeCap){const p=findSpawnSpot(260,4000);if(p)spawnEnt(pick(Z.nodes),p.x,p.y)}}
  // Entiteiten
  const domes=[];
  for(const e of [...W.ents.values()]){
    if(e.dead)continue;const k=e.k;
    if(e.def.ai||e.def.boss){aiUpdate(e,dt);
      if(!e.def.boss&&!e.def.mb&&e.t>5){let near=false;for(const p of Object.values(W.players))if(p.x!=null&&d2(p.x,p.y,e.x,e.y)<950*950){near=true;break}if(!near)W.ents.delete(e.id)}
      continue}
    if(e.def.node){if(e.flash>0)e.flash-=dt;continue}
    if(k==='crate'){for(const p of alivePlayers()){const dd=Math.sqrt(d2(p.x,p.y,e.x,e.y));const need=7+5+3;
        if(dd<need&&dd>0.01){const push=need-dd;moveC(e,(e.x-p.x)/dd*push,(e.y-p.y)/dd*push,6)}}continue}
    if(k==='loot'){e.life-=dt;if(e.life<=0){W.ents.delete(e.id);continue}
      e.x+=e.vx*dt;e.y+=e.vy*dt;e.vx*=0.9;e.vy*=0.9;
      const p=nearestPlayer(e.x,e.y,60);if(p){const dd=Math.sqrt(d2(p.x,p.y,e.x,e.y))||1;e.x+=(p.x-e.x)/dd*180*dt;e.y+=(p.y-e.y)/dd*180*dt;
        if(dd<10){W.ents.delete(e.id);Net.to(p.id,{t:'gain',items:{[e.mat]:e.amt}})}}continue}
    if(k==='pp'||k==='pl'){e.life-=dt;if(e.life<=0){W.ents.delete(e.id);continue}e.tt-=dt;
      if(e.tt<=0){e.tt=0.5;for(const p of alivePlayers())if(d2(p.x,p.y,e.x,e.y)<e.r*e.r)hurtPlayer(p.id,e.dps*0.5,e.kind==='lava'?'burn':'poison')}continue}
    if(k==='dome'){e.life-=dt;if(e.life<=0){W.ents.delete(e.id);continue}domes.push(e);continue}
    if(k==='hdrone'){e.life-=dt;const o=W.players[e.owner];if(e.life<=0||!o){W.ents.delete(e.id);continue}
      e.x=o.x+Math.cos(W.t*2)*14;e.y=o.y+Math.sin(W.t*2)*14;e.ht-=dt;
      if(e.ht<=0){e.ht=0.5;for(const p of Object.values(W.players))if(!p.dn&&d2(p.x,p.y,o.x,o.y)<e.range*e.range)Net.to(p.id,{t:'heal',a:e.heal*0.5})}continue}
    if(k==='storm'){e.life-=dt;const o=W.players[e.owner];if(e.life<=0||!o){W.ents.delete(e.id);continue}e.x=o.x;e.y=o.y;e.zt-=dt;
      if(e.zt<=0){e.zt=0.3;const list=[...W.ents.values()].filter(t=>isHittable(t)&&!t.def.node&&d2(t.x,t.y,o.x,o.y)<150*150).sort((a,b)=>d2(a.x,a.y,o.x,o.y)-d2(b.x,b.y,o.x,o.y)).slice(0,3);
        for(const t of list){fxPush(['zap',o.x,o.y,t.x,t.y]);dmgEnt(t,e.d,{},e.owner)}if(list.length)fxPush(['snd','zap'])}continue}
    if(k==='orb'){e.life-=dt;if(e.life<=0){W.ents.delete(e.id);fxPush(['beam',e.x,e.y]);fxPush(['boom',e.x,e.y,60,'#f6f']);fxPush(['snd','boom']);
        aoe(e.x,e.y,50,e.d,{kw:'*'},e.owner)}continue}
  }
  // Projectielen
  for(let i=W.proj.length-1;i>=0;i--){const p=W.proj[i];p.l-=dt;const nx=p.x+p.vx*dt,ny=p.y+p.vy*dt;
    if(p.k==='gren'){if(p.l<=0||solidP(nx,ny)){W.proj.splice(i,1);fxPush(['boom',p.x,p.y,p.rad,'#f6f']);fxPush(['snd','boom']);
        aoe(p.x,p.y,p.rad,p.d,{},p.o,p.burn?(e=>{e.burn=4;e.burnDps=Math.max(e.burnDps,p.burn);e.burnBy=p.o}):null)}else{p.x=nx;p.y=ny}continue}
    if(p.l<=0||solidP(nx,ny)){if(p.l>0)fxPush(['hit',p.x,p.y,'#ccc']);W.proj.splice(i,1);continue}
    p.x=nx;p.y=ny;
    if(p.o==='e'){let gone=false;
      for(const dm of domes)if(d2(dm.x,dm.y,p.x,p.y)<dm.r*dm.r){if(Math.random()<dm.refl){p.o=dm.owner;p.vx*=-1;p.vy*=-1;p.d*=1.5;p.k='bolt'}else gone=true;break}
      if(!gone&&p.o==='e')for(const pl of alivePlayers())if(d2(pl.x,pl.y,p.x,p.y)<(5+p.r)**2){hurtPlayer(pl.id,p.d,p.fx);gone=true;break}
      if(gone){fxPush(['hit',p.x,p.y,'#fa6']);W.proj.splice(i,1)}continue}
    for(const e of W.ents.values()){if(!isHittable(e))continue;const rr=entR(e)+p.r;
      if(d2(e.x,e.y,p.x,p.y)<rr*rr){if(p.hit&&p.hit.has(e.id))continue;dmgEnt(e,p.d,p,p.o);onHit(e,p);
        if(p.pierce>0){p.pierce--;(p.hit||(p.hit=new Set())).add(e.id)}else{p.l=-1;break}}}
    if(p.l<=0)W.proj.splice(i,1);
  }
  puzzleTick(dt);buildingTick(dt);finaleTick(dt);
  // Netwerk
  W.zsT-=dt;W.snapT-=dt;
  if(W.snapT<=0){W.snapT=0.05;if(Net.nConns())Net.bcast(packSnap(),true);W.fx=[]}
  if(W.dirty&&W.zsT<=0){W.zsT=0.2;W.dirty=false;ZS.story=HW.story;ZS.won=HW.won;Net.bcast({t:'zs',zs:ZS},true);UI.zsChanged()}
  W.saveT+=dt;if(W.saveT>30){W.saveT=0;hostSaveWorld()}
}
function packSnap(){
  const E=[];for(const e of W.ents.values())E.push([e.id,e.k,Math.round(e.x),Math.round(e.y),Math.ceil(e.hp),Math.ceil(e.mhp),Math.ceil(e.ar),Math.ceil(e.mar),stBits(e),Math.round(e.aux||0)]);
  const B=W.proj.map(p=>[Math.round(p.x),Math.round(p.y),Math.round(p.vx),Math.round(p.vy),p.k]);
  return{t:'s',E,B,P:Object.values(W.players),fx:W.fx};
}
function puzzleTick(dt){
  const f=ZS.flags;if(f.gate||W.ch>3)return;const P=MAP.rooms.puzzle;
  if(W.ch===2){const pr=MAP.plates.map(pl=>{const x=tc(pl[0]),y=tc(pl[1]);
      for(const p of alivePlayers())if(d2(p.x,p.y,x,y)<12*12)return 1;
      for(const e of W.ents.values())if(e.k==='crate'&&d2(e.x,e.y,x,y)<12*12)return 1;return 0});
    if(pr.join()!==ZS.plates.join()){ZS.plates=pr;dirty()}
    const all=pr.every(v=>v),any=pr.some(v=>v);
    W.plateProg=all?W.plateProg+dt:Math.max(0,W.plateProg-dt*0.6);
    if(any){W.waveT-=dt;if(W.waveT<=0){W.waveT=5;for(let i=0;i<2;i++){const s=findSpawnSpot(90,200,tc(P.x),tc(P.y));if(s)spawnEnt(pick(['vine','spitter','crawler']),s.x,s.y)}}}
    const pg=Math.round(W.plateProg/8*20)/20;if(pg!==ZS.plateProg){ZS.plateProg=pg;dirty()}
    if(W.plateProg>=8)openGate('De drukplaten houden — de jungletempel opent zich!');
  }
  if(W.ch===3){for(const p of alivePlayers())MAP.runes.forEach((r,i)=>{const on=d2(p.x,p.y,tc(r[0]),tc(r[1]))<11*11;const key=p.id+'|'+i;
      if(on&&!W.runeOn[key]&&!ZS.flags.gate){
        if(MAP.seq[ZS.runeProg]===i){ZS.runeProg++;fxPush(['snd','rune']);fxPush(['ring',tc(r[0]),tc(r[1]),14,'#ff8']);
          if(ZS.runeProg>=MAP.seq.length)openGate('De runen gloeien op — de vulkaanpoort opent!')}
        else{ZS.runeProg=0;toastAll('Verkeerde volgorde! De wachters ontwaken…','#f88');fxPush(['snd','wrong']);
          for(let k=0;k<3;k++){const s=findSpawnSpot(80,180,tc(P.x),tc(P.y));if(s)spawnEnt(pick(ZONES[3].enemies),s.x,s.y)}}
        dirty()}
      W.runeOn[key]=on})}
}
function buildingTick(dt){
  for(const b of ZS.buildings){const bt=W.bT[b.id]||(W.bT[b.id]={t:Math.random()});bt.t+=dt;const bx=tc(b.tx),by=tc(b.ty);
    if(b.k==='ammo'&&bt.t>=15){bt.t=0;HW.storage.cellen=(HW.storage.cellen||0)+4;dirty()}
    if(b.k==='turret'&&bt.t>=0.55){const tg=nearestEnemy(bx,by,150);if(tg&&los(bx,by,tg.x,tg.y)){bt.t=0;const a=Math.atan2(tg.y-by,tg.x-bx);b.a=a;
      W.proj.push({x:bx,y:by,vx:Math.cos(a)*320,vy:Math.sin(a)*320,d:10*W.ch,r:2,l:0.6,k:'bolt',o:'t',pierce:0});fxPush(['snd','turret'])}}
    if(b.k==='med'&&bt.t>=1){bt.t=0;for(const p of Object.values(W.players))if(!p.dn&&d2(p.x,p.y,bx,by)<56*56)Net.to(p.id,{t:'heal',a:6})}}
}
function finaleTick(dt){
  if(W.ch!==4||W.finale.state!=='launch')return;W.finale.t+=dt;
  if(Math.floor(W.finale.t*2)!==Math.floor((W.finale.t-dt)*2))dirty();
  const ps=Object.values(W.players);
  if(ps.length&&ps.every(p=>p.dn||p.hp<=0)){W.finale.state='idle';W.finale.t=0;dirty();toastAll('Iedereen is uitgeschakeld — de lancering is afgebroken. Probeer opnieuw!','#f88');return}
  if(W.finale.t>=90){W.finale.state='won';HW.won=true;dirty();hostSaveWorld();Net.bcast({t:'victory'})}
}
