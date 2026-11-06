'use strict';
// ===== Lokale speler, client-staat, savegames =====
let SAVE=null,CHAR=null,D=null,LP=null,ZS=null;
const VIEW={ents:new Map(),proj:[],players:{}};
const GAME={on:false,ch:1,replay:false,t:0,saveT:0,sendT:0,exploreT:0,victory:false};
let EXPLORED=null;
// Camera: 'top' (top-down), 'third' (3e persoon), 'first' (first person)
const CAM={mode:'top',zoom:{top:1,third:1,first:1},yaw:-Math.PI/2,pitch:0};
const CAM_MODES=['top','third','first'],CAM_NAMES={top:'Top-down',third:'3e persoon',first:'First person'};
const LSKEY='noodlanding_save_v1';

function loadSave(){try{const s=JSON.parse(localStorage.getItem(LSKEY));if(s&&s.char){s.snaps=s.snaps||{};s.wsnaps=s.wsnaps||{};s.world=s.world||newWorld();s.opts=s.opts||{};return s}}catch(e){}return null}
function writeSave(){try{localStorage.setItem(LSKEY,JSON.stringify(SAVE))}catch(e){console.warn('opslaan mislukt',e)}}
function saveGame(){if(!SAVE)return;SAVE.opts.cam=CAM.mode;SAVE.opts.zoom=CAM.zoom;writeSave()}
function myId(){return Net.role==='client'?Net.myId:'h'}
function recalc(){D=derive(CHAR);if(LP){LP.hp=Math.min(LP.hp,D.mhp);LP.sh=Math.min(LP.sh,D.msh)}}

function enterChapterLocal(ch,replay){
  GAME.ch=ch;GAME.replay=replay;GAME.on=true;GAME.victory=false;
  if(Net.role==='client')MAP=genMap(ch);
  EXPLORED=new Uint8Array(MW*MH);
  if(!replay){CHAR=SAVE.char;if(!SAVE.snaps[ch]){SAVE.snaps[ch]=deepCopy(SAVE.char)}writeSave()}
  else CHAR=deepCopy(SAVE.snaps[ch]||SAVE.char);
  D=derive(CHAR);
  if(Net.role==='client'){ZS={ch,replay,flags:{fuses:[],gate:false,pipes:MAP.pipe.rot0.slice(),mb:false,vault:false,boss:false,fixed:false},
    buildings:[],storage:{},parts:{},plates:[0,0,0],plateProg:0,runeProg:0,finale:{state:'idle',t:0}};VIEW.ents=new Map();VIEW.proj=[];VIEW.players={}}
  else{VIEW.ents=W.ents;VIEW.proj=W.proj;VIEW.players=W.players}
  const idx=Object.keys(VIEW.players).length;
  LP={x:MAP.spawnPx.x+(idx%3-1)*14,y:MAP.spawnPx.y+Math.floor(idx/3)*14,a:-Math.PI/2,hp:D.mhp,sh:D.msh,st:D.mst,dn:0,dnT:0,iv:2,
    cd:[0,0,0],cdMax:[1,1,1],ucd:0,ucdMax:1,fireT:0,wi:0,mcd:0,oc:0,ocRate:1,ocCrit:0,titan:0,dots:[],lastHit:9,mv:0,anim:0,swing:0,revT:0,hazAcc:0,bob:0};
  CAM.yaw=-Math.PI/2;
  R3.buildZone();
  UI.enterGame();
  toast(`Hoofdstuk ${ch}: ${ZONES[ch].n}${replay?' (herhaling)':''}`,'#ffe14d',4500);
  sendState(true);
}

function sendState(){
  if(!LP)return;const w=CHAR.loadout[LP.wi]||'blaster';
  Net.toHost({t:'p',s:{name:CHAR.name,color:CHAR.color,x:Math.round(LP.x*10)/10,y:Math.round(LP.y*10)/10,a:Math.round(LP.a*100)/100,
    hp:Math.ceil(LP.hp),mhp:D.mhp,sh:Math.ceil(LP.sh),msh:D.msh,dn:LP.dn,w,iv:LP.iv>0?1:0,mv:LP.mv?1:0,lvl:CHAR.level,
    gear:{m:CHAR.suit.mask?1:0,h:CHAR.suit.heat?1:0}}});
}

// ---------- Berichten van de host ----------
function clientRecv(m){
  switch(m.t){
    case 'welcome':Net.myId=m.id;enterChapterLocal(m.ch,m.replay);break;
    case 'chapter':if(Net.role==='client'){saveGame();enterChapterLocal(m.ch,m.replay)}break;
    case 'zs':if(Net.role==='client'){ZS=m.zs;UI.zsChanged()}break;
    case 's':if(Net.role==='client')applySnap(m);break;
    case 'hurt':takeDamage(m.d,m.k);break;
    case 'gain':gainItems(m.items,m.raw);break;
    case 'xp':addXP(m.a);break;
    case 'heal':if(LP&&!LP.dn)LP.hp=Math.min(D.mhp,LP.hp+m.a);break;
    case 'revive':if(LP&&LP.dn){LP.dn=0;LP.hp=D.mhp*0.4;LP.iv=2;toast('Je bent gereanimeerd!','#8f8')}break;
    case 'phoenix':if(LP){LP.dn=0;LP.hp=D.mhp;LP.sh=D.msh;LP.iv=5;LP.dots=[];toast('Feniks-protocol! Volledig hersteld.','#fd6')}break;
    case 'weapon':if(!CHAR.weapons[m.id]){CHAR.weapons[m.id]={lvl:1};if(!CHAR.loadout[1])CHAR.loadout[1]=m.id;
      toast(`UNIEK WAPEN: ${WEAPONS[m.id].n}! Uitgerust in slot 2.`,'#ffe14d',5000);sfx('lvl');saveGame()}
      else toast('Je hebt dit wapen al.');break;
    case 'refund':for(const k in m.c)CHAR.inv[k]=(CHAR.inv[k]||0)+m.c[k];if(m.m)toast(m.m,'#f88');break;
    case 'toast':toast(m.m,m.c);break;
    case 'victory':GAME.victory=true;UI.open('victory');sfx('victory');saveGame();break;
  }
}
function applySnap(m){
  const seen=new Set();
  for(const a of m.E){let e=VIEW.ents.get(a[0]);
    if(!e){e={id:a[0],k:a[1],x:a[2],y:a[3],def:ENEMIES[a[1]]||{}};VIEW.ents.set(a[0],e)}
    e.tx=a[2];e.ty=a[3];e.hp=a[4];e.mhp=a[5];e.ar=a[6];e.mar=a[7];e.st=a[8];e.aux=a[9];e.active=!!(a[8]&64);seen.add(a[0])}
  for(const id of [...VIEW.ents.keys()])if(!seen.has(id))VIEW.ents.delete(id);
  VIEW.proj=m.B.map(b=>({x:b[0],y:b[1],vx:b[2],vy:b[3],k:b[4]}));
  const pl={};for(const p of m.P){const o=VIEW.players[p.id]||{rx:p.x,ry:p.y};Object.assign(o,p);pl[p.id]=o}VIEW.players=pl;
  for(const f of m.fx)playFx(f);
}
function smoothView(dt){
  const k=Math.min(1,dt*14);
  for(const e of VIEW.ents.values()){if(e.tx==null)continue;if(d2(e.x,e.y,e.tx,e.ty)>80*80){e.x=e.tx;e.y=e.ty}else{e.x+=(e.tx-e.x)*k;e.y+=(e.ty-e.y)*k}}
  for(const p of VIEW.proj){p.x+=p.vx*dt;p.y+=p.vy*dt}
  for(const id in VIEW.players){const p=VIEW.players[id];if(p.rx==null){p.rx=p.x;p.ry=p.y}p.rx+=(p.x-p.rx)*k;p.ry+=(p.y-p.ry)*k}
}
function clientLost(){if(!GAME.on&&!UI.cur)return;toast('Verbinding met de host verbroken.','#f88',5000);saveGame();backToMenu()}
function backToMenu(){saveGame();Net.close();GAME.on=false;W=null;LP=null;UI.showMain()}

// ---------- Inventaris, XP ----------
function gainItems(items,raw){
  for(const k in items){let a=items[k];if(!raw&&k!=='cellen'&&k!=='nano')a=Math.max(1,Math.round(a*D.yield));CHAR.inv[k]=(CHAR.inv[k]||0)+a;
    if(LP)floatText(LP.x,LP.y,`+${a} ${MATS[k].n}`,MATS[k].c)}
  sfx('pickup');
}
function addXP(a){
  CHAR.xp+=a;let up=0;
  while(CHAR.xp>=xpNeed(CHAR.level)){CHAR.xp-=xpNeed(CHAR.level);CHAR.level++;CHAR.statPts+=3;CHAR.skillPts+=1;up++}
  if(up){recalc();if(LP){LP.hp=D.mhp;LP.sh=D.msh}toast(`NIVEAU ${CHAR.level}! +${3*up} statpunten, +${up} vaardigheidspunt (Tab)`,'#8ff',4000);sfx('lvl');
    if(LP)playFx(['ring',LP.x,LP.y,30,'#8ff']);saveGame()}
}

// ---------- Schade & dood ----------
function takeDamage(dmg,kind){
  const L=LP;if(!L||L.dn||L.iv>0)return;
  if(kind==='poison'||kind==='burn')L.dots.push({dps:kind==='poison'?4:5,t:3,kind});
  let d=dmg*(1-D.armor);L.lastHit=0;
  if(L.sh>0){const a=Math.min(L.sh,d);L.sh-=a;d-=a}
  L.hp-=d;R3.hurtFlash(Math.min(1,dmg/30));sfx('hurt');
  if(L.hp<=0)goDown();
}
function othersCount(){return Object.keys(VIEW.players).filter(k=>k!==myId()).length}
function goDown(){const L=LP;L.hp=0;L.dn=1;L.dnT=othersCount()?15:4;L.dots=[];
  toast(othersCount()?'Je bent neergegaan! Een teamgenoot kan je reanimeren (E vasthouden).':'Je bent neergegaan…','#f66',4000);sendState()}
function respawn(){const L=LP;let p={x:MAP.spawnPx.x,y:MAP.spawnPx.y},bd=1e18;
  for(const b of ZS.buildings)if(b.k==='med'){const dd=d2(tc(b.tx),tc(b.ty),L.x,L.y);if(dd<bd){bd=dd;p={x:tc(b.tx),y:tc(b.ty)+14}}}
  L.x=p.x;L.y=p.y;L.dn=0;L.hp=D.mhp;L.sh=D.msh;L.iv=2;toast('Gerespawnd.','#8f8')}

// ---------- Richten ----------
function aimPoint(dist){const L=LP;
  if(CAM.mode==='top'&&!Input.usePad){const w=R3.mouseWorld();if(w){const dd=Math.hypot(w.x-L.x,w.y-L.y);if(!dist||dd<=dist)return w;return{x:L.x+(w.x-L.x)/dd*dist,y:L.y+(w.y-L.y)/dd*dist}}}
  const dd=dist||120;return{x:L.x+Math.cos(L.a)*dd,y:L.y+Math.sin(L.a)*dd}}

// ---------- Lokale update ----------
function updateLocal(dt){
  const L=LP;if(!L)return;
  L.anim+=dt;for(const k of ['fireT','mcd','iv','oc','titan','swing','ucd'])if(L[k]>0)L[k]-=dt;
  for(let i=0;i<3;i++)if(L.cd[i]>0)L.cd[i]-=dt;
  // camera-invoer (altijd, ook bij neergaan)
  if(!UI.cur){
    if(tap('cam'))cycleCam();
    let zd=0;if(Input.wheel)zd=Math.sign(Input.wheel);if(held('zin'))zd-=dt*3;if(held('zout'))zd+=dt*3;
    if(zd){const z=CAM.zoom;z[CAM.mode]=clamp(z[CAM.mode]*(1+zd*0.12),CAM.mode==='first'?0.6:0.45,CAM.mode==='first'?1.6:2.6)}
    if(CAM.mode!=='top'){
      if(Input.locked){CAM.yaw+=Input.mdx*0.0026;CAM.pitch=clamp(CAM.pitch-Input.mdy*0.0022,-0.9,0.7)}
      if(Input.usePad&&(Input.rx||Input.ry)){CAM.yaw+=Input.rx*dt*2.8;CAM.pitch=clamp(CAM.pitch-Input.ry*dt*1.8,-0.9,0.7)}
    }
  }
  // DoT & hazards
  for(let i=L.dots.length-1;i>=0;i--){const o=L.dots[i];o.t-=dt;if(!L.dn&&L.iv<=0){L.hp-=o.dps*dt;if(L.hp<=0)goDown()}if(o.t<=0)L.dots.splice(i,1)}
  if(L.dn){L.dnT-=dt;if(L.dnT<=0)respawn();throttleSend(dt);return}
  const Z=ZONES[GAME.ch];const tl=tileAt(Math.floor(L.x/TS),Math.floor(L.y/TS));let haz=0;
  const safe=d2(L.x,L.y,MAP.spawnPx.x,MAP.spawnPx.y)<(8*TS)**2;
  if(!safe&&Z.hazard==='toxic'&&!CHAR.suit.mask)haz+=5;
  if(!safe&&Z.hazard==='heat'&&!CHAR.suit.heat)haz+=6;
  if(tl===T.LAVA)haz+=CHAR.suit.heat?8:22;
  if(haz&&L.iv<=0){L.hp-=haz*dt;L.lastHit=0;L.hazAcc+=dt;if(L.hazAcc>1){L.hazAcc=0;sfx('hurt');R3.hurtFlash(0.25)}if(L.hp<=0)goDown()}
  L.hazard=haz;
  // Beweging
  let mx=0,my=0;
  if(!UI.cur){let fx=0,sx=0;
    if(Input.keys.KeyW||Input.keys.ArrowUp)fx+=1;if(Input.keys.KeyS||Input.keys.ArrowDown)fx-=1;
    if(Input.keys.KeyD||Input.keys.ArrowRight)sx+=1;if(Input.keys.KeyA||Input.keys.ArrowLeft)sx-=1;
    fx-=Input.ly;sx+=Input.lx;
    if(CAM.mode==='top'){mx=sx;my=-fx}
    else{const cy=Math.cos(CAM.yaw),sy=Math.sin(CAM.yaw);mx=cy*fx-sy*sx;my=sy*fx+cy*sx}}
  const ml=Math.hypot(mx,my);if(ml>1){mx/=ml;my/=ml}
  let spd=D.spd;const sprint=held('sprint')&&ml>0.1&&!UI.cur&&(L.st>1||L.titan>0);
  if(sprint){spd*=1.55;if(L.titan<=0)L.st-=22*dt}else L.st=Math.min(D.mst,L.st+15*dt);
  if(L.st<0)L.st=0;if(tl===T.LAVA)spd*=0.85;
  moveC(L,mx*spd*dt,my*spd*dt,5);
  for(const e of VIEW.ents.values())if(e.k==='crate'){const dd=Math.sqrt(d2(L.x,L.y,e.x,e.y));const need=11;
    if(dd<need&&dd>0.01){const k=(need-dd);moveC(L,(L.x-e.x)/dd*k,(L.y-e.y)/dd*k,5)}}
  L.mv=ml>0.1;if(L.mv)L.bob+=dt*spd*0.12;
  // Richten
  if(CAM.mode==='top'){
    if(Input.usePad){if(Math.abs(Input.rx)+Math.abs(Input.ry)>0.3)L.a=Math.atan2(Input.ry,Input.rx);
      else{const tg=autoAim();if(tg&&held('fire'))L.a=Math.atan2(tg.y-L.y,tg.x-L.x);else if(ml>0.1)L.a=Math.atan2(my,mx)}}
    else{const w=R3.mouseWorld();if(w)L.a=Math.atan2(w.y-L.y,w.x-L.x)}
  }else L.a=CAM.yaw;
  if(!UI.cur&&!UI.placing){
    if(tap('swap')&&CHAR.loadout[1]){L.wi=1-L.wi;sfx('click')}
    if(tap('w1'))L.wi=0;if(tap('w2')&&CHAR.loadout[1])L.wi=1;
    if(!CHAR.loadout[L.wi])L.wi=0;
    if(held('fire'))doFire();
    if((tap('melee')||held('melee'))&&L.mcd<=0)doMelee();
    for(let i=0;i<3;i++)if(tap('ab'+i))useAbility(i);
    if(tap('ult'))useUlt();
  }
  // Interactie
  const it=UI.cur?null:findInteract();L.it=it;
  if(it&&it.act==='revive'){if(held('interact')){L.revT+=dt;if(L.revT>=2.5){L.revT=0;Net.toHost({t:'revive',id:it.id});toast('Teamgenoot gereanimeerd!','#8f8')}}else L.revT=0}
  else{L.revT=0;if(it&&tap('interact'))it.act()}
  // Schild
  L.lastHit+=dt;if(L.lastHit>2.5)L.sh=Math.min(D.msh,L.sh+D.shRegen*dt);
  // Verkennen (minimap)
  GAME.exploreT-=dt;if(GAME.exploreT<=0){GAME.exploreT=0.25;const tx=Math.floor(L.x/TS),ty=Math.floor(L.y/TS);
    for(let y=-11;y<=11;y++)for(let x=-11;x<=11;x++)if(x*x+y*y<=121){const X=tx+x,Y=ty+y;if(X>=0&&Y>=0&&X<MW&&Y<MH)EXPLORED[Y*MW+X]=1}}
  throttleSend(dt);
}
function throttleSend(dt){GAME.sendT-=dt;if(GAME.sendT<=0){GAME.sendT=0.05;sendState()}}
function cycleCam(){const i=CAM_MODES.indexOf(CAM.mode);setCam(CAM_MODES[(i+1)%3])}
function setCam(m){
  if(CAM.mode==='top'&&m!=='top')CAM.yaw=LP?LP.a:CAM.yaw;
  CAM.mode=m;CAM.pitch=0;toast('Camera: '+CAM_NAMES[m]+(m!=='top'?' — klik in het spel om de muis te vangen':''),'#adf',2200);
  if(m==='top'&&document.pointerLockElement)document.exitPointerLock();
  saveGame();UI.updateCamBtn&&UI.updateCamBtn();
}
function autoAim(){let best=null,bd=170*170;for(const e of VIEW.ents.values()){const d=e.def;if(!d||!d.hp||d.node||d.crate)continue;
  const dd=d2(e.x,e.y,LP.x,LP.y);if(dd<bd&&los(LP.x,LP.y,e.x,e.y)){bd=dd;best=e}}return best}

function doFire(){
  const L=LP;const wid=CHAR.loadout[L.wi]||'blaster',w=WEAPONS[wid],wl=(CHAR.weapons[wid]||{lvl:1}).lvl;
  if(L.fireT>0)return;let rate=w.rate;if(L.oc>0)rate*=L.ocRate;
  if(w.ammo>0&&(CHAR.inv.cellen||0)<w.ammo){L.fireT=0.4;toast('Geen energiecellen! Maak ze bij een Wapenbank of pak ze uit de opslag.','#f88',1500);sfx('click');return}
  if(w.ammo>0)CHAR.inv.cellen=Math.round(((CHAR.inv.cellen||0)-w.ammo)*100)/100;
  L.fireT=1/rate;
  const mul=D.dmg*(1+0.2*(wl-1))*(L.titan>0?1.6:1),critCh=D.crit+(L.oc>0?L.ocCrit:0);const shots=[];
  for(let i=0;i<w.count;i++){const a=L.a+(Math.random()-0.5)*2*w.spread;const cr=Math.random()<critCh;const sp=w.spd*(w.count>1?rnd(0.85,1.1):1);
    shots.push({x:L.x+Math.cos(L.a)*7,y:L.y+Math.sin(L.a)*7,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,d:Math.round(w.dmg*mul*(cr?2:1)*10)/10,cr:cr?1:0,
      k:w.kind,l:w.life,r:w.r||2,pc:w.pierce||0,ch:w.chill||0,sh:w.shatter||0,bu:w.burn||0,cn:w.chain||0,kw:w.key?wid:0})}
  Net.toHost({t:'shots',s:shots});sfx(w.kind);R3.recoil();
}
function doMelee(){const L=LP;L.mcd=0.45;L.swing=0.2;
  Net.toHost({t:'melee',x:L.x,y:L.y,a:L.a,d:25*D.melee*(L.titan>0?3:1),r:22});sfx('swing');
  playFx(['swing',L.x+Math.cos(L.a)*12,L.y+Math.sin(L.a)*12])}
function abilTracks(id){return (CHAR.abil[id]||{tr:[0,0,0]}).tr}
function useAbility(i){
  const L=LP;const id=CHAR.equipped[i];if(!id){toast('Geen vaardigheid in dit slot — open het upgrade-menu (Tab).');return}
  if(L.cd[i]>0)return;const A=ABILITIES[id],tr=abilTracks(id),ap=D.ap;let cd=A.cd*(1-D.cdr);
  switch(id){
    case 'grenade':{const p=aimPoint(160);Net.toHost({t:'abil',id,x:L.x,y:L.y,tx:p.x,ty:p.y,d:45*Math.pow(1.3,tr[0])*ap*D.dmg,rad:34*(1+0.18*tr[1]),burn:8*tr[2]});sfx('throw');break}
    case 'dash':{const dist=58*(1+0.2*tr[0]);cd=A.cd*Math.pow(0.85,tr[1])*(1-D.cdr);
      let dx=Math.cos(L.a),dy=Math.sin(L.a);
      if(L.mv){let fx=0,sx=0;if(Input.keys.KeyW)fx++;if(Input.keys.KeyS)fx--;if(Input.keys.KeyD)sx++;if(Input.keys.KeyA)sx--;fx-=Input.ly;sx+=Input.lx;
        if(CAM.mode==='top'){dx=sx;dy=-fx}else{const c=Math.cos(CAM.yaw),s=Math.sin(CAM.yaw);dx=c*fx-s*sx;dy=s*fx+c*sx}
        const l=Math.hypot(dx,dy)||1;dx/=l;dy/=l}
      for(let k=0;k<10;k++){playFx(['trail',L.x,L.y,CHAR.color]);moveC(L,dx*dist/10,dy*dist/10,5)}
      L.iv=Math.max(L.iv,0.3);sfx('dash');
      if(tr[2]>0)Net.toHost({t:'abil',id:'shock',x:L.x,y:L.y,d:25*tr[2]*ap,rad:36});break}
    case 'barrier':Net.toHost({t:'abil',id,x:L.x,y:L.y,rad:40*(1+0.15*tr[1]),dur:5+1.5*tr[0],refl:0.15*tr[2]});sfx('shield');break;
    case 'drone':Net.toHost({t:'abil',id,x:L.x,y:L.y,heal:7*Math.pow(1.3,tr[0])*ap,dur:8+2*tr[1],range:65*(1+0.2*tr[2])});sfx('shield');break;
    case 'overcharge':L.oc=5+tr[1];L.ocRate=1.3*Math.pow(1.15,tr[0]);L.ocCrit=0.06*tr[2];sfx('charge');playFx(['ring',L.x,L.y,20,'#ff8']);break;
    case 'cryonova':Net.toHost({t:'abil',id,x:L.x,y:L.y,rad:50*(1+0.15*tr[0]),fz:2+0.6*tr[1],d:20*Math.pow(1.3,tr[2])*ap*D.dmg});break;
  }
  L.cd[i]=cd;L.cdMax[i]=cd;
}
function useUlt(){
  const L=LP;const id=CHAR.ult;if(!id){toast('Nog geen ultieme vaardigheid. Bereik de juiste stats (Tab → Ultiem).');return}
  if(!ultOk(CHAR,id)||L.ucd>0)return;const U=ULTS[id];
  if(id==='titan'){L.titan=8;L.iv=8;toast('TITAN OVERDRIVE!','#f84');sfx('roar')}
  if(id==='orbital'){const p=aimPoint(260);Net.toHost({t:'abil',id,tx:p.x,ty:p.y,d:500*D.ap*D.dmg});toast('Orbital Strike aangevraagd!','#f6f')}
  if(id==='storm'){Net.toHost({t:'abil',id,x:L.x,y:L.y,d:22*D.ap*D.dmg});toast('STORMROEPER!','#8cf')}
  if(id==='phoenix'){Net.toHost({t:'abil',id,x:L.x,y:L.y})}
  L.ucd=U.cd*(1-D.cdr);L.ucdMax=L.ucd;
}

// ---------- Interactie ----------
function findInteract(){
  const L=LP;let best=null,bd=1e9;
  const cand=(x,y,label,act,r)=>{r=r||24;const d=d2(L.x,L.y,x,y);if(d<r*r&&d<bd){bd=d;best={label,act}}};
  for(const b of ZS.buildings){const B=BUILDINGS[b.k];if(['bench','suit','chest'].includes(b.k))cand(tc(b.tx),tc(b.ty),B.n,()=>UI.open(b.k))}
  if(MAP.ship)cand(MAP.ship.x,MAP.ship.y,'Ontsnappingsschip',()=>UI.open('ship'),44);
  const f=ZS.flags;
  if(GAME.ch===1&&!f.gate){MAP.fuses.forEach((fu,i)=>{if(!f.fuses.includes(i))cand(tc(fu[0]),tc(fu[1]),'Zekering oppakken',()=>Net.toHost({t:'use',what:'fuse',i}))});
    const pp=MAP.pipe;for(let i=0;i<pp.w*pp.h;i++)cand(tc(pp.gx+i%pp.w),tc(pp.gy+Math.floor(i/pp.w)),'Leiding draaien',()=>Net.toHost({t:'use',what:'pipe',i}),11);
    cand(MAP.generator.x,MAP.generator.y,'Generator',()=>toast(`Generator: ${f.fuses.length}/3 zekeringen. ${f.fuses.length<3?'Zoek de zekeringen in de woestenij.':'Draai de leidingen zodat de stroom van links naar rechts loopt.'}`,'#ffe14d',4000),20)}
  if(GAME.ch<=3){const key=ZONES[GAME.ch].key;
    cand(MAP.pedestal.x,MAP.pedestal.y,f.mb?(CHAR.weapons[key]?WEAPONS[key].n+' (al in bezit)':'Pak '+WEAPONS[key].n):'Kluis verzegeld — versla de bewaker',()=>{if(f.mb)Net.toHost({t:'use',what:'pedestal'});else toast('De kluis is verzegeld. Versla eerst de bewaker.','#f88')},20);
    if(f.boss)cand(MAP.arenaPx.x,MAP.arenaPx.y,'Poort naar het volgende hoofdstuk',()=>Net.toHost({t:'use',what:'portal'}),32)}
  for(const id in VIEW.players){if(id===myId())continue;const p=VIEW.players[id];if(p.dn&&p.x!=null){const d=d2(L.x,L.y,p.x,p.y);if(d<22*22&&d<bd){bd=d;best={label:'Houd E: reanimeer '+p.name,act:'revive',id}}}}
  return best;
}
