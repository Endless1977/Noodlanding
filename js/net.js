'use strict';
// ===== Netwerk via PeerJS (WebRTC, geen eigen server nodig → werkt op GitHub Pages) =====
// De host simuleert de wereld; spelers bezitten hun eigen positie en savegame.
const Net={role:'host',peer:null,conns:{},host:null,code:null,myId:'h',online:false,
  hostOpen(cb){
    if(typeof Peer==='undefined'){cb&&cb(null,'PeerJS niet geladen');return}
    const code=Array.from({length:4},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*32)]).join('');
    const peer=new Peer('noodlanding-'+code.toLowerCase());
    peer.on('open',()=>{Net.peer=peer;Net.code=code;Net.online=true;cb&&cb(code)});
    peer.on('error',e=>{if(e.type==='unavailable-id'){peer.destroy();Net.hostOpen(cb)}else toast('Netwerk: '+e.type,'#f88')});
    peer.on('disconnected',()=>{try{peer.reconnect()}catch(e){}});
    peer.on('connection',conn=>{
      conn.on('open',()=>{Net.conns[conn.peer]=conn});
      conn.on('data',d=>{try{hostRecv(conn.peer,d)}catch(err){console.error(err)}});
      conn.on('close',()=>{delete Net.conns[conn.peer];hostPlayerLeft(conn.peer)});
      conn.on('error',()=>{});
    });
  },
  join(code,cb){
    let done=false;const fin=(ok,msg)=>{if(done)return;done=true;cb(ok,msg)};
    if(typeof Peer==='undefined'){fin(false,'PeerJS niet geladen');return}
    const peer=new Peer();Net.peer=peer;
    peer.on('open',id=>{Net.myId=id;Net.role='client';
      const conn=peer.connect('noodlanding-'+code.toLowerCase(),{reliable:true});Net.host=conn;
      conn.on('open',()=>fin(true));
      conn.on('data',d=>{try{clientRecv(d)}catch(err){console.error(err)}});
      conn.on('close',()=>clientLost());conn.on('error',()=>{});
      setTimeout(()=>fin(false,'Geen host gevonden met code '+code),10000)});
    peer.on('error',e=>fin(false,e.type==='peer-unavailable'?'Geen host gevonden met code '+code:'Netwerk: '+e.type));
  },
  nConns(){return Object.keys(Net.conns).length},
  toHost(m){if(Net.role==='client'){if(Net.host&&Net.host.open)Net.host.send(m)}else hostRecv('h',m)},
  to(pid,m){if(pid==='h'){clientRecv(m);return}const c=Net.conns[pid];if(c&&c.open)c.send(m)},
  bcast(m,remoteOnly){for(const k in Net.conns){const c=Net.conns[k];if(c.open)c.send(m)}if(!remoteOnly)clientRecv(m)},
  close(){try{for(const k in Net.conns)Net.conns[k].close()}catch(e){}try{Net.host&&Net.host.close()}catch(e){}
    try{Net.peer&&Net.peer.destroy()}catch(e){}Net.peer=null;Net.conns={};Net.host=null;Net.code=null;Net.online=false;Net.role='host';Net.myId='h'}
};
