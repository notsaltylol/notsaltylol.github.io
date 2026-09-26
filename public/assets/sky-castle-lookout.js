import { coherentNoise3D, fractalRock } from './sky-castle-geology.js';

/** A long, broken ridge with a rolling meadow and one watertight rock shell.
 * Heights and silhouettes are authored in landscape units. Small erosion stays
 * in world units, so enlarging the island never enlarges its surface texture.
 */
export function buildLookoutTerrain(THREE, materials, {scale=10}={}) {
  if(!Number.isFinite(scale)||scale<=0)throw new RangeError('Lookout scale must be positive and finite');
  const group=new THREE.Group();group.name='lookout-landform';
  const TAU=Math.PI*2,segments=384,topRings=80,rockRings=96;
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  // Broad promontories alternate with shallow coves. Their unequal lengths
  // give the ridge shoulders and a sheltered rear saddle at every orbit angle.
  const corners=[[-9.6,-.2],[-8.7,-1.8],[-6.2,-2.3],[-4.3,-3.3],[-1.1,-2.9],
    [1,-3.7],[3.3,-3.2],[4.8,-2],[7.4,-1.5],[8.5,-.1],[6.9,1.6],
    [3.2,2.9],[.6,2.4],[-2.1,3.3],[-5.4,2.4],[-7.6,1.4]];
  function boundary(a){
    const dx=Math.cos(a),dz=Math.sin(a);let nearest=Infinity;
    for(let i=0;i<corners.length;i++){
      const p=corners[i],q=corners[(i+1)%corners.length],ex=q[0]-p[0],ez=q[1]-p[1];
      const det=dx*ez-dz*ex;if(Math.abs(det)<1e-9)continue;
      const r=(p[0]*ez-p[1]*ex)/det,u=(p[0]*dz-p[1]*dx)/det;
      if(r>0&&u>=-1e-8&&u<=1.00000001)nearest=Math.min(nearest,r);
    }
    return nearest*scale;
  }
  const outline=Array.from({length:segments},(_,i)=>{
    const a=i/segments*TAU,r=boundary(a);return [Math.fround(Math.cos(a)*r),Math.fround(Math.sin(a)*r)];
  });
  function radius(a){
    const sector=((a%TAU+TAU)%TAU)/TAU*segments,i=Math.floor(sector)%segments;
    const p=outline[i],q=outline[(i+1)%segments],ex=q[0]-p[0],ez=q[1]-p[1];
    return (p[0]*ez-p[1]*ex)/(Math.cos(a)*ez-Math.sin(a)*ex);
  }
  function height(x,z){
    const u=x/scale,v=z/scale;
    const hill=(cx,cz,sx,sz)=>Math.exp(-(((u-cx)/sx)**2+((v-cz)/sz)**2));
    return scale*(.24+.77*hill(-4,-.3,3.8,2.6)+.37*hill(3,-1.3,2.5,1.9)
      -.20*hill(.1,.4,1.6,1.6)+.025*u-.036*v
      +.048*coherentNoise3D(u*.8,17.3,v*.8));
  }
  const positions=[0,height(0,0),0],uvs=[.5,.5],indices=[];
  const index=(ring,i)=>ring===0?0:1+(ring-1)*(segments+1)+i;
  for(let ring=1;ring<=topRings;ring++)for(let i=0;i<=segments;i++){
    const p=outline[i%segments],t=ring/topRings,x=p[0]*t,z=p[1]*t;
    positions.push(x,height(x,z),z);uvs.push(x/(scale*20)+.5,z/(scale*8)+.5);
  }
  for(let i=0;i<segments;i++)indices.push(0,index(1,i+1),index(1,i));
  for(let ring=1;ring<topRings;ring++)for(let i=0;i<segments;i++){
    const a=index(ring,i),b=a+1,c=index(ring+1,i),d=c+1;indices.push(a,b,c,b,d,c);
  }
  function geometry(p,uv,idx){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingSphere();return g;
  }
  function weldSeam(g,start,rows){
    const n=g.attributes.normal;
    for(let row=0;row<rows;row++){
      const a=start+row*(segments+1),b=a+segments;
      const v=new THREE.Vector3().fromBufferAttribute(n,a).add(new THREE.Vector3().fromBufferAttribute(n,b)).normalize();
      n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);
    }
  }
  const meadow=geometry(positions,uvs,indices);weldSeam(meadow,1,topRings);
  const top=meadow.attributes.position,rockPositions=[],rockUvs=[],rockIndices=[];
  // Tilted, discontinuous beds narrow toward an offset keel. The large profile
  // is independent of fine fractal weathering and has no repeated cone tips.
  const profile=[[0,1],[.10,.99],[.24,.96],[.34,.83],[.49,.81],[.62,.60],[.78,.39],[.92,.20],[1,.075]];
  function taper(t){
    for(let i=1;i<profile.length;i++)if(t<=profile[i][0]){
      const [a,ra]=profile[i-1],[b,rb]=profile[i];return ra+(rb-ra)*(t-a)/(b-a);
    }
    return .075;
  }
  for(let row=0;row<=rockRings;row++)for(let i=0;i<=segments;i++){
    const edge=index(topRings,i),ex=top.getX(edge),ez=top.getZ(edge),ey=top.getY(edge);
    if(row===0){rockPositions.push(ex,ey,ez);rockUvs.push(i/segments,0);continue;}
    const a=i%segments/segments*TAU,t=row/rockRings,u=ex/scale,v=ez/scale;
    const bed=Math.max(0,Math.min(1,t+Math.sin(t*Math.PI)*(.055*u/9+.043*v/3)));
    const wall=smooth(.015,.09,t)*(1-smooth(.89,1,t));
    const west=.60*Math.exp(-(((u+3.6)/4.0)**2)),east=.32*Math.exp(-(((u-4.7)/2.7)**2));
    const depth=3.15+west+east+.23*Math.sin(a+.4);
    const broken=(.09*coherentNoise3D(u*.55+3,bed*4.8,v*.7)+.035*coherentNoise3D(u*1.9,bed*13,v*2))*wall;
    const factor=taper(bed)+broken;
    let x=ex*factor+scale*1.1*t,z=ez*factor-scale*.6*t;
    let y=ey*(1-t)-scale*depth*t;
    const erosion=fractalRock(x*.75,y*.9,z*.75+12)*.17*wall;
    x+=Math.cos(a)*erosion;z+=Math.sin(a)*erosion;y+=erosion*.24;
    rockPositions.push(x,y,z);rockUvs.push(i/segments,t);
  }
  for(let row=0;row<rockRings;row++)for(let i=0;i<segments;i++){
    const a=row*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;rockIndices.push(a,b,c,b,d,c);
  }
  const bottom=rockPositions.length/3;rockPositions.push(scale*1.1,-scale*3.05,-scale*.6);rockUvs.push(.5,1);
  for(let i=0;i<segments;i++)rockIndices.push(bottom,rockRings*(segments+1)+i,rockRings*(segments+1)+i+1);
  const rock=geometry(rockPositions,rockUvs,rockIndices);weldSeam(rock,0,rockRings+1);
  for(const [g,m,name] of [[meadow,materials.grass,'lookout-meadow'],[rock,materials.rock,'lookout-fractal-rock']]){
    const mesh=new THREE.Mesh(g,m);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }
  let rimError=0;
  for(let i=0;i<=segments;i++){
    const edge=index(topRings,i),p=rock.attributes.position;
    rimError=Math.max(rimError,Math.hypot(top.getX(edge)-p.getX(i),top.getY(edge)-p.getY(i),top.getZ(edge)-p.getZ(i)));
  }
  const stats={scale,segments,topRings,rockRings,triangles:(indices.length+rockIndices.length)/3,
    width:Math.max(...outline.map(p=>p[0]))-Math.min(...outline.map(p=>p[0])),
    rimError,drawCalls:2};
  group.userData.lookout=stats;
  return {group,radius,stats};
}
