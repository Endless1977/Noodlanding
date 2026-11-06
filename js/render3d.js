'use strict';
// ===== 3D-renderer (three.js) met pixel-look: laag-resolutie rendering, pixel-art billboards, schaduwen, dynamisch licht =====
const U=1/TS; // px → wereldeenheden (1 tegel = 1 eenheid)
const R3={
  pix:3,renderer:null,scene:null,cam:null,zone:null,stat:null,ents:new Map(),players:new Map(),texCache:{},
  projPool:[],partPool:[],parts:[],rings:[],zaps:[],texts:[],beams:[],lightsSrc:[],shake:0,flash:0,recoilT:0,camPos:null,camLook:null,
  init(){
    const cv=document.getElementById('cv');
    this.renderer=new THREE.WebGLRenderer({canvas:cv,antialias:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.scene=new THREE.Scene();
    this.cam=new THREE.PerspectiveCamera(55,16/9,0.05,200);
    this.hemi=new THREE.HemisphereLight(0xffffff,0x443322,0.8);this.scene.add(this.hemi);
    this.sun=new THREE.DirectionalLight(0xfff0dd,0.7);this.sun.castShadow=true;
    const sc=this.sun.shadow.camera;sc.left=-18;sc.right=18;sc.top=18;sc.bottom=-18;sc.near=1;sc.far=90;
    this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.bias=-0.0015;
    this.scene.add(this.sun);this.scene.add(this.sun.target);
    this.plight=new THREE.PointLight(0xffeedd,1.0,9,1.5);this.scene.add(this.plight);
    this.lightPool=[];for(let i=0;i<6;i++){const l=new THREE.PointLight(0xffffff,0,6,2);this.scene.add(l);this.lightPool.push(l)}
    this.dyn=new THREE.Group();this.scene.add(this.dyn);
    this.ov=document.getElementById('ov');this.og=this.ov.getContext('2d');
    this.ray=new THREE.Raycaster();this.plane=new THREE.Plane(new THREE.Vector3(0,1,0),-0.4);
    this.camPos=new THREE.Vector3();this.camLook=new THREE.Vector3();
    this.glowTex=this.makeGlow();this.sqTex=this.tex(this.solidCanvas('#ffffff',2,2));
    this.blobGeo=new THREE.CircleGeometry(1,12);this.blobGeo.rotateX(-Math.PI/2);
    this.blobMat=new THREE.MeshBasicMaterial({map:this.makeGlow(),color:'#000',transparent:true,opacity:0.45,depthWrite:false});
    for(let i=0;i<260;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:this.glowTex,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));s.visible=false;this.dyn.add(s);this.projPool.push(s)}
    for(let i=0;i<520;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:this.sqTex,transparent:true,depthWrite:false}));s.visible=false;this.dyn.add(s);this.partPool.push(s)}
    this.resize();addEventListener('resize',()=>this.resize());
  },
  resize(){const w=innerWidth,h=innerHeight;this.pix=w<700?2:(SAVE&&SAVE.opts&&SAVE.opts.pix)||3;
    this.renderer.setSize(Math.ceil(w/this.pix),Math.ceil(h/this.pix),false);
    this.renderer.domElement.style.width=w+'px';this.renderer.domElement.style.height=h+'px';
    this.cam.aspect=w/h;this.cam.updateProjectionMatrix();this.ov.width=w;this.ov.height=h},
  tex(c){const t=new THREE.CanvasTexture(c);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;return t},
  solidCanvas(col,w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle=col;g.fillRect(0,0,w,h);return c},
  makeGlow(){const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d');const gr=g.createRadialGradient(8,8,0,8,8,8);
    gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(0.35,'rgba(255,255,255,0.8)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,16,16);
    return new THREE.CanvasTexture(c)},
  // 16×16 rotstextuur met lagen (strata), scheuren en zone-details
  rockTex(zid,top,emis){const pal=ZONES[zid].pal,R=mulberry32(ZONES[zid].seed+(top?11:22)+(emis?5:0));const c=document.createElement('canvas');c.width=c.height=16;const g=c.getContext('2d');
    const base=top?pal.wall:pal.face;
    if(emis){g.fillStyle='#000';g.fillRect(0,0,16,16)}else{
      if(top){g.fillStyle=base;g.fillRect(0,0,16,16);for(let i=0;i<40;i++){g.fillStyle=R()<0.5?pal.wallHi:shade(base,0.75);g.fillRect(Math.floor(R()*16),Math.floor(R()*16),1+Math.floor(R()*2),1)}
        if(zid===2)for(let i=0;i<30;i++){g.fillStyle=R()<0.5?'#3f9a44':'#2c6e30';g.fillRect(Math.floor(R()*16),Math.floor(R()*16),2,1)}}
      else{let y=0;while(y<16){const h=1+Math.floor(R()*4);g.fillStyle=shade(base,0.8+R()*0.45);g.fillRect(0,y,16,h);g.fillStyle=shade(base,0.6);g.fillRect(0,y+h-1,16,1);y+=h}
        for(let i=0;i<18;i++){g.fillStyle=R()<0.5?pal.wallHi:shade(base,0.6);g.fillRect(Math.floor(R()*16),Math.floor(R()*16),1,1)}
        if(zid===2){for(let x=0;x<16;x++)if(R()<0.7){g.fillStyle=R()<0.5?'#3f9a44':'#2c6e30';g.fillRect(x,0,1,1+Math.floor(R()*4))}}}}
    if(!top&&(zid===3||emis)){let x=Math.floor(R()*16),y=0;for(let i=0;i<18;i++){g.fillStyle=emis?'#ff5a10':(zid===3?'#ff6a1a':shade(base,0.5));if(zid===3||!emis)g.fillRect(x,y,1,1);x=clamp(x+Math.round(R()*2-1),0,15);y++;if(y>15)break}}
    return this.tex(c)},
  sprTex(name,frame,color,flip){const key=name+'|'+frame+'|'+(color||'')+'|'+(flip?1:0);let t=this.texCache[key];
    if(!t){const c=makeSpriteCanvas(name,frame,color,flip);t=this.tex(c);t.userData={w:c.width,h:c.height};this.texCache[key]=t}return t},
  lam(col,emi,ei){const m=new THREE.MeshLambertMaterial({color:col});if(emi){m.emissive=new THREE.Color(emi);m.emissiveIntensity=ei==null?1:ei}return m},
  box(w,h,d,mat,x,y,z){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x||0,y||0,z||0);m.castShadow=true;m.receiveShadow=true;return m},
  cyl(r1,r2,h,mat,x,y,z,seg){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,seg||8),mat);m.position.set(x||0,y||0,z||0);m.castShadow=true;m.receiveShadow=true;return m},
  sph(r,mat,x,y,z,ws,hs){const m=new THREE.Mesh(new THREE.SphereGeometry(r,ws||8,hs||6),mat);m.position.set(x||0,y||0,z||0);m.castShadow=true;return m},
  blob(r){const m=new THREE.Mesh(this.blobGeo,this.blobMat);m.scale.setScalar(r);m.renderOrder=1;return m},

  // ---------- Zone opbouwen ----------
  buildZone(){
    if(this.zone){this.scene.remove(this.zone);this.zone.traverse(o=>{if(o.geometry)o.geometry.dispose()})}
    if(this.skyObj){this.scene.remove(this.skyObj.sky);this.skyObj.layers.forEach(l=>this.scene.remove(l))}
    for(const s of this.ents.values())this.removeRec(s);this.ents.clear();
    for(const s of this.players.values()){this.dyn.remove(s.obj);this.dyn.remove(s.gun);this.dyn.remove(s.blob)}this.players.clear();
    this.parts.forEach(p=>p.s.visible=false);this.parts.length=0;this.texts.length=0;
    const Z=ZONES[GAME.ch],zid=MAP.zid,pal=ZONES[zid].pal;this.zone=new THREE.Group();this.scene.add(this.zone);
    // sfeer
    this.scene.background=new THREE.Color(Z.fog);this.scene.fog=new THREE.Fog(Z.fog,16,52);
    this.hemi.intensity=Z.amb;this.sun.intensity=Z.amb*0.85;this.hemi.groundColor=new THREE.Color(pal.face);
    this.sun.color=new THREE.Color({1:'#fff0d0',2:'#c8ffd0',3:'#ffb080',4:'#a8b8ff'}[GAME.ch]);
    this.plight.intensity=GAME.ch>=2?1.4:0.6;
    this.skyObj=DECOR.buildSky(this.scene,GAME.ch);
    // vloer
    const fc=buildFloorCanvases();this.floorEmis=this.tex(fc.e);
    this.floorMat=new THREE.MeshLambertMaterial({map:this.tex(fc.c),emissive:0xffffff,emissiveMap:this.floorEmis,emissiveIntensity:0.9});
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(MW,MH),this.floorMat);floor.rotation.x=-Math.PI/2;floor.position.set(MW/2,0,MH/2);floor.receiveShadow=true;this.zone.add(floor);
    // muren: instanced met gelaagde rotstextuur
    const side=new THREE.MeshLambertMaterial({map:this.rockTex(zid,false)});
    if(zid===3){side.emissive=new THREE.Color('#ffffff');side.emissiveMap=this.rockTex(zid,false,true);side.emissiveIntensity=0.8}
    const top=new THREE.MeshLambertMaterial({map:this.rockTex(zid,true)});
    const H=1.6;let n=0;for(let i=0;i<MAP.t.length;i++)if(MAP.t[i]===T.WALL)n++;
    const im=new THREE.InstancedMesh(new THREE.BoxGeometry(1,H,1),[side,side,top,side,side,side],n);
    const mtx=new THREE.Matrix4();let k=0;const R=mulberry32(ZONES[zid].seed+3);
    for(let y=0;y<MH;y++)for(let x=0;x<MW;x++)if(MAP.t[y*MW+x]===T.WALL){const hh=1+R()*0.25;mtx.makeScale(1,hh,1);mtx.setPosition(x+0.5,H*hh/2,y+0.5);im.setMatrixAt(k++,mtx)}
    im.castShadow=true;im.receiveShadow=true;this.zone.add(im);
    // aankleding
    const pr=DECOR.buildProps(this.zone,GAME.ch);this.vents=pr.vents;
    // poort (tempel met energieveld)
    this.gate=new THREE.Group();
    const gm=new THREE.MeshBasicMaterial({color:pal.acc,transparent:true,opacity:0.5,depthWrite:false});
    this.gateField=this.box(2.6,1.9,5,gm,97.5,0.95,48.5);this.gateField.castShadow=false;this.gate.add(this.gateField);
    for(let i=0;i<5;i++)this.gate.add(this.box(2.7,0.05,0.05,new THREE.MeshBasicMaterial({color:'#fff'}),97.5,0.3+i*0.35,46.2+i*1.1));
    const stone=this.lam(shade(pal.wallHi,1.3)),glow=this.lam(pal.acc,pal.acc,1);
    for(const zz of [45.4,51.6]){this.zone.add(this.box(3.4,3,1,stone,97.5,1.5,zz));this.zone.add(this.box(3.5,0.15,1.05,glow,97.5,2.2,zz));this.zone.add(this.box(3.6,0.4,1.2,stone,97.5,3.1,zz))}
    this.zone.add(this.box(3.6,0.7,7.4,stone,97.5,3.2,48.5));this.zone.add(this.box(3.7,0.12,5,glow,97.5,2.8,48.5));
    const eye=this.cyl(0.6,0.6,0.15,glow,95.6,3.2,48.5,6);eye.rotation.z=Math.PI/2;this.zone.add(eye);
    this.zone.add(this.gate);
    this.rebuildStatic();
  },
  rebuildStatic(){
    if(!this.zone)return;if(this.stat){this.zone.remove(this.stat)}const S=this.stat=new THREE.Group();this.zone.add(S);
    this.anim=[];this.ship=null;this.shipEng=null;this.obCrystal=null;this.staticLights=[];const f=ZS.flags,ch=GAME.ch,pal=ZONES[MAP.zid].pal;
    this.gate.visible=!f.gate;
    if(MAP.ship)this.buildShip(S,ch===4&&f.fixed);
    else{// noodbaken met zuurstofbel in zone 2/3
      const b=new THREE.Group();b.add(this.cyl(0.08,0.12,2,this.lam('#888'),0,1,0,6));b.add(this.cyl(0.4,0.5,0.3,this.lam('#555'),0,0.15,0,6));
      const l=this.sph(0.2,this.lam('#fff','#4dffd2',1.4),0,2.1,0);b.add(l);this.anim.push({o:l,pulse:1});
      for(let i=0;i<3;i++){const leg=this.box(0.06,0.9,0.06,this.lam('#777'),Math.cos(i*2.1)*0.35,0.4,Math.sin(i*2.1)*0.35);leg.rotation.z=Math.cos(i*2.1)*0.4;leg.rotation.x=-Math.sin(i*2.1)*0.4;b.add(leg)}
      b.position.set(MAP.spawnPx.x*U,0,(MAP.spawnPx.y-30)*U);S.add(b);this.staticLights.push({x:MAP.spawnPx.x,y:MAP.spawnPx.y-30,h:2,col:'#4dffd2',i:1.2});
      const bub=new THREE.Mesh(new THREE.SphereGeometry(8,24,12,0,TAU,0,Math.PI/2),new THREE.MeshBasicMaterial({color:'#4dffd2',transparent:true,opacity:0.07,side:THREE.DoubleSide,depthWrite:false}));
      bub.position.set(MAP.spawnPx.x*U,0,MAP.spawnPx.y*U);S.add(bub)}
    if(ch<=3){
      const pg=new THREE.Group();pg.add(this.cyl(0.7,0.85,0.4,this.lam(shade(pal.wallHi,1.2)),0,0.2,0,8));pg.add(this.cyl(0.35,0.5,0.6,this.lam(shade(pal.wallHi,1.4)),0,0.7,0,8));
      pg.add(this.cyl(0.55,0.55,0.08,this.lam(pal.acc,pal.acc,0.8),0,1.02,0,8));
      const key=ZONES[ch].key;
      if(!f.mb){const sh=new THREE.Mesh(new THREE.SphereGeometry(1.2,16,10),new THREE.MeshBasicMaterial({color:'#ff4040',transparent:true,opacity:0.18,depthWrite:false}));sh.position.y=0.8;pg.add(sh);this.anim.push({o:sh,spin:0.6})}
      else if(!CHAR.weapons[key]){const w=this.weaponModel(key);w.position.y=1.5;pg.add(w);this.anim.push({o:w,spin:1.5,bob:1.5});
        this.staticLights.push({x:MAP.pedestal.x,y:MAP.pedestal.y,h:1.6,col:WEAPONS[key].col,i:1.5})}
      pg.position.set(MAP.pedestal.x*U,0,MAP.pedestal.y*U);S.add(pg);
      if(f.boss){const t=new THREE.Mesh(new THREE.TorusGeometry(1.3,0.2,8,28),this.lam('#a8f','#a6f',1.2));t.position.set(MAP.arenaPx.x*U,1.5,MAP.arenaPx.y*U);S.add(t);this.anim.push({o:t,spin:1.5,portal:1});
        const c=new THREE.Mesh(new THREE.CircleGeometry(1.15,28),new THREE.MeshBasicMaterial({color:'#c9f',transparent:true,opacity:0.55,side:THREE.DoubleSide}));t.add(c);
        this.staticLights.push({x:MAP.arenaPx.x,y:MAP.arenaPx.y,h:1.5,col:'#b07cff',i:2.5})}
    }
    const P=MAP.rooms.puzzle;
    if(ch===1){
      const gen=new THREE.Group();gen.add(this.box(2,1.1,1.1,this.lam('#5a5048'),0,0.55,0));gen.add(this.box(2.1,0.12,1.2,this.lam('#3a3430'),0,1.15,0));
      for(let i=0;i<3;i++){gen.add(this.cyl(0.08,0.08,0.4,this.lam('#333'),-0.6+i*0.6,1.4,0,6));
        const lit=i<f.fuses.length;gen.add(this.box(0.3,0.3,0.12,this.lam('#222',lit?'#ffe14d':'#000',1),-0.6+i*0.6,0.7,0.56));
        if(lit)this.staticLights.push({x:MAP.generator.x+(-0.6+i*0.6)/U,y:MAP.generator.y+10,h:0.8,col:'#ffe14d',i:0.6})}
      for(let i=0;i<4;i++)gen.add(this.box(0.08,0.9,0.05,this.lam('#777'),-0.9+i*0.15,0.55,-0.56));
      gen.position.set(MAP.generator.x*U,0,MAP.generator.y*U);S.add(gen);
      const pp=MAP.pipe,pw=pipePowered(pp,f.pipes),on=f.fuses.length>=3;
      for(let i=0;i<pp.w*pp.h;i++){const cx=pp.gx+i%pp.w+0.5,cz=pp.gy+Math.floor(i/pp.w)+0.5;const m=rotMask(pp.mask[i],f.pipes[i]);
        const lit=on&&pw.has(i);const mat=this.lam(lit?'#4dffd2':'#8a8f96',lit?'#4dffd2':null,lit?0.9:0);
        S.add(this.box(0.92,0.08,0.92,this.lam('#3a3a40'),cx,0.04,cz));S.add(this.box(0.8,0.02,0.8,this.lam('#2a2a30'),cx,0.09,cz));
        S.add(this.cyl(0.16,0.16,0.22,mat,cx,0.16,cz,8));
        if(m&1)S.add(this.box(0.16,0.14,0.45,mat,cx,0.15,cz-0.25));if(m&4)S.add(this.box(0.16,0.14,0.45,mat,cx,0.15,cz+0.25));
        if(m&2)S.add(this.box(0.45,0.14,0.16,mat,cx+0.25,0.15,cz));if(m&8)S.add(this.box(0.45,0.14,0.16,mat,cx-0.25,0.15,cz))}
      S.add(this.box(0.6,0.6,0.6,this.lam('#ffe14d','#ffb000',on?1:0.1),pp.gx-0.4,0.3,pp.gy+pp.sr+0.5));
      S.add(this.box(0.6,0.6,0.6,this.lam('#4dffd2','#4dffd2',f.gate?1:0.1),pp.gx+pp.w+0.4,0.3,pp.gy+pp.kr+0.5));
      MAP.fuses.forEach((fu,i)=>{if(f.fuses.includes(i))return;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:this.sprTex('fuse',0)}));s.center.set(0.5,0);s.scale.set(0.45,0.55,1);
        s.position.set(fu[0]+0.5,0.2,fu[1]+0.5);S.add(s);this.anim.push({o:s,bob:0.2});
        const beam=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.15,8,6,1,true),new THREE.MeshBasicMaterial({color:'#ffe14d',transparent:true,opacity:0.35,blending:THREE.AdditiveBlending,depthWrite:false}));
        beam.position.set(fu[0]+0.5,4,fu[1]+0.5);S.add(beam);this.staticLights.push({x:tc(fu[0]),y:tc(fu[1]),h:0.6,col:'#ffe14d',i:1})});
    }
    if(ch===2){MAP.plates.forEach((pl,i)=>{const on=ZS.plates[i];S.add(this.box(1.2,0.12,1.2,this.lam('#3a3f48'),pl[0]+0.5,0.06,pl[1]+0.5));
        S.add(this.box(0.9,0.1,0.9,this.lam(on?'#9cff4d':'#667',on?'#9cff4d':null,on?0.9:0),pl[0]+0.5,on?0.08:0.15,pl[1]+0.5));
        S.add(this.cyl(0.1,0.1,1.2,this.lam('#333',on?'#9cff4d':'#300',0.8),pl[0]+0.5,0.6,pl[1]-0.4,6))});
      if(!f.gate&&ZS.plateProg>0){const r=new THREE.Mesh(new THREE.RingGeometry(1.4,1.7,32,1,0,TAU*ZS.plateProg),new THREE.MeshBasicMaterial({color:'#9cff4d',side:THREE.DoubleSide}));
        r.rotation.x=-Math.PI/2;r.position.set(P.x+0.5,0.1,P.y+0.5);S.add(r)}}
    if(ch===3){const RC=['#ff5050','#50ff80','#5090ff','#ffe050'];
      MAP.runes.forEach((r,i)=>{S.add(this.box(1.2,0.14,1.2,this.lam('#2a2226'),r[0]+0.5,0.07,r[1]+0.5));S.add(this.box(0.8,0.05,0.8,this.lam(RC[i],RC[i],0.6),r[0]+0.5,0.16,r[1]+0.5));
        S.add(this.box(0.4,1.2,0.3,this.lam('#2a2226'),r[0]+0.5,0.6,r[1]-0.35));S.add(this.box(0.25,0.25,0.05,this.lam(RC[i],RC[i],1),r[0]+0.5,0.9,r[1]-0.18))});
      const ob=new THREE.Group();ob.add(this.box(0.9,0.4,0.9,this.lam('#2a2226'),0,0.2,0));ob.add(this.cyl(0.25,0.4,2.6,this.lam('#1d1416'),0,1.7,0,5));
      const cr=new THREE.Mesh(new THREE.OctahedronGeometry(0.45),this.lam('#fff','#fff',1));cr.position.y=3.4;ob.add(cr);this.obCrystal=cr;
      for(let i=0;i<MAP.seq.length;i++)ob.add(this.box(0.14,0.14,0.14,this.lam(i<ZS.runeProg?'#ffe14d':'#333',i<ZS.runeProg?'#ffe14d':null,1),-0.32+i*0.16,0.45,0.48));
      ob.position.set(MAP.obelisk.x*U,0,MAP.obelisk.y*U);S.add(ob);this.anim.push({o:cr,spin:2})}
    for(const b of ZS.buildings)S.add(this.buildingModel(b));
  },
  weaponModel(id){const w=WEAPONS[id],g=new THREE.Group();const body=this.lam('#5a606c'),glow=this.lam(w.col,w.col,1.2);
    g.add(this.box(0.7,0.14,0.14,body,0,0,0));g.add(this.box(0.12,0.22,0.1,body,-0.18,-0.14,0));g.add(this.cyl(0.05,0.05,0.4,glow,0.42,0,0,6).rotateZ(Math.PI/2));
    for(let i=0;i<3;i++)g.add(this.box(0.04,0.18,0.18,glow,-0.05+i*0.12,0,0));return g},
  buildShip(S,fixed){
    const g=new THREE.Group();const hull=this.lam('#c8ccd4'),dark=this.lam('#4a505a'),stripe=this.lam('#ff8a1a','#ff6a1a',0.3),glass=this.lam('#6ad0ff','#2a90c0',0.7);
    const body=this.cyl(0.65,0.75,3.4,hull,0,0.9,0,10);body.rotation.z=Math.PI/2;g.add(body);
    const nose=new THREE.Mesh(new THREE.ConeGeometry(0.65,1.3,10),hull);nose.rotation.z=-Math.PI/2;nose.position.set(2.35,0.9,0);nose.castShadow=true;g.add(nose);
    const ck=this.sph(0.45,glass,1.5,1.3,0,10,8);ck.scale.set(1.4,0.7,0.9);g.add(ck);
    const ring=this.cyl(0.77,0.77,0.18,stripe,-0.4,0.9,0,10);ring.rotation.z=Math.PI/2;g.add(ring);
    for(const s of [-1,1]){const wing=this.box(1.6,0.08,1.6,hull,-0.6,0.65,s*1.2);wing.rotation.y=s*0.35;g.add(wing);g.add(this.box(0.9,0.09,0.25,stripe,-0.3,0.7,s*1.65));
      g.add(this.cyl(0.22,0.28,0.9,dark,-1.4,0.65,s*0.9,8).rotateZ(Math.PI/2))}
    g.add(this.box(0.9,0.9,0.08,hull,-1.4,1.5,0));
    for(let i=0;i<6;i++)g.add(this.box(0.04,0.05,1.0,dark,-1.2+i*0.5,1.5,0).rotateY(0));
    const eng=this.cyl(0.42,0.5,0.5,this.lam('#333','#ff6a1a',fixed?1.4:0.15),-1.95,0.9,0,10);eng.rotation.z=Math.PI/2;g.add(eng);this.shipEng=eng;
    if(!fixed){g.rotation.z=0.18;g.rotation.y=0.35;g.rotation.x=0.08;
      // krater en wrakstukken
      const cr=new THREE.Mesh(new THREE.RingGeometry(1.6,3.2,20),new THREE.MeshLambertMaterial({color:'#3a2a1a',transparent:true,opacity:0.55,depthWrite:false}));cr.rotation.x=-Math.PI/2;cr.position.y=0.02;S.add(cr);cr.position.set(MAP.ship.x*U,0.02,MAP.ship.y*U);
      const R=mulberry32(77);for(let i=0;i<9;i++){const d=this.box(0.2+R()*0.4,0.06,0.15+R()*0.3,R()<0.5?hull:dark,MAP.ship.x*U-2-R()*5,0.05,MAP.ship.y*U+(R()-0.5)*3);d.rotation.set(R(),R()*3,R());S.add(d)}
      this.staticLights.push({x:MAP.ship.x-20,y:MAP.ship.y,h:1,col:'#ff8a1a',i:1.2,flicker:1})}
    else{g.add(this.box(0.1,1.4,0.1,dark,0.4,0.3,0.6));g.add(this.box(0.1,1.4,0.1,dark,0.4,0.3,-0.6));this.staticLights.push({x:MAP.ship.x-30,y:MAP.ship.y,h:1,col:'#ff8a1a',i:2})}
    g.position.set(MAP.ship.x*U,0,MAP.ship.y*U);S.add(g);this.ship=g},
  buildingModel(b){const B=BUILDINGS[b.k],g=new THREE.Group();const metal=this.lam('#4a4e56'),dk=this.lam('#2e3138'),acc=this.lam(B.col,B.col,0.45);
    g.add(this.box(0.95,0.12,0.95,dk,0,0.06,0));
    if(b.k==='bench'){g.add(this.box(0.9,0.5,0.5,metal,0,0.37,0.1));g.add(this.box(0.95,0.06,0.6,acc,0,0.65,0.1));g.add(this.box(0.5,0.35,0.05,this.lam('#111','#5ad1ff',0.9),0,0.9,-0.2));
      g.add(this.box(0.3,0.05,0.08,this.lam('#bbb'),0.2,0.7,0.2));g.add(this.cyl(0.04,0.04,0.25,this.lam('#e0a040'),-0.3,0.75,0.2,6).rotateZ(1.2))}
    if(b.k==='suit'){const pod=this.cyl(0.35,0.4,1.3,metal,0,0.75,0,10);g.add(pod);const gl=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.3,0.9,10,1,true,-0.9,1.8),new THREE.MeshLambertMaterial({color:'#9df',emissive:new THREE.Color('#2a8ac0'),emissiveIntensity:0.6,transparent:true,opacity:0.6}));gl.position.y=0.8;g.add(gl);
      g.add(this.cyl(0.42,0.42,0.12,acc,0,1.45,0,10))}
    if(b.k==='chest'){g.add(this.box(0.85,0.45,0.6,this.lam('#8a6a3e'),0,0.35,0));g.add(this.box(0.9,0.12,0.65,this.lam('#6a4e2a'),0,0.63,0));g.add(this.box(0.88,0.08,0.62,acc,0,0.35,0));g.add(this.box(0.12,0.12,0.05,this.lam('#ffcc33','#ffcc33',0.6),0,0.5,0.31))}
    if(b.k==='ammo'){g.add(this.box(0.8,0.6,0.8,metal,0,0.4,0));g.add(this.cyl(0.12,0.15,0.9,dk,0.25,1.1,0.25,6));g.add(this.box(0.6,0.08,0.3,acc,0,0.72,0.3));
      for(let i=0;i<3;i++)g.add(this.cyl(0.06,0.06,0.18,this.lam('#4dffd2','#4dffd2',1),-0.25+i*0.12,0.85,-0.2,6));this.anim.push({smoke:{x:tc(b.tx)+4,y:tc(b.ty)+4,h:1.6}})}
    if(b.k==='turret'){g.add(this.cyl(0.35,0.45,0.5,metal,0,0.35,0,8));const piv=new THREE.Group();piv.position.y=0.75;piv.add(this.sph(0.28,dk,0,0,0,8,6));
      piv.add(this.box(0.07,0.07,0.6,this.lam('#222'),0.09,0.02,0.32));piv.add(this.box(0.07,0.07,0.6,this.lam('#222'),-0.09,0.02,0.32));piv.add(this.box(0.12,0.05,0.05,this.lam('#f44','#f44',1),0,0.15,0.2));
      g.add(piv);this.anim.push({o:piv,turret:b})}
    if(b.k==='med'){g.add(this.cyl(0.4,0.45,0.35,metal,0,0.25,0,10));const cross=new THREE.Group();cross.position.y=1.0;
      cross.add(this.box(0.5,0.15,0.08,this.lam('#fff','#7f7',1.2)));cross.add(this.box(0.15,0.5,0.08,this.lam('#fff','#7f7',1.2)));g.add(cross);this.anim.push({o:cross,spin:1.5});
      this.staticLights.push({x:tc(b.tx),y:tc(b.ty),h:1,col:'#70ff70',i:1})}
    g.position.set(b.tx+0.5,0,b.ty+0.5);return g},

  // ---------- Entiteiten ----------
  mkSpriteObj(name,scale){const t=this.sprTex(name,0);const ppu=SPRITE_DEFS[name].px||12;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,alphaTest:0.5}));
    s.center.set(0.5,0);const k=scale||1;s.scale.set(t.userData.w/ppu*k,t.userData.h/ppu*k,1);s.userData.bh=s.scale.y;return s},
  mkEntObj(e){const k=e.k,d=e.def||{};let obj,kind='spr',blobR=0;
    if(d.boss){obj=this.mkBoss(k);kind='boss';blobR=1.8}
    else if(d.spr){obj=this.mkSpriteObj(d.spr,d.scale);blobR=(d.r||6)*(d.scale||1)*U*1.3}
    else if(k==='loot'){const c=MATS[MAT_KEYS[e.aux]||'schroot'].c;obj=new THREE.Mesh(new THREE.OctahedronGeometry(0.14),this.lam(c,c,0.8));kind='loot'}
    else if(k==='pp'||k==='pl'){obj=new THREE.Mesh(new THREE.CircleGeometry(1,20),new THREE.MeshBasicMaterial({color:k==='pp'?'#7cff3a':'#ff5a10',transparent:true,opacity:0.45,depthWrite:false}));obj.rotation.x=-Math.PI/2;kind='pud'}
    else if(k==='dome'){obj=new THREE.Mesh(new THREE.SphereGeometry(1,20,12,0,TAU,0,Math.PI/2),new THREE.MeshBasicMaterial({color:'#6cf',transparent:true,opacity:0.22,depthWrite:false,side:THREE.DoubleSide}));kind='dome'}
    else if(k==='hdrone'){obj=new THREE.Group();obj.add(this.box(0.25,0.1,0.25,this.lam('#ddd')));obj.add(this.sph(0.08,this.lam('#7f7','#7f7',1.4),0,-0.08,0));
      for(const [x,z] of [[0.18,0.18],[-0.18,0.18],[0.18,-0.18],[-0.18,-0.18]])obj.add(this.cyl(0.08,0.08,0.02,this.lam('#888'),x,0.06,z,8));kind='hd'}
    else if(k==='storm'){obj=new THREE.Mesh(new THREE.TorusGeometry(1.2,0.05,6,24),new THREE.MeshBasicMaterial({color:'#8cf'}));obj.rotation.x=-Math.PI/2;kind='storm'}
    else if(k==='orb'){obj=new THREE.Mesh(new THREE.RingGeometry(2.6,3.1,32),new THREE.MeshBasicMaterial({color:'#f44',side:THREE.DoubleSide,transparent:true,opacity:0.8}));obj.rotation.x=-Math.PI/2;kind='orb'}
    else{obj=new THREE.Group();kind='none'}
    this.dyn.add(obj);const rec={obj,kind,trail:[]};
    if(blobR){rec.blob=this.blob(blobR);this.dyn.add(rec.blob)}
    if(d.boss||d.mb){const sh=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:k==='boss1'?'#6cf':k==='boss2'?'#4c4':'#fc6',transparent:true,opacity:0.25,depthWrite:false,wireframe:k!=='boss2'}));
      this.dyn.add(sh);rec.shell=sh;sh.visible=false}
    return rec},
  removeRec(r){this.dyn.remove(r.obj);if(r.shell)this.dyn.remove(r.shell);if(r.blob)this.dyn.remove(r.blob);if(r.segs)r.segs.forEach(s=>this.dyn.remove(s))},
  mkBoss(k){const g=new THREE.Group();
    if(k==='boss1'){const m=this.lam('#8a8f96'),dk=this.lam('#4a4e56'),rust=this.lam('#8a5a3a'),eye=this.lam('#f22','#f22',1.5),core=this.lam('#ffcc33','#ff8a1a',1.2);
      g.add(this.box(2.4,1.7,1.7,m,0,2.0,0));g.add(this.box(2.0,0.4,1.9,rust,0,1.2,0));g.add(this.sph(0.35,core,0,2.0,0.85,8,6));
      g.add(this.box(1.1,0.8,1.0,dk,0,3.2,0));g.add(this.box(0.7,0.18,0.1,eye,0,3.25,0.52));g.add(this.box(0.08,0.6,0.08,dk,0.4,3.8,0));
      for(const s of [-1,1]){g.add(this.box(0.9,0.5,1.3,rust,s*1.5,2.9,0));g.add(this.box(0.55,1.5,0.55,dk,s*1.6,1.9,0));g.add(this.cyl(0.18,0.18,0.9,this.lam('#333'),s*1.6,1.0,0.2,6).rotateX(0.4));
        g.add(this.cyl(0.12,0.12,0.9,this.lam('#555'),s*0.7,3.3,-0.7,6))}
      for(let i=0;i<8;i++)g.add(this.box(0.08,0.08,0.05,this.lam('#bbb'),-1+i*0.28,2.75,0.86));
      g.userData.legs=[this.box(0.7,1.3,0.7,dk,-0.65,0.65,0),this.box(0.7,1.3,0.7,dk,0.65,0.65,0)];g.userData.legs.forEach(l=>g.add(l));
      g.userData.light={col:'#ff8a1a',h:2,i:1.5}}
    if(k==='boss2'){const st=this.cyl(0.5,1.0,2.4,this.lam('#2e6b28'),0,1.2,0,8);g.add(st);
      const head=this.sph(1.15,this.lam('#c03a7a','#601030',0.4),0,2.8,0,12,10);g.add(head);
      const mouth=this.sph(0.5,this.lam('#ff4d6a','#ff2040',1.3),0,2.8,0.85,8,6);g.add(mouth);
      for(let i=0;i<10;i++){const t=new THREE.Mesh(new THREE.ConeGeometry(0.06,0.3,4),this.lam('#fff'));const a=i/10*TAU;t.position.set(Math.cos(a)*0.4,2.8+Math.sin(a)*0.4,1.25);t.rotation.x=Math.PI/2;g.add(t)}
      const petals=new THREE.Group();for(let l=0;l<2;l++)for(let i=0;i<7;i++){const a=i*TAU/7+l*0.45;const p=new THREE.Mesh(new THREE.ConeGeometry(0.45-l*0.1,1.8-l*0.4,5),this.lam(l?'#ff9ad0':'#e86ab0'));
        p.position.set(Math.cos(a)*(1.5-l*0.3),2.8,Math.sin(a)*(1.5-l*0.3));p.rotation.z=Math.PI/2;p.rotation.y=-a;p.castShadow=true;petals.add(p)}
      g.add(petals);g.userData.spin=petals;
      const tent=[];for(let i=0;i<5;i++){const tg=new THREE.Group();const a=i*TAU/5;tg.position.set(Math.cos(a)*0.9,0.2,Math.sin(a)*0.9);
        for(let s=0;s<5;s++){const seg=this.sph(0.2-s*0.03,this.lam('#3f8a3a'),Math.cos(a)*s*0.35,0.15+s*0.05,Math.sin(a)*s*0.35,6,4);tg.add(seg)}g.add(tg);tent.push(tg)}
      g.userData.tent=tent;g.userData.light={col:'#ff4d6a',h:2.8,i:1.5}}
    if(k==='boss3'){const head=this.sph(1.05,this.lam('#3a1a10','#ff4a10',0.5),0,1.0,0,10,8);g.add(head);
      g.add(this.sph(0.18,this.lam('#ff0','#ff0',1.5),0.45,1.35,0.85,6,4));g.add(this.sph(0.18,this.lam('#ff0','#ff0',1.5),-0.45,1.35,0.85,6,4));
      for(const s of [-1,1]){const h=new THREE.Mesh(new THREE.ConeGeometry(0.15,0.9,5),this.lam('#1a1418'));h.position.set(s*0.6,1.9,-0.1);h.rotation.z=-s*0.5;g.add(h)}
      const jaw=this.box(1.1,0.25,0.9,this.lam('#2a1410','#ff4a10',0.4),0,0.5,0.5);g.add(jaw);g.userData.jaw=jaw;
      g.userData.seg=true;g.userData.light={col:'#ff6a1a',h:1.2,i:2}}
    g.traverse(o=>{if(o.isMesh)o.castShadow=true});
    return g},
  syncEnts(dt,t){
    const seen=new Set();
    for(const e of VIEW.ents.values()){seen.add(e.id);let r=this.ents.get(e.id);if(!r){r=this.mkEntObj(e);this.ents.set(e.id,r)}
      const o=r.obj,d=e.def||{},x=e.x*U,z=e.y*U,st=e.st!=null?e.st:stBits(e);
      if(r.blob)r.blob.position.set(x,0.03,z);
      if(r.kind==='spr'){const frames=SPRITE_DEFS[d.spr].frames.length;const fr=frames>1?Math.floor(t*6+e.id)%frames:0;
        const faceL=!!(st&128);const flip=this.flipFor(faceL?-1:1,0);o.material.map=this.sprTex(d.spr,fr,null,flip);
        const fly=d.fly?0.35+Math.sin(t*4+e.id)*0.08:0;o.position.set(x,fly,z);
        if(!d.node&&!d.crate&&!(st&1)){o.scale.y=o.userData.bh*(1+Math.sin(t*8+e.id)*0.04)}
        let c=1,g2=1,b=1;if(st&8){c=g2=b=3}else if(st&1){c=0.6;g2=0.9;b=1.6}else if(st&4){c=0.75;g2=0.9;b=1.3}if(st&2&&!(st&8)){c*=1.4;g2*=0.9;b*=0.7}
        if(st&32){c*=1.5;g2*=0.7;b*=0.7}
        o.material.color.setRGB(c,g2,b);
        if(st&2&&Math.random()<dt*20)this.particle(e.x,e.y,0.3,'#ff8a2a',0.5,0.6);
        if(st&1&&Math.random()<dt*6)this.particle(e.x,e.y,0.5,'#cdefff',0.4,0.5);
        if(d.mb&&Math.random()<dt*10)this.particle(e.x+rnd(-10,10),e.y+rnd(-10,10),0.2,'#ffcc33',0.4,0.6,0,0,1.5);
        if(d.node&&e.hp<e.mhp)o.material.color.multiplyScalar(0.6+0.4*e.hp/e.mhp)}
      else if(r.kind==='boss'){o.position.set(x,0,z);
        const tgt=LP?Math.atan2(LP.x-e.x,LP.y-e.y):0;o.rotation.y=lerp(o.rotation.y,tgt,Math.min(1,dt*3));
        if(o.userData.legs){o.userData.legs[0].position.y=0.65+Math.max(0,Math.sin(t*4))*0.3;o.userData.legs[1].position.y=0.65+Math.max(0,-Math.sin(t*4))*0.3}
        if(o.userData.spin)o.userData.spin.rotation.y+=dt*(st&64?1.5:0.3);
        if(o.userData.tent)o.userData.tent.forEach((tg,i)=>{tg.rotation.y=Math.sin(t*2+i)*0.5;tg.rotation.z=Math.sin(t*3+i*2)*0.25});
        if(o.userData.jaw)o.userData.jaw.rotation.x=(st&32)?0.6:Math.abs(Math.sin(t*3))*0.25;
        o.traverse(m=>{if(m.material&&m.material.emissive&&!m.userData.base){m.userData.base=m.material.emissive.clone();m.userData.bi=m.material.emissiveIntensity}
          if(m.material&&m.userData.base){if(st&8){m.material.emissive.setRGB(1,1,1);m.material.emissiveIntensity=0.8}else{m.material.emissive.copy(m.userData.base);m.material.emissiveIntensity=m.userData.bi}}});
        if(o.userData.light&&(st&64))this.lightsSrc.push({x:e.x,y:e.y,h:o.userData.light.h,col:o.userData.light.col,i:o.userData.light.i,r:9});
        if(st&16&&Math.random()<dt*20)this.particle(e.x+rnd(-20,20),e.y+rnd(-20,20),rnd(0.5,2.5),'#ffe14d',0.6,0.5);
        if(o.userData.seg){r.trail.unshift({x,z});if(r.trail.length>70)r.trail.pop();
          if(!r.segs){r.segs=[];for(let i=0;i<9;i++){const sg=new THREE.Group();const s=this.sph(0.9-i*0.07,this.lam('#4a2014','#ff4a10',0.25+(i%2)*0.35),0,0,0,8,6);sg.add(s);
              const sp=new THREE.Mesh(new THREE.ConeGeometry(0.12,0.6-i*0.04,4),this.lam('#1a1418'));sp.position.y=0.75-i*0.06;sg.add(sp);
              this.dyn.add(sg);r.segs.push(sg)}}
          r.segs.forEach((s,i)=>{const p=r.trail[Math.min(r.trail.length-1,(i+1)*6)];if(p)s.position.set(p.x,0.9-i*0.05,p.z)});
          if(Math.random()<dt*15){const p=r.trail[Math.floor(Math.random()*r.trail.length)];if(p)this.particle(p.x/U,p.z/U,0.6,pick(['#ff8a1a','#ffd24d']),0.5,0.6,0,0,1.5)}}}
      else if(r.kind==='loot'){o.position.set(x,0.25+Math.sin(t*4+e.id)*0.06,z);o.rotation.y+=dt*3}
      else if(r.kind==='pud'){const rr=(e.aux||16)*U;o.scale.set(rr,rr,1);o.position.set(x,0.02,z);o.material.opacity=0.35+Math.sin(t*5+e.id)*0.1;
        if(Math.random()<dt*8)this.particle(e.x+rnd(-e.aux,e.aux)*0.7,e.y+rnd(-e.aux,e.aux)*0.7,0.05,e.k==='pp'?'#9cff4d':'#ffb030',0.5,0.6,0,0,0.8);
        if(e.k==='pl')this.lightsSrc.push({x:e.x,y:e.y,h:0.4,col:'#ff6a1a',i:1,r:4})}
      else if(r.kind==='dome'){const rr=(e.aux||40)*U;o.scale.set(rr,rr,rr);o.position.set(x,0,z);o.rotation.y+=dt*0.5}
      else if(r.kind==='hd'){o.position.set(x,1.1+Math.sin(t*6)*0.1,z);o.rotation.y+=dt*6;this.lightsSrc.push({x:e.x,y:e.y,h:1,col:'#7f7',i:0.8,r:4})}
      else if(r.kind==='storm'){o.position.set(x,0.6,z);o.rotation.z+=dt*5;if(Math.random()<dt*15)this.particle(e.x+rnd(-20,20),e.y+rnd(-20,20),0.6,'#8cf',0.3,0.5);this.lightsSrc.push({x:e.x,y:e.y,h:1,col:'#8cf',i:1.5,r:6})}
      else if(r.kind==='orb'){o.position.set(x,0.05,z);o.scale.setScalar(0.4+0.6*Math.abs(Math.sin(t*6)))}
      if(r.shell){const show=e.ar>0;r.shell.visible=show;if(show){const s=(d.boss?2.7:entR(e)*U*1.6);r.shell.scale.setScalar(s);r.shell.position.set(x,d.boss?1.7:0.5,z);r.shell.rotation.y+=dt;r.shell.material.opacity=0.18+0.1*Math.sin(t*6)}}
    }
    for(const [id,r] of this.ents)if(!seen.has(id)){this.removeRec(r);this.ents.delete(id)}
  },
  flipFor(dx,dy){const yaw=this.viewYaw;const rx=-Math.sin(yaw),ry=Math.cos(yaw);return (dx*rx+dy*ry)<0},
  syncPlayers(t){
    const seen=new Set();const me=myId();
    const list=[];for(const id in VIEW.players){if(id===me)continue;const p=VIEW.players[id];if(p.x==null)continue;list.push({id,p,x:p.rx!=null?p.rx:p.x,y:p.ry!=null?p.ry:p.y})}
    if(LP)list.push({id:me,p:{color:CHAR.color,a:LP.a,mv:LP.mv,dn:LP.dn,iv:LP.iv>0,name:CHAR.name},x:LP.x,y:LP.y,local:true});
    for(const it of list){seen.add(it.id);let r=this.players.get(it.id);
      if(!r){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:this.sprTex('astro',0,it.p.color),transparent:true,alphaTest:0.5}));s.center.set(0.5,0);
        const tx=this.sprTex('astro',0,it.p.color);s.scale.set(tx.userData.w/15,tx.userData.h/15,1);
        const gun=new THREE.Group();gun.add(this.box(0.08,0.08,0.4,this.lam('#444')));const tip=this.box(0.05,0.05,0.12,this.lam('#fff','#fff',1),0,0,0.24);gun.add(tip);gun.userData.tip=tip;
        const bl=this.blob(0.4);this.dyn.add(s);this.dyn.add(gun);this.dyn.add(bl);r={obj:s,gun,blob:bl};this.players.set(it.id,r)}
      const p=it.p,s=r.obj;const fr=p.mv?Math.floor(t*8)%2:0;const flip=this.flipFor(Math.cos(p.a||0),Math.sin(p.a||0));
      s.material.map=this.sprTex('astro',fr,p.color,flip);
      s.visible=!(it.local&&CAM.mode==='first');s.material.opacity=p.iv&&Math.floor(t*12)%2?0.6:1;
      r.blob.position.set(it.x*U,0.03,it.y*U);
      const bob=p.mv&&!p.dn?Math.abs(Math.sin(t*10))*0.04:0;
      if(p.dn){s.material.rotation=Math.PI/2;s.position.set(it.x*U,0.05,it.y*U);s.material.color.setRGB(0.6,0.6,0.7)}
      else{s.material.rotation=0;s.position.set(it.x*U,bob,it.y*U);s.material.color.setRGB(1,1,1)}
      const g=r.gun;g.visible=s.visible&&!p.dn;const a=p.a||0;g.position.set(it.x*U+Math.cos(a)*0.32,0.62+bob,it.y*U+Math.sin(a)*0.32);g.rotation.y=-a+Math.PI/2;
      const w=WEAPONS[it.local?(CHAR.loadout[LP.wi]||'blaster'):(p.w||'blaster')];if(w)g.userData.tip.material.emissive.set(w.col);
      if(it.local&&!p.dn&&GAME.ch>=2)this.lightsSrc.push({x:it.x+Math.cos(a)*30,y:it.y+Math.sin(a)*30,h:1.2,col:'#fff2d8',i:0.9,r:10})}
    for(const [id,r] of this.players)if(!seen.has(id)){this.dyn.remove(r.obj);this.dyn.remove(r.gun);this.dyn.remove(r.blob);this.players.delete(id)}
  },
  PCOL:{bolt:'#77ffff',pellet:'#ffcc66',cryo:'#99ddff',plasma:'#ff66ff',rail:'#ffffff',arc:'#88ccff',flame:'#ffaa44',sonic:'#ffff88',gren:'#ff66ff',eb:'#ffdd55',ep:'#7cff3a',ef:'#ff6a2a'},
  PSIZE:{pellet:0.25,plasma:0.6,rail:0.5,flame:0.5,sonic:1.1,gren:0.45,eb:0.45,ep:0.5,ef:0.55},
  syncProj(dt){let i=0;for(const p of VIEW.proj){if(i>=this.projPool.length)break;const s=this.projPool[i++];s.visible=true;
      const col=this.PCOL[p.k]||'#fff';s.position.set(p.x*U,p.k==='gren'?0.6:0.5,p.y*U);s.material.color.set(col);const sz=this.PSIZE[p.k]||0.35;s.scale.set(sz,sz,1);
      if(i%3===0||p.k==='plasma'||p.k==='ef'||p.k==='sonic')this.lightsSrc.push({x:p.x,y:p.y,h:0.5,col,i:p.k==='plasma'||p.k==='sonic'?1.6:0.8,r:4});
      if(['plasma','flame','ef','gren','sonic'].includes(p.k)&&Math.random()<dt*25)this.particle(p.x,p.y,0.5,col,0.35,0.25,0,0,0.2)}
    for(;i<this.projPool.length;i++)this.projPool[i].visible=false},

  // ---------- Effecten ----------
  particle(x,y,h,col,size,life,vx,vy,vh){const s=this.partPool.find(o=>!o.visible);if(!s)return;s.visible=true;s.material.color.set(col);s.scale.set(size*0.16,size*0.16,1);s.material.opacity=1;
    s.position.set(x*U,h,y*U);this.parts.push({s,vx:(vx!=null?vx:rnd(-1,1))*U*40,vz:(vy!=null?vy:rnd(-1,1))*U*40,vh:vh!=null?vh:rnd(0.5,2),life,max:life,grav:vh!=null&&vh<=1.2?0:4})},
  ring(x,y,r,col){const m=new THREE.Mesh(new THREE.RingGeometry(0.85,1,32),new THREE.MeshBasicMaterial({color:col,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
    m.rotation.x=-Math.PI/2;m.position.set(x*U,0.1,y*U);this.dyn.add(m);this.rings.push({m,r:r*U,life:0.4,max:0.4})},
  zap(x1,y1,x2,y2){const pts=[];const n=6;for(let i=0;i<=n;i++){const k=i/n;pts.push(new THREE.Vector3(lerp(x1,x2,k)*U+(i&&i<n?rnd(-0.2,0.2):0),0.6+(i&&i<n?rnd(-0.2,0.2):0),lerp(y1,y2,k)*U+(i&&i<n?rnd(-0.2,0.2):0)))}
    const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#cfefff'}));this.dyn.add(l);this.zaps.push({l,life:0.14,x:(x1+x2)/2,y:(y1+y2)/2})},
  beam(x,y){const m=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.2,40,12,1,true),new THREE.MeshBasicMaterial({color:'#f9f',transparent:true,opacity:0.8,blending:THREE.AdditiveBlending,depthWrite:false}));
    m.position.set(x*U,20,y*U);this.dyn.add(m);this.beams.push({m,life:0.6,x,y})},
  flashes:[],
  updateFx(dt){
    for(let i=this.parts.length-1;i>=0;i--){const p=this.parts[i];p.life-=dt;if(p.life<=0){p.s.visible=false;this.parts.splice(i,1);continue}
      p.s.position.x+=p.vx*dt;p.s.position.z+=p.vz*dt;p.s.position.y=Math.max(0.02,p.s.position.y+p.vh*dt);p.vh-=p.grav*dt;p.s.material.opacity=Math.min(1,p.life/p.max*1.5)}
    for(let i=this.rings.length-1;i>=0;i--){const r=this.rings[i];r.life-=dt;const k=1-r.life/r.max;r.m.scale.setScalar(Math.max(0.01,r.r*k));r.m.material.opacity=r.life/r.max;
      if(r.life<=0){this.dyn.remove(r.m);r.m.geometry.dispose();this.rings.splice(i,1)}}
    for(let i=this.zaps.length-1;i>=0;i--){const z=this.zaps[i];z.life-=dt;this.lightsSrc.push({x:z.x,y:z.y,h:0.8,col:'#cfefff',i:2,r:6});if(z.life<=0){this.dyn.remove(z.l);z.l.geometry.dispose();this.zaps.splice(i,1)}}
    for(let i=this.beams.length-1;i>=0;i--){const b=this.beams[i];b.life-=dt;b.m.material.opacity=b.life/0.6;b.m.scale.x=b.m.scale.z=b.life/0.6;this.lightsSrc.push({x:b.x,y:b.y,h:2,col:'#f9f',i:4,r:14});if(b.life<=0){this.dyn.remove(b.m);this.beams.splice(i,1)}}
    for(let i=this.flashes.length-1;i>=0;i--){const f=this.flashes[i];f.life-=dt;if(f.life<=0){this.flashes.splice(i,1);continue}this.lightsSrc.push({x:f.x,y:f.y,h:1,col:f.col,i:f.i*f.life/f.max,r:f.r})}
    for(let i=this.texts.length-1;i>=0;i--){const t=this.texts[i];t.life-=dt;t.h+=dt*0.8;if(t.life<=0)this.texts.splice(i,1)}
    if(this.shake>0)this.shake=Math.max(0,this.shake-dt*3);if(this.flash>0)this.flash=Math.max(0,this.flash-dt*2.5);if(this.recoilT>0)this.recoilT-=dt;
  },
  hurtFlash(a){this.flash=Math.min(0.6,this.flash+a*0.6);this.shake=Math.min(1,this.shake+a*0.4)},
  recoil(){this.recoilT=0.08;if(LP){const w=WEAPONS[CHAR.loadout[LP.wi]||'blaster'];this.flashes.push({x:LP.x+Math.cos(LP.a)*10,y:LP.y+Math.sin(LP.a)*10,col:w.col,i:1.8,r:5,life:0.06,max:0.06})}},
  // kies de dichtstbijzijnde lichtbronnen voor de puntlicht-pool
  updateLights(){
    const L=LP;if(!L)return;const src=this.lightsSrc.concat(this.staticLights||[]);
    for(const s of src)s.d=d2(s.x,s.y,L.x,L.y);src.sort((a,b)=>a.d-b.d);
    const t=performance.now()/1000;
    for(let i=0;i<this.lightPool.length;i++){const l=this.lightPool[i],s=src[i];
      if(!s||s.d>320*320){l.intensity=0;continue}
      l.position.set(s.x*U,s.h,s.y*U);l.color.set(s.col);l.intensity=s.i*(s.flicker?0.7+Math.random()*0.5:1);l.distance=s.r||6}
    this.lightsSrc.length=0;
  },

  // ---------- Camera ----------
  updateCamera(dt){
    if(!LP)return;const L=LP,z=CAM.zoom[CAM.mode];const px=L.x*U,pz=L.y*U;const k=Math.min(1,dt*10);
    const sh=this.shake*0.25;const sx=rnd(-sh,sh),sy=rnd(-sh,sh);
    let pos,look,fov=55;
    if(CAM.mode==='top'){this.viewYaw=-Math.PI/2;pos=new THREE.Vector3(px,12*z,pz+6.5*z);look=new THREE.Vector3(px,0,pz-0.5);
      this.camPos.lerp(pos,k);this.camLook.lerp(look,k)}
    else if(CAM.mode==='third'){this.viewYaw=CAM.yaw;const cy=Math.cos(CAM.yaw),syw=Math.sin(CAM.yaw);const dist=4.2*z;
      let back=dist;for(let s=0.3;s<=dist;s+=0.2){if(solidP((px-cy*s)/U,(pz-syw*s)/U)){back=Math.max(0.4,s-0.3);break}}
      const hgt=1.9+0.8*z-CAM.pitch*1.6;
      pos=new THREE.Vector3(px-cy*back+(-syw)*0.45,Math.max(0.5,hgt),pz-syw*back+cy*0.45);
      look=new THREE.Vector3(px+cy*4,0.9+CAM.pitch*3,pz+syw*4);this.camPos.lerp(pos,Math.min(1,dt*14));this.camLook.copy(look)}
    else{this.viewYaw=CAM.yaw;const cy=Math.cos(CAM.yaw),syw=Math.sin(CAM.yaw);const bob=L.mv?Math.sin(L.bob)*0.04:0;
      pos=new THREE.Vector3(px,0.95+bob,pz);look=new THREE.Vector3(px+cy*Math.cos(CAM.pitch),0.95+Math.sin(CAM.pitch),pz+syw*Math.cos(CAM.pitch));
      this.camPos.copy(pos);this.camLook.copy(look);fov=72/z}
    if(this.cam.fov!==fov){this.cam.fov=fov;this.cam.updateProjectionMatrix()}
    if(this.camPos.lengthSq()===0){this.camPos.copy(pos);this.camLook.copy(look)}
    this.cam.position.set(this.camPos.x+sx,this.camPos.y+sy,this.camPos.z);this.cam.lookAt(this.camLook);
    this.plight.position.set(px,1.6,pz);
    this.sun.position.set(px-14,30,pz+10);this.sun.target.position.set(px,0,pz);
    if(this.skyObj){this.skyObj.sky.position.set(this.cam.position.x,0,this.cam.position.z);this.skyObj.layers.forEach((l,i)=>l.position.set(this.cam.position.x,i?5:7,this.cam.position.z))}
  },
  mouseWorld(){const v=new THREE.Vector2(Input.mx/innerWidth*2-1,-(Input.my/innerHeight)*2+1);this.ray.setFromCamera(v,this.cam);
    const p=new THREE.Vector3();if(!this.ray.ray.intersectPlane(this.plane,p))return null;return{x:p.x/U,y:p.z/U}},
  project(x,h,y){const v=new THREE.Vector3(x*U,h,y*U);v.project(this.cam);if(v.z>1||v.z<-1)return null;return{x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight}},

  // ---------- Frame ----------
  ambient(dt){if(!LP)return;const L=LP,ch=GAME.ch;
    const spawn=(n,col,h,size,life,vh)=>{if(Math.random()<dt*n)this.particle(L.x+rnd(-220,220),L.y+rnd(-170,170),h(),col,size,life,rnd(-0.4,0.4),rnd(-0.2,0.2),vh)};
    if(ch===1)spawn(18,'#e8d0a0',()=>rnd(0.2,2),0.35,2.5,0.05);
    if(ch===2){spawn(30,'#9cff4d',()=>rnd(0.2,1.8),0.4,2.2,0.08);spawn(8,'#ffe14d',()=>rnd(0.5,1.5),0.5,1.5,0.1)}
    if(ch===3){spawn(30,'#ff8a1a',()=>0.1,0.4,2.2,0.9);spawn(14,'#555',()=>rnd(1,3),0.8,3,0.2)}
    if(ch===4)spawn(12,'#c8d8ff',()=>rnd(0.5,2.5),0.3,3,0.02);
    if(this.vents)for(const v of this.vents)if(d2(v.x,v.y,L.x,L.y)<260*260&&Math.random()<dt*4){this.particle(v.x,v.y,0.3,pick(['#555','#666','#ff8a1a']),0.9,1.6,rnd(-0.1,0.1),rnd(-0.1,0.1),1.2)}
  },
  draw(dt){
    if(!GAME.on||!MAP||!this.zone)return;
    const t=performance.now()/1000;
    this.updateCamera(dt);this.syncEnts(dt,t);this.syncPlayers(t);this.syncProj(dt);this.updateFx(dt);this.ambient(dt);
    for(const a of this.anim){if(a.spin)a.o.rotation.y+=dt*a.spin;if(a.bob)a.o.position.y=a.bob+Math.sin(t*3)*0.12;
      if(a.pulse)a.o.material.emissiveIntensity=1+Math.sin(t*4)*0.6;
      if(a.portal&&Math.random()<dt*20)this.particle(MAP.arenaPx.x+rnd(-20,20),MAP.arenaPx.y+rnd(-20,20),rnd(0.5,2.5),'#c9f',0.5,0.8,0,0,0.6);
      if(a.smoke&&Math.random()<dt*3)this.particle(a.smoke.x,a.smoke.y,a.smoke.h,'#777',1,1.5,rnd(-0.2,0.2),rnd(-0.2,0.2),0.8);
      if(a.turret&&a.turret.a!=null)a.o.rotation.y=-a.turret.a+Math.PI/2}
    if(this.gateField&&this.gate.visible)this.gateField.material.opacity=0.4+Math.sin(t*5)*0.12;
    if(this.floorMat)this.floorMat.emissiveIntensity=0.8+Math.sin(t*1.7)*0.15;
    if(this.obCrystal&&GAME.ch===3){const cyc=MAP.seq.length*0.8+1.6;const ph=t%cyc;const i=Math.floor(ph/0.8);const RC=['#ff5050','#50ff80','#5090ff','#ffe050'];
      const col=i<MAP.seq.length?RC[MAP.seq[i]]:'#222';this.obCrystal.material.color.set(col);this.obCrystal.material.emissive.set(col);
      this.lightsSrc.push({x:MAP.obelisk.x,y:MAP.obelisk.y,h:3.4,col:i<MAP.seq.length?col:'#000',i:2.5,r:10})}
    if(this.ship&&GAME.ch===4&&ZS.flags.fixed){if(ZS.finale.state==='launch'&&Math.random()<0.6)this.particle(MAP.ship.x-34,MAP.ship.y,0.9,pick(['#ff8a1a','#ffd24d']),0.9,0.5,-2,rnd(-0.3,0.3),0.3);
      if(ZS.finale.state==='won')this.ship.position.y+=dt*3}
    if(this.ship&&GAME.ch<4){if(Math.random()<dt*6)this.particle(MAP.ship.x-26,MAP.ship.y,0.9,'#777',1.4,1.8,rnd(-0.2,0.2),rnd(-0.2,0.2),0.6);
      if(Math.random()<dt*3)for(let i=0;i<4;i++)this.particle(MAP.ship.x+10,MAP.ship.y-6,1,'#ffe14d',0.3,0.4)}
    this.updateLights();
    this.renderer.render(this.scene,this.cam);
    this.drawOverlay(t);
  },
  drawOverlay(t){
    const g=this.og,W2=innerWidth,H2=innerHeight;g.clearRect(0,0,W2,H2);g.imageSmoothingEnabled=false;
    g.textAlign='center';g.font='16px VT323, monospace';
    const me=myId();
    for(const id in VIEW.players){if(id===me)continue;const p=VIEW.players[id];if(p.x==null)continue;const pr=this.project(p.rx!=null?p.rx:p.x,1.55,p.ry!=null?p.ry:p.y);if(!pr)continue;
      g.fillStyle=p.color||'#fff';g.fillText((p.name||'?')+' ['+(p.lvl||1)+']',pr.x,pr.y-10);
      g.fillStyle='#000';g.fillRect(pr.x-20,pr.y-6,40,4);g.fillStyle='#e44';g.fillRect(pr.x-20,pr.y-6,40*clamp(p.hp/(p.mhp||1),0,1),4);
      if(p.dn){g.fillStyle='#f66';g.fillText('NEERGEGAAN — E vasthouden',pr.x,pr.y-24)}}
    for(const e of VIEW.ents.values()){const d=e.def;if(!d||!d.hp||d.node||d.boss||e.hp>=e.mhp)continue;
      const sd=SPRITE_DEFS[d.spr];const pr=this.project(e.x,(sd?sd.frames[0].length/(sd.px||12)*(d.scale||1):1)+0.15,e.y);if(!pr)continue;const w=d.mb?60:26;
      g.fillStyle='#000';g.fillRect(pr.x-w/2,pr.y,w,4);g.fillStyle=d.mb?'#fa4':'#f44';g.fillRect(pr.x-w/2,pr.y,w*clamp(e.hp/e.mhp,0,1),4);
      if(d.mb){g.fillStyle='#fc8';g.fillText(d.n,pr.x,pr.y-4)}
      if((e.st||0)&32){g.fillStyle='#f44';g.font='24px VT323';g.fillText('!',pr.x,pr.y-8);g.font='16px VT323, monospace'}}
    for(const tx of this.texts){const pr=this.project(tx.x,tx.h,tx.y);if(!pr)continue;g.globalAlpha=Math.min(1,tx.life*2);
      g.font=(tx.big?'22px':'16px')+' VT323, monospace';g.fillStyle='#000';g.fillText(tx.s,pr.x+1,pr.y+1);g.fillStyle=tx.col;g.fillText(tx.s,pr.x,pr.y)}
    g.globalAlpha=1;
    if(LP&&!UI.cur&&(CAM.mode!=='top'||Input.usePad===false)){
      let cx=W2/2,cy=H2/2;if(CAM.mode==='top'){cx=Input.mx;cy=Input.my}else if(CAM.mode==='third'){const pr=this.project(LP.x+Math.cos(LP.a)*200,0.7,LP.y+Math.sin(LP.a)*200);if(pr){cx=pr.x;cy=pr.y}}
      g.strokeStyle='rgba(255,255,255,0.85)';g.lineWidth=2;g.beginPath();g.moveTo(cx-9,cy);g.lineTo(cx-3,cy);g.moveTo(cx+3,cy);g.lineTo(cx+9,cy);g.moveTo(cx,cy-9);g.lineTo(cx,cy-3);g.moveTo(cx,cy+3);g.lineTo(cx,cy+9);g.stroke()}
    if(LP&&CAM.mode==='first'&&!LP.dn){const w=WEAPONS[CHAR.loadout[LP.wi]||'blaster'];const s=Math.max(4,Math.round(H2/120));const bx=W2*0.66,by=H2-s*24+(this.recoilT>0?s*2:0)+(LP.mv?Math.abs(Math.sin(LP.bob))*s*2:0);
      g.fillStyle='#2a2f38';g.fillRect(bx-s,by+s,s*18,s*6);g.fillStyle='#3d434d';g.fillRect(bx,by,s*16,s*6);g.fillStyle='#565e6c';g.fillRect(bx,by,s*16,s);g.fillStyle='#6d7685';g.fillRect(bx+s*2,by-s*3,s*12,s*4);
      g.fillStyle='#8a94a4';g.fillRect(bx+s*2,by-s*3,s*12,s);g.fillStyle=w.col;g.fillRect(bx+s*3,by-s*2,s*10,s);for(let i=0;i<4;i++)g.fillRect(bx+s*(4+i*3),by+s*2,s,s*2);
      g.fillStyle='#e9edf3';g.fillRect(bx+s*10,by+s*4,s*8,s*12);g.fillStyle='#a3adbb';g.fillRect(bx+s*16,by+s*4,s*2,s*12);g.fillStyle=CHAR.color;g.fillRect(bx+s*10,by+s*6,s*8,s*2);
      if(this.recoilT>0){g.fillStyle=w.col;g.globalAlpha=0.8;g.fillRect(bx-s*4,by-s*4,s*5,s*5);g.fillStyle='#fff';g.fillRect(bx-s*3,by-s*3,s*3,s*3);g.globalAlpha=1}}
    if(this.flash>0){g.fillStyle=`rgba(255,40,40,${this.flash*0.5})`;g.fillRect(0,0,W2,H2)}
    if(LP&&LP.hazard){g.fillStyle=GAME.ch===2?'rgba(80,255,40,0.12)':'rgba(255,100,20,0.12)';g.fillRect(0,0,W2,H2)}
  }
};
function playFx(f){if(!GAME.on)return;
  switch(f[0]){
    case 'dmg':R3.texts.push({x:f[1],y:f[2],h:1.2,s:f[4]===2?'⛨'+f[3]:''+f[3],col:f[4]===1?'#ffe14d':f[4]===2?'#8cf':'#fff',life:0.8,big:f[4]===1});break;
    case 'txt':R3.texts.push({x:f[1],y:f[2],h:1.8,s:f[3],col:f[4]||'#fff',life:1.4,big:true});break;
    case 'boom':for(let i=0;i<Math.min(36,f[3]*1.2);i++)R3.particle(f[1],f[2],0.4,i%4===0?'#fff':i%4===1?'#333':f[4],rnd(0.6,1.6),rnd(0.3,0.8),rnd(-2,2)*f[3]/20,rnd(-2,2)*f[3]/20,rnd(1.5,3.5));
      R3.ring(f[1],f[2],f[3],f[4]);R3.flashes.push({x:f[1],y:f[2],col:f[4],i:3,r:Math.max(4,f[3]*U*3),life:0.25,max:0.25});
      if(LP&&d2(f[1],f[2],LP.x,LP.y)<200*200)R3.shake=Math.min(1,R3.shake+f[3]/80);break;
    case 'hit':for(let i=0;i<4;i++)R3.particle(f[1],f[2],0.5,f[3]||'#fff',0.5,0.25);break;
    case 'zap':R3.zap(f[1],f[2],f[3],f[4]);break;
    case 'ring':R3.ring(f[1],f[2],f[3],f[4]);break;
    case 'beam':R3.beam(f[1],f[2]);break;
    case 'trail':R3.particle(f[1],f[2],0.5,f[3],0.8,0.3,0,0,0);break;
    case 'swing':for(let i=0;i<6;i++)R3.particle(f[1],f[2],0.6,'#fff',0.5,0.15);break;
    case 'snd':sfx(f[1]);break;
  }
}
function floatText(x,y,s,col){R3.texts.push({x,y,h:1.4,s,col,life:1.2})}
