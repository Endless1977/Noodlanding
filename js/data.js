'use strict';
// ===== Speldata: materialen, wapens, vaardigheden, vijanden, zones =====
const MATS={
  schroot:{n:'Schroot',c:'#b8c0ca'}, silicium:{n:'Silicium',c:'#7fd7ff'}, dna:{n:'Alien-DNA',c:'#c48cff'},
  bio:{n:'Biomassa',c:'#6fe36a'}, magma:{n:'Magmakristal',c:'#ff8a3d'}, nano:{n:'Nanoresidu',c:'#ffe066'},
  cellen:{n:'Energiecellen',c:'#4dffd2'}
};
const MAT_KEYS=Object.keys(MATS);

// kind = projectieltype (kleur/vorm). ammo = energiecellen per schot. key = uniek kluiswapen van zone.
const WEAPONS={
  blaster:{n:'Blaster',dmg:10,rate:5,spd:340,spread:0.03,count:1,life:0.9,ammo:0,col:'#77ffff',kind:'bolt',desc:'Betrouwbaar standaardwapen. Geen munitie nodig.'},
  scatter:{n:'Schrootkanon',dmg:7,rate:1.6,spd:300,spread:0.32,count:6,life:0.45,ammo:1,col:'#ffcc66',kind:'pellet',cost:{schroot:40,silicium:10},desc:'Hagel van schroot. Verwoestend van dichtbij.'},
  cryo:{n:'Cryo-blaster',dmg:6,rate:4,spd:300,spread:0.05,count:1,life:0.8,ammo:0.5,col:'#99ddff',kind:'cryo',chill:1,cost:{schroot:30,silicium:30,dna:10},desc:'Koelt vijanden af; genoeg treffers bevriest ze. Combineer met plasma!'},
  plasma:{n:'Plasmageweer',dmg:22,rate:2.2,spd:380,spread:0.02,count:1,life:1,ammo:1,col:'#ff66ff',kind:'plasma',shatter:2.5,r:3,cost:{silicium:40,bio:30,dna:25},desc:'Zware plasmabollen. ×2,5 verbrijzelschade op bevroren vijanden. Aanbevolen voor de Vulkanische Breuk.'},
  rail:{n:'Railgun',dmg:60,rate:0.8,spd:900,spread:0,count:1,life:0.6,ammo:2,col:'#ffffff',kind:'rail',pierce:5,cost:{silicium:60,magma:30,dna:40},desc:'Doorboort meerdere vijanden.'},
  arc:{n:'Boogontlader',key:1,dmg:14,rate:3,spd:420,spread:0.04,count:1,life:0.6,ammo:0.5,col:'#88ccff',kind:'arc',chain:3,desc:'UNIEK. Bliksem springt over naar vijanden. Overbelast het energieschild van de Schrootcolossus.'},
  flamer:{n:'Sporenbrander',key:2,dmg:4,rate:14,spd:200,spread:0.25,count:1,life:0.45,ammo:0.15,col:'#ffaa44',kind:'flame',burn:6,desc:'UNIEK. Vlammenwerper. Verbrandt het rankenpantser van de Moederplant.'},
  sonic:{n:'Sonische Resonator',key:3,dmg:18,rate:1.5,spd:260,spread:0,count:1,life:1.1,ammo:1,col:'#ffff88',kind:'sonic',pierce:99,r:6,desc:'UNIEK. Resonantiegolf. Verbrijzelt het kristalpantser van de Magma Leviathan.'}
};
function weaponUpCost(lvl){const c={schroot:15*lvl,silicium:10*lvl,dna:6*lvl};if(lvl>=3)c.nano=lvl-2;return c}
const CELL_RECIPE={cost:{schroot:6,silicium:3},out:20};

const SUIT={
  mask:{n:'Zuurstofmasker',cost:{schroot:50,silicium:25,dna:10},desc:'Beschermt tegen de gifgassen van de Radioactieve Jungle (hoofdstuk 2).'},
  heat:{n:'Hittebestendige beplating',cost:{schroot:80,bio:40,dna:30},desc:'Beschermt tegen de hitte van de Vulkanische Breuk (hoofdstuk 3) en verzacht lava.'},
  armor1:{n:'Pantser I',cost:{schroot:60,silicium:20},armor:0.1,desc:'−10% inkomende schade.'},
  armor2:{n:'Pantser II',cost:{schroot:120,bio:30,nano:3},armor:0.12,req:'armor1',desc:'Nog eens −12% schade.'},
  armor3:{n:'Pantser III',cost:{silicium:120,magma:40,nano:6},armor:0.12,req:'armor2',desc:'Nog eens −12% schade.'}
};

// Passieven: oneindig doorlevelen, kosten groeien exponentieel
const PASSIVES={
  hp:{n:'Max. HP',per:'+4% max. HP',base:{dna:4,schroot:10}},
  dmg:{n:'Wapenschade',per:'+2% schade',base:{dna:5,schroot:10}},
  crit:{n:'Kritieke kans',per:'+1,5% kritiek (×2 schade)',base:{dna:5,silicium:6}},
  speed:{n:'Bewegingssnelheid',per:'+2% snelheid',base:{dna:3,schroot:8}},
  yield:{n:'Grondstof-opbrengst',per:'+5% opbrengst',base:{schroot:12,silicium:6}},
  shield:{n:'Schildherstel',per:'+3% schildherstel',base:{silicium:8,dna:3}}
};
function passiveCost(id,lvl){const b=PASSIVES[id].base,c={};for(const k in b)c[k]=Math.ceil(b[k]*Math.pow(1.25,lvl));return c}

// Actieve vaardigheden: max 3 uitgerust, elk 3 stapelbare upgradesporen (max 5)
const ABILITIES={
  grenade:{n:'Plasmagranaat',cd:7,desc:'Gooi een granaat naar je richtpunt.',tracks:['Schade ×1,3','Radius +18%','Nabrand +8/s']},
  dash:{n:'Dash',cd:4,desc:'Schiet een stuk vooruit, kort onkwetsbaar.',tracks:['Afstand +20%','Cooldown ×0,85','Schokgolf +25']},
  barrier:{n:'Energiekoepel',cd:16,desc:'Koepel die vijandelijke kogels tegenhoudt.',tracks:['Duur +1,5 s','Straal +15%','Terugkaatsen +15%']},
  drone:{n:'Genezingsdrone',cd:20,desc:'Drone die jou en teamgenoten geneest.',tracks:['Genezing ×1,3','Duur +2 s','Bereik +20%']},
  overcharge:{n:'Overcharge',cd:18,desc:'Tijdelijk sneller vuren.',tracks:['Vuursnelheid ×1,15','Duur +1 s','Kritiek +6%']},
  cryonova:{n:'Cryo-nova',cd:12,desc:'Bevriest alles om je heen.',tracks:['Radius +15%','Bevriezing +0,6 s','Schade ×1,3']}
};
const TRACK_MAX=5;
function trackCost(lvl){const c={dna:5*(lvl+1),silicium:6*(lvl+1)};if(lvl>=3)c.nano=lvl-1;return c}

const ULTS={
  titan:{n:'Titan Overdrive',build:'The Juggernaut',req:{str:40,sta:40},cd:75,desc:'8 s onkwetsbaar, +200% melee- en +60% wapenschade, sprinten zonder uithouding.'},
  orbital:{n:'Orbital Strike',build:'The Cyber-Engineer',req:{int:50,sta:30},cd:80,desc:'Laserstraal van het moederschip op je richtpunt. Breekt zelfs door baaspantser.'},
  storm:{n:'Stormroeper',build:'The Conduit',req:{str:35,int:35},cd:70,desc:'6 s lang springen bliksemschichten naar vijanden om je heen.'},
  phoenix:{n:'Feniks-protocol',build:'The Guardian',req:{sta:45,int:35},cd:90,desc:'Herstelt het hele team, wekt gevallen spelers op en geeft 5 s onkwetsbaarheid.'}
};
function ultOk(ch,id){const r=ULTS[id].req;for(const k in r)if(ch.stats[k]<r[k])return false;return true}

const BUILDINGS={
  bench:{n:'Wapenbank',cost:{schroot:30,silicium:10},col:'#e0a040',desc:'Wapens maken en upgraden, energiecellen fabriceren.'},
  suit:{n:'Pakstation',cost:{schroot:40,silicium:15},col:'#60c0ff',desc:'Ruimtepak-upgrades maken (masker, hittebeplating, pantser).'},
  chest:{n:'Opslagkist',cost:{schroot:20},col:'#a07040',desc:'Gedeelde opslag voor het hele team.'},
  ammo:{n:'Munitiefabriek',cost:{schroot:60,silicium:30},col:'#40ffc0',desc:'Maakt elke 15 s 4 energiecellen in de gedeelde opslag.'},
  turret:{n:'Geschuttoren',cost:{schroot:50,silicium:25,dna:5},col:'#ff5050',desc:'Schiet automatisch op vijanden.'},
  med:{n:'Medstation',cost:{schroot:40,silicium:20,dna:10},col:'#70ff70',desc:'Geneest spelers in de buurt en is een respawnpunt.'}
};

const ENEMIES={
  crawler:{n:'Krabbelaar',hp:30,spd:52,dmg:8,r:6,xp:9,ai:'melee',spr:'crawler',drop:{dna:[0,2],schroot:[0,1]}},
  spiker:{n:'Stekeltor',hp:26,spd:34,dmg:7,r:6,xp:12,ai:'ranged',range:120,rate:0.9,shot:{spd:130,k:'eb'},spr:'spiker',drop:{dna:[1,2],cellen:[0,3]}},
  drone:{n:'Schrootdrone',hp:18,spd:68,dmg:6,r:5,xp:5,ai:'melee',fly:1,spr:'drone',drop:{schroot:[1,2]}},
  spitter:{n:'Gifspuwer',hp:85,spd:36,dmg:12,r:7,xp:24,ai:'ranged',range:125,rate:0.8,shot:{spd:115,k:'ep'},spr:'spitter',drop:{dna:[1,3],bio:[0,2],cellen:[0,3]}},
  vine:{n:'Rankenkruiper',hp:70,spd:78,dmg:14,r:6,xp:22,ai:'melee',spr:'vine',drop:{dna:[1,3],bio:[1,2]}},
  beetle:{n:'Magmakever',hp:220,spd:44,dmg:22,r:8,xp:48,ai:'charger',spr:'beetle',drop:{dna:[2,4],magma:[0,2],cellen:[1,3]}},
  wisp:{n:'Vuurgeest',hp:140,spd:52,dmg:16,r:6,xp:42,ai:'ranged',range:145,rate:1.0,shot:{spd:160,k:'ef'},fly:1,spr:'wisp',drop:{dna:[2,4],magma:[0,1],cellen:[1,3]}},
  mb1:{n:'Kluiswachter Krabbel',hp:520,spd:46,dmg:14,r:7,scale:2.2,xp:300,ai:'mb',mb:1,spr:'crawler',drop:{dna:[15,20],nano:[2,3],silicium:[10,15]}},
  mb2:{n:'Gifkoningin',hp:1300,spd:40,dmg:15,r:7,scale:2.2,xp:700,ai:'mb',mb:1,spr:'spitter',drop:{dna:[25,30],nano:[3,4],bio:[15,20]}},
  mb3:{n:'Lavarots',hp:2600,spd:46,dmg:24,r:8,scale:2.2,xp:1200,ai:'mb',mb:1,spr:'beetle',drop:{dna:[35,45],nano:[4,6],magma:[15,20]}},
  boss1:{n:'Schrootcolossus',hp:2400,armor:500,key:'arc',spd:26,dmg:14,r:22,xp:900,boss:1,drop:{nano:[6,8],dna:[30,40],schroot:[40,60]}},
  boss2:{n:'Moederplant',hp:5500,armor:900,key:'flamer',spd:0,dmg:16,r:24,xp:1800,boss:1,drop:{nano:[8,10],dna:[50,60],bio:[40,50]}},
  boss3:{n:'Magma Leviathan',hp:10000,armor:1500,key:'sonic',spd:70,dmg:26,r:18,xp:3000,boss:1,drop:{nano:[10,14],dna:[80,100],magma:[40,60]}},
  n_scrap:{n:'Schrootberg',hp:40,node:1,r:7,spr:'n_scrap',drop:{schroot:[4,7]}},
  n_sili:{n:'Siliciumkristal',hp:55,node:1,r:6,spr:'n_sili',drop:{silicium:[3,5]}},
  n_bio:{n:'Biopeul',hp:60,node:1,r:7,spr:'n_bio',drop:{bio:[3,5]}},
  n_magma:{n:'Magma-ader',hp:90,node:1,r:7,spr:'n_magma',drop:{magma:[2,4]}},
  crate:{n:'Krat',crate:1,r:7,spr:'crate'}
};

const PARTS={1:'Navigatiekern',2:'Reactorcel',3:'Startraket'};
const REPAIR={schroot:300,silicium:150,magma:40,cellen:100};

const ZONES={
  1:{n:'De Woestenij',seed:41017,amb:0.95,fog:'#c99a62',sky:'#e8b67a',enemies:['crawler','crawler','spiker','drone'],nodes:['n_scrap','n_scrap','n_sili'],cap:9,nodeCap:55,mb:'mb1',boss:'boss1',key:'arc',
     pal:{floor:['#7a5e3e','#82643f','#745a3a'],speck:'#9a7a52',wall:'#4a3826',wallHi:'#6e5438',face:'#5b4530',acc:'#ffb040',arena:'#5a4a3a'}},
  2:{n:'De Radioactieve Jungle',seed:52931,amb:0.55,fog:'#1f4a2a',sky:'#2a5a34',hazard:'toxic',needs:'mask',enemies:['spitter','vine','vine','crawler'],nodes:['n_bio','n_bio','n_sili','n_scrap'],cap:11,nodeCap:60,mb:'mb2',boss:'boss2',key:'flamer',
     pal:{floor:['#25472c','#2a5031','#224128'],speck:'#3a6e44',wall:'#123018',wallHi:'#2f6e3a',face:'#1c4424',acc:'#9cff4d',arena:'#2b3a22'}},
  3:{n:'De Vulkanische Breuk',seed:67213,amb:0.45,fog:'#3a1610',sky:'#4a1a10',hazard:'heat',needs:'heat',lava:1,enemies:['beetle','wisp','wisp','spitter'],nodes:['n_magma','n_magma','n_sili','n_scrap'],cap:12,nodeCap:60,mb:'mb3',boss:'boss3',key:'sonic',
     pal:{floor:['#342a2c','#3a2e31','#2f2628'],speck:'#4e3c40',wall:'#1d1416',wallHi:'#46302f',face:'#2a1d1e',acc:'#ff6a1a',arena:'#2a2022'}},
  4:{n:'De Ontsnapping',map:1,amb:0.32,fog:'#141a30',sky:'#0b1022',enemies:['crawler','spitter','beetle','wisp','vine','spiker'],nodes:['n_scrap','n_sili'],cap:8,nodeCap:40,finale:1}
};

function xpNeed(l){return Math.floor(40+30*l+4*l*l)}

function newChar(name,color){return{v:1,name:name||'Astronaut',color:color||'#ffcc33',level:1,xp:0,statPts:0,skillPts:1,
  stats:{str:5,sta:5,int:5},passives:{},abil:{},equipped:[null,null,null],ult:null,
  weapons:{blaster:{lvl:1}},loadout:['blaster',null],inv:{schroot:0,silicium:0,dna:0,bio:0,magma:0,nano:0,cellen:30},suit:{}}}

// Afgeleide statistieken uit core stats + passieven + pak
function derive(ch){
  const s=ch.stats,p=ch.passives,su=ch.suit;const P=k=>p[k]||0;const d={};
  d.mhp=Math.round((80+s.sta*6)*(1+0.04*P('hp')));
  d.msh=Math.round(20+s.int*2+s.sta);
  d.shRegen=(5+s.int*0.3)*(1+0.03*P('shield'));
  d.mst=50+s.sta*3;
  d.dmg=(1+s.str*0.025)*(1+0.02*P('dmg'));
  d.melee=1+s.str*0.07;
  d.ap=1+s.int*0.03;
  d.cdr=Math.min(0.4,s.int*0.005);
  d.crit=Math.min(0.75,0.05+0.015*P('crit'));
  d.spd=Math.min(72*2.2,72*(1+0.02*P('speed'))*(1+s.sta*0.003));
  d.yield=1+0.05*P('yield')+s.int*0.01;
  let ar=0;for(const k in su)if(su[k]&&SUIT[k]&&SUIT[k].armor)ar+=SUIT[k].armor;d.armor=Math.min(0.6,ar);
  return d;
}
