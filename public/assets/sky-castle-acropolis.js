import { buildTree } from './sky-castle-models.js';

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

  // The surviving precinct is an accumulation of small rooms, garden walls
  // and an older ruined cloister. There is deliberately no regular outer ring.
  const random = (() => {let seed=3097;return()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};})();
  const materialKeys=new Map(Object.entries(materials).map(([key,value])=>[value,key]));
  const wornShape=new THREE.Shape();
  wornShape.moveTo(-.5,-.5);wornShape.lineTo(.5,-.5);wornShape.lineTo(.5,.30);
  wornShape.lineTo(.31,.5);wornShape.lineTo(-.37,.5);wornShape.lineTo(-.5,.38);wornShape.closePath();
  // Shallow rounded arrises catch light without turning every block into a
  // separate chunky cube. Corner chips change the silhouette only at breaks.
  const wornBlock=geometry(new THREE.ExtrudeGeometry(wornShape,{depth:.92,bevelEnabled:true,bevelSize:.032,bevelThickness:.04,bevelSegments:1,steps:1}));
  wornBlock.translate(0,0,-.46);
  const square=new THREE.Shape();square.moveTo(-.48,-.48);square.lineTo(.48,-.48);square.lineTo(.48,.48);square.lineTo(-.48,.48);square.closePath();
  const masonryBlock=geometry(new THREE.ExtrudeGeometry(square,{depth:.94,bevelEnabled:true,bevelSize:.020,bevelThickness:.03,bevelSegments:1,steps:1}));
  masonryBlock.translate(0,0,-.47);
  const ivy=geometry(new THREE.BufferGeometry());
  ivy.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,-.065,.11,.006,0,.21,0,.065,.11,.006,0,.095,.03],3));
  ivy.setAttribute('uv',new THREE.Float32BufferAttribute([0,.5,.5,0,1,.5,.5,1,.5,.5],2));
  ivy.setIndex([0,3,4,3,2,4,2,1,4,1,0,4]);ivy.computeVertexNormals();
  let ivyLeaves=0;
  function wallIvy(x,z,nx,nz,reach,width=.7,phase=0) {
    const base=ground(x,z),angle=Math.atan2(nx,nz),tx=nz,tz=-nx;
    for(let stem=0;stem<7;stem++){
      const sideways=(stem/6-.5)*width,top=reach*(.65+.35*Math.sin(stem*1.7+phase)**2);
      const start=[x+tx*sideways,base-.025,z+tz*sideways];
      const end=[start[0]+tx*Math.sin(stem+phase)*.12,base+top,start[2]+tz*Math.sin(stem+phase)*.12];
      beam(start,end,.007,'trunk');
      const count=Math.ceil(top/.085);
      for(let leaf=0;leaf<count;leaf++){
        const t=(leaf+.25)/count,side=leaf%2?1:-1;
        const px=start[0]+(end[0]-start[0])*t+nx*.015,pz=start[2]+(end[2]-start[2])*t+nz*.015;
        const size=.65+.30*Math.sin(stem*5+leaf*2.4)**2;
        stamp(ivy,'leafDetail',[px,base+t*top,pz],[size,size,size],[.1,angle,side*.64]);ivyLeaves++;
      }
    }
  }

  // Long low walls have broad missing sections, stepped fracture silhouettes,
  // and weathered blocks. Their foundations continue below the sampled slope.
  function ruinWall(a,b,heights,width=.42) {
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),yaw=-Math.atan2(dz,dx);
    const c=Math.cos(yaw),s=Math.sin(yaw),count=heights.length,unit=length/count;
    for(let i=0;i<count;i++){
      const x=a[0]+dx*(i+.5)/count,z=a[1]+dz*(i+.5)/count;
      const base=Math.min(ground(x,z),ground(x-s*width,z-c*width))-.055;
      const rows=Math.max(1,Math.round(heights[i]/.19));
      for(let row=0;row<rows;row++){
        const cuts=row%2?[0,.36,1]:[0,.66,1];
        for(let part=0;part<2;part++){
          const span=(cuts[part+1]-cuts[part])*unit,off=(cuts[part+1]+cuts[part]-1)*unit*.5;
          const top=row===rows-1,chip=top&&((i+part)%3!==0);
          const key=(i+row*3+part)%37===4?'rock':(i+row+part)%17===3?'stoneLight':'stone';
          stamp(chip?wornBlock:masonryBlock,key,[x+c*off,base+(row+.5)*.19,z-s*off],
            [span-.008,.184,width+(row===0?.035:0)],[0,yaw+(top?(random()-.5)*.025:0),0]);
        }
      }
      if(i%5===2&&rows>3)stamp(wornBlock,'stone',[x,base+.24,z],[.35,.58,width+.27],[0,yaw,0]);
    }
  }
  ruinWall([-5.7,-3.3],[-4.9,-5.1],[.30,.48,.83,1.02,1.22],.49);
  ruinWall([-4.9,-5.1],[-1.5,-4.65],[1.22,1.22,1.04,.86,.48,.28],.48);
  ruinWall([1.3,-4.5],[4.75,-3.5],[.45,.65,.90,1.04,.83,.62],.45);
  ruinWall([4.75,-3.5],[5.10,-.6],[.72,.89,.83,.66,.46],.43);
  ruinWall([5.18,1.85],[4.52,3.55],[.28,.45,.63,.46],.44);
  ruinWall([-5.18,1.0],[-4.72,3.73],[.43,.60,.79,.56,.26],.47);
  ruinWall([-4.72,3.73],[-2.82,4.10],[.28,.46,.43,.25],.40);

  // Stone paving is restricted to circulation and a small gathering place.
  // Uneven islands of paving allow the meadow to run into the architecture.
  function pavedPatch(points,key='stone') {
    const shape=new THREE.Shape();
    points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
    const g=geometry(new THREE.ShapeGeometry(shape));g.rotateX(-Math.PI/2);
    const p=g.attributes.position;
    for(let i=0;i<p.count;i++)p.setY(i,ground(p.getX(i),p.getZ(i))+.023);
    g.computeVertexNormals();stamp(g,key,[0,0,0]);
  }
  pavedPatch([[-1.36,1.0],[-.56,.72],[1.34,.95],[2.10,1.46],[2.0,2.04],[1.33,2.3],[.72,2.10],[.31,2.54],[-.61,2.39],[-1.55,1.73]]);
  pavedPatch([[-3.45,-.18],[-2.12,-.35],[-1.64,.27],[-1.54,1.17],[-2.41,1.45],[-3.39,.95]]);

  // The old entrance still follows the original trail. Its voussoir arch is
  // open in both directions; one pier and a short wall survive above the other.
  const gateZ=5.15;let gateX=1.15,gateDistance=Infinity;
  if(terrain.trail)for(const p of terrain.trail.getPoints(800)){
    const dx=p.x-anchor.x,dz=p.z-anchor.z,x=cosine*dx-sine*dz,z=sine*dx+cosine*dz;
    if(Math.abs(z-gateZ)<gateDistance){gateDistance=Math.abs(z-gateZ);gateX=x;}
  }
  gateX=Math.max(-3.2,Math.min(3.2,gateX));
  const gateBase=ground(gateX,gateZ)-.025,opening=.59,spring=.72,ring=.23;
  for(const side of [-1,1]){
    const x=gateX+side*(opening+ring*.5);
    for(let row=0;row<4;row++)stamp(wornBlock,'stone',[x,gateBase+(row+.5)*.19,gateZ],[ring+.035,.184,.48]);
    stamp(block,'stone',[x,gateBase+.065,gateZ],[.39,.16,.65]);
  }
  for(let i=0;i<11;i++){
    const a=i/11*Math.PI+.006,b=(i+1)/11*Math.PI-.006;
    const shape=new THREE.Shape();shape.moveTo(Math.cos(a)*opening,Math.sin(a)*opening+spring);
    shape.absarc(0,spring,opening,a,b,false);shape.lineTo(Math.cos(b)*(opening+ring),Math.sin(b)*(opening+ring)+spring);
    shape.absarc(0,spring,opening+ring,b,a,true);shape.closePath();
    const archStone=geometry(new THREE.ExtrudeGeometry(shape,{depth:.48,bevelEnabled:false,curveSegments:4}));
    stamp(archStone,i===6?'stoneLight':'stone',[gateX,gateBase,gateZ-.24]);
  }
  ruinWall([gateX-.73,gateZ],[gateX-2.08,gateZ-.32],[1.50,1.31,.94],.48);
  ruinWall([gateX+.73,gateZ],[gateX+2.12,gateZ-.35],[.77,.56,.34],.46);

  const approach=new THREE.CatmullRomCurve3([
    new THREE.Vector3(gateX,0,7.8),new THREE.Vector3(gateX,0,gateZ),
    new THREE.Vector3(gateX*.52,0,3.05),new THREE.Vector3(.20,0,1.95),new THREE.Vector3(.08,0,.74),
  ]);
  const pathP=[],pathU=[],pathI=[],pathSteps=72;
  for(let i=0;i<=pathSteps;i++){
    const t=i/pathSteps,p=approach.getPoint(t),tangent=approach.getTangent(t);
    const width=.34+.055*Math.sin(t*17)+.026*Math.cos(t*39);
    for(const side of [-1,1]){
      const x=p.x+tangent.z*width*side,z=p.z-tangent.x*width*side;
      pathP.push(x,ground(x,z)+.034,z);pathU.push((side+1)/2,t*6);
    }
    if(i<pathSteps){const a=i*2;pathI.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const path=geometry(new THREE.BufferGeometry());path.setAttribute('position',new THREE.Float32BufferAttribute(pathP,3));
  path.setAttribute('uv',new THREE.Float32BufferAttribute(pathU,2));path.setIndex(pathI);path.computeVertexNormals();stamp(path,'stone',[0,0,0]);
  // A few broad displaced paving slabs, rather than a continuous bright border.
  for(let i=0;i<17;i++){
    const t=.12+i*.044,p=approach.getPoint(t),tangent=approach.getTangent(t),side=i%2?1:-1;
    if(i%4===1)continue;
    const x=p.x+tangent.z*side*.35,z=p.z-tangent.x*side*.35;
    stamp(wornBlock,i%5===0?'rock':'stone',[x,ground(x,z)+.025,z],[.24,.042,.21],[.015,-Math.atan2(tangent.z,tangent.x)+(random()-.5)*.35,0]);
  }

  function archedWindow(x,y,z,width,height,yaw=0,door=false) {
    stamp(geometry(new THREE.ShapeGeometry(archPath(width,height,0,THREE.Shape),12)),door?'wood':'dark',[x,y,z],[1,1,1],[0,yaw,0]);
    const rim=archPath(width+.095,height+.063,-.023,THREE.Shape);
    rim.holes.push(archPath(width,height,.003));
    stamp(geometry(new THREE.ExtrudeGeometry(rim,{depth:.035,bevelEnabled:false,curveSegments:12})),
      'stone',[x,y,z],[1,1,1],[0,yaw,0]);
    if(door)for(let plank=1;plank<5;plank++){
      const u=(plank/5-.5)*width;
      const px=x+Math.cos(yaw)*u,pz=z-Math.sin(yaw)*u;
      stamp(block,'dark',[px,y+height*.38,pz],[.008,height*.72,.016],[0,yaw,0]);
    }
  }
  function roofedHouse(x,z,width,depth,height,rotation=0) {
    const c=Math.cos(rotation),s=Math.sin(rotation),at=(u,v)=>[x+c*u+s*v,z-s*u+c*v];
    const corners=[at(-width/2,-depth/2),at(width/2,-depth/2),at(width/2,depth/2),at(-width/2,depth/2)];
    const grade=Math.max(...corners.map(([x,z])=>ground(x,z))),bottom=Math.min(...corners.map(([x,z])=>ground(x,z)))-.10;
    const top=grade+height;
    stamp(block,'stone',[x,(bottom+top)/2,z],[width,top-bottom,depth],[0,rotation,0]);
    stamp(block,'rock',[x,grade+.045,z],[width+.045,.11,depth+.045],[0,rotation,0]);
    // Large repaired plaster patches are implied by stone block faces around
    // the edges; joints and quoins have plausible physical masonry dimensions.
    for(let side of [-1,1]){
      for(let row=0;row<Math.ceil(height/.20);row++){
        const y=grade+.16+row*.20;if(y>top-.06)continue;
        for(let i=0;i<Math.ceil(width/.46);i++){
          const u=-width/2+(i+.5)*width/Math.ceil(width/.46),[xx,zz]=at(u,side*(depth/2+.005));
          if(row%3===1&&i%3===1)continue;
          stamp(block,'stoneLight',[xx,y,zz],[width/Math.ceil(width/.46)-.018,.012,.012],[0,rotation,0]);
        }
      }
      const count=Math.max(1,Math.round(width/.72));
      for(let i=0;i<count;i++){
        const [xx,zz]=at((i-(count-1)/2)*.63,side*(depth/2+.012));
        if(side<0||Math.abs((i-(count-1)/2)*.63-width*.27)>.30)
          archedWindow(xx,grade+.43,zz,.16,Math.min(.35,height-.48),rotation+(side<0?Math.PI:0));
      }
    }
    const door=at(width*.27,depth/2+.014);archedWindow(door[0],grade+.035,door[1],.22,.52,rotation,true);
    for(const side of [-1,1]){
      const gable=at(side*(width/2+.012),-.04);
      archedWindow(gable[0],grade+height*.47,gable[1],.17,.31,rotation+side*Math.PI/2);
    }
    const rise=depth*.33,roofShape=new THREE.Shape();roofShape.moveTo(-depth/2-.10,0);
    roofShape.lineTo(0,rise);roofShape.lineTo(depth/2+.1,0);roofShape.closePath();
    const roof=geometry(new THREE.ExtrudeGeometry(roofShape,{depth:width+.18,bevelEnabled:false}));
    const start=at(-(width+.18)/2,0);
    stamp(roof,'roof',[start[0],top+.015,start[1]],[1,1,1],[0,rotation+Math.PI/2,0]);
    for(const side of [-1,1])for(let row=1;row<=4;row++){
      const t=row/5,aa=at(-width/2-.095,side*(depth/2+.1)*t),bb=at(width/2+.095,side*(depth/2+.1)*t);
      beam([aa[0],top+.025+rise*(1-t),aa[1]],[bb[0],top+.025+rise*(1-t),bb[1]],.017,'roof');
    }
    // Only a few clay chimney stacks distinguish the inhabited wings.
    if(width>1.7){const [xx,zz]=at(-width*.29,-depth*.12);stamp(wornBlock,'stone',[xx,top+rise*.87,zz],[.20,.45,.23],[0,rotation,0]);}
  }
  // Four low attached wings make the original tiny keep part of a coherent
  // monastery-like ensemble. None grows with the island or reaches its spire.
  roofedHouse(-1.62,-.58,1.65,1.05,1.00,.04);
  roofedHouse(.02,-1.44,2.62,1.08,1.24,0);
  roofedHouse(1.61,-.72,1.04,1.54,.96,-.07);
  roofedHouse(-3.00,-1.73,1.32,1.65,1.35,-.12);

  // An incomplete cloister links the chapel to a garden. The last broken arch
  // and foundation outline communicate former rooms, rather than a new fence.
  const cloisterY=ground(-3.48,-.13)-.025;
  const cloister=archWall(1.04,1.14,.66,.93,.25);
  for(let bay=0;bay<3;bay++)stamp(cloister,'stone',[-3.38,cloisterY,.10+bay*.89],[1,1,1],[0,Math.PI/2,0]);
  ruinWall([-3.40,2.10],[-3.55,2.97],[.96,.58],.27);
  ruinWall([-3.45,-.5],[-5.00,-1.1],[.27,.46,.46,.28],.36);
  ruinWall([-5.00,-1.1],[-5.28,.26],[.27,.45,.64],.38);

  function ruinedTower(x,z,radius,height) {
    const base=ground(x,z)-.055,count=64,rings=16,outer=[],inner=[],indices=[],uvs=[];
    // An eroded continuous shell carries the load; only its broken crown has
    // individual missing stones. Broad smooth faces replace the voxel cylinder.
    const topAt=a=>height*(.90+.055*Math.sin(a*3+.4)+.035*Math.sin(a*7))
      -height*.36*Math.exp(-(((a-2.35)/.64)**4));
    const shell=(inside)=>{
      const positions=[];
      for(let row=0;row<=rings;row++)for(let i=0;i<=count;i++){
        const a=i/count*Math.PI*2,t=row/rings,y=topAt(a)*t;
        const erosion=.008*Math.sin(a*5+y*3)+.006*Math.sin(a*11-y*5);
        const r=radius-(inside?.225:0)+erosion+(1-t)*.025;
        positions.push(x+Math.sin(a)*r,base+y,z+Math.cos(a)*r);
      }
      return positions;
    };
    outer.push(...shell(false));inner.push(...shell(true));
    const positions=[...outer,...inner],offset=outer.length/3;
    for(let surface=0;surface<2;surface++)for(let row=0;row<rings;row++)for(let i=0;i<count;i++){
      const a=surface*offset+row*(count+1)+i,b=a+count+1;
      if(surface===0)indices.push(a,a+1,b,a+1,b+1,b);else indices.push(a,b,a+1,a+1,b,b+1);
    }
    for(let i=0;i<count;i++){
      const a=rings*(count+1)+i,b=offset+a;
      indices.push(a,a+1,b,a+1,b+1,b);
    }
    for(let i=0;i<positions.length/3;i++)uvs.push((i%(count+1))/count,Math.floor((i%offset)/(count+1))/rings);
    const shellGeometry=geometry(new THREE.BufferGeometry());
    shellGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    shellGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));shellGeometry.setIndex(indices);shellGeometry.computeVertexNormals();
    stamp(shellGeometry,'stone',[0,0,0]);
    // Fine courses are in relief, interrupted by the actual fractured top.
    for(let row=1;row<Math.floor(height/.19);row++)for(let i=0;i<32;i++){
      const a=(i+.5)/32*Math.PI*2,y=row*.19;if(y>topAt(a)-.04)continue;
      const r=radius+.003+(1-y/topAt(a))*.025+.008*Math.sin(a*5+y*3)+.006*Math.sin(a*11-y*5);
      stamp(block,'stoneLight',[x+Math.sin(a)*r,base+y,z+Math.cos(a)*r],[Math.PI*2*radius/32,.009,.014],[0,a,0]);
    }
    for(const a of [.32,.75,1.10,3.7,4.1,4.56,5.16]){
      stamp(wornBlock,'stone',[x+Math.sin(a)*(radius-.09),base+topAt(a)-.025,z+Math.cos(a)*(radius-.09)],
        [.20,.115,.27],[.025,a,.03*Math.sin(a*3)]);
    }
    stamp(column,'stone',[x,base+.075,z],[radius+.085,.15,radius+.085]);
  }
  ruinedTower(-4.40,-3.51,.61,1.61);
  ruinedTower(4.66,-2.91,.47,1.05);

  // Unequal living gardens sit in the sheltered former rooms. These are tree
  // models at their original physical scale, sharing the live leaf materials.
  for(const [i,[x,z,height,kind]] of [[-4.28,.06,1.48,'broadleaf'],[-4.05,1.46,1.21,'cypress'],[3.11,-2.36,1.18,'cypress'],[3.54,1.71,1.39,'broadleaf']].entries()){
    const tree=buildTree(THREE,materials,{height,kind,seed:791+i*29});tree.updateMatrixWorld(true);
    const transform=new THREE.Matrix4().makeTranslation(x,ground(x,z)-.012,z);
    tree.traverse(mesh=>{if(!mesh.isMesh)return;append(mesh.geometry,materialKeys.get(mesh.material),transform.clone().multiply(mesh.matrixWorld));disposable.add(mesh.geometry);});
  }
  wallIvy(-3.76,-1.72,-Math.cos(-.12),Math.sin(-.12),.87,.71,.8);
  wallIvy(-3.525,1.0,-1,0,.81,1.10,1.7);
  wallIvy(1.0,-2.012,0,-1,1.02,.66,2.1);
  wallIvy(5.04,-2.10,1,0,.54,.9,.3);
  wallIvy(gateX-1.47,gateZ-.095,0,1,.71,.72,2.8);
  // Collapsed masonry remains concentrated at broken ends and the ruined tower.
  for(const [x,z] of [[-5.18,-2.46],[-2.10,-4.73],[4.78,.0],[-4.05,3.85],[gateX+2.02,gateZ-.21]]){
    for(let i=0;i<4;i++){
      const xx=x+(random()-.5)*.48,zz=z+(random()-.5)*.43,h=.11+random()*.06;
      stamp(wornBlock,i===2?'rock':'stone',[xx,ground(xx,zz)+h*.35,zz],[.24+random()*.15,h,.19+random()*.1],[random()*.10,random()*2.8,random()*.12]);
    }
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
  const bounds=new THREE.Box3().setFromObject(group),size=bounds.getSize(new THREE.Vector3());
  const stats={triangles,vertices,drawCalls:group.children.length,towers:2,pavilions:0,gateways:1,houses:4,
    footprint:[size.x,size.z],maximumAddedHeight:bounds.max.y-anchor.y,gardenTrees:4,ivyLeaves,
    gatePosition:[gate.x,gateBase,gate.z],clearingRadius:9.85};
  group.userData.kind='castle-precinct';
  return {group,reservedPositions,stats};
}
