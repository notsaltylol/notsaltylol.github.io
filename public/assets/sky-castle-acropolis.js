import { buildTree, createHippedRoofGeometry } from './sky-castle-models.js';

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
  const ground = (x,z) => {const p=world(x,z),y=terrain.surfaceHeight?.(p.x,p.z);return Number.isFinite(y)?y:terrain.height(p.x,p.z);};
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
      const base=ground(x,z)-.045;
      let foot=base-.02;
      for(const along of [-1,1])for(const across of [-1,1])foot=Math.min(foot,
        ground(x+c*along*unit*.52+s*across*width*.52,z-s*along*unit*.52+c*across*width*.52)-.06);
      if(foot<base-.025)stamp(block,'stone',[x,(foot+base+.06)/2,z],[unit-.008,base+.06-foot,width+.03],[0,yaw,0]);
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

  // Individual small flags share a connected footprint. Each corner follows
  // the ground, so neither the court nor a winding path becomes a floating
  // polygon when the natural hill changes under the precinct.
  let pavingStones=0;
  function flag(corners,key='stone',offset=.025) {
    const top=corners.map(([x,z])=>[x,ground(x,z)+offset,z]);
    const bottom=corners.map(([x,z])=>[x,ground(x,z)-.035,z]);
    const p=[],uv=[],index=[];
    for(const v of [...top,...bottom]){p.push(...v);uv.push(v[0],v[2]);}
    index.push(0,2,1,0,3,2,4,5,6,4,6,7);
    for(let i=0;i<4;i++){const j=(i+1)%4;index.push(i,j,i+4,j,j+4,i+4);}
    const g=geometry(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();
    stamp(g,key,[0,0,0]);pavingStones++;
  }
  function paveCurve(points,halfWidth=.28) {
    const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)));
    const rows=Math.ceil(curve.getLength()/.24),columns=Math.max(2,Math.round(halfWidth*2/.23));
    function corner(t,u){const p=curve.getPointAt(t),d=curve.getTangentAt(t);return[p.x+d.z*u,p.z-d.x*u];}
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const t0=(row+.022)/rows,t1=(row+.978)/rows;
      const u0=-halfWidth+(col+.025)*halfWidth*2/columns,u1=-halfWidth+(col+.975)*halfWidth*2/columns;
      flag([corner(t0,u0),corner(t0,u1),corner(t1,u1),corner(t1,u0)]);
    }
    return curve;
  }
  function pavedCourt(outline) {
    const inside=(x,z)=>{let hit=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){
      const a=outline[i],b=outline[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
    }return hit;};
    for(let row=0;row<8;row++)for(let col=0;col<13;col++){
      const x=-1.9+col*.29+(row%2)*.145,z=.63+row*.23;
      const corners=[[x+.007,z+.007],[x+.283,z+.007],[x+.283,z+.223],[x+.007,z+.223]];
      if(corners.every(p=>inside(...p)))flag(corners,'stone',.027);
    }
  }
  pavedCourt([[-1.42,.65],[1.20,.66],[1.92,1.20],[1.70,2.08],[.68,2.36],[-.78,2.26],[-1.73,1.67]]);
  paveCurve([[-1.25,1.62],[-2.14,1.00],[-2.98,.40],[-2.98,-.40],[-2.78,-.93]],.21);
  paveCurve([[-1.14,1.04],[-1.20,.40],[-1.20,-.08]],.22);
  paveCurve([[1.22,1.62],[1.84,.85],[1.94,.06]],.22);

  // The old entrance still follows the original trail. Its voussoir arch is
  // open in both directions; one pier and a short wall survive above the other.
  const gateZ=5.15;let gateX=1.15,gateDistance=Infinity,entryX=1.15,entryDistance=Infinity;
  if(terrain.trail)for(const p of terrain.trail.getPoints(800)){
    const dx=p.x-anchor.x,dz=p.z-anchor.z,x=cosine*dx-sine*dz,z=sine*dx+cosine*dz;
    if(Math.abs(z-gateZ)<gateDistance){gateDistance=Math.abs(z-gateZ);gateX=x;}
    if(Math.abs(z-7.8)<entryDistance){entryDistance=Math.abs(z-7.8);entryX=x;}
  }
  gateX=Math.max(-3.2,Math.min(3.2,gateX));
  // The terrain trail meets this paved entrance; it must not continue as a
  // second almost-coplanar strip through the flagstones and keep courtyard.
  const approach=terrain.group.getObjectByName('limestone-walking-route');
  if(approach&&terrain.scale>2){
    const p=approach.geometry.attributes.position,columns=approach.geometry.userData.pathColumns||1,stride=columns+1,rows=p.count/stride;
    for(let row=0;row<rows;row++){
      const x=(p.getX(row*stride)+p.getX(row*stride+columns))/2-anchor.x;
      const z=(p.getZ(row*stride)+p.getZ(row*stride+columns))/2-anchor.z;
      if(sine*x+cosine*z<=7.80){approach.geometry.setDrawRange(0,row*columns*6);break;}
    }
  }

  const gateBase=Math.max(ground(gateX,gateZ),ground(gateX-.75,gateZ),ground(gateX+.75,gateZ))+.015,opening=.59,spring=.72,ring=.23;
  for(const side of [-1,1]){
    const x=gateX+side*(opening+ring*.5);
    for(let row=0;row<4;row++)stamp(wornBlock,'stone',[x,gateBase+(row+.5)*.19,gateZ],[ring+.035,.184,.48]);
    const foot=ground(x,gateZ)-.07;
    stamp(masonryBlock,'stone',[x,(foot+gateBase+.13)/2,gateZ],[.39,gateBase+.13-foot,.65]);
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

  // The entrance neck meets the island's existing narrow limestone trail;
  // inside the gate it widens into the small forecourt, with no detached slabs.
  paveCurve([[entryX,7.8],[(entryX+gateX)/2,6.45],[gateX,5.15]],.20);
  paveCurve([[gateX,5.17],[gateX*.68,3.78],[.24,2.36],[.08,.74]],.32);
  // A supported threshold ties the gate piers together. Two shallow steps make
  // any small cross-slope difference explicit instead of leaving an air gap.
  for(let step=0;step<2;step++){
    const z=gateZ+.21-step*.22,top=gateBase+.012+step*.016;
    const bottom=Math.min(ground(gateX-.60,z),ground(gateX+.60,z))-.04;
    stamp(masonryBlock,'stone',[gateX,(top+bottom)/2,z],[1.22,top-bottom,.25]);
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
  function hipRoof(x,y,z,width,depth,rise,rotation=0,dormer=false) {
    const c=Math.cos(rotation),s=Math.sin(rotation),at=(u,v)=>[x+c*u+s*v,z-s*u+c*v];
    const hip=Math.min(depth*.43,width*.22),ridge=width/2-hip;
    stamp(geometry(createHippedRoofGeometry(THREE,{width,depth,rise,hip,thickness:.042})),
      'roof',[x,y,z],[1,1,1],[0,rotation,0]);
    stamp(block,'wood',[x,y-.043,z],[width-.036,.055,depth-.036],[0,rotation,0]);
    const a=at(-ridge,0),b=at(ridge,0);beam([a[0],y+rise+.012,a[1]],[b[0],y+rise+.012,b[1]],.027,'roof');
    // Overlapping courses end at the hips. Diagonal caps meet the ridge rather
    // than drawing parallel bars past the roof's triangular end planes.
    for(const side of [-1,1]){
      for(let row=1;row<=5;row++){
        const t=row/6,half=ridge+hip*t,p=at(-half,side*depth/2*t),q=at(half,side*depth/2*t);
        beam([p[0],y+rise*(1-t)+.009,p[1]],[q[0],y+rise*(1-t)+.009,q[1]],.010,'roof');
      }
      for(const end of [-1,1]){
        const p=at(end*ridge,0),q=at(end*width/2,side*depth/2);
        beam([p[0],y+rise+.012,p[1]],[q[0],y+.012,q[1]],.019,'roof');
      }
      const count=Math.ceil(width/.24);
      for(let i=0;i<count;i++){
        const p=at(-width/2+(i+.5)*width/count,side*(depth/2-.045));
        stamp(block,'wood',[p[0],y-.075,p[1]],[.031,.075,.13],[0,rotation,0]);
      }
    }
    if(dormer){
      const p=at(-width*.12,depth*.23),base=y+rise*.32;
      stamp(block,'stone',[p[0],base+.115,p[1]],[.30,.23,.30],[0,rotation,0]);
      const front=at(-width*.12,depth*.23+.153);
      archedWindow(front[0],base+.018,front[1],.13,.19,rotation);
      stamp(geometry(createHippedRoofGeometry(THREE,{width:.40,depth:.38,rise:.16,hip:.045,thickness:.024})),
        'roof',[p[0],base+.246,p[1]],[1,1,1],[0,rotation,0]);
    }
  }
  function roofedHouse(x,z,width,depth,height,rotation=0,dormer=false) {
    const c=Math.cos(rotation),s=Math.sin(rotation),at=(u,v)=>[x+c*u+s*v,z-s*u+c*v];
    const samples=[];for(const u of [-.5,0,.5])for(const v of [-.5,0,.5]){const p=at(u*width,v*depth);samples.push(ground(...p));}
    const grade=Math.max(...samples),bottom=Math.min(...samples)-.10,top=grade+height;
    stamp(block,'stone',[x,(bottom+top)/2,z],[width,top-bottom,depth],[0,rotation,0]);
    stamp(block,'stone',[x,grade+.045,z],[width+.055,.12,depth+.055],[0,rotation,0]);
    stamp(block,'stoneLight',[x,top-.056,z],[width+.055,.045,depth+.055],[0,rotation,0]);
    // Corner quoins, window sills and recessed timber shutters communicate
    // construction. The middle of the plaster wall stays visually quiet.
    for(const end of [-1,1])for(const side of [-1,1])for(let row=0;row<Math.ceil(height/.17);row++){
      const p=at(end*(width/2-.047),side*(depth/2+.006));
      const span=row%2?.14:.085;
      stamp(masonryBlock,'stoneLight',[p[0],grade+.08+row*.17,p[1]],[span,.12,.035],[0,rotation,0]);
    }
    for(const side of [-1,1]){
      const count=Math.max(1,Math.round(width/.72));
      for(let i=0;i<count;i++){
        const u=(i-(count-1)/2)*.63,p=at(u,side*(depth/2+.012));
        if(side>0&&Math.abs(u-width*.27)<=.30)continue;
        archedWindow(p[0],grade+.43,p[1],.16,Math.min(.35,height-.48),rotation+(side<0?Math.PI:0));
        const sill=at(u,side*(depth/2+.044));stamp(block,'stone',[sill[0],grade+.405,sill[1]],[.27,.036,.09],[0,rotation,0]);
        if(i%2===0)for(const shutter of [-1,1]){
          const q=at(u+shutter*.127,side*(depth/2+.020));
          stamp(block,'wood',[q[0],grade+.555,q[1]],[.073,.24,.025],[0,rotation+shutter*.10,0]);
        }
      }
    }
    const door=at(width*.27,depth/2+.014);archedWindow(door[0],grade+.035,door[1],.22,.52,rotation,true);
    const frontGround=ground(...at(width*.27,depth/2+.46));
    const steps=Math.max(2,Math.min(7,Math.ceil((grade+.038-frontGround)/.075)));
    for(let step=0;step<steps;step++){
      const t=(step+1)/steps,p=at(width*.27,depth/2+.12+(steps-step-1)*.14),floor=ground(...p)-.055;
      const upper=Math.max(floor+.025,frontGround+(grade+.038-frontGround)*t);
      stamp(masonryBlock,'stone',[p[0],(floor+upper)/2,p[1]],[.43,upper-floor,.165],[0,rotation,0]);
    }
    for(const side of [-1,1]){
      const p=at(side*(width/2+.012),-.04);
      archedWindow(p[0],grade+height*.47,p[1],.17,.31,rotation+side*Math.PI/2);
    }
    const rise=depth*.40;
    hipRoof(x,top+.015,z,width+.20,depth+.20,rise,rotation,dormer);
    if(width>1.7){
      const p=at(-width*.31,-depth*.14);
      stamp(masonryBlock,'stone',[p[0],top+rise*.91,p[1]],[.18,.39,.21],[0,rotation,0]);
      stamp(block,'dark',[p[0],top+rise*.91+.232,p[1]],[.11,.008,.14],[0,rotation,0]);
      stamp(masonryBlock,'stoneLight',[p[0],top+rise*.91+.20,p[1]],[.24,.055,.27],[0,rotation,0]);
    }
  }
  // Four low attached wings make the original tiny keep part of a coherent
  // monastery-like ensemble. None grows with the island or reaches its spire.
  roofedHouse(-1.62,-.58,1.65,1.05,1.00,.04,true);
  roofedHouse(.02,-1.44,2.62,1.08,1.24,0,true);
  roofedHouse(1.61,-.72,1.04,1.54,.96,-.07);
  roofedHouse(-3.00,-1.73,1.32,1.65,1.35,-.12);

  // An incomplete cloister links the chapel to a garden. The last broken arch
  // and foundation outline communicate former rooms, rather than a new fence.
  const cloisterY=Math.max(...[-.46,.44,1.34,2.40].map(z=>ground(-3.38,z)))-.015;
  const cloister=archWall(1.04,1.14,.66,.93,.25);
  for(let bay=0;bay<3;bay++){
    const z=.10+bay*.89,floor=Math.min(ground(-3.38,z-.5),ground(-3.38,z+.5))-.06;
    stamp(block,'stone',[-3.38,(floor+cloisterY+.02)/2,z],[.28,cloisterY+.02-floor,1.04]);
    stamp(cloister,'stone',[-3.38,cloisterY,z],[1,1,1],[0,Math.PI/2,0]);
  }
  // The first two bays still shelter a real walk; the last stands open as a
  // ruin. Inner posts and projecting eaves visibly support the surviving roof.
  for(const z of [-.46,.24,1.20]){
    const floor=ground(-2.69,z)-.04;
    stamp(column,'stone',[-2.69,(floor+cloisterY+1.12)/2,z],[.047,cloisterY+1.12-floor,.047]);
    stamp(masonryBlock,'stoneLight',[-2.69,cloisterY+1.095,z],[.16,.085,.16]);
  }
  hipRoof(-3.025,cloisterY+1.16,.20,2.40,.99,.26,Math.PI/2);
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
    let foot=base-.03;
    for(let i=0;i<20;i++){const a=i/20*Math.PI*2;foot=Math.min(foot,ground(x+Math.sin(a)*(radius+.10),z+Math.cos(a)*(radius+.10))-.065);}
    stamp(column,'stone',[x,(foot+base+.15)/2,z],[radius+.085,base+.15-foot,radius+.085]);
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
    footprint:[size.x,size.z],maximumAddedHeight:bounds.max.y-anchor.y,gardenTrees:4,ivyLeaves,pavingStones,
    gatePosition:[gate.x,gateBase,gate.z],clearingRadius:9.85};
  group.userData.kind='castle-precinct';
  return {group,reservedPositions,stats};
}
