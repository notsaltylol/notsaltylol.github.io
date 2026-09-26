import * as THREE from './vendor/three/three.module.js';
import { STYLES, DEFAULT_STYLE } from './castle-styles.js';

// Three authored illustration layers in a real Three.js scene. No geometry is
// regenerated on theme changes; this version deliberately uses 2.5D parallax.
const W=960,H=600;
const params=new URLSearchParams(location.search),capture=params.has('capture');
const loader=new THREE.TextureLoader();
const load=async path=>{const t=await loader.loadAsync(path);t.colorSpace=THREE.SRGBColorSpace;return t;};
const [skyTexture,islandTexture,foregroundTexture,cozyTexture,inkTexture,satelliteTexture,cozyForeground,cozySatellite,watercolorSky]=await Promise.all([
 load('./painted-sky.png'),load('./illustration/island-fantasy.png'),load('./illustration/foreground.png'),load('./illustration/island-cozy.png'),load('./illustration/island-ink.png'),load('./illustration/satellite.png'),load('./illustration/foreground-cozy.png'),load('./illustration/satellite-cozy.png'),load('./illustration/sky-watercolor.png')
]);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
renderer.setSize(W,H);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.domElement.style.width='100%';renderer.domElement.style.height='auto';
document.getElementById('scene').appendChild(renderer.domElement);
document.getElementById('loading')?.remove();
const scene=new THREE.Scene();scene.background=new THREE.Color(0x91d7ea);
const camera=new THREE.OrthographicCamera(-8,8,5,-5,.1,60);camera.position.z=20;
const shared={time:{value:0},grade:{value:0}};
function layer(texture,width,height,z,flow=false){
 const material=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,
  uniforms:{map:{value:texture},time:shared.time,grade:shared.grade,flow:{value:flow?1:0},alpha:{value:1},soften:{value:z===-9?1:0}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec2 vUv;uniform sampler2D map;uniform float time,grade,flow,alpha,soften;
   void main(){
    vec2 uv=vUv;
    vec4 c=texture2D(map,uv);if(c.a<.015)discard;
    if(soften>0.){vec2 d=vec2(.0025,.004);c=c*.4+.15*(texture2D(map,uv+vec2(d.x,0.))+texture2D(map,uv-vec2(d.x,0.))+texture2D(map,uv+vec2(0.,d.y))+texture2D(map,uv-vec2(0.,d.y)));}
    float water=flow*step(uv.y,.53)*smoothstep(.25,.55,min(c.g,c.b))*step(c.r*.91,c.b)*step(c.r*.91,c.g);
    c.rgb+=water*.035*sin(uv.y*220.+time*12.);
    float lum=dot(c.rgb,vec3(.2126,.7152,.0722));
    if(grade==1.){c.rgb=mix(vec3(lum),c.rgb,.66)*vec3(1.09,1.025,.83);}
    if(grade==4.){c.rgb=mix(vec3(lum),c.rgb,.72)*vec3(1.06,1.,.86);}
    if(grade==5.){c.rgb=mix(c.rgb,vec3(.68,.76,.60),.08);c.rgb=pow(max(c.rgb,0.),vec3(.9));}
    if(grade==6.){float sun=smoothstep(.20,.82,lum);c.rgb=mix(vec3(lum),c.rgb,.90)*mix(vec3(.92,1.015,1.05),vec3(1.085,1.035,.89),sun);c.rgb=pow(max(c.rgb,0.),vec3(.96));}
    c.a*=alpha;gl_FragColor=c;
    #include <colorspace_fragment>
   }`
 });
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),material);mesh.position.z=z;mesh.renderOrder=z+10;scene.add(mesh);return mesh;
}
const sky=layer(skyTexture,18.6,11.65,-9);
const island=layer(islandTexture,11.7,7.8,0,true);island.position.set(-1.05,.7,0);
const satellite=layer(satelliteTexture,3.7,2.467,-2);satellite.position.set(5.65,1.3,-2);
const distant=layer(satelliteTexture,2.8,1.867,-3);distant.position.set(-7.65,2.15,-3);
const foreground=layer(foregroundTexture,17.5,10.94,3);
// An understated inscription on the cliff replaces the former banner-like sign.
const inscription=document.createElement('canvas');inscription.width=1024;inscription.height=160;
const ctx=inscription.getContext('2d');ctx.font='600 83px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';
ctx.fillStyle='#4e4133';ctx.fillText('NOTSALTYLOL',514,82);ctx.fillStyle='#dcc3a1';ctx.fillText('NOTSALTYLOL',512,79);
const nameTexture=new THREE.CanvasTexture(inscription);nameTexture.colorSpace=THREE.SRGBColorSpace;
const name=layer(nameTexture,2.75,.43,.1);name.material.uniforms.flow.value=0;name.material.uniforms.alpha.value=.58;
const bases=new Map([[sky,[0,0]],[island,[-1.05,.7]],[satellite,[5.65,1.3]],[distant,[-7.65,2.15]],[foreground,[0,0]]]);
const grades={original:1,fantasy:0,ink:4,cozy:5,ghibli:6};
window.castleStyles=Object.keys(STYLES);window.castleState={style:DEFAULT_STYLE,layerCount:3};
window.setStyle=(id,{persist=true}={})=>{
 if(!Object.hasOwn(STYLES,id))throw new Error('Unknown castle style: '+id);
 shared.grade.value=grades[id];
 const illustrated=['cozy','ink','original'].includes(id);
 island.material.uniforms.map.value=id==='cozy'?cozyTexture:id==='ink'||id==='original'?inkTexture:islandTexture;
 island.material.uniforms.grade={value:id==='cozy'||id==='ink'?0:grades[id]};
 sky.material.uniforms.map.value=illustrated?watercolorSky:skyTexture;
 foreground.material.uniforms.map.value=illustrated?cozyForeground:foregroundTexture;
 satellite.material.uniforms.map.value=distant.material.uniforms.map.value=illustrated?cozySatellite:satelliteTexture;
 document.querySelectorAll('[data-style]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.style===id)));
 document.getElementById('description').textContent=STYLES[id].description;
 document.getElementById('three-d-link').href='./animation-3d.html?style='+id;
 if(persist&&!capture){const url=new URL(location.href);url.searchParams.set('style',id);history.replaceState(null,'',url);try{localStorage.setItem('castle-style',id);}catch{}}
 window.castleState.style=id;
 if(window.renderFrame)window.renderFrame(window.castleState.phase||0);
};
const picker=document.getElementById('style-picker');
for(const [id,preset] of Object.entries(STYLES)){
 const button=document.createElement('button');button.type='button';button.dataset.style=id;button.textContent=preset.label;button.setAttribute('aria-pressed','false');
 button.addEventListener('click',()=>window.setStyle(id));picker.append(button);
}
let preferred=params.get('style');if(!preferred&&!capture){try{preferred=localStorage.getItem('castle-style');}catch{}}
window.setStyle(Object.hasOwn(STYLES,preferred)?preferred:DEFAULT_STYLE,{persist:false});
window.animationConfig={duration:24,fps:12};
window.renderFrame=phase=>{
 const cycle=phase-Math.floor(phase),t=cycle*Math.PI*2;shared.time.value=t;window.castleState.phase=cycle;
 for(const [mesh,[x,y]] of bases){
  const amount=mesh===foreground?.23:mesh===sky?.035:mesh===island?.12:.06;
  // Whole-pixel capture steps let GIF reuse unchanged regions. Live playback
  // keeps subpixel movement; both paths return exactly to their starting pose.
  const position=value=>capture?Math.round(value*60)/60:value;
  mesh.position.x=position(x+Math.sin(t)*amount);mesh.position.y=position(y+Math.cos(t)*amount*.3);
 }
 name.position.set(island.position.x-.45,island.position.y-1.2,.1);name.rotation.z=-.06;
 renderer.render(scene,camera);
};
window.renderFrame(0);
if(!capture){
 let elapsed=0,last=performance.now(),paused=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const pause=document.getElementById('pause');const update=()=>{pause.textContent=paused?'Play motion':'Pause motion';pause.setAttribute('aria-pressed',String(paused));};update();
 pause.addEventListener('click',()=>{paused=!paused;update();});
 renderer.setAnimationLoop(now=>{if(!paused)elapsed+=now-last;last=now;window.renderFrame((elapsed%24000)/24000);});
}
