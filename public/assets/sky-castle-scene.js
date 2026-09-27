import * as THREE from './vendor/three/three.module.js';
import { createMaterials } from './sky-castle-materials.js';
import { createAtmosphere } from './sky-castle-atmosphere.js';
import { buildTerrain } from './sky-castle-terrain.js';
import { buildSatelliteTerrain } from './sky-castle-satellites.js';
import { buildAcropolis } from './sky-castle-acropolis.js';
import { buildTraveler } from './sky-castle-travelers.js';
import { buildCastle, buildTree, buildPavilion } from './sky-castle-models.js';
import { buildLandscapeDetails } from './sky-castle-details.js';
import { buildGroves } from './sky-castle-groves.js';
import { buildBotany } from './sky-castle-botany.js';
import { buildLookoutTerrain } from './sky-castle-lookout.js';
import { buildForegroundDetails } from './sky-castle-foreground.js';
import { STYLES, DEFAULT_STYLE } from './castle-styles.js';

const W = 960, H = 600, DURATION = 60;
const LAND_SCALE=10, HEIGHT_SCALE=LAND_SCALE;
const groveControllers=[];
const travelerControllers=[];
const sunOffset=new THREE.Vector3(-28*LAND_SCALE,25*LAND_SCALE,16*LAND_SCALE);
const params = new URLSearchParams(location.search), capture = params.has('capture');
const sceneContainer=document.getElementById('scene');
let renderScale=capture?1:Math.min(window.devicePixelRatio||1,2)*Math.min(W,sceneContainer.clientWidth||W)/W;
let renderWidth=Math.floor(W*renderScale),renderHeight=Math.floor(H*renderScale);
const renderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
renderer.setSize(W,H); renderer.setPixelRatio(renderScale);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.info.autoReset = false;
renderer.domElement.style.width = '100%'; renderer.domElement.style.height = 'auto';
renderer.domElement.style.touchAction = 'none';
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('aria-label','3D sky castle. Drag or use arrow keys to orbit. Shift-drag or shift-arrow to pan. Use plus and minus to zoom.');
sceneContainer.appendChild(renderer.domElement);
renderer.domElement.style.visibility='hidden';
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb4dce4, 40*LAND_SCALE, 90*LAND_SCALE);
const camera = new THREE.PerspectiveCamera(30,W/H,1,180*LAND_SCALE);
const palette = createMaterials(THREE), m = palette.materials;
palette.setWorldScale(LAND_SCALE,HEIGHT_SCALE);palette.setSunDirection(sunOffset);
const meadowReady=palette.loadMeadowTexture(new URL('./meadow-paint-v1.png',import.meta.url).href);
const rockReady=palette.loadRockTexture(new URL('./rock-paint-v1.png',import.meta.url).href);
const ambient = new THREE.HemisphereLight(0xfff3d7,0x739aaa,1.45);
const sunlight = new THREE.DirectionalLight(0xfff0d3,2.8);
sunlight.position.copy(sunOffset); sunlight.castShadow = true;
sunlight.shadow.mapSize.set(4096,4096);
Object.assign(sunlight.shadow.camera,{left:-16*LAND_SCALE,right:16*LAND_SCALE,top:17*LAND_SCALE,bottom:-14*LAND_SCALE,near:1,far:sunOffset.length()+30*LAND_SCALE});
sunlight.shadow.bias = -.00004; sunlight.shadow.normalBias = .035;
scene.add(ambient,sunlight,sunlight.target);
const terrain = buildTerrain(THREE,m,{scale:LAND_SCALE,
 reservedAreas:[{x:-3.1*LAND_SCALE,z:-1.7*LAND_SCALE,radius:11.3}]
}); scene.add(terrain.group);
palette.setSummitAnchor(terrain.castleAnchor);
const landscapeDetails = buildLandscapeDetails(THREE,m,terrain); scene.add(landscapeDetails.group);
const botany = buildBotany(THREE,m,terrain); scene.add(botany.group);
const castle = buildCastle(THREE,m); castle.scale.setScalar(.64);
castle.position.copy(terrain.castleAnchor); castle.position.y-=.09;castle.rotation.y = .17;
scene.add(castle);
const acropolis=buildAcropolis(THREE,m,terrain);scene.add(acropolis.group);

// Unequal tree silhouettes follow the actual height field and frame the hill.
const trees = [[-4.52,-1.48,1.7,'cypress'],[-4.1,.4,1.35,'cypress'],[-1.96,-2.8,1.45,'cypress'],[-1.0,-3.8,1.6,'broadleaf'],[2.8,-3.1,1.2,'broadleaf'],[4.7,-1.8,1.8,'broadleaf'],[4.5,1.4,1.1,'cypress'],[-4.8,2,1.25,'broadleaf'],[-.9,3.5,.9,'broadleaf']];
for(let i=0;i<trees.length;i++) {
  const [x,z,height,kind]=trees[i]; const tree=buildTree(THREE,m,{height,kind,seed:i*17+3});
  tree.position.set(x*LAND_SCALE,terrain.surfaceHeight(x*LAND_SCALE,z*LAND_SCALE),z*LAND_SCALE); scene.add(tree);
}
const pavilion=buildPavilion(THREE,m);pavilion.scale.setScalar(.64);pavilion.position.set(4.1*LAND_SCALE,terrain.height(4.1*LAND_SCALE,-2.6*LAND_SCALE),-2.6*LAND_SCALE);scene.add(pavilion);
const groves=buildGroves(THREE,m,terrain,{buildTree,count:900,reservedPositions:trees.map(([x,z])=>[x*LAND_SCALE,z*LAND_SCALE,1.3])});scene.add(groves.group);groveControllers.push(groves);

// Smaller landforms have individually authored shoulders and fractured bases.
// Their surface sampler grounds the same small buildings and grove geometry.
function satellite(x,y,z,size,seed) {
  const land=buildSatelliteTerrain(THREE,m,{scale:LAND_SCALE,seed});
  const group=land.group;group.position.set(x*LAND_SCALE,y*HEIGHT_SCALE,z*LAND_SCALE);group.scale.setScalar(size);
  const temple=buildPavilion(THREE,m);temple.scale.setScalar(.64);temple.position.y=land.height(0,0)-.025;group.add(temple);
  const tree=buildTree(THREE,m,{height:.85,kind:'cypress',seed});
  tree.position.set(-.7*LAND_SCALE,land.height(-.7*LAND_SCALE,-.25*LAND_SCALE),-.25*LAND_SCALE);group.add(tree);
  const grove=buildGroves(THREE,m,land,{buildTree,count:100,islandKind:'satellite',seed:seed*113,
    reservedPositions:[[0,0,1.3],[-.7*LAND_SCALE,-.25*LAND_SCALE,.8]]});
  group.add(grove.group);groveControllers.push(grove);scene.add(group);return group;
}
satellite(10,-.2,-4,.92,43);satellite(-11,-1.7,-6,.64,71);satellite(4,-1.8,-13,.45,97);

// Brass celestial mechanism, deliberately subordinate to the castle silhouette.
const machine=new THREE.Group(); machine.position.set(-.8*LAND_SCALE,terrain.height(-.8*LAND_SCALE,-2.8*LAND_SCALE),-2.8*LAND_SCALE);
const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.23,.33,.4,24),m.stone);pedestal.position.y=.2;machine.add(pedestal);
for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.37,.018,6,48),m.gold);ring.position.y=.7;ring.rotation.set(i*.8,i*.6,.25);machine.add(ring);}scene.add(machine);

// Small human silhouettes establish scale without dominating the landscape.
function traveler(x,z,scale,groundY=null) {
 const controller=buildTraveler(THREE,m,{seed:travelerControllers.length+1,companion:travelerControllers.length%2===1});
 controller.group.scale.setScalar(scale);controller.group.position.set(x,groundY??terrain.height(x,z),z);
 controller.group.rotation.y=Math.atan2(x-terrain.castleAnchor.x,z-terrain.castleAnchor.z);
 travelerControllers.push(controller);scene.add(controller.group);
}
traveler(-.85*LAND_SCALE,2.8*LAND_SCALE,1);traveler(-.56*LAND_SCALE,2.87*LAND_SCALE,.72);

// A genuine foreground viewing ledge contributes the darkest depth layer.
// It remains in world space, so orbiting reveals its relationship to the island.
const foregroundGrass=m.habitatGround.clone();
foregroundGrass.onBeforeCompile=m.habitatGround.onBeforeCompile;foregroundGrass.customProgramCacheKey=m.habitatGround.customProgramCacheKey;
foregroundGrass.name='painted-lookout-meadow';
const lookoutLand=buildLookoutTerrain(THREE,{grass:foregroundGrass,rock:m.rock},{scale:LAND_SCALE});
// Offset the ridge laterally from the waterfall. The near-person preset can
// look across open sky to the summit without the ridge covering the island tip.
const ledge=lookoutLand.group;ledge.position.set(-14*LAND_SCALE,-1.5*HEIGHT_SCALE,16*LAND_SCALE);scene.add(ledge);
const foreground = buildForegroundDetails(THREE,m,ledge,{scale:LAND_SCALE,viewingPoint:lookoutLand.viewingPoint}); scene.add(foreground.group);
for(const [i,u,v,height] of [[0,-3,.2,1.25],[1,-2.2,.6,.9],[2,-1.6,0,1.4],[3,-.7,.8,1.05]]){const x=ledge.position.x+u*LAND_SCALE,z=ledge.position.z+v*LAND_SCALE;const tree=buildTree(THREE,m,{height,kind:'broadleaf',seed:79+i});tree.position.set(x,foreground.groundHeight(x,z)-.025,z);scene.add(tree);}
const lookoutStation=new THREE.Vector3(ledge.position.x+lookoutLand.viewingPoint.x,0,ledge.position.z+lookoutLand.viewingPoint.z);
lookoutStation.y=foreground.groundHeight(lookoutStation.x,lookoutStation.z);
// Keep the sunlight opening attached when the authored viewing point moves.
palette.setLookoutAnchor(lookoutStation);
traveler(lookoutStation.x,lookoutStation.z,1.5,lookoutStation.y);
traveler(lookoutStation.x+.9,lookoutStation.z+.2,1.0,foreground.groundHeight(lookoutStation.x+.9,lookoutStation.z+.2));
const lookoutTerrain={scale:LAND_SCALE,verticalScale:HEIGHT_SCALE,waterLevel:-1000,
 height:(x,z)=>foreground.groundHeight(x+ledge.position.x,z+ledge.position.z)-ledge.position.y,
 trailDistance:(x,z)=>foreground.trailDistance(x+ledge.position.x,z+ledge.position.z),
 radius:lookoutLand.radius,
 contains:(x,z,margin=0)=>foreground.contains(x+ledge.position.x,z+ledge.position.z,margin)};
const lookoutGroves=buildGroves(THREE,m,lookoutTerrain,{buildTree,count:400,islandKind:'lookout',reservedPositions:[[lookoutLand.viewingPoint.x,lookoutLand.viewingPoint.z,3],[-30,2,3],[-22,6,3],[-16,0,3],[-7,8,3]]});ledge.add(lookoutGroves.group);groveControllers.push(lookoutGroves);

// A quiet name is assembled from actual slender stone strokes and raycast
// onto the cliff. There is no rectangular sign or image masquerading as text.
const glyphs={N:[[0,0,0,1],[0,1,.6,0],[.6,0,.6,1]],O:[[.1,0,.5,0],[.5,0,.6,.15],[.6,.15,.6,.85],[.6,.85,.5,1],[.5,1,.1,1],[.1,1,0,.85],[0,.85,0,.15],[0,.15,.1,0]],T:[[0,1,.6,1],[.3,1,.3,0]],S:[[.6,1,.1,1],[.1,1,0,.8],[0,.8,.1,.55],[.1,.55,.5,.45],[.5,.45,.6,.2],[.6,.2,.5,0],[.5,0,0,0]],A:[[0,0,.3,1],[.3,1,.6,0],[.13,.43,.47,.43]],L:[[0,1,0,0],[0,0,.6,0]],Y:[[0,1,.3,.55],[.6,1,.3,.55],[.3,.55,.3,0]]};
scene.updateMatrixWorld(true);
const ray=new THREE.Raycaster();const cliff=terrain.group.getObjectByName('continuous-eroded-cliff');
const word = [...'NOTSALTYLOL'];
let inscription = null;
for (const baseY of [-.55,-1.2,-1.9]) for (const baseCenter of [-4.1,-3.1,-2.1,-1.1]) {
 const y=baseY*HEIGHT_SCALE,center=baseCenter*LAND_SCALE;
 const hits=word.map((_,i)=>{ray.set(new THREE.Vector3(center+(i-5)*.19*LAND_SCALE,y,12*LAND_SCALE),new THREE.Vector3(0,0,-1));return ray.intersectObject(cliff)[0];});
 if(hits.some(hit=>!hit||hit.face.normal.z<.6))continue;
 const normal=hits.reduce((sum,hit)=>sum.add(hit.face.normal),new THREE.Vector3()).normalize();
 const start=hits[0].point.z,end=hits[10].point.z;
 const score=hits.reduce((sum,hit,i)=>sum+Math.abs(hit.point.z-(start+(end-start)*i/10))+(1-hit.face.normal.dot(normal)),0);
 if(!inscription||score<inscription.score)inscription={hits,normal,score};
}
if(inscription)word.forEach((letter,index)=>{
 const hit=inscription.hits[index],g=new THREE.Group();
 const facing=(hit.normal||hit.face.normal).clone().normalize();
 const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),facing).normalize();
 const up=new THREE.Vector3().crossVectors(facing,right).normalize();
 g.position.copy(hit.point).addScaledVector(facing,.20);
 g.scale.setScalar(LAND_SCALE);
 g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,facing));
 for(const [x1,y1,x2,y2] of glyphs[letter]){
  const a=new THREE.Vector3((x1-.3)*.24,y1*.30-.15,0),b=new THREE.Vector3((x2-.3)*.24,y2*.30-.15,0);
  const stroke=new THREE.Mesh(new THREE.CylinderGeometry(.011,.011,a.distanceTo(b),6),m.stoneLight);
  stroke.position.copy(a).add(b).multiplyScalar(.5);stroke.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());g.add(stroke);
 }
 scene.add(g);
});

// A painted environment surrounds the actual 3D terrain throughout the orbit.
const atmosphere=createAtmosphere(THREE,{
 scale:LAND_SCALE,sunDirection:sunOffset.clone().normalize(),
 textureUrl:new URL('./sky-panorama-v2.png',import.meta.url).href
});
scene.add(atmosphere.group);

// Soft mist at the waterfall foot is a small particle effect in 3D space.
const mistTexture=document.createElement('canvas');mistTexture.width=mistTexture.height=64;const ctx=mistTexture.getContext('2d');const grad=ctx.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(255,255,255,.5)');grad.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
const mistMap=new THREE.CanvasTexture(mistTexture);
const mistMaterials=[.11,.17,.23].map(opacity=>new THREE.SpriteMaterial({map:mistMap,color:0xe5f7ed,transparent:true,opacity,depthWrite:false}));
// Unequal thin spray veils overlap down the lower fall, rather than forming
// one opaque ball at a fixed endpoint. Every drift returns after one orbit.
const mists=[];for(let i=0;i<12;i++){
 const mist=new THREE.Sprite(mistMaterials[i%3]);
 mist.scale.set((.45+(i%4)*.19)*HEIGHT_SCALE,(.65+(i%3)*.19)*HEIGHT_SCALE,1);
 scene.add(mist);mists.push(mist);
}

// Depth silhouettes and fine paper grain are applied once after the shared
// three-dimensional scene is rendered.
const target=new THREE.WebGLRenderTarget(renderWidth,renderHeight,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
target.depthTexture=new THREE.DepthTexture(renderWidth,renderHeight);target.depthTexture.type=THREE.UnsignedIntType;
target.samples = 4;
// A waterfall-only mask carries the true animated alpha. The opaque depth
// rejects hidden water, while transparent openings leave the cliff ink intact.
const waterCoverageTarget=new THREE.WebGLRenderTarget(renderWidth,renderHeight,{
 minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false,
});
const waterCoverageScene=new THREE.Scene();
const sourceWaterfall=terrain.group.getObjectByName('rolling-turbulent-waterfall');
const waterCoverageMaterial=m.waterfall.userData.coverageMaterial;
waterCoverageMaterial.uniforms.uOpaqueDepth.value=target.depthTexture;
waterCoverageMaterial.uniforms.uCoverageResolution.value.set(renderWidth,renderHeight);
const waterCoverageMesh=new THREE.Mesh(sourceWaterfall.geometry,waterCoverageMaterial);
waterCoverageMesh.matrixAutoUpdate=false;waterCoverageScene.add(waterCoverageMesh);
const savedClearColor=new THREE.Color();
const postUniforms={colorMap:{value:target.texture},depthMap:{value:target.depthTexture},waterCoverageMap:{value:waterCoverageTarget.texture},resolution:{value:new THREE.Vector2(renderWidth,renderHeight)},pixelRatio:{value:renderScale},ink:{value:0},inkColor:{value:new THREE.Color()},paper:{value:0},cameraNear:{value:camera.near},cameraFar:{value:camera.far}};
const postMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:postUniforms,
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`varying vec2 vUv;uniform sampler2D colorMap,depthMap,waterCoverageMap;uniform vec2 resolution;uniform vec3 inkColor;uniform float ink,paper,pixelRatio,cameraNear,cameraFar;
 // Convert the perspective depth buffer to normalized view-space distance
 // before detecting contours; raw perspective depth loses detail at this scale.
 float depthAt(vec2 uv){float raw=texture2D(depthMap,uv).r;return cameraNear/(cameraFar-(cameraFar-cameraNear)*raw);}
 void main(){
  vec2 uv=vUv,px=pixelRatio/resolution;vec3 c=texture2D(colorMap,uv).rgb;
  float d=depthAt(uv),edge=0.;
  edge=max(edge,abs(d-depthAt(uv+vec2(px.x,0.))));edge=max(edge,abs(d-depthAt(uv-vec2(px.x,0.))));
  edge=max(edge,abs(d-depthAt(uv+vec2(0.,px.y))));edge=max(edge,abs(d-depthAt(uv-vec2(0.,px.y))));
  if(ink>0.){
   float water=texture2D(waterCoverageMap,uv).r;
   float left=texture2D(waterCoverageMap,uv-vec2(px.x,0.)).r,right=texture2D(waterCoverageMap,uv+vec2(px.x,0.)).r;
   float up=texture2D(waterCoverageMap,uv+vec2(0.,px.y)).r,down=texture2D(waterCoverageMap,uv-vec2(0.,px.y)).r;
   // Ink lies underneath translucent water, rather than over its final color.
   // Turbulent water scatters fine contours more than broad color, so attenuate
   // contrast twice by its transmittance. Clear gaps preserve the original ink.
   // A very quiet alpha contour retains the liquid edge without outlining foam.
   float waterEdge=max(abs(left-right),abs(up-down));
   float transmission=1.-water;
   float contour=smoothstep(.0005,.008,edge)*transmission*transmission;
   contour+=smoothstep(.12,.65,waterEdge)*water*.10;
   c=mix(c,inkColor,clamp(contour*ink,0.,1.));
  }
  float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
  c*=1.+grain*paper;gl_FragColor=vec4(c,1.);
 #include <colorspace_fragment>
 }`});
const postScene=new THREE.Scene(),postCamera=new THREE.Camera();postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),postMaterial));

const descriptions={original:'Golden stone, olive gardens, matte pigment and warm sunlight.',fantasy:'Lush green terrain, soft toon shading, colored shadows and luminous water.',ink:'Cream and olive surfaces, crisp light bands and fine depth outlines.',cozy:'Gentle pastel colors, nearly flat illumination and soft contour lines.',ghibli:'Warm painted sunlight, natural greens, soft cool shadows and cream clouds.'};
window.castleStyles=Object.keys(STYLES);window.castleState={style:DEFAULT_STYLE,mode:'3d',geometry:true,landScale:LAND_SCALE,landAreaScale:LAND_SCALE*LAND_SCALE,view:'overview'};
let sceneReady=false;
window.setStyle=(id,{persist=true}={})=>{
 if(!Object.hasOwn(STYLES,id))throw new Error('Unknown castle style: '+id);
 const preset=palette.setStyle(id);foregroundGrass.color.copy(m.grass.color).multiplyScalar(.78);scene.fog.color.setHex(preset.fog);ambient.intensity=preset.ambient;sunlight.intensity=preset.sunlight;
 // Separate the far landforms with aerial perspective. Nearby architecture
 // keeps its full pigment contrast when the camera dollies into a close view.
 const fogRange={original:[34,95],fantasy:[36,95],ink:[36,110],cozy:[30,95],ghibli:[34,95]}[id];
 scene.fog.near=fogRange[0]*LAND_SCALE;scene.fog.far=fogRange[1]*LAND_SCALE;
 document.body.style.backgroundColor=new THREE.Color(preset.fog).lerp(new THREE.Color(0xfffbf1),.66).getStyle();
 atmosphere.setStyle(preset,id);
 postUniforms.ink.value=preset.outlineOpacity;postUniforms.inkColor.value.setHex(preset.outline);postUniforms.paper.value=id==='ink'?.035:id==='cozy'?.012:id==='ghibli'?.012:0;
 document.querySelectorAll('[data-style]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.style===id)));
 document.getElementById('description').textContent=descriptions[id];document.getElementById('illustration-link').href='./animation.html?style='+id;
 if(persist&&!capture){const url=new URL(location.href);url.searchParams.set('style',id);history.replaceState(null,'',url);try{localStorage.setItem('castle-3d-style',id);}catch{}}
 window.castleState.style=id;renderer.shadowMap.needsUpdate=true;
 if(sceneReady)window.renderFrame(window.castleState.phase||0);
};
for(const [id,preset] of Object.entries(STYLES)){const button=document.createElement('button');button.type='button';button.dataset.style=id;button.textContent=preset.label;button.addEventListener('click',()=>window.setStyle(id));document.getElementById('style-picker').append(button);}
let preferred=params.get('style');if(!preferred&&!capture){try{preferred=localStorage.getItem('castle-3d-style');}catch{}}
window.setStyle(Object.hasOwn(STYLES,preferred)?preferred:DEFAULT_STYLE,{persist:false});
const focus=new THREE.Vector3(),cameraRight=new THREE.Vector3(),cameraUp=new THREE.Vector3(),cameraDirection=new THREE.Vector3();
let shadowZoom=-1,detailShadowRevision=-1;const shadowFocus=new THREE.Vector3(Infinity,Infinity,Infinity);
let azimuthOffset=.24,elevation=.37,zoom=1,elapsed=0,last=performance.now(),paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
// Keep the near-horizontal Lookout orbit valid after a pan or horizontal drag.
// Other presets retain the normal above-island elevation limits.
let lookoutOrbit=false;
const minimumElevation=()=>lookoutOrbit?-.65:.12;
window.animationConfig={duration:DURATION,fps:12};
try{
 const [skyTexture]=await Promise.all([atmosphere.ready,meadowReady,rockReady]);
 palette.setSkyTexture(skyTexture);
}catch(error){
 document.getElementById('loading').textContent='The painted textures could not load. Reload to try again.';
 throw error;
}
window.renderFrame=phase=>{
 const cycle=phase-Math.floor(phase),t=cycle*Math.PI*2;
 // Flow stays lively during the slow camera orbit; eight water cycles still
 // meet the camera at exactly the same seamless loop boundary.
 palette.animate(cycle*8);palette.animateLight(cycle);atmosphere.animate(cycle);
 window.castleState.phase=cycle;
 const angle=t+azimuthOffset;camera.position.set(Math.sin(angle)*32*LAND_SCALE/zoom,(Math.sin(elevation)*32*LAND_SCALE+1)/zoom,Math.cos(angle)*32*LAND_SCALE/zoom).add(focus);camera.updateProjectionMatrix();camera.lookAt(focus);camera.updateMatrixWorld(true);
 const visibleWidth=2*camera.position.distanceTo(focus)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect;
 terrain.updateDetail?.(camera,visibleWidth);landscapeDetails.updateDetail?.(camera,visibleWidth);botany.updateDetail?.(camera,visibleWidth);foreground.updateDetail(camera,visibleWidth);
 for(const controller of groveControllers)controller.updateDetail(camera,visibleWidth);
 landscapeDetails.animate(cycle);botany.animate(cycle);
 for(const controller of travelerControllers)controller.animate(cycle);
 const nextShadowRevision=groveControllers.reduce((sum,controller)=>sum+controller.stats.shadowRevision,0)
   +(terrain.detailStats.shadowRevision||0)+(foreground.stats.shadowRevision||0)+(landscapeDetails.stats.shadowRevision||0);
 if(nextShadowRevision!==detailShadowRevision){renderer.shadowMap.needsUpdate=true;detailShadowRevision=nextShadowRevision;}
 if(zoom!==shadowZoom||!focus.equals(shadowFocus)){
  sunlight.position.copy(sunOffset).add(focus);sunlight.target.position.copy(focus);
  const span=Math.max(18,18*LAND_SCALE/zoom);Object.assign(sunlight.shadow.camera,{left:-span,right:span,top:span,bottom:-span});sunlight.shadow.camera.updateProjectionMatrix();
  sunlight.shadow.normalBias=Math.max(.01,span*4/sunlight.shadow.mapSize.x);renderer.shadowMap.needsUpdate=true;shadowZoom=zoom;shadowFocus.copy(focus);
 }
 window.castleState.zoom=zoom;window.castleState.focus=focus.toArray();
 mists.forEach((mist,i)=>{
  const a=i*2.4+t,fall=(i+.5)/12;
  mist.position.set(terrain.lip.x+Math.sin(a)*(.10+.24*fall)*LAND_SCALE,
   terrain.waterLevel-(5.8+fall*1.5)*HEIGHT_SCALE+Math.sin(t+i)*.18*HEIGHT_SCALE,
   terrain.lip.z+(.14+.30*fall+Math.cos(a)*.12)*LAND_SCALE);
 });
 renderer.info.reset();renderer.setRenderTarget(target);renderer.render(scene,camera);
 if(postUniforms.ink.value>0){
  waterCoverageMesh.matrix.copy(sourceWaterfall.matrixWorld);
  renderer.getClearColor(savedClearColor);const savedClearAlpha=renderer.getClearAlpha();
  renderer.setClearColor(0,0);renderer.setRenderTarget(waterCoverageTarget);renderer.render(waterCoverageScene,camera);
  renderer.setClearColor(savedClearColor,savedClearAlpha);
 }
 renderer.setRenderTarget(null);renderer.render(postScene,postCamera);
 window.castleState.drawCalls=renderer.info.render.calls;window.castleState.triangles=renderer.info.render.triangles;
};
// Prepare existing offscreen material variants with the real color target and
// populated lights before showing the scene. Fine tree geometry stays lazy.
// Retain the instanced, double-sided shadow program used by distant leaves.
// This single-triangle proxy is compiled only and never added to the scene.
const shadowWarmupMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
const shadowWarmupGeometry=new THREE.BufferGeometry();
shadowWarmupGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
const shadowWarmupProxy=new THREE.InstancedMesh(shadowWarmupGeometry,shadowWarmupMaterial,1);
const warmupTarget=renderer.getRenderTarget();
renderer.setRenderTarget(target);
try{
 await renderer.compileAsync(scene,camera);
 // Shadow depth has no fog; match its context without changing the shown scene.
 const shadowWarmupFog=scene.fog;scene.fog=null;
 let shadowWarmupPending;
 try{shadowWarmupPending=renderer.compileAsync(shadowWarmupProxy,camera,scene);}finally{scene.fog=shadowWarmupFog;}
 await shadowWarmupPending;
}finally{
 renderer.setRenderTarget(warmupTarget);
 shadowWarmupGeometry.dispose();
}
window.renderFrame(0);sceneReady=true;
document.getElementById('loading')?.remove();renderer.domElement.style.visibility='visible';
const pause=document.getElementById('pause');function updatePause(){pause.textContent=paused?'Play motion':'Pause motion';pause.setAttribute('aria-pressed',String(paused));}updatePause();
pause.addEventListener('click',()=>{paused=!paused;updatePause();});
function selectView(id){
 azimuthOffset=.24;elevation=.37;elapsed=0;camera.fov=30;lookoutOrbit=id==='lookout';
 if(id==='castle'){focus.copy(terrain.castleAnchor);focus.y+=1.1;zoom=12;elevation=.43;}
 else if(id==='lake'){focus.set(1.5*LAND_SCALE,terrain.waterLevel,1.9*LAND_SCALE);zoom=7;elevation=.48;}
 else if(id==='lookout'){
  focus.set(0,-1.2*HEIGHT_SCALE,0);
  const direction=new THREE.Vector3(focus.x-lookoutStation.x,0,focus.z-lookoutStation.z).normalize();
  const right=new THREE.Vector3(-direction.z,0,direction.x);
  // These metre-scale offsets make the existing, unscaled people readable.
  // A wider lens holds the distant summit, floating tip, and nearby path.
  const eye=lookoutStation.clone().addScaledVector(direction,-7).addScaledVector(right,3);eye.y+=3;
  const offset=eye.sub(focus),radius=Math.hypot(offset.x,offset.z);
  zoom=32*LAND_SCALE/radius;azimuthOffset=Math.atan2(offset.x,offset.z);
  elevation=Math.asin((offset.y*zoom-1)/(32*LAND_SCALE));camera.fov=50;
 }
 else{focus.set(0,0,0);zoom=1;id='overview';}
 window.castleState.view=id;document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===id)));
 if(id!=='overview'){paused=true;updatePause();}window.renderFrame(0);
}
window.setView=selectView;
document.getElementById('reset-view').addEventListener('click',()=>selectView('overview'));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>selectView(button.dataset.view)));
function pan(dx,dy){
 camera.getWorldDirection(cameraDirection);cameraRight.crossVectors(cameraDirection,camera.up).normalize();cameraUp.crossVectors(cameraRight,cameraDirection).normalize();
 const units=2*camera.position.distanceTo(focus)*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect/renderer.domElement.clientWidth;focus.addScaledVector(cameraRight,-dx*units).addScaledVector(cameraUp,dy*units);
 window.castleState.view='custom';document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed','false'));
}
function changeZoom(factor){zoom=Math.max(.65,Math.min(16,zoom*factor));window.renderFrame(elapsed/(DURATION*1000));}
document.getElementById('zoom-in').addEventListener('click',()=>changeZoom(1.35));document.getElementById('zoom-out').addEventListener('click',()=>changeZoom(1/1.35));
let drag=null;
renderer.domElement.addEventListener('contextmenu',event=>event.preventDefault());
renderer.domElement.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,pan:event.shiftKey||event.button===2};renderer.domElement.setPointerCapture(event.pointerId);paused=true;updatePause();});
renderer.domElement.addEventListener('pointermove',event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(drag.pan)pan(dx,dy);else{azimuthOffset-=dx*.007;elevation=Math.max(minimumElevation(),Math.min(.9,elevation+dy*.005));}drag.x=event.clientX;drag.y=event.clientY;window.renderFrame(elapsed/(DURATION*1000));});
renderer.domElement.addEventListener('pointerup',()=>{drag=null;});renderer.domElement.addEventListener('pointercancel',()=>{drag=null;});
renderer.domElement.addEventListener('wheel',event=>{event.preventDefault();changeZoom(Math.exp(-event.deltaY*.001));},{passive:false});
renderer.domElement.addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(event.key))return;
 event.preventDefault();paused=true;updatePause();
 if(event.shiftKey&&event.key.startsWith('Arrow'))pan(event.key==='ArrowLeft'?35:event.key==='ArrowRight'?-35:0,event.key==='ArrowUp'?35:event.key==='ArrowDown'?-35:0);
 else{if(event.key==='ArrowLeft')azimuthOffset-=.08;if(event.key==='ArrowRight')azimuthOffset+=.08;if(event.key==='ArrowUp')elevation=Math.min(.9,elevation+.04);if(event.key==='ArrowDown')elevation=Math.max(minimumElevation(),elevation-.04);}
 if(event.key==='+'||event.key==='=')zoom=Math.min(16,zoom*1.2);if(event.key==='-')zoom=Math.max(.65,zoom/1.2);
 window.renderFrame(elapsed/(DURATION*1000));
});
if(!capture){
 // Match the visible canvas on phones as well as Retina desktops; a narrow
 // screen should not pay to render an invisible 1920-pixel-wide image.
 const resizeObserver=new ResizeObserver(()=>{
  const next=Math.min(window.devicePixelRatio||1,2)*Math.min(W,sceneContainer.clientWidth||W)/W;
  if(Math.abs(next-renderScale)<.001)return;
  renderScale=next;renderWidth=Math.floor(W*renderScale);renderHeight=Math.floor(H*renderScale);
  renderer.setPixelRatio(renderScale);target.setSize(renderWidth,renderHeight);waterCoverageTarget.setSize(renderWidth,renderHeight);
  waterCoverageMaterial.uniforms.uCoverageResolution.value.set(renderWidth,renderHeight);
  postUniforms.resolution.value.set(renderWidth,renderHeight);postUniforms.pixelRatio.value=renderScale;
  window.renderFrame(window.castleState.phase||0);
 });
 resizeObserver.observe(sceneContainer);
 renderer.setAnimationLoop(now=>{if(!paused){elapsed+=Math.min(now-last,100);window.renderFrame(elapsed/(DURATION*1000));}last=now;});
}
