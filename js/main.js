'use strict';
// ===== Opstarten & hoofdlus =====
(function boot(){
  SAVE=loadSave();
  if(!SAVE){SAVE={char:newChar('Astronaut',COLORS[Math.floor(Math.random()*COLORS.length)]),snaps:{},wsnaps:{},world:newWorld(),opts:{}};writeSave()}
  MUTED=!!SAVE.opts.mute;if(SAVE.opts.cam)CAM.mode=SAVE.opts.cam;if(SAVE.opts.zoom)Object.assign(CAM.zoom,SAVE.opts.zoom);
  R3.init();
  const cv=document.getElementById('cv');
  cv.addEventListener('mousedown',e=>{ac();if(!GAME.on||UI.cur)return;
    if(CAM.mode!=='top'&&!Input.locked&&!UI.placing){cv.requestPointerLock&&cv.requestPointerLock();return}
    if(e.button===0){Input.mdown=true;Input.mtap=true}if(e.button===2){Input.rdown=true;Input.rtap=true}});
  addEventListener('mouseup',e=>{if(e.button===0)Input.mdown=false;if(e.button===2)Input.rdown=false});
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  addEventListener('wheel',e=>{if(GAME.on&&!UI.cur){Input.wheel+=e.deltaY>0?1:-1;e.preventDefault()}},{passive:false});
  addEventListener('beforeunload',()=>{if(GAME.on)saveGame()});
  document.addEventListener('keydown',()=>ac(),{once:true});
  UI.showMain();
  let last=performance.now();
  function frame(now){
    const dt=Math.min(0.05,(now-last)/1000);last=now;
    try{pollPad();
    if(GAME.on&&LP){
      const paused=UI.cur&&UI.cur!=='victory'&&Net.role==='host'&&!Net.nConns();
      if(!paused){if(Net.role==='host'&&W)hostTick(dt);updateLocal(dt)}
      if(Net.role==='client')smoothView(dt);
      R3.draw(dt);UI.hud(dt);UI.frameKeys();
      GAME.saveT+=dt;if(GAME.saveT>20){GAME.saveT=0;if(!GAME.replay)saveGame()}
    }else drawMenuBg(dt);
    }catch(err){console.error(err);if(!frame.warned){frame.warned=1;toast('Er ging iets mis: '+err.message,'#f88',6000)}}
    endInput();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // Host blijft de wereld simuleren als het tabblad op de achtergrond staat (rAF pauzeert dan)
  let bgLast=performance.now();
  setInterval(()=>{const now=performance.now();const dt=Math.min(0.1,(now-bgLast)/1000);bgLast=now;
    if(document.hidden&&GAME.on&&Net.role==='host'&&W&&Net.nConns()){try{hostTick(dt);if(LP)throttleSend(dt)}catch(e){console.error(e)}}},50);
})();

// Sfeervolle achtergrond in het menu: planeet + sterren in 3D
let MENU3D=null;
function drawMenuBg(dt){
  if(!MENU3D){const s=new THREE.Scene();s.background=new THREE.Color('#05060f');
    const stars=new THREE.BufferGeometry();const pts=[];for(let i=0;i<900;i++){const v=new THREE.Vector3(rnd(-1,1),rnd(-1,1),rnd(-1,1)).normalize().multiplyScalar(rnd(40,80));pts.push(v.x,v.y,v.z)}
    stars.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));s.add(new THREE.Points(stars,new THREE.PointsMaterial({color:'#fff',size:1.2,sizeAttenuation:false})));
    const c=document.createElement('canvas');c.width=64;c.height=32;const g=c.getContext('2d');const R=mulberry32(7);
    for(let y=0;y<32;y++)for(let x=0;x<64;x++){g.fillStyle=pick(['#8a5a34','#a06a3e','#6e4628','#2e6b28','#c83a10'].slice(0,y>24||y<6?2:5));if(R()<0.6){g.fillStyle=['#8a5a34','#9a6a3e','#7a5030'][Math.floor(R()*3)]}g.fillRect(x,y,1,1)}
    const t=R3.tex(c);const pl=new THREE.Mesh(new THREE.SphereGeometry(6,24,16),new THREE.MeshLambertMaterial({map:t}));pl.position.set(3,-3,-14);s.add(pl);
    s.add(new THREE.AmbientLight('#335',0.6));const sun=new THREE.DirectionalLight('#ffd9a0',1.2);sun.position.set(-10,5,5);s.add(sun);
    const ship=new THREE.Group();ship.add(R3.box(0.9,0.25,0.4,R3.lam('#ccd')));ship.add(R3.box(0.3,0.15,0.25,R3.lam('#6cf','#29c',0.6),0.3,0.15,0));
    const fl=R3.box(0.2,0.12,0.12,R3.lam('#f80','#f80',1),-0.55,0,0);ship.add(fl);s.add(ship);
    const cam=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,0.1,200);MENU3D={s,cam,pl,ship,t:0}}
  const M=MENU3D;M.t+=dt;M.pl.rotation.y+=dt*0.05;M.cam.aspect=innerWidth/innerHeight;M.cam.updateProjectionMatrix();
  const k=(M.t%14)/14;M.ship.position.set(-8+k*10,2-k*4.5,-6-k*6);M.ship.rotation.z=-0.4;M.ship.rotation.y=-0.5;
  R3.renderer.render(M.s,M.cam);R3.og.clearRect(0,0,innerWidth,innerHeight);
}
