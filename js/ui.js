'use strict';
// ===== Menu's, HUD, minimap, toasts =====
const $=id=>document.getElementById(id);
function toast(msg,col,ms){const box=$('toasts');const d=document.createElement('div');d.className='toast';d.innerHTML=msg;if(col)d.style.color=col;box.appendChild(d);
  while(box.children.length>5)box.removeChild(box.firstChild);setTimeout(()=>{d.classList.add('out');setTimeout(()=>d.remove(),400)},ms||3200)}
const COLORS=['#ffcc33','#ff5a5a','#5ad1ff','#7dff6a','#c48cff','#ff9a3d','#ffffff','#ff6ad5'];

const UI={cur:null,tab:'stats',placing:null,hudT:0,miniT:0,miniImg:null,
  // ---------- Hoofdmenu ----------
  showMain(){this.cur=null;this.placing=null;$('hud').classList.add('hidden');$('panel').classList.add('hidden');$('menu').classList.remove('hidden');
    if(document.pointerLockElement)document.exitPointerLock();
    const c=SAVE.char;const st=SAVE.world.story;
    $('menu').innerHTML=`<div class="mm">
      <h1>NOODLANDING</h1><p class="sub">Multiplayer astronaut-ontsnappingsspel · co-op tot 4 spelers</p>
      <div class="row"><label>Naam</label><input id="mmName" maxlength="14" value="${esc(c.name)}"></div>
      <div class="row"><label>Pakkleur</label><div class="sw">${COLORS.map(k=>`<button class="swc ${k===c.color?'on':''}" data-a="color" data-v="${k}" style="background:${k}"></button>`).join('')}</div></div>
      <div class="charinfo">Niveau ${c.level} · STR ${c.stats.str} · STA ${c.stats.sta} · INT ${c.stats.int} · Verhaal: hoofdstuk ${st}${SAVE.world.won?' · ✦ ontsnapt':''}</div>
      <button class="big" data-a="chapters">▶ Spelen / hosten</button>
      <button class="big" data-a="joinScr">⇄ Meedoen met code</button>
      <div class="rowb"><button data-a="controls">Besturing</button><button data-a="settings">Instellingen</button><button class="danger" data-a="reset">Nieuw spel</button></div>
      <p class="tiny">Je personage en savegame blijven in deze browser. De host bepaalt het verhaal.</p></div>`;
  },
  chapters(){const st=SAVE.world.story;
    $('menu').innerHTML=`<div class="mm"><h2>Hoofdstukken</h2>
      ${[1,2,3,4].map(c=>{const open=c<=st;const cur=c===st;
        return `<div class="chap ${open?'':'locked'}"><div><b>${c}. ${ZONES[c].n}</b><br><span class="tiny">${!open?'Vergrendeld':cur?'Doorgaan met je huidige personage':'Herhalen met de snapshot van toen (voortgang wordt niet bewaard)'}</span></div>
        ${open?`<button data-a="start" data-v="${c}">${cur?'Doorgaan':'Herhalen'}</button>`:''}</div>`}).join('')}
      <label class="chk"><input type="checkbox" id="online" ${SAVE.opts.online!==false?'checked':''}> Open voor vrienden (je krijgt een code)</label>
      <button data-a="main">← Terug</button></div>`},
  joinScr(){$('menu').innerHTML=`<div class="mm"><h2>Meedoen</h2><p>Vul de code van de host in:</p>
      <input id="code" maxlength="4" class="code" placeholder="ABCD" autocomplete="off"><p id="jstat" class="tiny"></p>
      <button class="big" data-a="join">Verbinden</button><button data-a="main">← Terug</button></div>`;setTimeout(()=>$('code')&&$('code').focus(),50)},
  controls(){$('menu').innerHTML=`<div class="mm"><h2>Besturing</h2><div class="ctl">${this.controlsHTML()}</div><button data-a="main">← Terug</button></div>`},
  controlsHTML(){return `<table>
    <tr><td>WASD</td><td>Lopen (Shift = sprinten)</td></tr><tr><td>Muis</td><td>Richten / rondkijken · links = schieten · rechts of Z = melee</td></tr>
    <tr><td>V</td><td>Camera wisselen: top-down → 3e persoon → first person</td></tr><tr><td>Scrollwiel / + −</td><td>Zoomen (in first person: beeldhoek)</td></tr>
    <tr><td>Q · F · G</td><td>Actieve vaardigheden 1–3</td></tr><tr><td>R</td><td>Ultieme vaardigheid</td></tr>
    <tr><td>1 · 2 · X</td><td>Wapen kiezen / wisselen</td></tr><tr><td>E</td><td>Gebruiken / oppakken (vasthouden = reanimeren)</td></tr>
    <tr><td>Tab / I</td><td>Upgrade-menu (stats, passief, actief, ultiem, uitrusting)</td></tr><tr><td>B</td><td>Bouwen</td></tr><tr><td>M</td><td>Grote kaart</td></tr><tr><td>Esc</td><td>Pauze / sluiten</td></tr>
    <tr><td>Controller</td><td>Sticks bewegen/richten · RT schieten · LT melee · A gebruiken · X/Y/B vaardigheden · RB ultiem · LB wapen · D-pad ↑↓ zoom, → camera · Start menu</td></tr></table>`},
  settings(){const o=SAVE.opts;$('menu').innerHTML=`<div class="mm"><h2>Instellingen</h2>
      <div class="row"><label>Pixelgrootte</label><div>${[2,3,4].map(p=>`<button class="${(o.pix||3)===p?'on':''}" data-a="pix" data-v="${p}">${p}×</button>`).join('')}</div></div>
      <div class="row"><label>Geluid</label><button data-a="mute">${MUTED?'Uit':'Aan'}</button></div>
      <div class="row"><label>Savegame</label><button data-a="export">Exporteren</button><button data-a="import">Importeren</button></div>
      <button data-a="main">← Terug</button></div>`},

  // ---------- In-game ----------
  enterGame(){$('menu').classList.add('hidden');$('hud').classList.remove('hidden');this.close();
    $('hReplay').classList.toggle('hidden',!GAME.replay);this.buildMiniBase();this.zsChanged();this.updateCamBtn()},
  updateCamBtn(){const b=$('hCam');if(b)b.textContent='🎥 '+CAM_NAMES[CAM.mode]+' (V)'},
  zsChanged(){if(R3.zone)R3.rebuildStatic();if(this.cur&&['chest','ship'].includes(this.cur))this.render()},
  open(kind){this.cur=kind;if(kind==='char')this.tab=this.tab||'stats';$('panel').classList.remove('hidden');if(document.pointerLockElement)document.exitPointerLock();this.render()},
  close(){this.cur=null;$('panel').classList.add('hidden');$('panel').innerHTML=''},
  render(){const k=this.cur;if(!k)return;let h='';
    if(k==='char')h=this.charPanel();else if(k==='bench')h=this.benchPanel();else if(k==='suit')h=this.suitPanel();else if(k==='chest')h=this.chestPanel();
    else if(k==='ship')h=this.shipPanel();else if(k==='build')h=this.buildPanel();else if(k==='pause')h=this.pausePanel();else if(k==='victory')h=this.victoryPanel();
    $('panel').innerHTML=`<div class="pn">${h}<button class="x" data-a="close">✕</button></div>`},
  charPanel(){const c=CHAR,t=this.tab;const tabs=[['stats','Statistieken'],['passive','Passief'],['active','Actief'],['ult','Ultiem'],['gear','Uitrusting']];
    let h=`<div class="tabs">${tabs.map(([k,n])=>`<button class="${t===k?'on':''}" data-a="tab" data-v="${k}">${n}</button>`).join('')}</div>`;
    h+=`<div class="hdr">${esc(c.name)} · Niveau ${c.level} · XP ${fmtN(c.xp)}/${fmtN(xpNeed(c.level))} · <span class="hl">${c.statPts} statpunten</span> · <span class="hl2">${c.skillPts} vaardigheidspunten</span>${GAME.replay?' · <span class="warn">HERHALING</span>':''}</div>`;
    if(t==='stats'){const info={str:'Kracht: +2,5% wapenschade, +7% melee',sta:'Uithouding: +6 HP, +1 schild, meer sprint & snelheid',int:'Intelligentie: +3% vaardigheidskracht, +2 schild, sneller herladen, meer opbrengst'};
      h+=`<div class="grid3">${['str','sta','int'].map(s=>`<div class="card"><h3>${s.toUpperCase()} <span class="big">${c.stats[s]}</span></h3><p>${info[s]}</p>
        <button ${c.statPts?'':'disabled'} data-a="stat" data-v="${s}">+1</button> <button ${c.statPts>=5?'':'disabled'} data-a="stat5" data-v="${s}">+5</button></div>`).join('')}</div>`;
      h+=`<div class="card"><h3>Afgeleide waarden</h3><p>HP ${D.mhp} · Schild ${D.msh} (+${D.shRegen.toFixed(1)}/s) · Uithouding ${D.mst} · Schade ×${D.dmg.toFixed(2)} · Melee ×${D.melee.toFixed(2)} · Vaardigheidskracht ×${D.ap.toFixed(2)} · Cooldown −${Math.round(D.cdr*100)}% · Kritiek ${Math.round(D.crit*100)}% · Pantser ${Math.round(D.armor*100)}% · Opbrengst ×${D.yield.toFixed(2)}</p>
        <p class="tiny">Tip: ultieme vaardigheden vragen een specifieke stat-combinatie. Kies bewust!</p></div>`}
    if(t==='passive'){h+=`<p class="tiny">Passieve upgrades zijn oneindig door te levelen met grondstoffen.</p><div class="list">${Object.entries(PASSIVES).map(([id,P])=>{const l=c.passives[id]||0,cost=passiveCost(id,l);
      return `<div class="li"><div><b>${P.n}</b> <span class="lv">nv. ${l}</span><br><span class="tiny">${P.per} per niveau · kosten: ${costStr(cost,c.inv)}</span></div><button ${canAfford(c.inv,cost)?'':'disabled'} data-a="passive" data-v="${id}">Upgrade</button></div>`}).join('')}</div>`}
    if(t==='active'){h+=`<p class="tiny">Max. 3 uitgerust (Q · F · G). Elke upgrade stapelt zijn multiplier (max ${TRACK_MAX} per spoor).</p><div class="list">${Object.entries(ABILITIES).map(([id,A])=>{const a=c.abil[id];
      if(!a)return `<div class="li"><div><b>${A.n}</b><br><span class="tiny">${A.desc} · cooldown ${A.cd}s</span></div><button ${c.skillPts?'':'disabled'} data-a="unlock" data-v="${id}">Ontgrendel (1 punt)</button></div>`;
      const slot=c.equipped.indexOf(id);
      return `<div class="li col"><div><b>${A.n}</b> ${slot>=0?`<span class="hl">[${'QFG'[slot]}]</span>`:''}<br><span class="tiny">${A.desc}</span></div>
        <div class="tracks">${A.tracks.map((tn,i)=>{const lv=a.tr[i],cost=trackCost(lv);const ok=lv<TRACK_MAX&&c.skillPts>0&&canAfford(c.inv,cost);
          return `<div class="tr"><span>${tn}</span><span class="pips">${'■'.repeat(lv)}${'□'.repeat(TRACK_MAX-lv)}</span>${lv<TRACK_MAX?`<button ${ok?'':'disabled'} data-a="track" data-v="${id}:${i}" title="1 punt + ${Object.entries(cost).map(([k,v])=>v+' '+MATS[k].n).join(', ')}">+</button><span class="tiny">1 pt + ${costStr(cost,c.inv)}</span>`:'<span class="tiny">MAX</span>'}</div>`}).join('')}</div>
        <div>Slot: ${[0,1,2].map(i=>`<button class="${c.equipped[i]===id?'on':''}" data-a="equip" data-v="${id}:${i}">${'QFG'[i]}</button>`).join('')}</div></div>`}).join('')}</div>`}
    if(t==='ult'){h+=`<p class="tiny">Ultieme vaardigheden worden vrijgespeeld door de juiste combinatie van core stats. Eén tegelijk uitgerust (R).</p><div class="list">${Object.entries(ULTS).map(([id,U])=>{const ok=ultOk(c,id);
      const req=Object.entries(U.req).map(([s,v])=>`<span class="${c.stats[s]>=v?'ok':'lack'}">${s.toUpperCase()} ${c.stats[s]}/${v}</span>`).join(' · ');
      return `<div class="li"><div><b>${U.n}</b> <span class="tiny">(${U.build})</span><br><span class="tiny">${U.desc} · cooldown ${U.cd}s</span><br>${req}</div>
        ${ok?`<button class="${c.ult===id?'on':''}" data-a="ult" data-v="${id}">${c.ult===id?'Uitgerust':'Uitrusten'}</button>`:'<span class="tiny">🔒</span>'}</div>`}).join('')}</div>`}
    if(t==='gear'){h+=`<div class="card"><h3>Wapens</h3>${Object.keys(c.weapons).map(id=>{const w=WEAPONS[id];const sl=c.loadout.indexOf(id);
        return `<div class="li"><div><b style="color:${w.col}">${w.n}</b> nv. ${c.weapons[id].lvl}${w.key?' <span class="hl">UNIEK</span>':''}<br><span class="tiny">${w.desc}</span></div>
        <div>${[0,1].map(i=>`<button class="${sl===i?'on':''}" data-a="load" data-v="${id}:${i}">Slot ${i+1}</button>`).join('')}</div></div>`}).join('')}</div>
      <div class="card"><h3>Ruimtepak</h3><p>${Object.keys(SUIT).map(k=>`<span class="${c.suit[k]?'ok':'lack'}">${c.suit[k]?'✔':'✘'} ${SUIT[k].n}</span>`).join(' · ')}</p></div>
      <div class="card"><h3>Materialen</h3><p>${MAT_KEYS.map(k=>`<span style="color:${MATS[k].c}">${MATS[k].n}: ${fmtN(c.inv[k]||0)}</span>`).join(' · ')}</p></div>`}
    return h},
  benchPanel(){const c=CHAR;let h=`<h2>Wapenbank</h2><div class="list">`;
    for(const [id,w] of Object.entries(WEAPONS)){if(w.key&&!c.weapons[id])continue;const own=c.weapons[id];
      if(!own){if(!w.cost)continue;h+=`<div class="li"><div><b style="color:${w.col}">${w.n}</b><br><span class="tiny">${w.desc}<br>${costStr(w.cost,c.inv)}</span></div><button ${canAfford(c.inv,w.cost)?'':'disabled'} data-a="craftW" data-v="${id}">Maken</button></div>`}
      else{const l=own.lvl,cost=weaponUpCost(l);h+=`<div class="li"><div><b style="color:${w.col}">${w.n}</b> nv. ${l}/5<br><span class="tiny">+20% schade per niveau${l<5?' · '+costStr(cost,c.inv):''}</span></div>${l<5?`<button ${canAfford(c.inv,cost)?'':'disabled'} data-a="upW" data-v="${id}">Upgrade</button>`:'<span class="tiny">MAX</span>'}</div>`}}
    h+=`</div><div class="li"><div><b style="color:${MATS.cellen.c}">Energiecellen ×${CELL_RECIPE.out}</b><br><span class="tiny">${costStr(CELL_RECIPE.cost,c.inv)} · je hebt ${Math.floor(c.inv.cellen||0)}</span></div><div><button ${canAfford(c.inv,CELL_RECIPE.cost)?'':'disabled'} data-a="cells" data-v="1">×1</button><button data-a="cells" data-v="5">×5</button></div></div>`;
    return h},
  suitPanel(){const c=CHAR;return `<h2>Pakstation</h2><div class="list">${Object.entries(SUIT).map(([k,S])=>{const own=c.suit[k];const lock=S.req&&!c.suit[S.req];
      return `<div class="li"><div><b>${S.n}</b>${own?' <span class="ok">✔ in bezit</span>':''}<br><span class="tiny">${S.desc}${own?'':'<br>'+costStr(S.cost,c.inv)}${lock?' · vereist '+SUIT[S.req].n:''}</span></div>${own?'':`<button ${!lock&&canAfford(c.inv,S.cost)?'':'disabled'} data-a="craftS" data-v="${k}">Maken</button>`}</div>`}).join('')}</div>`},
  chestPanel(){const c=CHAR,s=ZS.storage||{};return `<h2>Gedeelde opslag</h2><p class="tiny">Iedereen in dit spel kan hieruit pakken. Het schip wordt gerepareerd met materialen uit de opslag.</p>
    <table class="tbl"><tr><th>Materiaal</th><th>Jij</th><th>Opslag</th><th></th></tr>${MAT_KEYS.map(k=>`<tr><td style="color:${MATS[k].c}">${MATS[k].n}</td><td>${fmtN(c.inv[k]||0)}</td><td>${fmtN(s[k]||0)}</td>
      <td><button data-a="store" data-v="${k}" ${(c.inv[k]||0)>=1?'':'disabled'}>Inleggen</button><button data-a="take" data-v="${k}:10" ${(s[k]||0)>=10?'':'disabled'}>Pak 10</button><button data-a="take" data-v="${k}:all" ${(s[k]||0)>=1?'':'disabled'}>Pak alles</button></td></tr>`).join('')}</table>
    <button data-a="storeAll">Alles inleggen (behalve energiecellen)</button>`},
  shipPanel(){const s=ZS.storage||{},p=ZS.parts||{},f=ZS.flags;let h=`<h2>Ontsnappingsschip</h2><p>Onderdelen: ${[1,2,3].map(i=>`<span class="${p[i]?'ok':'lack'}">${p[i]?'✔':'✘'} ${PARTS[i]}</span>`).join(' · ')}</p>
      <p>Benodigd in gedeelde opslag: ${costStr(REPAIR,s)}</p>`;
    if(GAME.ch!==4)h+=`<p class="tiny">Versla de bazen van de drie zones om alle onderdelen te vinden. De reparatie gebeurt in hoofdstuk 4.</p>`;
    else if(!f.fixed)h+=`<button class="big" data-a="repair">Repareer het schip</button>`;
    else if(ZS.finale.state==='idle')h+=Net.role==='client'?'<p>Wacht tot de host de lancering start.</p>':`<button class="big" data-a="launch">🚀 Start lanceersequentie</button><p class="tiny">Houd daarna 90 seconden stand tegen golven aliens.</p>`;
    else if(ZS.finale.state==='launch')h+=`<p class="hl">Lancering bezig… ${Math.ceil(90-ZS.finale.t)} s</p>`;
    return h},
  buildPanel(){return `<h2>Bouwen</h2><p class="tiny">Kies een gebouw en klik op de vloer om het te plaatsen (Esc = annuleren). Gebouwen blijven staan voor het hele team.</p><div class="list">${Object.entries(BUILDINGS).map(([k,B])=>
      `<div class="li"><div><b style="color:${B.col}">${B.n}</b><br><span class="tiny">${B.desc}<br>${costStr(B.cost,CHAR.inv)}</span></div><button ${canAfford(CHAR.inv,B.cost)?'':'disabled'} data-a="place" data-v="${k}">Plaatsen</button></div>`).join('')}</div>`},
  pausePanel(){return `<h2>Pauze</h2>${Net.code?`<p>Code voor vrienden: <span class="code big">${Net.code}</span></p>`:''}
    <div class="rowb"><button data-a="close">Hervatten</button><button data-a="saveNow">Opslaan</button><button data-a="cam">Camera: ${CAM_NAMES[CAM.mode]}</button></div>
    <div class="ctl">${this.controlsHTML()}</div><button class="danger" data-a="quit">Naar hoofdmenu</button>`},
  victoryPanel(){return `<h2>🚀 JE BENT ONTSNAPT!</h2><p>Het schip schiet door de atmosfeer, de planeet verdwijnt onder je. Goed gedaan, ${esc(CHAR.name)}!</p>
    <p class="tiny">Je personage blijft bewaard. Speel hoofdstukken opnieuw of ga verder met grinden.</p><button data-a="close">Verder spelen</button><button data-a="quit">Hoofdmenu</button>`},

  // ---------- Acties ----------
  act(a,v,el){const c=CHAR;
    switch(a){
      case 'color':SAVE.char.color=v;this.saveName();writeSave();this.showMain();break;
      case 'chapters':this.saveName();this.chapters();break;
      case 'joinScr':this.saveName();this.joinScr();break;
      case 'main':this.showMain();break;
      case 'controls':this.controls();break;
      case 'settings':this.settings();break;
      case 'pix':SAVE.opts.pix=+v;writeSave();R3.resize();this.settings();break;
      case 'mute':MUTED=!MUTED;SAVE.opts.mute=MUTED;writeSave();this.settings();break;
      case 'export':{const b=new Blob([JSON.stringify(SAVE)],{type:'application/json'});const u=URL.createObjectURL(b);const l=document.createElement('a');l.href=u;l.download='noodlanding-save.json';l.click();break}
      case 'import':{const i=document.createElement('input');i.type='file';i.accept='.json';i.onchange=()=>{const r=new FileReader();r.onload=()=>{try{const s=JSON.parse(r.result);if(!s.char)throw 0;SAVE=s;s.snaps=s.snaps||{};s.wsnaps=s.wsnaps||{};s.opts=s.opts||{};s.world=s.world||newWorld();writeSave();toast('Savegame geïmporteerd','#8f8');this.showMain()}catch(e){toast('Ongeldig bestand','#f88')}};r.readAsText(i.files[0])};i.click();break}
      case 'reset':if(confirm('Alles wissen en een nieuw personage beginnen?')){const n=SAVE.char.name,col=SAVE.char.color;SAVE={char:newChar(n,col),snaps:{},wsnaps:{},world:newWorld(),opts:SAVE.opts};writeSave();this.showMain()}break;
      case 'start':{const ch=+v;const online=$('online')&&$('online').checked;SAVE.opts.online=online;Net.role='host';Net.myId='h';W=null;
        hostStartChapter(ch,ch<SAVE.world.story);
        if(online)Net.hostOpen((code,err)=>{if(code){toast(`Online! Code voor vrienden: <b class="code">${code}</b>`,'#8ff',8000);$('hCode').innerHTML='Code: <b>'+code+'</b>'}else toast('Online gaan mislukt: '+err,'#f88')});
        else $('hCode').textContent='';break}
      case 'join':{const code=($('code').value||'').trim().toUpperCase();if(code.length!==4){$('jstat').textContent='Code is 4 tekens.';break}
        $('jstat').textContent='Verbinden…';Net.join(code,(ok,msg)=>{if(!ok){$('jstat').textContent=msg;Net.close();return}
          $('jstat').textContent='Verbonden! Wachten op de wereld…';$('hCode').textContent='Verbonden met '+code;
          Net.toHost({t:'hello',name:SAVE.char.name,color:SAVE.char.color})});break}
      case 'close':this.close();break;
      case 'tab':this.tab=v;this.render();break;
      case 'stat':if(c.statPts>0){c.stats[v]++;c.statPts--;recalc();this.render()}break;
      case 'stat5':if(c.statPts>=5){c.stats[v]+=5;c.statPts-=5;recalc();this.render()}break;
      case 'passive':{const cost=passiveCost(v,c.passives[v]||0);if(canAfford(c.inv,cost)){payCost(c.inv,cost);c.passives[v]=(c.passives[v]||0)+1;recalc();sfx('build');this.render()}break}
      case 'unlock':if(c.skillPts>0&&!c.abil[v]){c.skillPts--;c.abil[v]={tr:[0,0,0]};const free=c.equipped.indexOf(null);if(free>=0)c.equipped[free]=v;sfx('lvl');this.render()}break;
      case 'track':{const [id,i]=v.split(':');const a=c.abil[id];const lv=a.tr[+i],cost=trackCost(lv);
        if(lv<TRACK_MAX&&c.skillPts>0&&canAfford(c.inv,cost)){payCost(c.inv,cost);c.skillPts--;a.tr[+i]++;sfx('build');this.render()}break}
      case 'equip':{const [id,i]=v.split(':');const j=c.equipped.indexOf(id);if(j>=0)c.equipped[j]=null;c.equipped[+i]=id;this.render();break}
      case 'ult':c.ult=v;this.render();break;
      case 'load':{const [id,i]=v.split(':');const j=c.loadout.indexOf(id);if(j>=0&&j!==+i)c.loadout[j]=c.loadout[+i]||null;c.loadout[+i]=id;if(!c.loadout[0])c.loadout[0]='blaster';LP.wi=0;this.render();break}
      case 'craftW':{const w=WEAPONS[v];if(canAfford(c.inv,w.cost)){payCost(c.inv,w.cost);c.weapons[v]={lvl:1};if(!c.loadout[1])c.loadout[1]=v;toast(w.n+' gemaakt!','#8f8');sfx('build');saveGame();this.render()}break}
      case 'upW':{const l=c.weapons[v].lvl,cost=weaponUpCost(l);if(l<5&&canAfford(c.inv,cost)){payCost(c.inv,cost);c.weapons[v].lvl++;sfx('build');this.render()}break}
      case 'cells':for(let i=0;i<+v;i++){if(!canAfford(c.inv,CELL_RECIPE.cost))break;payCost(c.inv,CELL_RECIPE.cost);c.inv.cellen=(c.inv.cellen||0)+CELL_RECIPE.out}sfx('build');this.render();break;
      case 'craftS':{const S=SUIT[v];if(!c.suit[v]&&canAfford(c.inv,S.cost)&&(!S.req||c.suit[S.req])){payCost(c.inv,S.cost);c.suit[v]=1;recalc();toast(S.n+' gemaakt!','#8f8');sfx('build');saveGame();this.render()}break}
      case 'store':{const amt=Math.floor(c.inv[v]||0);if(amt>0){c.inv[v]-=amt;Net.toHost({t:'store',mat:v,amt});setTimeout(()=>this.render(),120)}break}
      case 'storeAll':for(const k of MAT_KEYS){if(k==='cellen')continue;const amt=Math.floor(c.inv[k]||0);if(amt>0){c.inv[k]-=amt;Net.toHost({t:'store',mat:k,amt})}}setTimeout(()=>this.render(),120);break;
      case 'take':{const [k,n]=v.split(':');const amt=n==='all'?Math.floor((ZS.storage||{})[k]||0):10;if(amt>0)Net.toHost({t:'take',mat:k,amt});setTimeout(()=>this.render(),150);break}
      case 'repair':Net.toHost({t:'repair'});break;
      case 'launch':Net.toHost({t:'launch'});this.close();break;
      case 'place':this.placing=v;this.close();toast('Klik op de vloer om '+BUILDINGS[v].n+' te plaatsen (Esc = annuleren)','#adf');break;
      case 'saveNow':saveGame();toast(GAME.replay?'Herhaling: je hoofd-savegame blijft onaangeroerd.':'Opgeslagen.','#8f8');break;
      case 'cam':cycleCam();this.render();break;
      case 'quit':this.close();backToMenu();break;
    }},
  saveName(){const n=$('mmName');if(n&&n.value.trim()){SAVE.char.name=n.value.trim().slice(0,14);writeSave()}},
  tryPlace(){const k=this.placing;if(!k)return;const B=BUILDINGS[k];
    const p=CAM.mode==='top'?R3.mouseWorld():{x:LP.x+Math.cos(LP.a)*28,y:LP.y+Math.sin(LP.a)*28};if(!p)return;
    if(!canAfford(CHAR.inv,B.cost)){toast('Niet genoeg materialen.','#f88');this.placing=null;return}
    const tx=Math.floor(p.x/TS),ty=Math.floor(p.y/TS);if(tileAt(tx,ty)!==T.FLOOR){toast('Hier kun je niet bouwen.','#f88');return}
    payCost(CHAR.inv,B.cost);Net.toHost({t:'build',k,tx,ty});this.placing=null},

  // ---------- Toetsen per frame ----------
  frameKeys(){
    if(tap('esc')){if(this.placing){this.placing=null;toast('Bouwen geannuleerd')}else if(this.cur)this.close();else this.open('pause');return}
    if(tap('menu')){if(this.cur==='char')this.close();else{this.open('char')}return}
    if(Input.usePad&&padTap(1)&&this.cur){this.close();return}
    if(tap('build')&&!this.cur){this.open('build');return}
    if(tap('map'))$('mini').classList.toggle('big');
    if(this.placing&&(Input.mtap||(Input.usePad&&padTap(0)))){Input.mtap=false;Input.mdown=false;this.tryPlace()}
  },

  // ---------- HUD ----------
  hud(dt){if(!LP)return;const L=LP;
    $('bHp').style.width=clamp(L.hp/D.mhp*100,0,100)+'%';$('tHp').textContent=Math.ceil(Math.max(0,L.hp))+' / '+D.mhp;
    $('bSh').style.width=clamp(L.sh/D.msh*100,0,100)+'%';$('tSh').textContent=Math.ceil(L.sh)+' / '+D.msh;
    $('bSt').style.width=clamp(L.st/D.mst*100,0,100)+'%';
    $('bXp').style.width=clamp(CHAR.xp/xpNeed(CHAR.level)*100,0,100)+'%';
    this.hudT-=dt;
    if(this.hudT<=0){this.hudT=0.15;
      $('hName').innerHTML=`${esc(CHAR.name)} <span>nv. ${CHAR.level}</span>${CHAR.statPts||CHAR.skillPts?' <span class="hl">● punten (Tab)</span>':''}`;
      $('tXp').textContent=`XP ${fmtN(CHAR.xp)}/${fmtN(xpNeed(CHAR.level))}`;
      $('hMats').innerHTML=MAT_KEYS.map(k=>`<span style="color:${MATS[k].c}" title="${MATS[k].n}">■ ${fmtN(CHAR.inv[k]||0)}</span>`).join(' ');
      $('hChap').textContent=`Hoofdstuk ${GAME.ch}: ${ZONES[GAME.ch].n}`;
      $('hObj').innerHTML=this.objective();
      const me=myId();$('hParty').innerHTML=Object.entries(VIEW.players).filter(([id])=>id!==me).map(([id,p])=>`<div><span style="color:${p.color}">■</span> ${esc(p.name||'?')} ${p.dn?'<span class="lack">neer</span>':Math.ceil(p.hp||0)+' HP'}</div>`).join('');
      $('hWeap').innerHTML=[0,1].map(i=>{const id=CHAR.loadout[i];if(!id)return `<div class="slot empty">${i+1}</div>`;const w=WEAPONS[id];
        return `<div class="slot ${L.wi===i?'on':''}"><b style="color:${w.col}">${i+1} ${w.n}</b><br><span>${w.ammo?Math.floor(CHAR.inv.cellen||0)+' cellen':'∞'}</span></div>`}).join('');
      let pr='';if(L.it)pr=(L.it.act==='revive'?'':'[E] ')+L.it.label+(L.revT>0?` ${Math.round(L.revT/2.5*100)}%`:'');
      if(this.placing)pr='Plaats '+BUILDINGS[this.placing].n+(CAM.mode==='top'?' — klik op de vloer':' — klik om voor je te bouwen');
      $('hPrompt').textContent=pr;$('hPrompt').style.display=pr?'block':'none';
      $('hDown').classList.toggle('hidden',!L.dn);if(L.dn)$('hDown').textContent=`NEERGEGAAN — ${othersCount()?'wacht op reanimatie of respawn over ':'respawn over '}${Math.ceil(L.dnT)} s`;
      // baas
      let boss=null;for(const e of VIEW.ents.values())if(e.def&&e.def.boss&&e.active){boss=e;break}
      $('hBoss').classList.toggle('hidden',!boss);
      if(boss){$('hBossName').textContent=boss.def.n+(boss.ar>0?' — PANTSER (alleen '+WEAPONS[boss.def.key].n+')':((boss.st||stBits(boss))&16?' — KWETSBAAR!':''));
        $('bBoss').style.width=clamp(boss.hp/boss.mhp*100,0,100)+'%';$('bArmor').style.width=clamp(boss.ar/(boss.mar||1)*100,0,100)+'%'}
    }
    $('hAbil').innerHTML=[0,1,2].map(i=>{const id=CHAR.equipped[i];const cd=L.cd[i];
      return `<div class="ab ${id?'':'empty'}"><span class="k">${'QFG'[i]}</span>${id?ABILITIES[id].n:'—'}${cd>0?`<i style="height:${clamp(cd/L.cdMax[i]*100,0,100)}%"></i><em>${cd.toFixed(1)}</em>`:''}</div>`}).join('')+
      `<div class="ab ult ${CHAR.ult&&ultOk(CHAR,CHAR.ult)?'':'empty'}"><span class="k">R</span>${CHAR.ult?ULTS[CHAR.ult].n:'Ultiem'}${L.ucd>0?`<i style="height:${clamp(L.ucd/L.ucdMax*100,0,100)}%"></i><em>${Math.ceil(L.ucd)}</em>`:''}</div>`;
    this.miniT-=dt;if(this.miniT<=0){this.miniT=0.25;this.drawMini()}
  },
  objective(){const f=ZS.flags,ch=GAME.ch;const out=[];
    if(ch===4){const n=[1,2,3].filter(i=>(ZS.parts||{})[i]).length;
      if(ZS.finale.state==='won')return '🚀 Je bent ontsnapt!';
      if(!f.fixed)return `Repareer het schip bij de crashlocatie (onderdelen ${n}/3 + materialen in de gedeelde opslag)`;
      if(ZS.finale.state==='launch')return `<b class="warn">Houd stand! Lancering over ${Math.ceil(90-ZS.finale.t)} s</b>`;
      return 'Schip gerepareerd — de host start de lancering bij het schip'}
    const Z=ZONES[ch];
    if(ch===2&&!CHAR.suit.mask)out.push('<span class="warn">⚠ Maak een Zuurstofmasker (bouw een Pakstation)</span>');
    if(ch===3&&!CHAR.suit.heat)out.push('<span class="warn">⚠ Maak Hittebestendige beplating (Pakstation)</span>');
    if(!f.gate){if(ch===1)out.push(f.fuses.length<3?`Vind de zekeringen (${f.fuses.length}/3) — volg de gele lichtbundels`:'Draai de leidingen bij de generator tot de stroom van geel naar cyaan loopt');
      if(ch===2)out.push(`Zet de 3 drukplaten tegelijk onder druk (spelers of kratten) — ${Math.round((ZS.plateProg||0)*100)}%`);
      if(ch===3)out.push(`Stap op de runeplaten in de kleurvolgorde van de obelisk (${ZS.runeProg}/${MAP.seq.length})`)}
    if(!f.mb)out.push('Versla de bewaker van de kluis');else if(!CHAR.weapons[Z.key])out.push(`Pak het unieke wapen in de kluis: ${WEAPONS[Z.key].n}`);
    if(f.gate&&!f.boss)out.push(`Versla ${ENEMIES[Z.boss].n} in de arena`);
    if(f.boss)out.push(ch<3?'Ga door de poort in de arena (host)':'Ga door de poort naar de ontsnapping (host)');
    return out.join('<br>')},
  buildMiniBase(){const c=$('mini');const g=c.getContext('2d');this.miniImg=g.createImageData(MW,MH);const pal=ZONES[MAP.zid].pal;
    const hex=h=>{const n=parseInt(h.slice(1),16);return[n>>16,(n>>8)&255,n&255]};this.miniCols={0:hex(pal.floor[0]),1:hex(pal.wall),2:[0,255,255],3:[255,90,20]};this.miniDone=new Uint8Array(MW*MH)},
  drawMini(){if(!this.miniImg||!EXPLORED)return;const d=this.miniImg.data;
    for(let i=0;i<MW*MH;i++){if(EXPLORED[i]&&!this.miniDone[i]){this.miniDone[i]=1;const col=this.miniCols[MAP.t[i]]||[0,0,0];d[i*4]=col[0];d[i*4+1]=col[1];d[i*4+2]=col[2];d[i*4+3]=255}}
    const c=$('mini'),g=c.getContext('2d');g.putImageData(this.miniImg,0,0);
    const dot=(x,y,col,s)=>{g.fillStyle=col;g.fillRect(Math.floor(x/TS)-(s>>1),Math.floor(y/TS)-(s>>1),s,s)};
    for(const b of ZS.buildings)dot(tc(b.tx),tc(b.ty),BUILDINGS[b.k].col,2);
    if(MAP.ship)dot(MAP.ship.x,MAP.ship.y,'#fff',4);
    const f=ZS.flags;if(GAME.ch===1&&!f.gate){MAP.fuses.forEach((fu,i)=>{if(!f.fuses.includes(i)&&EXPLORED[fu[1]*MW+fu[0]])dot(tc(fu[0]),tc(fu[1]),'#ffe14d',3)});dot(MAP.generator.x,MAP.generator.y,'#ffb040',3)}
    if(GAME.ch<=3){if(EXPLORED[MAP.rooms.vault.y*MW+MAP.rooms.vault.x])dot(MAP.pedestal.x,MAP.pedestal.y,f.mb?'#ffe14d':'#f44',3);dot(97*TS,48*TS,f.gate?'#8ff':'#f84',3)}
    for(const e of VIEW.ents.values())if(e.def&&e.def.hp&&!e.def.node&&!e.def.crate&&d2(e.x,e.y,LP.x,LP.y)<300*300)dot(e.x,e.y,'#f44',1);
    for(const id in VIEW.players){const p=VIEW.players[id];if(id!==myId()&&p.x!=null)dot(p.x,p.y,p.color||'#fff',3)}
    dot(LP.x,LP.y,'#fff',3);
    if(CAM.mode!=='top'){g.strokeStyle='#fff';g.beginPath();g.moveTo(LP.x/TS,LP.y/TS);g.lineTo(LP.x/TS+Math.cos(LP.a)*6,LP.y/TS+Math.sin(LP.a)*6);g.stroke()}}
};
document.addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b||b.disabled)return;e.preventDefault();sfx('click');UI.act(b.dataset.a,b.dataset.v,b)});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.activeElement&&document.activeElement.id==='code')UI.act('join')});
