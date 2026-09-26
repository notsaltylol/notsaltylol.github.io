import * as THREE from './vendor/three/three.module.js';
import { RoundedBoxGeometry } from './vendor/three/RoundedBoxGeometry.js';
import { STYLES, DEFAULT_STYLE } from './castle-styles.js';
const surfaceMaterials=new Set();
const paintedSky=await new THREE.TextureLoader().loadAsync('./painted-sky.png');
paintedSky.colorSpace=THREE.SRGBColorSpace;
const W=960,H=600;
const scene=new THREE.Scene();
scene.background=new THREE.Color('#b8e3ee');
// Unlit colors remain stable throughout the full orbit; no fog or dynamic lighting.
const camera=new THREE.PerspectiveCamera(34,W/H,.1,100);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(W,H); renderer.setPixelRatio(1);
renderer.domElement.style.width='100%';renderer.domElement.style.height='auto';
renderer.shadowMap.enabled=false;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.NoToneMapping;
document.getElementById('scene').appendChild(renderer.domElement);
let seed=27;
const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
// Unlit hand-painted shading: a faint baked underside tint, independent of lights.
const mat=(color)=>{
 const m=new THREE.MeshBasicMaterial({color});
 m.onBeforeCompile=shader=>{
  shader.vertexShader='varying float vPaintShade;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPaintShade=.92+.08*smoothstep(-.2,.8,normal.y);');
  shader.fragmentShader='varying float vPaintShade;\n'+shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=vPaintShade;');
 };
 surfaceMaterials.add(m);return m;
};
const stone=[0xecd9a7,0xf0e2bb,0xdbcf9c,0xf5e7c2,0xe9dbb3].map(mat);
const rock=[0xa7c7aa,0xc3d6ac,0xd8d6af,0x93b9a1].map(mat);
const moss=mat(0xa9d388),dark=mat(0x73846b),gold=mat(0xd8b873);
// Fine procedural stone grain, shared by every masonry block.
const texCanvas=document.createElement('canvas');texCanvas.width=texCanvas.height=128;
const ctx=texCanvas.getContext('2d');
ctx.fillStyle='#fffafc';ctx.fillRect(0,0,128,128);
for(let i=0;i<7000;i++){const v=215+Math.floor(rand()*40);ctx.fillStyle=`rgba(${v},${v},${v},.12)`;ctx.fillRect(rand()*128,rand()*128,1+rand()*2,1);}
const texture=new THREE.CanvasTexture(texCanvas);texture.colorSpace=THREE.SRGBColorSpace;
stone.forEach(m=>m.map=texture);

const island=new THREE.Group(),castle=new THREE.Group(),clouds=new THREE.Group();
scene.add(clouds,island,castle);
island.scale.set(1.6,1.18,1.6);castle.position.set(-2.8,1.25,-1.7);castle.scale.setScalar(.72);
function mesh(geo,material,parent,x,y,z){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=false;m.receiveShadow=false;parent.add(m);return m;}
const inkMaterial=new THREE.LineBasicMaterial({color:0x80765f,transparent:true,opacity:.25});
function box(parent,x,y,z,w,h,d,material=stone[Math.floor(rand()*stone.length)]){
 const m=mesh(new RoundedBoxGeometry(w,h,d,2,Math.min(w,h,d)*.08),material,parent,x,y,z);
 if(w>.2&&h>.2&&d>.2){
  const lines=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w,h,d)),inkMaterial);m.add(lines);
 }
 return m;
}
const hullMaterial=new THREE.MeshBasicMaterial({color:0x71816d,side:THREE.BackSide,transparent:true,opacity:.5});
function boulder(parent,x,y,z,s,material){const m=mesh(new THREE.IcosahedronGeometry(s,3),material,parent,x,y,z);m.scale.set(1+rand()*.5,.65+rand(),.7+rand()*.5);m.rotation.set(rand(),rand()*3,rand());const hull=new THREE.Mesh(m.geometry,hullMaterial);hull.scale.setScalar(1.014);m.add(hull);return m;}
// A broad meadow atop a deep, fractured floating cliff. Ring samples align the rim.
const profileR=(a)=>4.45*(1+.07*Math.sin(a*3)+.045*Math.sin(a*7)+.025*Math.cos(a*13));
function floatingCliff(parent,material){
 const radii=[1,.99,.88,.75,.53,.29,.075],ys=[.04,-.55,-1.5,-2.6,-3.9,-5.1,-6.1];
 const segments=96,positions=[],uvs=[],indices=[];
 for(let ring=0;ring<ys.length;ring++)for(let i=0;i<=segments;i++){
  const a=i/segments*Math.PI*2;
  const furrow=ring===0?1:1+(.025+ring*.01)*Math.sin(a*19)+.018*Math.cos(a*31);
  const r=profileR(a)*radii[ring]*furrow;
  positions.push(Math.cos(a)*r,ys[ring]+(ring?Math.sin(a*9)*.16:0),Math.sin(a)*r);
  uvs.push(i/segments*3,ring/(ys.length-1));
 }
 for(let ring=0;ring<ys.length-1;ring++)for(let i=0;i<segments;i++){
  const a=ring*(segments+1)+i,b=a+segments+1;
  indices.push(a,a+1,b,a+1,b+1,b);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
 return mesh(geo,material,parent,0,0,0);
}
const cragCanvas=document.createElement('canvas');cragCanvas.width=cragCanvas.height=256;
const cragCtx=cragCanvas.getContext('2d');cragCtx.fillStyle='#dedbd1';cragCtx.fillRect(0,0,256,256);
for(let i=0;i<900;i++){const x=rand()*256;cragCtx.strokeStyle=`rgba(66,57,52,${.015+rand()*.06})`;cragCtx.lineWidth=.4+rand()*5;cragCtx.beginPath();cragCtx.moveTo(x,0);cragCtx.bezierCurveTo(x+(rand()-.5)*25,80,x+(rand()-.5)*35,180,x+(rand()-.5)*25,256);cragCtx.stroke();}
const cragTexture=new THREE.CanvasTexture(cragCanvas);cragTexture.colorSpace=THREE.SRGBColorSpace;cragTexture.wrapS=THREE.RepeatWrapping;rock.forEach(m=>m.map=cragTexture);
floatingCliff(island,rock[0]);
const meadowShape=new THREE.Shape();
for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,r=profileR(a);if(i===0)meadowShape.moveTo(Math.cos(a)*r,Math.sin(a)*r);else meadowShape.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
const meadow=mesh(new THREE.ShapeGeometry(meadowShape,96),moss,island,0,.06,0);meadow.rotation.x=-Math.PI/2;
for(let i=0;i<16;i++){
 const a=rand()*6.28,r=profileR(a)*(.68+rand()*.25);
 const crag=boulder(island,Math.cos(a)*r,-1.8-rand()*1.8,Math.sin(a)*r,.35+rand()*.25,rock[i%4]);crag.scale.y=1.5+rand()*1.7;crag.scale.x*=.65;crag.scale.z*=.65;crag.rotation.set(.08*Math.sin(a),-a,0);
}
for(let i=0;i<22;i++){const a=rand()*6.28,r=2.8+rand()*1.35;boulder(island,Math.cos(a)*r,.08,Math.sin(a)*r,.09+rand()*.14,rock[2]);}
// Soft layered brush marks break up the meadow without adding realistic lighting.
const grassCanvas=document.createElement('canvas');grassCanvas.width=grassCanvas.height=512;
const grassCtx=grassCanvas.getContext('2d');grassCtx.fillStyle='#e9efdb';grassCtx.fillRect(0,0,512,512);
for(let i=0;i<2300;i++){
 const x=rand()*512,y=rand()*512,r=8+rand()*40;
 const wash=grassCtx.createRadialGradient(x,y,0,x,y,r);wash.addColorStop(0,i%3?'rgba(67,108,52,.08)':'rgba(255,249,178,.18)');wash.addColorStop(1,'rgba(255,255,255,0)');grassCtx.fillStyle=wash;grassCtx.fillRect(x-r,y-r,r*2,r*2);
}
const grassTexture=new THREE.CanvasTexture(grassCanvas);grassTexture.colorSpace=THREE.SRGBColorSpace;moss.map=grassTexture;
// An irregular green ridge lifts the architecture into the skyline.
const ridge=boulder(scene,-2.8,.3,-1.7,1.5,rock[2]);ridge.scale.set(1.5,.8,1.15);
const ridgeGrass=boulder(scene,-2.8,.88,-1.7,1.15,moss);ridgeGrass.scale.set(1.65,.3,1.2);
// Layer 2: hand-laid blocks, real open arch, ruined parapets and a turquoise dome.
function tower(cx,cz,w,h){
 for(let row=0;row<Math.floor(h/.34);row++){
  const y=.28+row*.34;
  for(let side=0;side<4;side++)for(let col=0;col<5;col++){
   const t=-w/2+(col+.5)*w/5;
   if(side===0 && Math.abs(t)<.48 && y<2.05)continue;
   if(side===0 && col===2 && y>2.65 && y<3.65)continue;
   const block=side%2===0?box(castle,cx+t,y,cz+(side===0?w/2:-w/2),w/5-.018,.318,.3):box(castle,cx+(side===1?w/2:-w/2),y,cz+t,.3,.318,w/5-.018);
   block.rotation.y=(rand()-.5)*.018;
  }
 }
 box(castle,cx,h+.12,cz,w+.38,.22,w+.38);
 for(let i=0;i<5;i++)for(const s of [-1,1]){if(rand()>.12)box(castle,cx-w/2+i*w/4,h+.43,cz+s*w/2,.3,.42,.32);}
}
tower(.6,0,2.35,4.45);
// Voussoirs trace the entry arch rather than painting it on a solid wall.
for(let i=0;i<11;i++){const a=i*Math.PI/10;const m=box(castle,.6+Math.cos(a)*.61,1.5+Math.sin(a)*.61,1.21,.25,.34,.4,stone[3]);m.rotation.z=a-Math.PI/2;}
box(castle,.6,.11,1.17,1.4,.16,.65);
box(castle,.6,1,-.9,1.1,1.9,.1,dark);
const domeMat=mat(0x99cfbf);
mesh(new THREE.CylinderGeometry(.97,1.05,.24,24),gold,castle,.6,4.9,0);
mesh(new THREE.SphereGeometry(.98,24,16,0,Math.PI*2,0,Math.PI/2),domeMat,castle,.6,5.02,0);
for(let i=0;i<8;i++){const curve=[];for(let j=0;j<=24;j++){const a=j/24*Math.PI/2;curve.push(new THREE.Vector3(.6+Math.sin(a)*.99*Math.cos(i*Math.PI/4),5.02+Math.cos(a)*.99,Math.sin(a)*.99*Math.sin(i*Math.PI/4)));}mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curve),24,.014,4,false),gold,castle,0,0,0);}
mesh(new THREE.ConeGeometry(.1,.55,8),gold,castle,.6,6.2,0);
// Lower ruined hall and a small watchtower establish the castle silhouette.
for(let row=0;row<6;row++)for(let col=0;col<7;col++){if(row>3&&col<2)continue;box(castle,-2.8+col*.42,.28+row*.33,.6,.4,.31,.45);}
for(let i=0;i<6;i++)box(castle,-2.75+i*.45,2.32,.6,.24,.45,.45);
mesh(new THREE.CylinderGeometry(.52,.64,2.9,12),stone[1],castle,-2.35,1.35,-.55);
mesh(new THREE.ConeGeometry(.75,1.35,12),moss,castle,-2.35,3.45,-.55);
for(let i=0;i<22;i++){const x=-.65+rand()*.28,y=rand()*4;boulder(castle,x,y,1.38,.09+rand()*.08,moss);}
function tree(x,z,h){
 h*=.7;
 mesh(new THREE.CylinderGeometry(.055,.09,h*.8,10),dark,island,x,h*.3,z);
 for(let i=0;i<3;i++){const crown=mesh(new THREE.SphereGeometry(h*(.24-i*.025),20,16),moss,island,x+(i-1)*h*.1,h*(.58+i*.16),z);crown.scale.set(.9,1.3,.9);const hull=new THREE.Mesh(crown.geometry,hullMaterial);hull.scale.setScalar(1.014);crown.add(hull);}
}
[[-3,1.8,1.6],[3,-1.2,1.9],[-3.3,-1.4,1.5],[2.8,1.8,1.2]].forEach(v=>tree(...v));
for(let i=0;i<24;i++){const a=Math.PI+rand()*Math.PI;const r=2.8+rand()*1.2;tree(Math.cos(a)*r,Math.sin(a)*r,.6+rand()*.75);}
// The username is actual raised masonry geometry on the island's front facade.
// Five-by-seven letter patterns turn each lit pixel into an extruded stone block.
const glyphs={
 N:['10001','11001','11001','10101','10011','10011','10001'],
 O:['01110','11011','10001','10001','10001','11011','01110'],
 T:['11111','00100','00100','00100','00100','00100','00100'],
 S:['01111','11000','10000','01110','00001','00011','11110'],
 A:['01110','11011','10001','11111','10001','10001','10001'],
 L:['10000','10000','10000','10000','10000','10000','11111'],
 Y:['10001','10001','01010','00100','00100','00100','00100']
};
const namework=new THREE.Group();
namework.position.set(-1.25,-1.0,4.42);namework.rotation.y=0;namework.scale.set(.68,.85,.85);island.add(namework);
const inscription='NOTSALTYLOL',unit=.113,total=(inscription.length*6-1)*unit;
const backing=mat(0x789b88),letter=mat(0xffefc7),trim=mat(0xc3d7a1);
// A masonry lintel sunk into the floating cliff, with lime-green end caps.
box(namework,0,.0,-.17,total+.45,1.2,.55,backing);
box(namework,0,-.61,-.1,total+.65,.15,.62,trim);
box(namework,0,.61,-.1,total+.65,.15,.62,trim);
for(let i=0;i<inscription.length;i++){
 const rows=glyphs[inscription[i]];
 rows.forEach((row,y)=>[...row].forEach((pixel,x)=>{
  if(pixel==='1')box(namework,-total/2+(i*6+x+.5)*unit,(3-y)*unit,.18,unit*.94,unit*.94,.22,letter);
 }));
}
// Layer 3: clustered sunlit cumulus, well behind the architecture.
// Art Nouveau-inspired lake: a flowing shoreline, scalloped stones and curling plants.
const garden=new THREE.Group();scene.add(garden);
const lakeShape=new THREE.Shape();
for(let i=0;i<=80;i++){
 const a=i/80*Math.PI*2,r=1+.06*Math.sin(a*3)+.045*Math.sin(a*5);
 const x=Math.cos(a)*2.8*r,y=Math.sin(a)*2.3*r;
 if(i===0)lakeShape.moveTo(x,y);else lakeShape.lineTo(x,y);
}
const waterUniforms={uTime:{value:0},waterLow:{value:new THREE.Color()},waterHigh:{value:new THREE.Color()}};
const lakeMat=new THREE.ShaderMaterial({
 uniforms:waterUniforms,side:THREE.DoubleSide,
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`varying vec2 vUv;uniform float uTime;uniform vec3 waterLow,waterHigh;
 void main(){
  float wave=sin(vUv.x*8.+vUv.y*4.+uTime)*sin(vUv.y*9.-uTime);
  float ripple=smoothstep(.78,.99,sin(vUv.x*15.+sin(vUv.y*10.+uTime)*.55-uTime));
  vec3 water=mix(waterLow,waterHigh,.5+.5*wave);
  water+=vec3(.13,.14,.1)*ripple*.35;
  gl_FragColor=vec4(water,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`
});
const lake=mesh(new THREE.ShapeGeometry(lakeShape),lakeMat,garden,1.55,.5,.25);lake.rotation.x=-Math.PI/2;
for(let i=0;i<38;i++){
 const a=i/38*Math.PI*2;
 if(a>.6&&a<1.45)continue;
 boulder(garden,1.55+Math.cos(a)*2.9,.25,.25+Math.sin(a)*2.42,.18+rand()*.12,i%3===0?stone[0]:rock[1]);
}
// A narrow outlet snakes toward the island rim before dropping into open sky.
const riverShape=new THREE.Shape();
riverShape.moveTo(1.9,1.6);riverShape.bezierCurveTo(2.5,2.8,3.0,3.8,2.65,6.1);
riverShape.lineTo(3.85,6.1);riverShape.bezierCurveTo(4.15,3.7,3.3,2.7,3.1,1.6);riverShape.closePath();
const river=mesh(new THREE.ShapeGeometry(riverShape),lakeMat,garden,0,.5,0);river.rotation.x=Math.PI/2;
river.material=lakeMat;
// Shape lies in X/Y; rotate +90 degrees so the outlet runs toward positive Z.
const falls=new THREE.Group();garden.add(falls);
const waterfallMats=[0x8dcfdb,0xb3e4e7,0x79becd,0xe4f9ee].map(mat);
for(let i=0;i<10;i++){
 const strip=box(falls,2.73+i*.113,-4.05,6.09,.12,8.7,.13,waterfallMats[i%4]);
 strip.rotation.z=(i-4.5)*.004;
}
const streaks=[];
for(let i=0;i<34;i++){
 const m=box(falls,2.7+rand()*1.12,0,6.2,.035+rand()*.045,.14+rand()*.3,.05,waterfallMats[3]);
 streaks.push({m,offset:rand()});
}
// Pixel glints on the lake and petals beside the shore.
const glints=[];
for(let i=0;i<30;i++){
 const a=rand()*6.28,r=Math.sqrt(rand());
 const m=box(garden,1.55+Math.cos(a)*2.45*r,.53,.25+Math.sin(a)*1.95*r,.13+rand()*.25,.015,.04,waterfallMats[3]);
 glints.push({m,offset:rand()*6.28});
}
const leafMat=mat(0x8eb781),flowerMats=[mat(0xff937a),mat(0xffe651),mat(0x8fe0d2)];
function curlPlant(x,z,h,flip){
 const pts=[];
 for(let i=0;i<=30;i++){const t=i/30;pts.push(new THREE.Vector3(x+flip*(.12*Math.sin(t*3)+.4*t*t*Math.cos(t*7)),.25+h*t,z+.22*t*Math.sin(t*7)));}
 mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),30,.035,5,false),leafMat,garden,0,0,0);
 const tip=pts[pts.length-1];
 for(let i=0;i<5;i++){const a=i*6.28/5;const petal=boulder(garden,tip.x+.12*Math.cos(a),tip.y+.12*Math.sin(a),tip.z,.12,flowerMats[Math.floor(rand()*3)]);petal.scale.z=.35;}
}
for(let i=0;i<18;i++){const a=rand()*6.28;curlPlant(1.55+Math.cos(a)*3.4,.25+Math.sin(a)*2.8,.4+rand()*.75,i%2?1:-1);}
// Lily pads and tiny coral blossoms make the lake read clearly at GIF resolution.
for(let i=0;i<8;i++){const a=rand()*6.28,r=1+rand();const x=1.55+Math.cos(a)*r,z=.25+Math.sin(a)*r*.8;const pad=mesh(new THREE.CircleGeometry(.18,9),leafMat,garden,x,.54,z);pad.rotation.x=-Math.PI/2;boulder(garden,x+.04,.59,z,.065,flowerMats[0]);}
// Curved stepping-stone path ties the ruined castle to the garden.
for(let i=0;i<19;i++){const t=i/18;const x=-2.3-1.4*Math.sin(t*Math.PI),z=-.2+t*5.4;const step=box(garden,x,.28,z,.62,.13,.28,stone[2]);step.rotation.y=Math.cos(t*Math.PI)*.4;}
const cloudMats=[0xfff4de,0xf9f2df,0xfff9ea,0xe9efda].map(mat);
function cloudCluster(cx,cy,cz,s){for(let i=0;i<18;i++){const m=mesh(new THREE.SphereGeometry((.55+rand()*.75)*s,24,16),cloudMats[Math.floor(rand()*4)],clouds,cx+(rand()-.5)*s*3,cy+(rand()-.5)*s*2,cz+(rand()-.5)*s);m.castShadow=false;}}
cloudCluster(-8,2.5,-10,2.3);cloudCluster(-7,5,-11,1.8);cloudCluster(8,2,-10,2);cloudCluster(9,4.3,-12,1.5);cloudCluster(0,-6,-8,2.2);
// A brass gyroscope and crystal globe: remnants of a lost solar civilization.
const machine=new THREE.Group();machine.position.set(-5,.55,1.2);scene.add(machine);
mesh(new THREE.CylinderGeometry(.48,.65,.65,24),stone[1],machine,0,0,0);
const crystal=new THREE.MeshBasicMaterial({color:0xb3e2d4,transparent:true,opacity:.78});
mesh(new THREE.SphereGeometry(.53,32,24),crystal,machine,0,.9,0);
for(let i=0;i<3;i++){const ring=mesh(new THREE.TorusGeometry(.8,.035,8,64),gold,machine,0,.9,0);ring.rotation.set(i*.9,i*.7,.3);}
for(let i=0;i<12;i++){const a=i*Math.PI/6;box(machine,Math.cos(a)*.94,.9+Math.sin(a)*.94,0,.15,.15,.15,gold);}
const explorer=new THREE.Group();explorer.position.set(-1.35,.38,2.05);scene.add(explorer);
mesh(new THREE.SphereGeometry(.11,16,12),mat(0xe7c597),explorer,0,.58,0);
mesh(new THREE.ConeGeometry(.19,.4,24),mat(0xc37c4c),explorer,0,.3,0);
box(explorer,-.065,.07,0,.07,.22,.08,dark);box(explorer,.065,.07,0,.07,.22,.08,dark);
// Satellite islands make the main castle feel like part of a floating archipelago.
const satellites=[];
for(const [x,y,z,scale] of [[10.8,.7,-3.8,.28],[-11.4,-2,-5.5,.23],[5,-3,-12,.15]]){
 const mini=new THREE.Group();mini.position.set(x,y,z);mini.scale.setScalar(scale);scene.add(mini);satellites.push(mini);
 floatingCliff(mini,rock[1]);const lawn=new THREE.Mesh(meadow.geometry,moss);lawn.rotation.x=-Math.PI/2;lawn.position.y=.08;mini.add(lawn);
 mesh(new THREE.CylinderGeometry(.65,.8,1.5,24),stone[1],mini,0,.8,0);
 mesh(new THREE.SphereGeometry(.9,24,16,0,Math.PI*2,0,Math.PI/2),gold,mini,0,1.55,0);
}
// A second slender fall descends from a spring on the western cliff.
const sideFall=new THREE.Group();sideFall.position.set(-5.6,-3.4,1.7);sideFall.rotation.y=-.8;scene.add(sideFall);
for(let i=0;i<4;i++)box(sideFall,(i-1.5)*.06,0,0,.06,7.4,.04,waterfallMats[i]);
const birds=[];const birdMat=mat(0xfffae7);
for(let i=0;i<7;i++){
 const bird=new THREE.Group();scene.add(bird);
 const wingGeo=new THREE.BufferGeometry();wingGeo.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.45,0,-.06,.12,0,.08],3));wingGeo.computeVertexNormals();
 const left=new THREE.Mesh(wingGeo,birdMat);left.material.side=THREE.DoubleSide;const right=left.clone();right.scale.x=-1;bird.add(left,right);birds.push({bird,left,right,offset:i/7});
}
// One compositor, controlled by the active style. Cozy disables bloom and blur.
const target=new THREE.WebGLRenderTarget(W,H,{samples:4});
const postScene=new THREE.Scene(),postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const postMaterial=new THREE.ShaderMaterial({
 uniforms:{tColor:{value:target.texture},resolution:{value:new THREE.Vector2(W,H)},blur:{value:0},bloom:{value:0},grain:{value:.004},saturation:{value:1}},
 vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
 fragmentShader:`varying vec2 vUv;uniform sampler2D tColor;uniform vec2 resolution;uniform float blur,bloom,grain,saturation;
 void main(){
  vec2 px=1./resolution;vec3 color=texture2D(tColor,vUv).rgb;
  if(blur>0.||bloom>0.){
   vec3 soft=color*.2,glow=vec3(0.);
   float radius=blur*(.25+1.8*abs(vUv.y-.5));
   for(int i=0;i<8;i++){
    float a=float(i)*.785398;vec2 dir=vec2(cos(a),sin(a));
    soft+=texture2D(tColor,vUv+dir*px*radius).rgb*.1;
    vec3 g=texture2D(tColor,vUv+dir*px*5.).rgb;glow+=max(g-.7,0.)*.125;
   }
   color=soft+glow*bloom;
  }
  float luminance=dot(color,vec3(.2126,.7152,.0722));color=mix(vec3(luminance),color,saturation);
  float noise=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
  color=color*vec3(1.015,1.005,.985)+noise*grain;
  gl_FragColor=vec4(color,1.);
  #include <colorspace_fragment>
 }`
});
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),postMaterial));
const ambient=new THREE.HemisphereLight(0xe5f6ff,0x71865a,0);scene.add(ambient);
const sunlight=new THREE.DirectionalLight(0xffeed0,0);sunlight.position.set(-9,15,8);scene.add(sunlight);
const bands=new THREE.DataTexture(new Uint8Array([100,165,220,255]),4,1,THREE.RedFormat);bands.needsUpdate=true;bands.minFilter=bands.magFilter=THREE.NearestFilter;
const roles=new Map();
const role=(materials,key)=>materials.forEach((m,i)=>roles.set(m,{key,index:i}));
role(stone,'stone');role(rock,'rock');role(cloudMats,'cloud');role(flowerMats,'flower');
for(const [key,m] of Object.entries({moss,dark,gold,dome:domeMat,backing,letter,trim,leaf:leafMat}))roles.set(m,{key});
waterfallMats.forEach((m,i)=>roles.set(m,{key:'water',index:i%2}));
const originalMaterials=new Map();
scene.traverse(obj=>{if(obj.isMesh&&surfaceMaterials.has(obj.material))originalMaterials.set(obj,obj.material);});
const materialCache=new Map();
let activeStyle=DEFAULT_STYLE;
function materialsFor(id){
 if(materialCache.has(id))return materialCache.get(id);
 const preset=STYLES[id],mapping=new Map();
 for(const original of surfaceMaterials){
  const mappingRole=roles.get(original);let color=original.color.clone();
  if(mappingRole){const value=preset[mappingRole.key];color.set(Array.isArray(value)?value[mappingRole.index]:value);}
  let material;
  // Clouds remain smoothly shaded for clear-line comic looks.
  const model=mappingRole?.key==='cloud'&&preset.model==='toon'?'lit':preset.model;
  if(model==='unlit'){
   material=new THREE.MeshBasicMaterial({color,map:original.map});material.onBeforeCompile=original.onBeforeCompile;
  }else if(model==='toon'){
   material=new THREE.MeshToonMaterial({color,map:original.map,gradientMap:bands});
  }else{
   material=new THREE.MeshStandardMaterial({color,map:original.map,roughness:id==='fantasy'?.7:1,metalness:0});
  }
  mapping.set(original,material);
 }
 materialCache.set(id,mapping);return mapping;
}
window.setStyle=(id,{persist=true}={})=>{
 if(!Object.hasOwn(STYLES,id))throw new Error('Unknown castle style: '+id);
 activeStyle=id;const preset=STYLES[id],mapping=materialsFor(id);
 for(const [obj,original] of originalMaterials)obj.material=mapping.get(original);
 scene.background=id==='fantasy'&&paintedSky?paintedSky:new THREE.Color(preset.sky);clouds.visible=!(id==='fantasy'&&paintedSky);document.body.style.backgroundColor='#'+preset.sky.toString(16).padStart(6,'0');
 ambient.intensity=preset.ambient;sunlight.intensity=preset.sunlight;
 renderer.toneMapping=preset.model==='unlit'?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=preset.exposure;
 inkMaterial.opacity=preset.ink;hullMaterial.opacity=preset.hull;
 inkMaterial.visible=preset.ink>0;hullMaterial.visible=preset.hull>0;
 target.setSize(W/preset.pixel,H/preset.pixel);target.texture.minFilter=target.texture.magFilter=preset.pixel>1?THREE.NearestFilter:THREE.LinearFilter;
 postMaterial.uniforms.resolution.value.set(W/preset.pixel,H/preset.pixel);
 for(const key of ['blur','bloom','grain','saturation'])postMaterial.uniforms[key].value=preset[key];
 waterUniforms.waterLow.value.set(preset.water[0]);waterUniforms.waterHigh.value.set(preset.water[1]);
 crystal.color.set(preset.dome);
 document.querySelectorAll('[data-style]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.style===id)));
 document.getElementById('description').textContent=preset.description;
 if(persist&&!capture){const url=new URL(location.href);url.searchParams.set('style',id);history.replaceState(null,'',url);try{localStorage.setItem('castle-style',id);}catch{}}
 window.castleState.style=id;
};
window.castleStyles=Object.keys(STYLES);
window.castleState={style:DEFAULT_STYLE,meshCount:originalMaterials.size};
const params=new URLSearchParams(location.search),capture=params.has('capture');
const picker=document.getElementById('style-picker');
for(const [id,preset] of Object.entries(STYLES)){
 const button=document.createElement('button');button.type='button';button.dataset.style=id;button.textContent=preset.label;button.setAttribute('aria-pressed','false');
 button.addEventListener('click',()=>window.setStyle(id));picker.append(button);
}
let preferred=params.get('style');if(!preferred&&!capture){try{preferred=localStorage.getItem('castle-style');}catch{}}
window.setStyle(Object.hasOwn(STYLES,preferred)?preferred:DEFAULT_STYLE,{persist:false});
// A full 24-second orbit; an exact cycle keeps both camera and water seamless.
window.renderFrame=phase=>{
 const t=phase*Math.PI*2;
 const angle=.426+t;
 camera.position.set(Math.sin(angle)*39,10.8,Math.cos(angle)*39);
 camera.lookAt(0,-1.2,0);clouds.rotation.y=t;
 streaks.forEach(({m,offset})=>m.position.y=.2-((phase*12+offset)%1)*9.1);
 glints.forEach(({m,offset})=>m.scale.x=.6+.4*Math.sin(t+offset));
 waterUniforms.uTime.value=t*4;
 birds.forEach(({bird,left,right,offset})=>{const a=t+offset*Math.PI*2;bird.position.set(Math.cos(a)*13,2+Math.sin(a*2)*.8,Math.sin(a)*11);bird.rotation.y=-a;left.rotation.z=Math.sin(t*8+offset*6.28)*.3;right.rotation.z=-left.rotation.z;});
 renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(postScene,postCamera);
};
window.animationConfig={duration:24,fps:12};
window.renderFrame(0);
// Capture uses exact phases; normal browser viewing plays the same 24-second orbit.
if (!new URLSearchParams(location.search).has('capture')) {
  let elapsed=0,last=performance.now(),paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pause=document.getElementById('pause');
  const updatePause=()=>{pause.textContent=paused?'Play orbit':'Pause orbit';pause.setAttribute('aria-pressed',String(paused));};updatePause();
  pause.addEventListener('click',()=>{paused=!paused;updatePause();});
  renderer.setAnimationLoop(now=>{if(!paused)elapsed+=now-last;last=now;window.renderFrame((elapsed%24000)/24000);});
}
