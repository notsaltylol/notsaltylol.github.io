/**
 * A distant painted panorama, or real continuous three-dimensional cloud banks.
 * Optional textureUrl selects the panorama without constructing cloud meshes.
 * Its ready Promise resolves after the texture loads, or rejects on load error.
 */
export function createAtmosphere(THREE, {
  scale = 10,
  sunDirection = new THREE.Vector3(150, 210, 110).normalize(),
  textureUrl = null,
  panoramaRepeat = 1,
} = {}) {
  const group = new THREE.Group();
  group.name = 'painted-sky-and-billowing-clouds';
  const sun = sunDirection.clone().normalize();
  const uniforms = {
    skyTop:{value:new THREE.Color(0x539cc8)}, skyHorizon:{value:new THREE.Color(0xc5dde0)},
    skyLow:{value:new THREE.Color(0xd7e5df)}, cloudLight:{value:new THREE.Color(0xfff5d9)},
    cloudShade:{value:new THREE.Color(0x8eafc1)}, sunDirection:{value:sun},
    softness:{value:1}, cloudContrast:{value:.65}, paper:{value:.025},
    panorama:{value:null}, panoramaDrift:{value:0}, paintedStyle:{value:0},
    panoramaRepeat:{value:Math.max(1,Math.round(panoramaRepeat))},
  };

  const skyMaterial = new THREE.ShaderMaterial({
    side:THREE.BackSide, depthWrite:false, depthTest:false, fog:false,
    uniforms,
    defines:textureUrl ? {PAINTED_SKY:1} : {},
    vertexShader:/* glsl */`
      varying vec3 worldDirection;
      // Sky is infinitely distant: camera translation and dolly distance must
      // not change the apparent cloud size or move the camera outside its dome.
      void main(){worldDirection=position;gl_Position=projectionMatrix*vec4(mat3(viewMatrix)*position,1.0);}
    `,
    fragmentShader:/* glsl */`
      varying vec3 worldDirection;
      uniform vec3 skyTop,skyHorizon,skyLow,sunDirection;
      #ifdef PAINTED_SKY
      uniform sampler2D panorama;
      uniform float panoramaDrift,paintedStyle,panoramaRepeat;
      vec3 paintedGrade(vec3 color){
        // Grade gently in a perceptual space; keep the painted value structure.
        vec3 c=pow(max(color,vec3(0.0)),vec3(1.0/2.2));
        float value=dot(c,vec3(.2126,.7152,.0722));
        if(paintedStyle>.5 && paintedStyle<1.5){
          c=mix(vec3(value),c,.86)*vec3(1.025,1.008,.97);
        }else if(paintedStyle>1.5 && paintedStyle<2.5){
          c=mix(vec3(value),c,.72)*vec3(1.02,1.0,.91);
          c=mix(c,vec3(.90,.87,.75),.035);
        }else if(paintedStyle>2.5 && paintedStyle<3.5){
          c=mix(vec3(value),c,.59)*vec3(1.025,1.012,.94);
          float band=floor(value*11.0+.5)/11.0;
          c+=vec3((band-value)*.28);
          // A restrained pigment edge preserves brushwork under the scene ink.
          c*=1.0-clamp(fwidth(value)*1.7,0.0,.065);
        }else if(paintedStyle>3.5){
          c=mix(vec3(value),c,.68);
          c=mix(c,vec3(.94,.92,.86),.17);
        }
        return pow(clamp(c,0.0,1.0),vec3(2.2));
      }
      #endif
      void main(){
        vec3 d=normalize(worldDirection);
        #ifdef PAINTED_SKY
        // A broad virtual sky lens frames the painted horizon around the
        // downward-looking perspective camera. Zoom moves the camera, keeping
        // the backdrop's angular detail instead of magnifying a few texels.
        vec3 forward=-vec3(viewMatrix[0][2],viewMatrix[1][2],viewMatrix[2][2]);
        float forwardLongitude=atan(forward.x,-forward.z);
        float longitude=atan(d.x,-d.z);
        float longitudeOffset=atan(sin(longitude-forwardLongitude),cos(longitude-forwardLongitude));
        // Widen the panorama in angular space. Extrapolating 3D ray vectors
        // crosses a false pole at steep camera elevations, creating a starburst.
        float u=(forwardLongitude+longitudeOffset*1.7+.24)*panoramaRepeat/6.28318530718+.5+panoramaDrift;
        float v=.64+asin(clamp(d.y,-1.0,1.0))*.55;
        // Preserve painted cloud structure at high/low viewing elevations.
        // A hard clamp would stretch one edge row over half the sky. These
        // soft tails retain a continuous first derivative into the poles.
        if(v<.05)v=.006+.044*exp((v-.05)/.044);
        else if(v>.95)v=.994-.044*exp((.95-v)/.044);
        // Explicit continuous derivatives prevent the atan seam from selecting
        // a blurry mip level when the orbit crosses the panorama join.
        vec3 ld=d;
        float longitudeScale=1.7*panoramaRepeat/(6.28318530718*max(.0001,ld.x*ld.x+ld.z*ld.z));
        float duX=(-ld.z*dFdx(ld.x)+ld.x*dFdx(ld.z))*longitudeScale;
        float duY=(-ld.z*dFdy(ld.x)+ld.x*dFdy(ld.z))*longitudeScale;
        vec3 paint=textureGrad(panorama,vec2(u,v),vec2(duX,dFdx(v)),vec2(duY,dFdy(v))).rgb;
        // Generated paintings can be visually continuous without matching edge
        // pixels. A narrow symmetric crossfade removes a hard longitude join.
        float wrapped=fract(u);
        float seamBlend=(1.0-smoothstep(0.0,.045,min(wrapped,1.0-wrapped)))*.5;
        vec3 seamPaint=textureGrad(panorama,vec2(1.0-wrapped,v),vec2(-duX,dFdx(v)),vec2(-duY,dFdy(v))).rgb;
        vec3 sky=paintedGrade(mix(paint,seamPaint,seamBlend));
        #else
        float altitude=smoothstep(-.53,-.08,d.y);
        vec3 sky=mix(skyLow,skyHorizon,smoothstep(-.80,-.16,d.y));
        sky=mix(sky,skyTop,altitude);
        float sun=pow(max(0.0,dot(d,sunDirection)),18.0);
        float halo=pow(max(0.0,dot(d,sunDirection)),5.0);
        sky=mix(sky,vec3(1.0,.92,.72),sun*.22+halo*.035);
        #endif
        gl_FragColor=vec4(sky,1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(100*scale,48,24),skyMaterial);
  dome.name='graded-atmosphere';dome.renderOrder=-100;dome.frustumCulled=false;group.add(dome);

  if(textureUrl){
    dome.name='painted-panorama-atmosphere';
    // A ready flag allows a caller to wait before taking a deterministic frame.
    group.userData.atmosphere={mode:'painted',textureUrl,ready:false,cloudBanks:0,
      uniqueGeometries:1,triangles:dome.geometry.index.count/3,maximumDrawCalls:1};
    const ready=new THREE.TextureLoader().loadAsync(textureUrl).then(texture=>{
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.wrapS=THREE.RepeatWrapping;texture.wrapT=THREE.ClampToEdgeWrapping;
      texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;
      texture.anisotropy=4;texture.needsUpdate=true;
      uniforms.panorama.value=texture;group.userData.atmosphere.ready=true;
      return texture;
    });
    const animate=phase=>{
      const loop=((phase%1)+1)%1;
      uniforms.panoramaDrift.value=Math.sin(loop*Math.PI*2)*.0012;
    };
    animate(0);
    return {group,setStyle,animate,ready};
  }

  const cloudMaterial = new THREE.ShaderMaterial({
    uniforms, fog:false, depthWrite:true,
    vertexShader:/* glsl */`
      attribute float shelter;
      varying vec3 worldNormal,cloudPosition,worldPosition;
      varying float cloudShelter;
      void main(){
        mat4 world=modelMatrix;
        #ifdef USE_INSTANCING
          world=world*instanceMatrix;
        #endif
        vec4 p=world*vec4(position,1.0);
        worldPosition=p.xyz;cloudPosition=position;
        worldNormal=normalize(transpose(inverse(mat3(world)))*normal);cloudShelter=shelter;
        gl_Position=projectionMatrix*viewMatrix*p;
      }
    `,
    fragmentShader:/* glsl */`
      varying vec3 worldNormal,cloudPosition,worldPosition;
      varying float cloudShelter;
      uniform vec3 cloudLight,cloudShade,skyHorizon,sunDirection;
      uniform float softness,cloudContrast,paper;
      float hash(vec3 p){p=fract(p*.3183099+vec3(.17,.31,.43));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 p){
        vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      void main(){
        vec3 n=normalize(worldNormal);
        float facing=dot(n,sunDirection);
        float lit=smoothstep(-.30,.90,facing);
        float height=smoothstep(-.46,1.28,cloudPosition.y);
        float illumination=clamp(lit*.67+height*.20+cloudShelter*.13,0.,1.);
        illumination*=mix(.60,1.,cloudShelter);
        float band=floor(illumination*3.)/3.;
        illumination=mix(band,illumination,softness);
        illumination=mix(.62,illumination,cloudContrast);
        vec3 color=mix(cloudShade,cloudLight,illumination);
        // Small pigment changes stay much quieter than the billow lighting.
        float pigment=noise(cloudPosition*2.6)*.68+noise(cloudPosition*6.5)*.32-.5;
        color*=1.+pigment*paper;
        float distanceHaze=smoothstep(850.,1550.,distance(cameraPosition,worldPosition));
        color=mix(color,skyHorizon,distanceHaze*.20);
        gl_FragColor=vec4(color,1.0);
        #include <colorspace_fragment>
      }
    `,
  });

  const smoothMin=(a,b,k)=>{
    const h=Math.max(0,Math.min(1,.5+.5*(b-a)/k));
    return b*(1-h)+a*h-k*h*(1-h);
  };
  function cloudGeometry(seed) {
    let state=seed;
    const random=()=>((state=state*16807%2147483647)/2147483647);
    const lobes=[{x:0,y:-.04,z:0,rx:2.58,ry:.29,rz:.63}];
    // Unequal lower shoulders carry taller billows; a broad base unifies them.
    for(let i=0;i<7;i++){
      const x=-2.35+i*.78+(random()-.5)*.15;
      lobes.push({x,y:.15+random()*.28,z:(random()-.5)*.34,
        rx:.62+random()*.22,ry:.51+random()*.29,rz:.64+random()*.20});
    }
    for(let i=0;i<5;i++){
      const x=-1.52+i*.70+(random()-.5)*.22;
      lobes.push({x,y:.72+random()*.39,z:(random()-.5)*.42,
        rx:.43+random()*.23,ry:.49+random()*.27,rz:.48+random()*.22});
    }
    // Smaller bubbles on both faces give the banks folded, layered surfaces,
    // not just a row of balls visible along their outside silhouette.
    for(let side=-1;side<=1;side+=2)for(let i=0;i<11;i++){
      const x=-2.4+i*.47+(random()-.5)*.13;
      lobes.push({x,y:.20+random()*.52,z:side*(.56+random()*.08),
        rx:.25+random()*.15,ry:.28+random()*.19,rz:.24+random()*.13,small:true});
    }
    for(let i=0;i<7;i++){
      lobes.push({x:-1.5+i*.50,y:1.09+random()*.24,z:(random()-.5)*.82,
        rx:.26+random()*.12,ry:.28+random()*.13,rz:.25+random()*.12,small:true});
    }
    function density(x,y,z){
      let d=100;
      for(const lobe of lobes){
        const dx=(x-lobe.x)/lobe.rx,dy=(y-lobe.y)/lobe.ry,dz=(z-lobe.z)/lobe.rz;
        const ellipsoid=(Math.sqrt(dx*dx+dy*dy+dz*dz)-1)*Math.min(lobe.rx,lobe.ry,lobe.rz);
        d=smoothMin(d,ellipsoid,lobe.small?.085:.12);
      }
      const undulation=Math.sin(x*6.7+seed)*Math.sin(z*5.3+y*4.1)*.017
        +Math.sin(x*11.1-y*7.4)*Math.cos(z*9.2+seed)*.009;
      return Math.max(d+undulation,-.47-y);
    }
    const nx=64,ny=34,nz=30;
    const lo=[-3.55,-.62,-1.36],hi=[3.55,2.12,1.36];
    const dx=(hi[0]-lo[0])/nx,dy=(hi[1]-lo[1])/ny,dz=(hi[2]-lo[2])/nz;
    const field=new Float32Array((nx+1)*(ny+1)*(nz+1));
    const index=(x,y,z)=>(z*(ny+1)+y)*(nx+1)+x;
    for(let z=0;z<=nz;z++)for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++)field[index(x,y,z)]=density(lo[0]+x*dx,lo[1]+y*dy,lo[2]+z*dz);
    const offsets=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
    const tetrahedra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
    const positions=[],normals=[],shelters=[];
    function normalAt(p){
      const h=.015;
      return new THREE.Vector3(density(p.x+h,p.y,p.z)-density(p.x-h,p.y,p.z),
        density(p.x,p.y+h,p.z)-density(p.x,p.y-h,p.z),density(p.x,p.y,p.z+h)-density(p.x,p.y,p.z-h)).normalize();
    }
    function triangle(a,b,c){
      const na=normalAt(a),nb=normalAt(b),nc=normalAt(c);
      const cross=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a));
      if(cross.lengthSq()<1e-15)return;
      if(cross.dot(na)<0){[b,c]=[c,b];[nb.x,nc.x]=[nc.x,nb.x];[nb.y,nc.y]=[nc.y,nb.y];[nb.z,nc.z]=[nc.z,nb.z];}
      for(const [p,n] of [[a,na],[b,nb],[c,nc]]){
        positions.push(p.x,p.y,p.z);normals.push(n.x,n.y,n.z);
        shelters.push(1-Math.max(0,Math.min(.6,-density(p.x,p.y+.29,p.z)*2.1)));
      }
    }
    for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      const points=offsets.map(([a,b,c])=>new THREE.Vector3(lo[0]+(x+a)*dx,lo[1]+(y+b)*dy,lo[2]+(z+c)*dz));
      const values=offsets.map(([a,b,c])=>field[index(x+a,y+b,z+c)]);
      if(values.every(v=>v>=0)||values.every(v=>v<0))continue;
      const cut=(a,b)=>points[a].clone().lerp(points[b],values[a]/(values[a]-values[b]));
      for(const tetra of tetrahedra){
        const inside=tetra.filter(i=>values[i]<0),outside=tetra.filter(i=>values[i]>=0);
        if(inside.length===1)triangle(...outside.map(i=>cut(inside[0],i)));
        else if(inside.length===3)triangle(...inside.map(i=>cut(outside[0],i)));
        else if(inside.length===2){
          const a=cut(inside[0],outside[0]),b=cut(inside[0],outside[1]),c=cut(inside[1],outside[0]),d=cut(inside[1],outside[1]);
          triangle(a,c,b);triangle(b,c,d);
        }
      }
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geometry.setAttribute('shelter',new THREE.Float32BufferAttribute(shelters,1));
    geometry.computeBoundingSphere();return geometry;
  }

  const variants=[137,353,743].map(cloudGeometry),banks=[];
  let seed=418;
  const random=()=>((seed=seed*16807%2147483647)/2147483647);
  // The ortho camera looks down at ~20 degrees. The distant banks therefore
  // live below the island horizon, not on the y=0 plane. Every azimuth has
  // shoulders and a low cloud sea, while the initial castle view has a blue bay.
  const initialRear=Math.PI+.24;
  for(let i=0;i<18;i++){
    const angle=initialRear+i/18*Math.PI*2;
    const distance=(80+random()*5)*scale;
    const offset=i===0?-12:-7+random()*6;
    banks.push({variant:i%3,angle,baseY:-distance*.36+offset*scale,
      distance,size:(3.1+random()*.55)*scale,phase:random()*Math.PI*2,layer:0});
  }
  // Framing towers rise beside, rather than directly behind, the tiny castle.
  for(let i=0;i<12;i++){
    const angle=initialRear+(i+.5)/12*Math.PI*2;
    const distance=(81+random()*4)*scale;
    banks.push({variant:(i+1)%3,angle,baseY:-distance*.36+(-1+random()*2)*scale,
      distance,size:(3.9+random()*.55)*scale,phase:random()*Math.PI*2,layer:1});
  }
  // Separate bank bounds let Three.js reject the unseen hemisphere. The three
  // geometries and one material are shared; distant off-screen clouds cost no
  // draw call or vertex work in close views.
  const meshes=banks.map((bank,index)=>{
    const mesh=new THREE.Mesh(variants[bank.variant],cloudMaterial);
    mesh.name=`continuous-cloud-bank-${index}`;mesh.renderOrder=-20;
    mesh.castShadow=mesh.receiveShadow=false;group.add(mesh);return {mesh,bank};
  });
  function animate(phase){
    const loop=((phase%1)+1)%1,t=loop*Math.PI*2;
    for(const {mesh,bank} of meshes){
      const a=bank.angle+Math.sin(t+bank.phase)*.006;
      mesh.position.set(Math.sin(a)*bank.distance,bank.baseY+Math.sin(t+bank.phase)*scale*.32,Math.cos(a)*bank.distance);
      // The long bank axis is tangential; its depth cannot enter the orbit.
      mesh.rotation.set(0,a,0);
      const breathe=1+Math.sin(t+bank.phase)*.008;
      mesh.scale.set(bank.size,bank.size*breathe,bank.size*.82);
    }
  }
  function setStyle(preset,id){
    uniforms.paintedStyle.value=({fantasy:0,ghibli:1,original:2,ink:3,cozy:4})[id]??0;
    uniforms.skyTop.value.setHex(preset.sky ?? 0x79c1df);
    uniforms.skyHorizon.value.setHex(preset.fog ?? 0xb4dce4);
    uniforms.skyLow.value.copy(uniforms.skyHorizon.value).lerp(new THREE.Color(preset.cloud ?? 0xfff9e8),.28);
    uniforms.cloudLight.value.setHex(preset.cloud ?? 0xfff9e8);
    uniforms.cloudShade.value.setHex(preset.shadow ?? 0x75959d).lerp(uniforms.skyHorizon.value,.42);
    uniforms.cloudContrast.value=id==='cozy'?.40:id==='ink'?.62:.85;
    uniforms.softness.value=id==='ink'?.65:1;
    uniforms.paper.value=id==='cozy'?.012:id==='ink'?.014:.045;
    if(id==='fantasy'){
      uniforms.skyTop.value.setHex(0x3b8ed0);uniforms.skyHorizon.value.setHex(0xb3dce9);
      uniforms.skyLow.value.setHex(0xd4e4de);uniforms.cloudShade.value.setHex(0x668aa9);
    } else if(id==='ghibli'){
      uniforms.skyTop.value.setHex(0x72adc9);uniforms.skyHorizon.value.setHex(0xc5dddc);
      uniforms.cloudShade.value.setHex(0x7e9eab);
    }
  }
  animate(0);
  group.userData.atmosphere={cloudBanks:banks.length,uniqueGeometries:variants.length,
    triangles:meshes.reduce((sum,{mesh})=>sum+mesh.geometry.attributes.position.count/3,0),maximumDrawCalls:meshes.length+1};
  return {group,setStyle,animate,ready:Promise.resolve()};
}
