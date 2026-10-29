import {installMinorBodies} from './minor-body-data.js?v=100';
import {robloxTextureAssets} from './roblox-texture-assets.js';
import {surfacePalette} from './surface-palette.js';
import {starShineColor} from './star-colors.js';
import * as T from './vendor/three.module.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
let seed=4829;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}const bodies=[];
function body(name,type,r,color,pos,opts={}){let b={id:name,name,type,r,color,pos:V(...pos),system:'Sol',solid:!['STAR','GAS GIANT','ICE GIANT'].includes(type),desc:'A real Solar System world. Terrain is a procedural artistic representation.',...opts};bodies.push(b);return b}
body('Sun','STAR',160,'#ffcf7d',[-5200,300,-4300],{desc:'Our home star. Keep a safe distance from the stellar surface.'});
body('Mercury','TERRESTRIAL PLANET',24.4,'#a69b8b',[-2600,0,-2300]);body('Venus','TERRESTRIAL PLANET',60.5,'#d8b47f',[-1400,0,-1500]);
const earth=body('Earth','TERRESTRIAL PLANET',63.71,'#468bd1',[0,0,0],{desc:'Our ocean world. Blue seas, drifting clouds and a place to call home.'});body('Moon','MOON',17.37,'#b2b1ad',[410,35,-220],{parent:'Earth'});body('Mars','TERRESTRIAL PLANET',33.9,'#c6704c',[1200,-40,-1100]);body('Jupiter','GAS GIANT',180,'#d5b08b',[3100,0,-3200]);body('Saturn','GAS GIANT',155,'#d3bd8e',[5100,0,-4300],{rings:true});body('Uranus','ICE GIANT',110,'#8fd2d5',[7200,0,-5500]);body('Neptune','ICE GIANT',107,'#416bc2',[9000,0,-7300]);
for(const [name,r,c,p] of [['Ceres',4.7,'#918e86',[2200,100,-2200]],['Pluto',11.88,'#baaa98',[10800,0,-8300]],['Eris',11.6,'#ddd4ce',[12800,0,-9400]],['Haumea',8,'#c6c5b9',[11800,200,-6500]],['Makemake',7.1,'#b8997f',[11200,-100,-10500]]])body(name,'DWARF PLANET',r,c,p);
const moons={'Mars':'Phobos,Deimos','Jupiter':'Io,Europa,Ganymede,Callisto','Saturn':'Titan,Enceladus,Mimas,Rhea,Dione,Tethys,Iapetus','Uranus':'Miranda,Ariel,Umbriel,Titania,Oberon','Neptune':'Triton,Proteus,Nereid','Pluto':'Charon,Nix,Hydra','Eris':'Dysnomia','Haumea':'Hiʻiaka,Namaka'};for(const [parent,names] of Object.entries(moons)){let p=bodies.find(b=>b.name===parent);names.split(',').forEach((n,i)=>{const a=i*2.2+.5,d=p.r*2.4+30+i*26;body(n,'MOON',n==='Ganymede'?26.3:n==='Titan'?25.7:n==='Charon'?6:3.5+rand()*13,'#b5ac9e',[p.pos.x+Math.cos(a)*d,p.pos.y+12,p.pos.z+Math.sin(a)*d],{parent,desc:`A moon of ${parent}. Surface detail is procedurally imagined.`})})}
body('Proxima Centauri','STAR',110,'#ff8368',[0,0,0],{system:'Proxima',desc:'The nearby red dwarf, approximately 4.24 light-years from the Sun.'});body('Proxima b','EXOPLANET',66,'#9d8273',[550,0,0],{system:'Proxima',desc:'A real exoplanet. This rocky surface and atmosphere are imagined, not observed.'});
for(const [i,n] of ['TRAPPIST-1','Barnard’s Star','Epsilon Eridani','51 Pegasi','Kepler-186','Kepler-452','HR 8799','Alpha Centauri'].entries()){body(n,'STAR',100,'#e4bb8a',[i*1800,0,-i*900],{system:'Beyond',desc:'Real star destination. This edition shows a stylized star, without inventing confirmed planets.'})}
for(const [i,n] of ['Andromeda','Triangulum','Large Magellanic Cloud','Small Magellanic Cloud','M87','M51','M104'].entries()){body(n+' · simulated world','SIMULATED PLANET',60+rand()*30,['#a16cba','#4bafaa','#bf9578'][i%3],[i*1800,0,-12000],{system:'Beyond',desc:`A FICTIONAL world representing exploration in ${n}. Not an observed exoplanet.`,fictional:true})}

// Units: 100 km. Orbital phases are illustrative, not an ephemeris.
const oldPositions = new Map(bodies.map(b=>[b.name,b.pos.clone()]));
const AU = 1495978.707;
const phases = {Mercury:[.387,2.7],Venus:[.723,1.8],Earth:[1,0],Mars:[1.524,-.8],Jupiter:[5.203,2.2],Saturn:[9.537,-1.9],Uranus:[19.191,1.2],Neptune:[30.069,-.5],Ceres:[2.767,.8],Pluto:[39.482,2.9],Eris:[67.7,-1.1],Haumea:[43.13,1.7],Makemake:[45.79,-2.2]};
for(const b of bodies){
 if(b.name==='Sun'){b.pos.set(-AU,0,0);b.r=6963.4}
 else if(phases[b.name]){const [a,p]=phases[b.name];b.pos.set(Math.cos(p)*a*AU-AU,0,Math.sin(p)*a*AU)}
 if(b.name==='Moon')b.pos.set(3400,260,-1780);
 if(b.parent&&b.name!=='Moon'){const parent=bodies.find(p=>p.name===b.parent),offset=oldPositions.get(b.name).clone().sub(oldPositions.get(b.parent));b.pos.copy(parent.pos).add(offset.multiplyScalar(8))}
 if(b.name==='Jupiter')b.r=699.11;
 if(b.name==='Saturn')b.r=582.32;
 if(b.name==='Uranus')b.r=253.62;
 if(b.name==='Neptune')b.r=246.22;
 if(b.system==='Proxima'&&b.solid)b.pos.set(72000,0,0);
 if(b.system==='Beyond')b.pos.multiplyScalar(150);
}
export {bodies,earth,AU};

// Additional named destinations. Sizes and placements beyond Sol are illustrative.
for(const [i,name] of ['Sirius A','Sirius B','Vega','Altair','Deneb','Betelgeuse','Rigel','Antares','Arcturus','Polaris','Aldebaran','Procyon','Wolf 359','Tau Ceti','Ross 128','Luyten’s Star'].entries()){
 body(name,'STAR',name==='Sirius B'?45:120+(i%5)*45,['#b8d7ff','#f8eed8','#ff9c6c','#d6e7ff'][i%4],[Math.cos(i*2.39996)*(3500000+i*170000),Math.sin(i*1.731)*(900000+i*65000),Math.sin(i*2.39996)*(3500000+i*170000)],{system:'Beyond',solid:false,desc:'A real named star. Its rendered size and position in this sandbox are illustrative.',texture:'sun.jpg'});
}
for(const [i,name] of ['Sagittarius A*','M87*','Cygnus X-1','V404 Cygni'].entries()){
 body(name,'BLACK HOLE',220+i*100,'#ffb366',[i*1500000,0,-i*700000],{system:'Blackholes',solid:false,desc:'A known black hole. Disk, lensing halo, size and placement are artistic approximations. Use Approach for a safe viewing distance.'});
}
for(const [i,name] of ['Orion Nebula','Carina Nebula','Crab Nebula','Pleiades Cluster','Omega Centauri'].entries()){
 body(name,i>2?'STAR CLUSTER':'NEBULA',450,'#bd8df5',[Math.cos(i*2.39996)*3600000,Math.sin(i*1.7)*1200000,Math.sin(i*2.39996)*3600000],{system:'Nebulae',solid:false,desc:'A real astronomical destination shown as a stylized volume of gas and stars, not a telescope photograph.'});
}
const trappist=bodies.find(b=>b.name==='TRAPPIST-1');trappist.system='TRAPPIST-1';trappist.pos.set(0,0,0);trappist.r=840;
for(const [i,letter] of ['b','c','d','e','f','g','h'].entries())body('TRAPPIST-1 '+letter,'EXOPLANET',40+i*5,['#ae775e','#c6aa79','#98a9c3'][i%3],[16000+i*7000,0,-i*3000],{system:'TRAPPIST-1',texture:'exo'+[5,6,7][i%3]+'.png',desc:'A known TRAPPIST-1 planet. The borrowed game texture is an imagined surface, not an observed map.'});
const realMaps={Earth:'earth.jpg',Moon:'moon.jpg',Sun:'sun.jpg',Mercury:'mercury.jpg',Venus:'venus.jpg',Mars:'mars.jpg',Jupiter:'jupiter.jpg',Saturn:'saturn.jpg',Uranus:'uranus.jpg',Neptune:'neptune.jpg'};
for(const [i,b] of bodies.entries()){
 if(realMaps[b.name]){b.texture=realMaps[b.name];b.desc+=' Image-based map: Solar System Scope (CC BY 4.0).';}
 else if(b.type==='STAR')b.texture='sun.jpg';
 else if(b.fictional||b.type==='EXOPLANET'){b.texture='exo'+[5,6,7][i%3]+'.png';b.desc+=' Surface art: Screaming Brain Studios / CC0; imagined, not observed.';}
 else if(b.solid){b.texture='moon.jpg';b.desc+=' Borrowed lunar texture for illustration; not an observed map of this world.';}
}

// Deterministic fictional survey systems, with explicit labels and shared image assets.
for(let s=1;s<=6;s++){
 const cx=Math.cos(s*2.39996)*(1600000+s*500000),cz=Math.sin(s*2.39996)*(1600000+s*500000),starName='RS '+(2040+s);
 body(starName,'STAR',150+(s%3)*70,['#ffae7e','#dbedff','#fff1c6'][s%3],[cx,0,cz],{system:'Procedural',solid:false,fictional:true,texture:'sun.jpg',seed:s*107,desc:'SIMULATED survey system. Generated star and placement; not an observed catalog object.'});
 for(let p=1;p<=3;p++){
  const a=p*1.93+s*.47,d=12000+p*18000,name=starName+' '+String.fromCharCode(97+p),pos=[cx+Math.cos(a)*d,Math.sin(s+p)*120,cz+Math.sin(a)*d];
  const planet=body(name,'SIMULATED PLANET',24+((s*17+p*13)%50),['#b68562','#8babbc','#9b9574'][(s+p)%3],pos,{system:'Procedural',fictional:true,texture:'exo'+[5,6,7][(s+p)%3]+'.png',seed:s*107+p*13,desc:'SIMULATED / FICTIONAL world. Deterministic generated terrain with a borrowed CC0 game texture. No measured surface or orbit is implied.'});
  if(p===2)body(name+' I','MOON',7+s%4,'#b6b0a4',[pos[0]+planet.r*15,20,pos[2]-planet.r*8],{system:'Procedural',parent:name,fictional:true,texture:'moon.jpg',seed:s*211,desc:'SIMULATED moon of a fictional survey world. Lunar artwork is reused as a visual material.'});
 }
}

// Galaxy destinations: artistic overview scenes; positions and scale are schematic.
for(const [i,name] of ['Andromeda Galaxy','Triangulum Galaxy','Large Magellanic Cloud','Small Magellanic Cloud','Whirlpool Galaxy','Sombrero Galaxy'].entries())body(name,'GALAXY',6000,'#a7b5e5',[12000000+i*140000,20000,-9000000-i*250000],{system:'Beyond',solid:false,desc:'A real named galaxy shown as an artistic particle overview. Placement, bearing and scale are schematic, not measured sky coordinates.'});

// Body-specific spacecraft image mosaics from NASA/JPL/USGS.
const moonMaps={"Io": "io.jpg", "Europa": "europa.jpg", "Ganymede": "ganymede.jpg", "Callisto": "callisto.jpg", "Mimas": "mimas.jpg", "Enceladus": "enceladus.jpg", "Tethys": "tethys.jpg", "Dione": "dione.jpg", "Rhea": "rhea.jpg", "Iapetus": "iapetus.jpg", "Ariel": "ariel.jpg", "Umbriel": "umbriel.jpg", "Titania": "titania.jpg", "Oberon": "oberon.jpg", "Miranda": "miranda.jpg", "Triton": "triton.jpg", "Phobos": "phobos.jpg", "Deimos": "deimos.jpg"};
for(const b of bodies){if(moonMaps[b.name]){b.texture=moonMaps[b.name];b.color={Io:"#c5b164",Europa:"#c5bba6",Ganymede:"#969181",Callisto:"#655f58",Enceladus:"#c4d0d5",Triton:"#b5ad9e"}[b.name]||b.color;b.desc=b.desc.replace(/ Borrowed lunar texture[^.]*\./g,"")+" Body-specific NASA/JPL-Caltech/USGS spacecraft mosaic; gaps may be unobserved or artistically filled."}else if(b.system==="Sol"&&b.type==="MOON"&&b.name!=="Moon"){b.texture=null;b.desc=b.desc.replace(/ Borrowed lunar texture[^.]*\./g,"")+" Procedural surface placeholder: no observed global map is bundled for this body."}}

// New Horizons / Cassini / Dawn maps replace the former lunar stand-ins.
const extendedMaps={Pluto:'pluto.jpg',Charon:'charon.jpg',Titan:'titan.jpg',Ceres:'ceres.jpg'};
for(const b of bodies){if(extendedMaps[b.name]){b.texture=extendedMaps[b.name];b.desc=b.desc.replace(/ Borrowed lunar texture[^.]*\./g,'').replace(/ Procedural surface placeholder[^.]*\./g,'')+' Body-specific spacecraft mosaic (NASA and mission partners); coverage gaps remain unobserved.';b.mapKind='spacecraft'}else if(b.texture==='moon.jpg'&&b.name!=='Moon'){b.texture=null;b.desc=b.desc.replace(/ Borrowed lunar texture[^.]*\./g,'')+' Surface illustration unique to this world; no resolved global spacecraft map is available here.';b.mapKind='illustration'}}
for(const [i,name]of ['Orcus','Quaoar','Sedna','Gonggong'].entries()){const a=[39.2,43.7,506,67.5][i],phase=.6+i*1.7;body(name,'DWARF PLANET CANDIDATE',[4.6,5.55,5,6.15][i],['#a6a9ac','#ba8871','#b76648','#a76c5c'][i],[Math.cos(phase)*a*AU-AU,Math.sin(phase)*a*AU*.08,Math.sin(phase)*a*AU],{texture:null,candidate:true,mapKind:'illustration',desc:'An observed trans-Neptunian object, included as a dwarf-planet candidate rather than a confirmed IAU dwarf planet. Placement is schematic; the unresolved surface is illustrated.'})}
// Each external galaxy has its own travel scene and sky, rather than sharing Beyond.
for(const b of bodies.filter(b=>b.fictional&&b.name.endsWith(' · simulated world'))){const galaxy=b.name.split(' · ')[0];b.system='Galaxy:'+galaxy;b.pos.set(65000,0,0);body(galaxy+' · simulated host star','STAR',170,'#ffe5ad',[0,0,0],{system:b.system,solid:false,fictional:true,texture:'sun.jpg',desc:'FICTIONAL host star for this galaxy exploration scene; not a confirmed extragalactic planetary system.'})}
const galaxyNames={'Andromeda Galaxy':'Andromeda','Triangulum Galaxy':'Triangulum','Large Magellanic Cloud':'Large Magellanic Cloud','Small Magellanic Cloud':'Small Magellanic Cloud','Whirlpool Galaxy':'M51','Sombrero Galaxy':'M104'};
for(const b of bodies.filter(b=>b.type==='GALAXY')){b.system='Galaxy:'+galaxyNames[b.name];b.pos.set(0,0,-1800000)}

// M87's black hole belongs to its external-galaxy scene.
bodies.find(b=>b.name==='M87*').system='Galaxy:M87';

for(const b of bodies){if(b.solid){const p=surfacePalette(b);if(p.observed)b.color=p.ground;}else if(b.type==='STAR')b.color=starShineColor(b).getStyle();}

// Named additions requested with Roblox texture IDs. Positions/sizes are schematic.
for(const [name,a,phase,r,color]of [['Salacia',42.2,1.1,4.23,'#9b9e9f'],['Varda',45.6,-.6,3.6,'#9d9288']]){
 const p=[Math.cos(phase)*a*AU-AU,Math.sin(phase)*a*AU*.04,Math.sin(phase)*a*AU];
 body(name,'DWARF PLANET CANDIDATE',r,color,p,{candidate:true,texture:null,mapKind:'illustration',desc:'A real trans-Neptunian object shown as a dwarf-planet candidate. Size and orbital placement are schematic; terrain is an illustration.'});
}
for(const [name,parent,r,angle]of [['Actaea','Salacia',1.5,.3],['Ilmarë','Varda',1.63,1.7],['Vanth','Orcus',2.2,2.8],['Xiangliu','Gonggong',1.5,-1.1]]){
 const host=bodies.find(b=>b.name===parent),distance=Math.max(110,host.r*18),p=host.pos.clone().add(V(Math.cos(angle)*distance,20,Math.sin(angle)*distance));
 body(name,'MOON',r,'#aaa6a0',p.toArray(),{parent,texture:null,mapKind:'illustration',desc:`A moon of ${parent}. The displayed size, orbit and unresolved terrain are illustrative.`});
}
body('Planet X','ICE GIANT',110,'#7191b3',[Math.cos(.7)*400*AU-AU,20*AU,Math.sin(.7)*400*AU],{fictional:true,hypothetical:true,solid:false,texture:null,mapKind:'illustration',desc:'HYPOTHETICAL / SIMULATED ice giant. No solid landing surface. Its orbit, size and gas interior are fictional.'});
for(const [name,r,p]of [['Proxima c',85,[-1400000,90000,1650000]],['Proxima d',45,[27000,-2000,-34000]]])body(name,name==='Proxima c'?'GAS GIANT':'EXOPLANET CANDIDATE',r,'#9b8a7d',p,{system:'Proxima',candidate:true,solid:name!=='Proxima c',texture:null,mapKind:'illustration',desc:name==='Proxima c'?'An illustrated candidate world represented as a gas giant in this game, with no solid landing surface. Size, placement and atmosphere are schematic.':'An illustrated landable candidate world in the Proxima Centauri system. Size, placement and rocky terrain are schematic, not an observed surface map.'});
for(const asset of robloxTextureAssets){const b=bodies.find(b=>b.name===asset.name);if(!b)continue;b.robloxAssetId=asset.assetId;if(asset.suppliedName!==asset.name)b.aliases=[asset.suppliedName];if(asset.texture){b.texture=asset.texture;if(b.name==='Moon')b.textureLayout='cube-cross';b.mapKind='user-supplied-preview';b.robloxTextureResolution=[asset.width,asset.height];b.desc=b.desc.split(/ Image-based map:| Surface art:| Borrowed lunar| Body-specific| Procedural surface| Surface illustration/)[0]+' User-selected surface artwork; local terrain is procedural.'}}

// Playable rocky worlds use a consistent game scale; other body categories retain their sizes.
for(const b of bodies)if(b.solid&&/PLANET/.test(b.type)&&!b.parent){b.physicalRadius=b.r;if(b.name!=='Mars')b.r=32;}

installMinorBodies(bodies,AU);

// Requested ring artwork; ordinary body textures remain unchanged.
for(const b of bodies){if(['Quaoar','Haumea'].includes(b.name)){b.rings=true;b.ringProfile={count:1,color:'#999b9e',inner:1.65,outer:1.86}}if(b.name==='Proxima c'){b.rings=true;b.ringProfile={count:10,color:'#b4e6ff'}}}
