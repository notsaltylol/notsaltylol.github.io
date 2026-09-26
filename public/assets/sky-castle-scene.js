import * as THREE from './vendor/three/three.module.js';
import { createMaterials } from './sky-castle-materials.js';
import { buildTerrain } from './sky-castle-terrain.js';
import { buildCastle, buildTree, buildPavilion } from './sky-castle-models.js';
import { buildLandscapeDetails } from './sky-castle-details.js';
import { buildGroves } from './sky-castle-groves.js';
import { buildBotany } from './sky-castle-botany.js';
import { fractalRock } from './sky-castle-geology.js';
import { buildForegroundDetails } from './sky-castle-foreground.js';
import { STYLES, DEFAULT_STYLE } from './castle-styles.js';

const W = 960, H = 600, DURATION = 60;
const LAND_SCALE=10, HEIGHT_SCALE=LAND_SCALE, HALF_WIDTH=14*LAND_SCALE;
const groveControllers=[];
const params = new URLSearchParams(location.search), capture = params.has('capture');
const renderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
renderer.setSize(W,H); renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.info.autoReset = false;
renderer.domElement.style.width = '100%'; renderer.domElement.style.height = 'auto';
renderer.domElement.style.touchAction = 'none';
renderer.domElement.tabIndex = 0;
renderer.domElement.setAttribute('aria-label','3D sky castle. Drag or use arrow keys to orbit. Shift-drag or shift-arrow to pan. Use plus and minus to zoom.');
document.getElementById('scene').appendChild(renderer.domElement);
document.getElementById('loading')?.remove();
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xb4dce4, 40*LAND_SCALE, 90*LAND_SCALE);
const camera = new THREE.OrthographicCamera(-HALF_WIDTH,HALF_WIDTH,HALF_WIDTH*H/W,-HALF_WIDTH*H/W,.1,180*LAND_SCALE);
const palette = createMaterials(THREE), m = palette.materials;
palette.setWorldScale(LAND_SCALE,HEIGHT_SCALE);
const ambient = new THREE.HemisphereLight(0xfff3d7,0x739aaa,1.45);
const sunlight = new THREE.DirectionalLight(0xfff0d3,2.8);
sunlight.position.set(-10*LAND_SCALE,18*LAND_SCALE,12*LAND_SCALE); sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048,2048);
Object.assign(sunlight.shadow.camera,{left:-16*LAND_SCALE,right:16*LAND_SCALE,top:17*LAND_SCALE,bottom:-14*LAND_SCALE,near:1,far:60*LAND_SCALE});
sunlight.shadow.bias = -.00015; sunlight.shadow.normalBias = .035;
scene.add(ambient,sunlight,sunlight.target);
const terrain = buildTerrain(THREE,m,{scale:LAND_SCALE}); scene.add(terrain.group);
const landscapeDetails = buildLandscapeDetails(THREE,m,terrain); scene.add(landscapeDetails.group);
const botany = buildBotany(THREE,m,terrain); scene.add(botany.group);
const castle = buildCastle(THREE,m); castle.scale.setScalar(.64);
castle.position.copy(terrain.castleAnchor); castle.position.y-=.09;castle.rotation.y = .17;
scene.add(castle);

// Unequal tree silhouettes follow the actual height field and frame the hill.
const trees = [[-4.8,-1.2,1.7,'cypress'],[-4.1,.4,1.35,'cypress'],[-2.1,-2.8,1.45,'cypress'],[-1.0,-3.8,1.6,'broadleaf'],[2.8,-3.1,1.2,'broadleaf'],[4.7,-1.8,1.8,'broadleaf'],[4.5,1.4,1.1,'cypress'],[-4.8,2,1.25,'broadleaf'],[-.9,3.5,.9,'broadleaf']];
for(let i=0;i<trees.length;i++) {
  const [x,z,height,kind]=trees[i]; const tree=buildTree(THREE,m,{height,kind,seed:i*17+3});
  tree.position.set(x*LAND_SCALE,terrain.height(x*LAND_SCALE,z*LAND_SCALE),z*LAND_SCALE); scene.add(tree);
}
const pavilion=buildPavilion(THREE,m);pavilion.scale.setScalar(.64);pavilion.position.set(4.1*LAND_SCALE,terrain.height(4.1*LAND_SCALE,-2.6*LAND_SCALE),-2.6*LAND_SCALE);scene.add(pavilion);
const groves=buildGroves(THREE,m,terrain,{buildTree,count:900,reservedPositions:trees.map(([x,z])=>[x*LAND_SCALE,z*LAND_SCALE,1.3])});scene.add(groves.group);groveControllers.push(groves);

// Smaller formations use the same geology at a lighter amplitude. Their rims
// stay fixed beneath the meadow caps; erosion appears below the planted surface.
function satellite(x,y,z,scale) {
  const group=new THREE.Group(); group.position.set(x*LAND_SCALE,y*HEIGHT_SCALE,z*LAND_SCALE);group.scale.setScalar(scale);
  const p=[],ix=[],uv=[],n=160,rr=64;
  for(let j=0;j<=rr;j++)for(let i=0;i<=n;i++){
    const a=i/n*Math.PI*2,t=j/rr,base=(1.4+.11*Math.sin(a*5))*Math.pow(1-t,.63);
    const erosion=fractalRock(Math.cos(a)*base*LAND_SCALE+x,-t*3.8*HEIGHT_SCALE,Math.sin(a)*base*LAND_SCALE+z);
    const mask=Math.sin(t*Math.PI),r=base*LAND_SCALE+erosion*.22*mask;
    p.push(Math.cos(a)*r,(-2.1*t+.07*Math.sin(a*3)*mask)*HEIGHT_SCALE+erosion*.08*mask,Math.sin(a)*r*.82);uv.push(i/n,t);
    if(j<rr&&i<n){const q=j*(n+1)+i;ix.push(q,q+1,q+n+1,q+1,q+n+2,q+n+1);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(ix);geo.computeVertexNormals();
  const normals=geo.attributes.normal;
  for(let j=0;j<=rr;j++){const first=j*(n+1),last=first+n;const normal=new THREE.Vector3().fromBufferAttribute(normals,first).add(new THREE.Vector3().fromBufferAttribute(normals,last)).normalize();normals.setXYZ(first,normal.x,normal.y,normal.z);normals.setXYZ(last,normal.x,normal.y,normal.z);}
  const rock=new THREE.Mesh(geo,m.rock);rock.name='satellite-fractal-rock';rock.castShadow=rock.receiveShadow=true;group.add(rock);
  const grass=new THREE.Mesh(new THREE.SphereGeometry(1.4,32,16,0,Math.PI*2,0,Math.PI/2),m.grass);grass.scale.set(LAND_SCALE,.15*HEIGHT_SCALE,.82*LAND_SCALE);group.add(grass);
  const temple=buildPavilion(THREE,m);temple.scale.setScalar(.64);temple.position.y=.21*HEIGHT_SCALE-.025;group.add(temple);
  const capHeight=(xx,zz)=>.21*HEIGHT_SCALE*Math.sqrt(Math.max(0,1-(xx/(1.4*LAND_SCALE))**2-(zz/(1.4*.82*LAND_SCALE))**2));
  const tree=buildTree(THREE,m,{height:.85,kind:'cypress',seed:43});tree.position.set(-.7*LAND_SCALE,capHeight(-.7*LAND_SCALE,-.25*LAND_SCALE),-.25*LAND_SCALE);group.add(tree);
  const capTerrain={scale:LAND_SCALE,verticalScale:HEIGHT_SCALE,height:capHeight,waterLevel:-1000,
    radius:a=>1.4*LAND_SCALE/Math.hypot(Math.cos(a),Math.sin(a)/.82),
    contains:(xx,zz,margin=0)=>Math.hypot(xx,zz/.82)<1.4*LAND_SCALE-margin};
  const grove=buildGroves(THREE,m,capTerrain,{buildTree,count:100,islandKind:'satellite',reservedPositions:[[0,0,1],[-.7*LAND_SCALE,-.25*LAND_SCALE,.8]]});group.add(grove.group);groveControllers.push(grove);
  scene.add(group);return group;
}
satellite(10,-.2,-4,.92);satellite(-11,-1.7,-6,.64);satellite(4,-1.8,-13,.45);

// Brass celestial mechanism, deliberately subordinate to the castle silhouette.
const machine=new THREE.Group(); machine.position.set(-.8*LAND_SCALE,terrain.height(-.8*LAND_SCALE,-2.8*LAND_SCALE),-2.8*LAND_SCALE);
const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.23,.33,.4,24),m.stone);pedestal.position.y=.2;machine.add(pedestal);
for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.37,.018,6,48),m.gold);ring.position.y=.7;ring.rotation.set(i*.8,i*.6,.25);machine.add(ring);}scene.add(machine);

// Tiny geometric travelers establish scale without dominating the diorama.
function traveler(x,z,scale,groundY=null) {
 const g=new THREE.Group();g.scale.setScalar(scale);g.position.set(x,groundY??terrain.height(x,z),z);
 const body=new THREE.Mesh(new THREE.ConeGeometry(.12,.35,12),m.roof);body.position.y=.24;g.add(body);
 const head=new THREE.Mesh(new THREE.SphereGeometry(.068,12,8),m.stoneLight);head.position.y=.48;g.add(head);
 const staff=new THREE.Mesh(new THREE.CylinderGeometry(.011,.014,.49,6),m.wood);staff.position.set(.13,.24,0);g.add(staff);scene.add(g);
}
traveler(-.85*LAND_SCALE,2.8*LAND_SCALE,1);traveler(-.56*LAND_SCALE,2.87*LAND_SCALE,.72);

// A genuine foreground viewing ledge contributes the darkest depth layer.
// It remains in world space, so orbiting reveals its relationship to the island.
const ledge=new THREE.Group();ledge.position.set(-8*LAND_SCALE,-3.7*HEIGHT_SCALE,10.5*LAND_SCALE);
for(const [upper,material,vertical] of [[true,m.leaf,.65*HEIGHT_SCALE],[false,m.rock,2.1*HEIGHT_SCALE]]){
 const columns=upper?224:448,rows=upper?72:112;
 const geo=new THREE.SphereGeometry(1,columns,rows,0,Math.PI*2,upper?0:Math.PI/2,Math.PI/2);
 const p=geo.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),warp=1+.05*Math.sin(Math.atan2(z,x)*5)+.025*Math.cos(x*9+z*4);
  const px=x*9.5*LAND_SCALE*warp,pz=z*2.5*LAND_SCALE*warp;
  const erosion=upper?0:fractalRock(px*.7,y*vertical*.9,pz*.8+12)*Math.sin(Math.min(1,Math.abs(y))*Math.PI);
  p.setXYZ(i,px+erosion*x*.24,y*vertical+erosion*.12,pz+erosion*z*.24);
 }
 if(!upper){
  // Subdivide the exact existing meadow boundary. Resampling its curved outline
  // at a higher resolution would otherwise leave a hairline gap between meshes.
  const rim=ledge.children[0].geometry.attributes.position,offset=rim.count-225;
  for(let i=0;i<=columns;i++){
   const edge=i/2,left=Math.floor(edge),right=Math.min(224,left+1),blend=edge-left;
   p.setXYZ(i,THREE.MathUtils.lerp(rim.getX(offset+left),rim.getX(offset+right),blend),THREE.MathUtils.lerp(rim.getY(offset+left),rim.getY(offset+right),blend),THREE.MathUtils.lerp(rim.getZ(offset+left),rim.getZ(offset+right),blend));
  }
 }
 geo.computeVertexNormals();
 const normals=geo.attributes.normal;
 for(let row=0;row<=rows;row++){
  const first=row*(columns+1),last=first+columns,n=new THREE.Vector3().fromBufferAttribute(normals,first).add(new THREE.Vector3().fromBufferAttribute(normals,last)).normalize();
  normals.setXYZ(first,n.x,n.y,n.z);normals.setXYZ(last,n.x,n.y,n.z);
 }
 const mesh=new THREE.Mesh(geo,material);mesh.name=upper?'lookout-meadow':'lookout-fractal-rock';mesh.castShadow=mesh.receiveShadow=true;ledge.add(mesh);
}scene.add(ledge);
const foreground = buildForegroundDetails(THREE,m,ledge,{scale:LAND_SCALE}); scene.add(foreground.group);
for(const [i,x,z,height] of [[0,-11.0,10.7,1.25],[1,-10.2,11.1,.9],[2,-9.6,10.5,1.4],[3,-8.7,11.3,1.05]]){const tree=buildTree(THREE,m,{height,kind:'broadleaf',seed:79+i});tree.position.set(x*LAND_SCALE,foreground.groundHeight(x*LAND_SCALE,z*LAND_SCALE)-.025,z*LAND_SCALE);scene.add(tree);}
traveler(-6.9*LAND_SCALE,10.45*LAND_SCALE,1.5,foreground.groundHeight(-6.9*LAND_SCALE,10.45*LAND_SCALE));traveler(-6.45*LAND_SCALE,10.46*LAND_SCALE,1.0,foreground.groundHeight(-6.45*LAND_SCALE,10.46*LAND_SCALE));
const lookoutTerrain={scale:LAND_SCALE,verticalScale:HEIGHT_SCALE,waterLevel:-1000,
 height:(x,z)=>foreground.groundHeight(x+ledge.position.x,z+ledge.position.z)-ledge.position.y,
 radius:a=>LAND_SCALE/Math.hypot(Math.cos(a)/9.2,Math.sin(a)/2.3),
 contains:(x,z,margin=0)=>Math.hypot(x/(9.2*LAND_SCALE-margin),z/(2.3*LAND_SCALE-margin))<1};
const lookoutGroves=buildGroves(THREE,m,lookoutTerrain,{buildTree,count:400,islandKind:'satellite',reservedPositions:[[11,-.5,3],[15.5,-.4,3],[-30,2,3],[-22,6,3],[-16,0,3],[-7,8,3]]});ledge.add(lookoutGroves.group);groveControllers.push(lookoutGroves);

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
 g.position.copy(hit.point).addScaledVector(inscription.normal,.08);
 g.scale.setScalar(LAND_SCALE);
 g.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),inscription.normal);
 for(const [x1,y1,x2,y2] of glyphs[letter]){
  const a=new THREE.Vector3((x1-.3)*.24,y1*.30-.15,0),b=new THREE.Vector3((x2-.3)*.24,y2*.30-.15,0);
  const stroke=new THREE.Mesh(new THREE.CylinderGeometry(.011,.011,a.distanceTo(b),6),m.stoneLight);
  stroke.position.copy(a).add(b).multiplyScalar(.5);stroke.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());g.add(stroke);
 }
 scene.add(g);
});

// Procedural atmosphere surrounds the scene in every direction. Clouds are
// shaded soft fields on a sky dome; the land and architecture are actual meshes.
const skyUniforms={high:{value:new THREE.Color()},low:{value:new THREE.Color()},cloud:{value:new THREE.Color()},time:{value:0}};
const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:skyUniforms,
 vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`varying vec3 direction;uniform vec3 high,low,cloud;uniform float time;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 float fbm(vec2 p){return .55*noise(p)+.28*noise(p*2.03)+.12*noise(p*4.01)+.05*noise(p*8.1);}
 void main(){vec3 d=normalize(direction);float h=clamp((d.y+.5)*1.7,0.,1.);vec3 c=mix(low,high,smoothstep(0.,.85,h));vec2 p=vec2(atan(d.z,d.x)*11.,d.y*31.);float n=fbm(p*1.4+vec2(.03*sin(time),0.));float a=smoothstep(.43,.63,n)*(1.-smoothstep(.35,.8,d.y));vec3 shade=mix(cloud*.74,cloud,smoothstep(.40,.62,n));c=mix(c,shade,a*.94);gl_FragColor=vec4(c,1.);
 #include <colorspace_fragment>
 }`});
const sky=new THREE.Mesh(new THREE.SphereGeometry(100*LAND_SCALE,40,24),skyMaterial);sky.renderOrder=-10;scene.add(sky);

// Soft mist at the waterfall foot is a small particle effect in 3D space.
const mistTexture=document.createElement('canvas');mistTexture.width=mistTexture.height=64;const ctx=mistTexture.getContext('2d');const grad=ctx.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(255,255,255,.5)');grad.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
const mistMaterial=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(mistTexture),color:0xe5f7ed,transparent:true,opacity:.32,depthWrite:false});
const mists=[];for(let i=0;i<12;i++){const mist=new THREE.Sprite(mistMaterial);mist.scale.set(1.3*HEIGHT_SCALE,1.0*HEIGHT_SCALE,1);scene.add(mist);mists.push(mist);}

// Depth silhouettes and fine paper grain are applied once after the shared
// three-dimensional scene is rendered.
const target=new THREE.WebGLRenderTarget(W,H,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter});
target.depthTexture=new THREE.DepthTexture(W,H);target.depthTexture.type=THREE.UnsignedIntType;
target.samples = 4;
const postUniforms={colorMap:{value:target.texture},depthMap:{value:target.depthTexture},resolution:{value:new THREE.Vector2(W,H)},ink:{value:0},inkColor:{value:new THREE.Color()},paper:{value:0}};
const postMaterial=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:postUniforms,
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
 fragmentShader:`varying vec2 vUv;uniform sampler2D colorMap,depthMap;uniform vec2 resolution;uniform vec3 inkColor;uniform float ink,paper;
 void main(){vec2 uv=vUv;vec2 px=1./resolution;vec3 c=texture2D(colorMap,uv).rgb;float d=texture2D(depthMap,uv).r;float edge=0.;edge=max(edge,abs(d-texture2D(depthMap,uv+vec2(px.x,0.)).r));edge=max(edge,abs(d-texture2D(depthMap,uv-vec2(px.x,0.)).r));edge=max(edge,abs(d-texture2D(depthMap,uv+vec2(0.,px.y)).r));edge=max(edge,abs(d-texture2D(depthMap,uv-vec2(0.,px.y)).r));c=mix(c,inkColor,smoothstep(.0005,.008,edge)*ink);float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;c*=1.+grain*paper;gl_FragColor=vec4(c,1.);
 #include <colorspace_fragment>
 }`});
const postScene=new THREE.Scene(),postCamera=new THREE.Camera();postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),postMaterial));

const descriptions={original:'Golden stone, olive gardens, matte pigment and warm sunlight.',fantasy:'Lush green terrain, soft toon shading, colored shadows and luminous water.',ink:'Cream and olive surfaces, crisp light bands and fine depth outlines.',cozy:'Gentle pastel colors, nearly flat illumination and soft contour lines.',ghibli:'Warm painted sunlight, natural greens, soft cool shadows and cream clouds.'};
window.castleStyles=Object.keys(STYLES);window.castleState={style:DEFAULT_STYLE,mode:'3d',geometry:true,landScale:LAND_SCALE,landAreaScale:LAND_SCALE*LAND_SCALE,view:'overview'};
window.setStyle=(id,{persist=true}={})=>{
 if(!Object.hasOwn(STYLES,id))throw new Error('Unknown castle style: '+id);
 const preset=palette.setStyle(id);scene.fog.color.setHex(preset.fog);ambient.intensity=preset.ambient;sunlight.intensity=preset.sunlight;
 skyUniforms.high.value.setHex(preset.sky);skyUniforms.low.value.setHex(preset.fog);skyUniforms.cloud.value.setHex(preset.cloud);
 if(id==='fantasy'){skyUniforms.high.value.setHex(0x2589d7);skyUniforms.low.value.setHex(0x8cd2e9);}
 postUniforms.ink.value=preset.outlineOpacity;postUniforms.inkColor.value.setHex(preset.outline);postUniforms.paper.value=id==='ink'?.035:id==='cozy'?.012:id==='ghibli'?.012:0;
 document.querySelectorAll('[data-style]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.style===id)));
 document.getElementById('description').textContent=descriptions[id];document.getElementById('illustration-link').href='./animation.html?style='+id;
 if(persist&&!capture){const url=new URL(location.href);url.searchParams.set('style',id);history.replaceState(null,'',url);try{localStorage.setItem('castle-3d-style',id);}catch{}}
 window.castleState.style=id;renderer.shadowMap.needsUpdate=true;
 if(window.renderFrame)window.renderFrame(window.castleState.phase||0);
};
for(const [id,preset] of Object.entries(STYLES)){const button=document.createElement('button');button.type='button';button.dataset.style=id;button.textContent=preset.label;button.addEventListener('click',()=>window.setStyle(id));document.getElementById('style-picker').append(button);}
let preferred=params.get('style');if(!preferred&&!capture){try{preferred=localStorage.getItem('castle-3d-style');}catch{}}
window.setStyle(Object.hasOwn(STYLES,preferred)?preferred:DEFAULT_STYLE,{persist:false});
const focus=new THREE.Vector3(),cameraRight=new THREE.Vector3(),cameraUp=new THREE.Vector3(),cameraDirection=new THREE.Vector3();
let shadowZoom=-1,groveShadowRevision=-1;const shadowFocus=new THREE.Vector3(Infinity,Infinity,Infinity);
let azimuthOffset=.24,elevation=.37,zoom=1,elapsed=0,last=performance.now(),paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
window.animationConfig={duration:DURATION,fps:12};
window.renderFrame=phase=>{
 const cycle=phase-Math.floor(phase),t=cycle*Math.PI*2;
 // Flow stays lively during the slow camera orbit; eight water cycles still
 // meet the camera at exactly the same seamless loop boundary.
 palette.animate(cycle*8);skyUniforms.time.value=t;
 window.castleState.phase=cycle;
 const angle=t+azimuthOffset;camera.position.set(Math.sin(angle)*32*LAND_SCALE,Math.sin(elevation)*32*LAND_SCALE+1,Math.cos(angle)*32*LAND_SCALE).add(focus);camera.zoom=zoom;camera.updateProjectionMatrix();camera.lookAt(focus);camera.updateMatrixWorld(true);
 const visibleWidth=HALF_WIDTH*2/zoom;
 terrain.updateDetail?.(camera,visibleWidth);landscapeDetails.updateDetail?.(camera,visibleWidth);botany.updateDetail?.(camera,visibleWidth);foreground.updateDetail(camera,visibleWidth);
 for(const controller of groveControllers)controller.updateDetail(camera,visibleWidth);
 landscapeDetails.animate(cycle);botany.animate(cycle);
 const nextShadowRevision=groveControllers.reduce((sum,controller)=>sum+controller.stats.shadowRevision,0);
 if(nextShadowRevision!==groveShadowRevision){renderer.shadowMap.needsUpdate=true;groveShadowRevision=nextShadowRevision;}
 if(zoom!==shadowZoom||!focus.equals(shadowFocus)){
  sunlight.position.set(-10*LAND_SCALE,18*LAND_SCALE,12*LAND_SCALE).add(focus);sunlight.target.position.copy(focus);
  const span=Math.max(18,18*LAND_SCALE/zoom);Object.assign(sunlight.shadow.camera,{left:-span,right:span,top:span,bottom:-span});sunlight.shadow.camera.updateProjectionMatrix();
  sunlight.shadow.normalBias=zoom>4?.018:.05;renderer.shadowMap.needsUpdate=true;shadowZoom=zoom;shadowFocus.copy(focus);
 }
 window.castleState.zoom=zoom;window.castleState.focus=focus.toArray();
 mists.forEach((mist,i)=>{const a=i*2.4+t;mist.position.set(terrain.lip.x+Math.sin(a)*.35*HEIGHT_SCALE,-5.8*HEIGHT_SCALE+Math.sin(t+i)*.18*HEIGHT_SCALE,terrain.lip.z+.5*HEIGHT_SCALE+Math.cos(a)*.20*HEIGHT_SCALE);});
 renderer.info.reset();renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(postScene,postCamera);
 window.castleState.drawCalls=renderer.info.render.calls;window.castleState.triangles=renderer.info.render.triangles;
};
window.renderFrame(0);
const pause=document.getElementById('pause');function updatePause(){pause.textContent=paused?'Play motion':'Pause motion';pause.setAttribute('aria-pressed',String(paused));}updatePause();
pause.addEventListener('click',()=>{paused=!paused;updatePause();});
function selectView(id){
 azimuthOffset=.24;elevation=.37;elapsed=0;
 if(id==='castle'){focus.copy(terrain.castleAnchor);focus.y+=1.1;zoom=12;elevation=.43;}
 else if(id==='lake'){focus.set(1.5*LAND_SCALE,terrain.waterLevel,1.9*LAND_SCALE);zoom=7;elevation=.48;}
 else if(id==='lookout'){focus.set(-6.9*LAND_SCALE,foreground.groundHeight(-6.9*LAND_SCALE,10.45*LAND_SCALE)+.4,10.45*LAND_SCALE);zoom=12;elevation=.28;}
 else{focus.set(0,0,0);zoom=1;id='overview';}
 window.castleState.view=id;document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===id)));
 if(id!=='overview'){paused=true;updatePause();}window.renderFrame(0);
}
window.setView=selectView;
document.getElementById('reset-view').addEventListener('click',()=>selectView('overview'));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>selectView(button.dataset.view)));
function pan(dx,dy){
 camera.getWorldDirection(cameraDirection);cameraRight.crossVectors(cameraDirection,camera.up).normalize();cameraUp.crossVectors(cameraRight,cameraDirection).normalize();
 const units=HALF_WIDTH*2/zoom/renderer.domElement.clientWidth;focus.addScaledVector(cameraRight,-dx*units).addScaledVector(cameraUp,dy*units);
 window.castleState.view='custom';document.querySelectorAll('[data-view]').forEach(button=>button.setAttribute('aria-pressed','false'));
}
function changeZoom(factor){zoom=Math.max(.65,Math.min(16,zoom*factor));window.renderFrame(elapsed/(DURATION*1000));}
document.getElementById('zoom-in').addEventListener('click',()=>changeZoom(1.35));document.getElementById('zoom-out').addEventListener('click',()=>changeZoom(1/1.35));
let drag=null;
renderer.domElement.addEventListener('contextmenu',event=>event.preventDefault());
renderer.domElement.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,pan:event.shiftKey||event.button===2};renderer.domElement.setPointerCapture(event.pointerId);paused=true;updatePause();});
renderer.domElement.addEventListener('pointermove',event=>{if(!drag)return;const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(drag.pan)pan(dx,dy);else{azimuthOffset-=dx*.007;elevation=Math.max(.12,Math.min(.9,elevation+dy*.005));}drag.x=event.clientX;drag.y=event.clientY;window.renderFrame(elapsed/(DURATION*1000));});
renderer.domElement.addEventListener('pointerup',()=>{drag=null;});renderer.domElement.addEventListener('pointercancel',()=>{drag=null;});
renderer.domElement.addEventListener('wheel',event=>{event.preventDefault();changeZoom(Math.exp(-event.deltaY*.001));},{passive:false});
renderer.domElement.addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(event.key))return;
 event.preventDefault();paused=true;updatePause();
 if(event.shiftKey&&event.key.startsWith('Arrow'))pan(event.key==='ArrowLeft'?35:event.key==='ArrowRight'?-35:0,event.key==='ArrowUp'?35:event.key==='ArrowDown'?-35:0);
 else{if(event.key==='ArrowLeft')azimuthOffset-=.08;if(event.key==='ArrowRight')azimuthOffset+=.08;if(event.key==='ArrowUp')elevation=Math.min(.9,elevation+.04);if(event.key==='ArrowDown')elevation=Math.max(.12,elevation-.04);}
 if(event.key==='+'||event.key==='=')zoom=Math.min(16,zoom*1.2);if(event.key==='-')zoom=Math.max(.65,zoom/1.2);
 window.renderFrame(elapsed/(DURATION*1000));
});
if(!capture)renderer.setAnimationLoop(now=>{if(!paused){elapsed+=Math.min(now-last,100);window.renderFrame(elapsed/(DURATION*1000));}last=now;});
