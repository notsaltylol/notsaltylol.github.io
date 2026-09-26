import { coherentNoise3D, fractalRock } from './sky-castle-geology.js';

/**
 * A small, asymmetrical floating landform in its own local coordinates.
 * Meadow and rock share the exact same rim. height() interpolates the meadow
 * triangles, so physical-sized trees and buildings sit on the rendered ground.
 */
export function buildSatelliteTerrain(THREE, materials, { scale = 10, seed = 43 } = {}) {
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('Satellite scale must be positive and finite');
  if (!Number.isFinite(seed)) throw new RangeError('Satellite seed must be finite');
  const TAU = Math.PI * 2, group = new THREE.Group();
  group.name = 'fractured-satellite-landform';
  let state = (Math.abs(Math.trunc(seed)) % 2147483646) + 1;
  const random = () => (state = state * 16807 % 2147483647) / 2147483647;
  const smooth = (a,b,x) => {const t = Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const angleDistance = (a,b) => Math.atan2(Math.sin(a-b),Math.cos(a-b));
  // Burn the first correlated values of the simple deterministic generator.
  for(let i=0;i<5;i++)random();
  const rotation=random()*TAU, noiseOffset=random()*300, skew=.78+random()*.13;
  const planes = Array.from({length:9},(_,i) => ({
    angle:rotation+i/9*TAU+(random()-.5)*.17,
    distance:(1.15+random()*.27)*scale,
  }));
  const clefts = [
    {angle:rotation+.58,width:.17,depth:.12*scale},
    {angle:rotation+3.17,width:.11,depth:.085*scale},
  ];
  const buttresses = [
    {angle:rotation+.35,width:.57,weight:1},
    {angle:rotation+2.58,width:.46,weight:.46},
    {angle:rotation+4.55,width:.68,weight:.75},
  ];
  const shiftX=(random()-.5)*.34*scale,shiftZ=(random()-.5)*.28*scale;
  function authoredRadius(angle){
    const x=Math.cos(angle),z=Math.sin(angle)/skew;
    let r=Infinity;
    for(const plane of planes){
      const facing=Math.cos(plane.angle)*x+Math.sin(plane.angle)*z;
      if(facing>.05)r=Math.min(r,plane.distance/facing);
    }
    for(const cleft of clefts){
      const d=angleDistance(angle,cleft.angle)/cleft.width;
      r-=cleft.depth*Math.exp(-d*d);
    }
    return r;
  }
  const segments=128,meadowRings=36,rockRings=64;
  const outline=Array.from({length:segments},(_,i)=>{
    const a=i/segments*TAU,r=authoredRadius(a);
    return [Math.fround(Math.cos(a)*r),Math.fround(Math.sin(a)*r)];
  });
  const sector=angle=>((angle%TAU+TAU)%TAU)/TAU*segments;
  function radius(angle){
    const i=Math.floor(sector(angle))%segments,a=outline[i],b=outline[(i+1)%segments];
    const x=Math.cos(angle),z=Math.sin(angle),ex=b[0]-a[0],ez=b[1]-a[1];
    return (a[0]*ez-a[1]*ex)/(x*ez-z*ex);
  }
  function contains(x,z,margin=0){
    return Math.hypot(x,z)<=radius(Math.atan2(z,x))-Math.max(0,margin);
  }
  const hillAngle=rotation+1.2;
  const hillX=Math.cos(hillAngle)*scale*.57,hillZ=Math.sin(hillAngle)*scale*.48;
  function rollingHeight(x,z){
    const hill=Math.exp(-(((x-hillX)/(.62*scale))**2+((z-hillZ)/(.55*scale))**2));
    const shoulder=Math.exp(-(((x+hillX*.7)/(.47*scale))**2+((z+hillZ*.8)/(.62*scale))**2));
    return scale*(.061+.087*hill+.060*shoulder)+x*.012+z*.021+
      coherentNoise3D(x/scale*1.6,noiseOffset,z/scale*1.6)*scale*.022;
  }
  const centerHeight=rollingHeight(0,0),seatRadius=Math.min(1.35,scale*.24);
  function authoredHeight(x,z){
    const blend=smooth(seatRadius,seatRadius+Math.min(1.15,scale*.2),Math.hypot(x,z));
    return centerHeight+(rollingHeight(x,z)-centerHeight)*blend;
  }
  const topPositions=[0,centerHeight,0],topUvs=[.5,.5],topIndices=[];
  const topIndex=(ring,i)=>ring===0?0:1+(ring-1)*(segments+1)+i;
  for(let ring=1;ring<=meadowRings;ring++)for(let i=0;i<=segments;i++){
    const edge=outline[i%segments],r=ring/meadowRings,x=edge[0]*r,z=edge[1]*r;
    topPositions.push(x,authoredHeight(x,z),z);topUvs.push(x/(scale*3)+.5,z/(scale*3)+.5);
  }
  for(let i=0;i<segments;i++)topIndices.push(0,topIndex(1,i+1),topIndex(1,i));
  for(let ring=1;ring<meadowRings;ring++)for(let i=0;i<segments;i++){
    const a=topIndex(ring,i),b=topIndex(ring,i+1),c=topIndex(ring+1,i),d=topIndex(ring+1,i+1);
    topIndices.push(a,b,c,b,d,c);
  }
  function geometry(positions,uvs,indices){
    const result=new THREE.BufferGeometry();
    result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    result.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    result.setIndex(indices);result.computeVertexNormals();result.computeBoundingSphere();return result;
  }
  function joinNormals(g,first,stride,rows){
    const normals=g.attributes.normal;
    for(let j=0;j<rows;j++){
      const a=first+j*stride,b=a+segments;
      const n=new THREE.Vector3().fromBufferAttribute(normals,a).add(new THREE.Vector3().fromBufferAttribute(normals,b)).normalize();
      normals.setXYZ(a,n.x,n.y,n.z);normals.setXYZ(b,n.x,n.y,n.z);
    }
  }
  const meadowGeometry=geometry(topPositions,topUvs,topIndices);
  joinNormals(meadowGeometry,1,segments+1,meadowRings);
  const top=meadowGeometry.attributes.position.array;
  function triangleHeight(x,z,a,b,c){
    const ax=top[a*3],az=top[a*3+2],bx=top[b*3],bz=top[b*3+2],cx=top[c*3],cz=top[c*3+2];
    const denominator=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
    const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/denominator;
    const v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/denominator;
    return {inside:u>=-1e-5&&v>=-1e-5&&u+v<=1.00001,
      y:u*top[a*3+1]+v*top[b*3+1]+(1-u-v)*top[c*3+1]};
  }
  function height(x,z){
    if(Math.abs(x)+Math.abs(z)<1e-10)return top[1];
    const angle=Math.atan2(z,x),i=Math.floor(sector(angle))%segments;
    const distance=Math.hypot(x,z),edgeRadius=radius(angle),fraction=Math.min(1,distance/edgeRadius);
    if(distance>edgeRadius){const shrink=edgeRadius/distance;x*=shrink;z*=shrink;}
    const ring=Math.min(meadowRings-1,Math.floor(fraction*meadowRings));
    if(ring===0)return triangleHeight(x,z,0,topIndex(1,i+1),topIndex(1,i)).y;
    const a=topIndex(ring,i),b=topIndex(ring,i+1),c=topIndex(ring+1,i),d=topIndex(ring+1,i+1);
    const first=triangleHeight(x,z,a,b,c);
    return first.inside?first.y:triangleHeight(x,z,b,d,c).y;
  }
  const profile=[[0,1],[.12,.99],[.24,.95],[.34,.85],[.46,.80],[.56,.70],[.66,.57],[.82,.37],[1,.115]];
  function taper(t){
    for(let i=1;i<profile.length;i++)if(t<=profile[i][0]){
      const [a,ra]=profile[i-1],[b,rb]=profile[i];return ra+(rb-ra)*(t-a)/(b-a);
    }
    return profile.at(-1)[1];
  }
  const rockPositions=[],rockUvs=[],rockIndices=[];
  for(let ring=0;ring<=rockRings;ring++)for(let i=0;i<=segments;i++){
    const a=i%segments/segments*TAU,t=ring/rockRings,edge=topIndex(meadowRings,i)*3;
    if(ring===0){rockPositions.push(top[edge],top[edge+1],top[edge+2]);rockUvs.push(i/segments,0);continue;}
    let mass=0;
    for(const buttress of buttresses)mass=Math.max(mass,
      Math.max(0,1-Math.abs(angleDistance(a,buttress.angle+t*.09))/buttress.width)*buttress.weight);
    const support=smooth(.24,.80,t),relief=smooth(.012,.12,t)*(1-smooth(.90,1,t));
    // Separate buttresses end at unequal depths around a higher, concave core.
    // No single axisymmetric point closes the bottom of the formation.
    const bedDepth=Math.max(0,Math.min(1,t+Math.sin(t*Math.PI)*
      (.044*Math.sin(a*2+rotation)+.018*Math.sin(a*5+.6))));
    let r=radius(a)*(taper(bedDepth)+mass*support*.21);
    const shelfPatch=smooth(-.35,.60,Math.sin(a*2+rotation));
    const secondPatch=smooth(-.10,.70,Math.sin(a*3-rotation+1.8));
    r+=scale*.075*shelfPatch*smooth(.18,.205,bedDepth)*(1-smooth(.245,.31,bedDepth));
    r+=scale*.055*secondPatch*smooth(.37,.405,bedDepth)*(1-smooth(.435,.50,bedDepth));
    r-=scale*.037*shelfPatch*smooth(.29,.33,bedDepth)*(1-smooth(.37,.43,bedDepth));
    for(const cleft of clefts){
      const delta=angleDistance(a,cleft.angle+t*.15)/(.065+cleft.width*.35);
      r-=scale*.071*Math.exp(-delta*delta)*relief;
    }
    let x=Math.cos(a)*r+shiftX*t,z=Math.sin(a)*r+shiftZ*t;
    let y=top[edge+1]*(1-t)-scale*(1.36+.73*mass+.07*Math.sin(a*3+rotation))*t;
    const erosion=fractalRock(x*.72+noiseOffset,y*.95,z*.72-noiseOffset)*.20*relief;
    x+=Math.cos(a)*erosion;z+=Math.sin(a)*erosion;y+=erosion*.28;
    rockPositions.push(x,y,z);rockUvs.push(i/segments,t);
  }
  for(let ring=0;ring<rockRings;ring++)for(let i=0;i<segments;i++){
    const a=ring*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;
    rockIndices.push(a,b,c,b,d,c);
  }
  const bottom=rockPositions.length/3;
  rockPositions.push(shiftX,-scale*1.22,shiftZ);rockUvs.push(.5,1);
  for(let i=0;i<segments;i++)rockIndices.push(bottom,rockRings*(segments+1)+i,rockRings*(segments+1)+i+1);
  const rockGeometry=geometry(rockPositions,rockUvs,rockIndices);
  joinNormals(rockGeometry,0,segments+1,rockRings+1);
  for(const [g,material,name] of [[meadowGeometry,materials.grass,'rolling-satellite-meadow'],[rockGeometry,materials.rock,'fractured-satellite-rock']]){
    const mesh=new THREE.Mesh(g,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }
  let rimError=0;
  const rock=rockGeometry.attributes.position.array;
  for(let i=0;i<=segments;i++)for(let axis=0;axis<3;axis++)rimError=Math.max(rimError,Math.abs(top[topIndex(meadowRings,i)*3+axis]-rock[i*3+axis]));
  const stats={seed,drawCalls:2,vertices:top.length/3+rock.length/3,
    meadowTriangles:topIndices.length/3,rockTriangles:rockIndices.length/3,
    triangles:(topIndices.length+rockIndices.length)/3,rimError,centerHeight:height(0,0),
    pavilionSeatRadius:seatRadius,segments,meadowRings,rockRings};
  group.userData.satellite=stats;
  return {group,height,contains,radius,stats,scale,verticalScale:scale,waterLevel:-1000*scale};
}
