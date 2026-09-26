import { buildPavilion, buildTree } from './sky-castle-models.js';

/**
 * A small hilltop precinct around the existing keep. All dimensions are world
 * units: the surrounding island may grow, but its masonry and buildings do not.
 * Geometry is batched by the supplied live materials for every art direction.
 */
export function buildAcropolis(THREE, materials, terrain) {
  const group = new THREE.Group();
  group.name = 'hilltop-castle-precinct';
  const anchor = terrain.castleAnchor, yaw = .17;
  const cosine = Math.cos(yaw), sine = Math.sin(yaw);
  group.position.set(anchor.x, 0, anchor.z);
  group.rotation.y = yaw;
  const world = (x,z) => ({x:anchor.x+cosine*x+sine*z,z:anchor.z-sine*x+cosine*z});
  const ground = (x,z) => {const p=world(x,z);return terrain.height(p.x,p.z);};
  const bags = new Map(), disposable = new Set();
  const matrix = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3();
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3(), scaling = new THREE.Vector3();
  const geometry = value => {disposable.add(value);return value;};
  const block = geometry(new THREE.BoxGeometry(1,1,1));
  const column = geometry(new THREE.CylinderGeometry(1,1,1,24));
  const taperedColumn = geometry(new THREE.CylinderGeometry(.94,1,1,32));
  const roofCone = geometry(new THREE.ConeGeometry(1,1,40));
  const finial = geometry(new THREE.SphereGeometry(1,10,6));

  function append(shape,key,transform) {
    if(!materials[key])throw new Error(`Acropolis material '${key}' is missing`);
    if(!bags.has(key))bags.set(key,{positions:[],normals:[],uvs:[],indices:[]});
    const bag=bags.get(key),p=shape.attributes.position,n=shape.attributes.normal,uv=shape.attributes.uv;
    const offset=bag.positions.length/3;
    normalMatrix.getNormalMatrix(transform);
    for(let i=0;i<p.count;i++){
      point.fromBufferAttribute(p,i).applyMatrix4(transform);
      normal.fromBufferAttribute(n,i).applyNormalMatrix(normalMatrix);
      bag.positions.push(point.x,point.y,point.z);bag.normals.push(normal.x,normal.y,normal.z);
      bag.uvs.push(uv?uv.getX(i):0,uv?uv.getY(i):0);
    }
    if(shape.index)for(const index of shape.index.array)bag.indices.push(offset+index);
    else for(let i=0;i<p.count;i++)bag.indices.push(offset+i);
  }
  function stamp(shape,key,p,s=[1,1,1],rotation=[0,0,0]) {
    position.set(...p);scaling.set(...s);quaternion.setFromEuler(new THREE.Euler(...rotation));
    matrix.compose(position,quaternion,scaling);append(shape,key,matrix);
  }
  function beam(a,b,radius,key='gold') {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);
    quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize());
    matrix.compose(start.add(end).multiplyScalar(.5),quaternion,scaling.set(radius,direction.length(),radius));
    append(column,key,matrix);
  }
  function archPath(width,height,bottom=0,ShapeType=THREE.Path) {
    const shape=new ShapeType(),r=width/2,spring=bottom+height-r;
    shape.moveTo(-r,bottom);shape.lineTo(r,bottom);shape.lineTo(r,spring);
    shape.absarc(0,spring,r,0,Math.PI,false);shape.lineTo(-r,bottom);return shape;
  }
  function archWall(width,height,opening,openingHeight,depth) {
    const wall=new THREE.Shape();wall.moveTo(-width/2,0);wall.lineTo(width/2,0);
    wall.lineTo(width/2,height);wall.lineTo(-width/2,height);wall.closePath();
    wall.holes.push(archPath(opening,openingHeight,.006));
    const g=geometry(new THREE.ExtrudeGeometry(wall,{depth,bevelEnabled:false,curveSegments:20}));
    g.translate(0,0,-depth/2);return g;
  }

  // Fit the entrance to the already-authored approach rather than redirecting
  // the island trail. All other precinct dimensions remain fixed in world units.
  const gateZ=5.6;
  let gateX=1.15,gateDistance=Infinity;
  if(terrain.trail)for(const p of terrain.trail.getPoints(800)){
    const dx=p.x-anchor.x,dz=p.z-anchor.z,x=cosine*dx-sine*dz,z=sine*dx+cosine*dz;
    if(Math.abs(z-gateZ)<gateDistance){gateDistance=Math.abs(z-gateZ);gateX=x;}
  }
  gateX=Math.max(-3.2,Math.min(3.2,gateX));
  const courtY=anchor.y+.022;
  const enclosure=[[-6.5,-4.7],[-5.4,-5.8],[5.3,-5.8],[6.5,-4.6],[6.5,4.5],[5.4,5.6],[-5.4,5.6],[-6.5,4.5]];
  const outerTerrace=[[-7.7,-4.8],[-5.9,-6.6],[5.8,-6.6],[7.7,-4.7],[7.7,4.7],[5.9,6.6],[-5.9,6.6],[-7.7,4.7]];

  // A smaller clipped court runs directly to the existing keep's foundation.
  // Its surface is only 22 mm above grade, below the keep's upper entry steps.
  const court=new THREE.Shape();
  [[-4.05,-2.10],[-3.15,-3.05],[3.15,-3.05],[4.05,-2.15],[4.05,2.00],[3.18,3.10],[-3.05,3.10],[-4.05,2.03]].forEach(([x,z],i)=>i?court.lineTo(x,z):court.moveTo(x,z));
  court.closePath();
  const paving=geometry(new THREE.ShapeGeometry(court,1));
  paving.rotateX(-Math.PI/2);
  stamp(paving,'stone',[0,courtY,0]);

  // Two contour-following terrace edges are shallow enough to remain ordinary
  // human-scale steps. Foundations extend into sampled ground on every segment.
  function retainingSegment(a,b,width,rise,key='stone') {
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),count=Math.ceil(length/.72);
    const rotation=-Math.atan2(dz,dx);
    for(let i=0;i<count;i++){
      const t=(i+.5)/count,x=a[0]+dx*t,z=a[1]+dz*t;
      const sample=ground(x,z),top=Math.max(courtY-.045,sample+.035)+rise;
      const acrossX=Math.sin(rotation)*width*.5,acrossZ=Math.cos(rotation)*width*.5;
      const bottom=Math.min(sample,ground(x+acrossX,z+acrossZ),ground(x-acrossX,z-acrossZ))-.055;
      stamp(block,key,[x,(bottom+top)/2,z],[length/count-.006,top-bottom,width],[0,rotation,0]);
      stamp(block,'stoneLight',[x,top+.022,z],[length/count-.006,.044,width+.055],[0,rotation,0]);
    }
  }
  // Surviving terrace fragments collect in unequal garden corners; there is
  // no second continuous outline around the enclosure.
  retainingSegment([-7.7,-1.55],outerTerrace[0],.30,.025);
  retainingSegment(outerTerrace[0],outerTerrace[1],.30,.025);
  retainingSegment(outerTerrace[1],[-2.35,-6.6],.30,.025);
  retainingSegment([7.7,3.20],outerTerrace[4],.30,.025);
  retainingSegment(outerTerrace[4],outerTerrace[5],.30,.025);
  retainingSegment(outerTerrace[5],[3.65,6.6],.30,.025);
  for(const side of [-1,1]){
    // Short flights connect the side terraces to the court.
    for(let step=0;step<3;step++){
      const x=side*(4.45+step*.18),z=side<0?-2.18:1.53,y=ground(x,z)+.10-step*.033;
      stamp(block,'stone',[x,y,z],[.195,.068,.74]);
    }
  }

  // A weathered low enclosure provides a readable precinct outline. Broad wall
  // sections and a few cap interruptions replace rows of decorative brick bits.
  function enclosureWall(a,b,wallHeight=.58) {
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),count=Math.ceil(length/1.05),rotation=-Math.atan2(dz,dx);
    for(let i=0;i<count;i++){
      const t=(i+.5)/count,x=a[0]+dx*t,z=a[1]+dz*t,bottom=ground(x,z)-.06;
      const top=Math.max(anchor.y+.06,ground(x,z)) +wallHeight-(i%11===7?.085:0);
      const courses=Math.max(3,Math.round((top-bottom)/.17)),courseHeight=(top-bottom)/courses;
      for(let row=0;row<courses;row++){
        // Broad staggered blocks expose shallow horizontal joints. Alternating
        // quarter-width ends give coursing without a noisy brick-per-draw-call wall.
        const splits=row%2?[0,.36,1]:[0,.70,1],unit=length/count;
        for(let piece=0;piece<splits.length-1;piece++){
          const left=splits[piece],right=splits[piece+1],offset=(left+right-1)*unit*.5;
          const worn=(i+row*3+piece*2)%17===9?.010:0;
          stamp(block,'stone',[x+Math.cos(rotation)*offset,bottom+(row+.5)*courseHeight,z-Math.sin(rotation)*offset],
            [unit*(right-left)-.009,courseHeight-.008-worn,.30-(row===0?.012:0)],[0,rotation,0]);
        }
      }
      stamp(block,'stoneLight',[x,top+.035,z],[length/count-.014,.07,.36],[0,rotation,0]);
      if(i%4===2)stamp(block,'stone',[x,top-.10,z],[.25,.39,.45],[0,rotation,0]);
    }
  }
  for(let i=0;i<enclosure.length;i++){
    const a=enclosure[i],b=enclosure[(i+1)%enclosure.length];
    if(i===5){enclosureWall(a,[gateX+1.08,gateZ]);enclosureWall([gateX-1.08,gateZ],b);}
    else enclosureWall(a,b,i<3?.68:.53);
  }

  // The real open gateway is the focal entrance from the existing walking path.
  const gateBase=ground(gateX,gateZ)-.025;
  stamp(archWall(2.16,1.55,1.27,1.24,.40),'stone',[gateX,gateBase,gateZ]);
  stamp(block,'stoneLight',[gateX,gateBase+1.575,gateZ],[2.30,.09,.52]);
  stamp(block,'stone',[gateX,gateBase+1.655,gateZ],[2.08,.07,.42]);
  const archRim=archPath(1.58,1.42,0,THREE.Shape);
  archRim.holes.push(archPath(1.28,1.25,.025));
  const rim=geometry(new THREE.ExtrudeGeometry(archRim,{depth:.07,bevelEnabled:false,curveSegments:20}));
  for(const side of [-1,1])stamp(rim,'stoneLight',[gateX,gateBase,gateZ+side*.21], [1,1,1], [0,side<0?Math.PI:0,0]);
  for(const side of [-1,1]){
    const x=gateX+side*.91;
    stamp(block,'stone',[x,gateBase+.18,gateZ],[.39,.36,.61]);
    stamp(block,'stoneLight',[x,gateBase+.385,gateZ],[.44,.05,.65]);
    beam([x,gateBase+.91,gateZ+.28],[x,gateBase+.91,gateZ+.45],.028,'wood');
    stamp(column,'gold',[x,gateBase+1.01,gateZ+.45],[.046,.16,.046]);
    stamp(finial,'gold',[x,gateBase+1.12,gateZ+.45],[.055,.067,.055]);
  }
  const approach=new THREE.CatmullRomCurve3([
    new THREE.Vector3(gateX,0,7.8),new THREE.Vector3(gateX,0,gateZ),
    new THREE.Vector3(gateX*.58,0,2.8),new THREE.Vector3(.05,0,1.55),
  ]);
  const pathP=[],pathU=[],pathI=[],pathSteps=64;
  for(let i=0;i<=pathSteps;i++){
    const t=i/pathSteps,p=approach.getPoint(t),tangent=approach.getTangent(t);
    for(const side of [-1,1]){
      const x=p.x+tangent.z*.43*side,z=p.z-tangent.x*.43*side;
      pathP.push(x,ground(x,z)+.030,z);pathU.push((side+1)/2,t*6);
    }
    if(i<pathSteps){const a=i*2;pathI.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const path=geometry(new THREE.BufferGeometry());
  path.setAttribute('position',new THREE.Float32BufferAttribute(pathP,3));path.setAttribute('uv',new THREE.Float32BufferAttribute(pathU,2));
  path.setIndex(pathI);path.computeVertexNormals();stamp(path,'stoneLight',[0,0,0]);

  function watchtower(x,z,height,roofHeight) {
    const base=ground(x,z)-.035,r=.44;
    stamp(column,'stone',[x,base+.105,z],[.58,.21,.58]);
    stamp(column,'stoneLight',[x,base+.23,z],[.54,.06,.54]);
    stamp(taperedColumn,'stone',[x,base+.23+height/2,z],[r,height,r]);
    stamp(column,'stoneLight',[x,base+.23+height,z],[r+.065,.085,r+.065]);
    stamp(roofCone,'roof',[x,base+.30+height+roofHeight/2,z],[r+.07,roofHeight,r+.07]);
    const tip=base+.30+height+roofHeight;
    beam([x,tip-.015,z],[x,tip+.15,z],.013);
    stamp(finial,'gold',[x,tip+.15,z],[.032,.038,.032]);
    const window=geometry(new THREE.ShapeGeometry(archPath(.14,.36,0,THREE.Shape),10));
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2,xx=x+Math.sin(a)*r*.995,zz=z+Math.cos(a)*r*.995;
      stamp(window,'dark',[xx,base+.42+height*.27,zz],[1,1,1],[0,a,0]);
    }
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5;
      beam([x+Math.sin(a)*(r+.065),base+.30+height,z+Math.cos(a)*(r+.065)],
        [x,tip,z],.007,'gold');
    }
  }
  watchtower(-5.65,4.67,1.13,.50);
  watchtower(5.58,-4.75,.96,.44);

  // Two open garden pavilions inherit the same authored model as the outlying
  // temples. Their meshes are merged into these batches, not new draw calls.
  const pavilion=buildPavilion(THREE,materials);
  pavilion.updateMatrixWorld(true);
  const materialKeys=new Map(Object.entries(materials).map(([key,value])=>[value,key]));
  for(const [x,z,size,rotation] of [[-3.94,-2.18,.66,-.20],[4.02,1.53,.59,.12]]){
    const base=ground(x,z)-.025;
    stamp(column,'stone',[x,base+.035,z],[.53,.12,.53]);
    const transform=new THREE.Matrix4().compose(new THREE.Vector3(x,base+.08,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,rotation,0)),new THREE.Vector3(size,size,size));
    pavilion.traverse(mesh=>{
      if(!mesh.isMesh)return;
      append(mesh.geometry,materialKeys.get(mesh.material),transform.clone().multiply(mesh.matrixWorld));
    });
  }
  pavilion.traverse(mesh=>{if(mesh.isMesh)disposable.add(mesh.geometry);});

  // Pruned cypresses in low stone planters restore a planted court after the
  // surrounding procedural scatter is cleared. They keep the same leaf detail
  // and live palette as the island's trees, at ordinary garden-tree dimensions.
  const planterBody=geometry(new THREE.CylinderGeometry(.33,.38,.24,24));
  const planterRim=geometry(new THREE.TorusGeometry(.326,.030,6,32));
  for(const [i,[x,z,height]] of [[-5.08,-2.5,.88],[-5.08,1.1,1.0],[5.05,-1.7,.94],[5.02,3.20,.84]].entries()){
    const base=ground(x,z)-.035;
    stamp(planterBody,'stone',[x,base+.12,z]);
    stamp(planterRim,'stoneLight',[x,base+.245,z],[1,1,1],[Math.PI/2,0,0]);
    stamp(column,'dark',[x,base+.232,z],[.302,.015,.302]);
    const tree=buildTree(THREE,materials,{height,kind:'cypress',seed:521+i*17});
    tree.updateMatrixWorld(true);
    const transform=new THREE.Matrix4().makeTranslation(x,base+.236,z);
    tree.traverse(mesh=>{
      if(!mesh.isMesh)return;
      append(mesh.geometry,materialKeys.get(mesh.material),transform.clone().multiply(mesh.matrixWorld));
      disposable.add(mesh.geometry);
    });
  }

  // Sparse wall ivy climbs actual outer masonry faces. Folded leaf geometry
  // uses the shared leafDetail material's base-to-tip vein UV convention.
  const ivy=geometry(new THREE.BufferGeometry());
  ivy.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.065,.11,.006,0,.21,0,.065,.11,.006,0,.095,.03],3));
  ivy.setAttribute('uv',new THREE.Float32BufferAttribute([0,.5,.5,0,1,.5,.5,1,.5,.5],2));
  ivy.setIndex([0,3,4,3,2,4,2,1,4,1,0,4]);ivy.computeVertexNormals();
  function wallIvy(x,z,nx,nz,phase) {
    const base=ground(x,z),angle=Math.atan2(nx,nz),tx=nz,tz=-nx;
    for(let stem=0;stem<4;stem++){
      const sideways=(stem-1.5)*.22,reach=.31+(stem%3)*.075;
      const start=[x+tx*sideways,base-.018,z+tz*sideways];
      const end=[start[0]+tx*Math.sin(stem+phase)*.065,base+reach,start[2]+tz*Math.sin(stem+phase)*.065];
      beam(start,end,.008,'trunk');
      for(let leaf=0;leaf<5;leaf++){
        const t=(leaf+.3)/5,side=leaf%2?1:-1;
        const px=start[0]+(end[0]-start[0])*t+nx*.009,pz=start[2]+(end[2]-start[2])*t+nz*.009;
        const size=.72+(leaf%3)*.14;
        stamp(ivy,'leafDetail',[px,base+t*reach,pz],[size,size,size],[.06,angle,side*(.54+(stem%2)*.16)]);
      }
    }
  }
  wallIvy(-6.675,-.1,-1,0,.7);
  wallIvy(-1.85,-5.985,0,-1,1.5);
  wallIvy(3.72,5.785,0,1,2.2);

  // A few benches make the court inhabited without adding a second settlement.
  for(const [x,z,rotation] of [[-3.3,2.55,0],[2.9,-2.55,Math.PI/2]]){
    const base=ground(x,z),c=Math.cos(rotation),s=Math.sin(rotation);
    for(const side of [-1,1]){
      stamp(block,'stone',[x+c*side*.34,base+.14,z-s*side*.34],[.12,.25,.30],[0,rotation,0]);
    }
    for(let slat=0;slat<3;slat++)stamp(block,'wood',[x+s*(slat-1)*.10,base+.30,z+c*(slat-1)*.10],[.92,.055,.08],[0,rotation,0]);
  }

  let triangles=0,vertices=0;
  for(const [key,bag] of bags){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(bag.positions,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(bag.normals,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(bag.uvs,2));g.setIndex(bag.indices);
    g.computeBoundingBox();g.computeBoundingSphere();
    const mesh=new THREE.Mesh(g,materials[key]);mesh.name=`acropolis-${key}`;mesh.castShadow=mesh.receiveShadow=true;
    group.add(mesh);triangles+=bag.indices.length/3;vertices+=bag.positions.length/3;
  }
  for(const g of disposable)g.dispose();
  const reservedPositions=[{x:anchor.x,z:anchor.z,radius:9.85}];
  const gate=world(gateX,gateZ);
  const stats={triangles,vertices,drawCalls:group.children.length,towers:2,pavilions:2,gateways:1,
    footprint:[15.4,14.5],maximumAddedHeight:2.12,planterTrees:4,ivyLeaves:60,
    gatePosition:[gate.x,gateBase,gate.z],clearingRadius:9.85};
  group.userData.kind='castle-precinct';
  return {group,reservedPositions,stats};
}
