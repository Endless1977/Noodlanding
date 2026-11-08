'use strict';
// ===== Wereld-aankleding: lucht, bergen, props per zone, tempelruïnes =====
const DECOR={
  flat(geo){const g=geo.index?geo.toNonIndexed():geo;g.computeVertexNormals();return g},
  // InstancedMesh uit een lijst matrices
  inst(group,geo,mat,mats,shadow){if(!mats.length)return null;const m=new THREE.InstancedMesh(geo,mat,mats.length);
    mats.forEach((M,i)=>m.setMatrixAt(i,M));m.castShadow=shadow!==false;m.receiveShadow=true;group.add(m);return m},
  mtx(x,y,z,ry,sx,sy,sz,rx,rz){const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0));
    return new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),q,new THREE.Vector3(sx,sy==null?sx:sy,sz==null?sx:sz))},
  part(M,ox,oy,oz,ry,sx,sy,sz,rx,rz){return M.clone().multiply(this.mtx(ox,oy,oz,ry,sx,sy,sz,rx,rz))},

  // ---------- Lucht ----------
  buildSky(scene,ch){
    const Z=ZONES[ch],zid=Z.map||ch;const R=mulberry32(ZONES[zid].seed+99);
    const c=document.createElement('canvas');c.width=512;c.height=256;const g=c.getContext('2d');
    const top={1:'#7fb2d8',2:'#0e2a1a',3:'#1a0606',4:'#03050f'}[ch],hor=Z.sky;
    const gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,top);gr.addColorStop(0.48,hor);gr.addColorStop(0.52,Z.fog);gr.addColorStop(1,Z.fog);
    g.fillStyle=gr;g.fillRect(0,0,512,256);
    const night=ch!==1;
    if(night)for(let i=0;i<500;i++){const y=R()*120;g.fillStyle=`rgba(255,255,255,${0.3+R()*0.7})`;g.fillRect(Math.floor(R()*512),Math.floor(y),1,1)}
    // gasreus met ringen
    const px=140,py=70,r=ch===1?26:34;
    g.save();g.beginPath();g.arc(px,py,r,0,TAU);g.clip();
    for(let y=-r;y<r;y+=3){g.fillStyle=['#d9a066','#b5703a','#e8c48a','#9a5a30'][Math.floor(R()*4)];g.fillRect(px-r,py+y,r*2,3)}
    g.fillStyle='rgba(0,0,0,0.45)';g.beginPath();g.arc(px+r*0.5,py+r*0.3,r,0,TAU);g.fill();g.restore();
    g.strokeStyle='rgba(230,210,170,0.8)';g.lineWidth=2;g.beginPath();g.ellipse(px,py,r*1.9,r*0.42,-0.25,0,TAU);g.stroke();
    g.strokeStyle='rgba(180,150,110,0.6)';g.lineWidth=1;g.beginPath();g.ellipse(px,py,r*2.2,r*0.5,-0.25,0,TAU);g.stroke();
    // maantjes
    for(const [mx,my,mr,col] of [[330,50,9,'#c9c2b8'],[372,86,5,'#9ad']]){g.fillStyle=col;g.beginPath();g.arc(mx,my,mr,0,TAU);g.fill();g.fillStyle='rgba(0,0,0,0.35)';g.beginPath();g.arc(mx+mr*0.4,my,mr,0,TAU);g.fill()}
    if(ch===1){g.fillStyle='#fff6d8';g.beginPath();g.arc(430,40,10,0,TAU);g.fill();g.fillStyle='rgba(255,240,200,0.25)';g.beginPath();g.arc(430,40,20,0,TAU);g.fill()}
    if(ch===3){for(let i=0;i<40;i++){g.fillStyle=`rgba(255,${80+Math.floor(R()*80)},20,${0.15+R()*0.2})`;g.fillRect(Math.floor(R()*512),110+Math.floor(R()*20),20+Math.floor(R()*40),2)}}
    const t=R3.tex(c);
    const sky=new THREE.Mesh(new THREE.SphereGeometry(95,32,16),new THREE.MeshBasicMaterial({map:t,side:THREE.BackSide,fog:false,depthWrite:false}));
    sky.renderOrder=-10;scene.add(sky);
    // bergsilhouetten (2 lagen)
    const layers=[];
    for(const [rad,hgt,col,seed] of [[80,16,shade(Z.fog,0.8),1],[64,11,shade(Z.fog,0.55),2]]){
      const mc=document.createElement('canvas');mc.width=1024;mc.height=64;const mg=mc.getContext('2d');const RR=mulberry32(ZONES[zid].seed+seed*13);
      let h=30;mg.fillStyle=col;for(let x=0;x<1024;x++){h+=(RR()-0.5)*(zid===3?5:3);if(RR()<0.01)h-=8;h=clamp(h,6,60);mg.fillRect(x,64-h,1,h)}
      if(zid===3)for(let i=0;i<6;i++){const x=Math.floor(RR()*1024);mg.fillStyle='#ff5a10';mg.fillRect(x,8,2,6)}
      const mt=R3.tex(mc);mt.wrapS=THREE.RepeatWrapping;mt.repeat.x=2;
      const m=new THREE.Mesh(new THREE.CylinderGeometry(rad,rad,hgt,64,1,true),new THREE.MeshBasicMaterial({map:mt,transparent:true,side:THREE.BackSide,fog:false,depthWrite:false}));
      m.renderOrder=-9;scene.add(m);layers.push(m)}
    return {sky,layers};
  },

  // ---------- Props ----------
  buildProps(group,ch){
    const zid=ZONES[ch].map||ch,pal=ZONES[zid].pal,R=mulberry32(ZONES[zid].seed+555);
    const rm=MAP.rooms;const avoid=(x,y)=>{
      if(Math.abs(x-rm.spawn.x)<10&&Math.abs(y-rm.spawn.y)<8)return true;
      if(Math.abs(x-rm.puzzle.x)<9&&Math.abs(y-rm.puzzle.y)<7)return true;
      if((x-rm.vault.x)**2+(y-rm.vault.y)**2<16)return true;if(x>=86)return true;return false};
    const wallN=(x,y)=>[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>tileAt(x+dx,y+dy)===T.WALL);
    const L={};const add=(k,M)=>{(L[k]=L[k]||[]).push(M)};
    const vents=[];
    for(let y=1;y<MH-1;y++)for(let x=1;x<95;x++){const v=MAP.t[y*MW+x];
      if(v===T.WALL){const open=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{const t=tileAt(x+dx,y+dy);return t===T.FLOOR||t===T.LAVA});
        if(!open||R()>0.4)continue;const cx=x+0.5+(R()-0.5)*0.6,cz=y+0.5+(R()-0.5)*0.6,top=1.6;
        if(zid===1){if(R()<0.6)add('spire',this.mtx(cx,top,cz,R()*TAU,0.35+R()*0.3,0.8+R()*1.6));else add('slab',this.mtx(cx,top+0.1,cz,R()*TAU,0.9+R()*0.5,0.25,0.8+R()*0.4))}
        if(zid===2){add('tree',this.mtx(cx,top-0.2,cz,R()*TAU,0.8+R()*0.6))}
        if(zid===3){if(R()<0.5)add('obsid',this.mtx(cx,top,cz,R()*TAU,0.3+R()*0.25,0.9+R()*1.8));else add('basalt',this.mtx(cx,top,cz,R()*TAU,0.4+R()*0.2,0.3+R()*0.9))}
        continue}
      if(v!==T.FLOOR||avoid(x,y))continue;
      const wn=wallN(x,y);const cx=x+0.5,cz=y+0.5;
      if(wn.length&&R()<0.3){const [dx,dy]=wn[Math.floor(R()*wn.length)];const px=cx+dx*0.3,pz=cz+dy*0.3;
        if(zid===1){if(R()<0.7)add('boulder',this.mtx(px,0.1,pz,R()*TAU,0.3+R()*0.35,0.2+R()*0.25,0.3+R()*0.35));else add('debris',this.mtx(px,0.12,pz,R()*TAU,0.5+R()*0.4,0.15,0.25,R()*0.4,R()*0.3))}
        if(zid===2){if(R()<0.55)add('fern',this.mtx(px,0,pz,R()*TAU,0.6+R()*0.5));else add('mush',this.mtx(px,0,pz,R()*TAU,0.5+R()*0.7))}
        if(zid===3){if(R()<0.5)add('crystal',this.mtx(px,0,pz,R()*TAU,0.5+R()*0.6));else add('obsid',this.mtx(px,0,pz,R()*TAU,0.2+R()*0.15,0.5+R()*0.8))}
        continue}
      if(R()<0.035){const ox=cx+(R()-0.5)*0.6,oz=cz+(R()-0.5)*0.6;
        if(zid===1){const r=R();if(r<0.4)add('pebble',this.mtx(ox,0.05,oz,R()*TAU,0.12+R()*0.12,0.1,0.12+R()*0.12));else if(r<0.7)add('cactus',this.mtx(ox,0,oz,R()*TAU,0.6+R()*0.5));else add('ribs',this.mtx(ox,0,oz,R()*TAU,0.7+R()*0.4))}
        if(zid===2){const r=R();if(r<0.5)add('pod',this.mtx(ox,0.12,oz,0,0.12+R()*0.1));else add('mush',this.mtx(ox,0,oz,R()*TAU,0.3+R()*0.3))}
        if(zid===3){const r=R();if(r<0.35){add('vent',this.mtx(ox,0,oz,R()*TAU,0.35,0.2,0.35));vents.push({x:ox/U,y:oz/U})}else if(r<0.7)add('crystal',this.mtx(ox,0,oz,R()*TAU,0.3+R()*0.3));else add('pebble',this.mtx(ox,0.05,oz,R()*TAU,0.15,0.1,0.15))}}
    }
    const lam=(c,e,ei)=>{const m=new THREE.MeshLambertMaterial({color:c});if(e){m.emissive=new THREE.Color(e);m.emissiveIntensity=ei==null?0.8:ei}return m};
    const ico=r=>this.flat(new THREE.IcosahedronGeometry(r,0)),cone=(r,h,s)=>{const g=this.flat(new THREE.ConeGeometry(r,h,s||6));g.translate(0,h/2,0);return g},
      cyl=(r1,r2,h,s)=>{const g=this.flat(new THREE.CylinderGeometry(r1,r2,h,s||6));g.translate(0,h/2,0);return g};
    const I=(k,geo,mat,shadow)=>this.inst(group,geo,mat,L[k]||[],shadow);
    const P=(k,geo,mat,ox,oy,oz,ry,sx,sy,sz,rx,rz)=>this.inst(group,geo,mat,(L[k]||[]).map(M=>this.part(M,ox,oy,oz,ry,sx,sy,sz,rx,rz)));
    // woestijn
    I('spire',cone(1,1,5),lam(shade(pal.wallHi,1.1)));
    I('slab',this.flat(new THREE.BoxGeometry(1,1,1)),lam(shade(pal.wallHi,1.2)));
    I('boulder',ico(1),lam('#9a7650'));
    I('pebble',ico(1),lam('#a88d6a'));
    I('debris',this.flat(new THREE.BoxGeometry(1,1,1)),lam('#8a8f96'));
    P('debris',this.flat(new THREE.BoxGeometry(1,1,1)),lam('#ff8a1a'),0,0.55,0,0,1.01,0.2,1.01);
    P('cactus',cyl(0.08,0.11,1.1,6),lam('#4f8a52'),0,0,0,0,1,1,1);
    P('cactus',cyl(0.05,0.06,0.4,5),lam('#4f8a52'),0.12,0.45,0,0,1,1,1,0,-0.9);
    P('cactus',cyl(0.05,0.06,0.35,5),lam('#4f8a52'),-0.1,0.65,0,0,1,1,1,0,0.9);
    P('cactus',ico(0.11),lam('#ff6ad5','#ff3aa0',0.9),0,1.15,0,0,1,1,1);
    for(let i=0;i<4;i++)P('ribs',new THREE.TorusGeometry(0.28-i*0.03,0.03,4,8,Math.PI),lam('#e9e2cf'),-0.3+i*0.16,0,0,Math.PI/2,1,1,1);
    P('ribs',cyl(0.03,0.03,0.7,4),lam('#e9e2cf'),-0.35,0.02,0,0,1,1,1,0,-Math.PI/2);
    // jungle
    P('tree',cyl(0.16,0.26,2.6,6),lam('#5a3a22'),0,0,0,0,1,1,1);
    P('tree',ico(1.15),lam('#1f5a2a'),0,2.9,0,0,1,0.8,1);
    P('tree',ico(0.8),lam('#2f7a36'),0.4,3.5,0.2,0.5,1,0.8,1);
    P('tree',ico(0.25),lam('#e8ff4d','#c8ff2a',0.9),-0.6,2.7,0.5,0,1,1,1);
    P('fern',cone(0.08,0.9,4),lam('#3f9a44'),0.1,0,0,0,1,1,1,0.5,0);
    P('fern',cone(0.08,0.8,4),lam('#2f8a3a'),-0.1,0,0.05,1.5,1,1,1,0.6,0);
    P('fern',cone(0.08,0.7,4),lam('#4fb050'),0,0,-0.1,3,1,1,1,0.4,0.3);
    P('mush',cyl(0.06,0.09,0.55,6),lam('#d8d0b8'),0,0,0,0,1,1,1);
    P('mush',(()=>{const g=new THREE.SphereGeometry(0.3,7,4,0,TAU,0,Math.PI/2);return this.flat(g)})(),lam('#7a3aff','#b06cff',0.9),0,0.5,0,0,1,0.7,1);
    I('pod',ico(1),lam('#c8ff4a','#9cff20',1.2),false);
    // vulkaan
    I('obsid',cone(1,1,5),lam('#1c1518','#3a0a00',0.3));
    I('basalt',cyl(1,1,1,6),lam('#2a2226'));
    P('crystal',this.flat(new THREE.OctahedronGeometry(0.18)),lam('#ff8a3d','#ff6a10',1.1),0,0.3,0,0,1,2,1);
    P('crystal',this.flat(new THREE.OctahedronGeometry(0.12)),lam('#ffb060','#ff8a20',1.1),0.15,0.2,0.05,0.5,1,1.8,1,0,-0.5);
    P('crystal',this.flat(new THREE.OctahedronGeometry(0.1)),lam('#ff6a2a','#ff4a10',1.1),-0.12,0.16,-0.06,1,1,1.6,1,0,0.6);
    I('vent',cyl(1,1.2,1,7),lam('#2a1d1e'));
    P('vent',cyl(0.6,0.6,0.05,7),lam('#ff5a10','#ff4a00',1.5),0,1,0,0,1,1,1);
    this.ruins(group,ch);
    return {vents};
  },
  // tempelruïnes rond de puzzelzaal en arena
  ruins(group,ch){const zid=ZONES[ch].map||ch,pal=ZONES[zid].pal,R=mulberry32(ZONES[zid].seed+777);
    const stone=new THREE.MeshLambertMaterial({color:shade(pal.wallHi,1.35)}),glow=new THREE.MeshLambertMaterial({color:pal.acc,emissive:new THREE.Color(pal.acc),emissiveIntensity:1});
    const shafts=[],caps=[],bands=[],fallen=[];
    const pillar=(x,z,h,broken)=>{R3.pillars.push({x,z});shafts.push(this.mtx(x,h/2,z,R()*TAU,0.28,h,0.28));bands.push(this.mtx(x,h*0.55,z,0,0.31,0.08,0.31));
      if(!broken)caps.push(this.mtx(x,h+0.12,z,0,0.5,0.24,0.5));else fallen.push(this.mtx(x+0.9,0.2,z+0.3,R()*TAU,0.26,1.4,0.26,Math.PI/2,0))};
    const P=MAP.rooms.puzzle;
    for(const [dx,dy] of [[-7,-5],[7,-5],[-7,5],[7,5],[-3,-5.5],[3,-5.5]])if(tileAt(Math.floor(P.x+dx),Math.floor(P.y+dy))!==T.WALL)pillar(P.x+dx+0.5,P.y+dy+0.5,2+R()*1.2,R()<0.3);
    const A=MAP.rooms.arena;for(let i=0;i<12;i++){const a=i*TAU/12;pillar(A.x+0.5+Math.cos(a)*10.5,A.y+0.5+Math.sin(a)*8.6,2.6+R()*1.4,R()<0.25)}
    const V=MAP.rooms.vault;for(let i=0;i<4;i++){const a=i*TAU/4+0.4;pillar(V.x+0.5+Math.cos(a)*3.6,V.y+0.5+Math.sin(a)*3.6,1.6+R(),false)}
    const cyl=new THREE.CylinderGeometry(1,1,1,6);const box=new THREE.BoxGeometry(1,1,1);
    this.inst(group,this.flat(cyl),stone,shafts);this.inst(group,this.flat(box),stone,caps);this.inst(group,this.flat(cyl),glow,bands,false);this.inst(group,this.flat(cyl),stone,fallen);
  }
};
