import { createDetailView } from './sky-castle-lod.js';
import { coherentNoise3D } from './sky-castle-geology.js';

/** Grounded details for the foreground lookout, shared by every art direction. */
export function buildForegroundDetails(THREE, materials, ledge, {scale:landScale=1}={}) {
  const group = new THREE.Group();
  group.name = 'lookout-garden';
  ledge.updateMatrixWorld(true);
  const ground = ledge.getObjectByName('lookout-meadow');
  const detailMeshes = [];
  // The meadow stays fixed. Index its world-space triangles once instead of
  // raycasting the entire dense mesh for every flower, tree, and grass root.
  // Barycentric interpolation samples the actual mesh, including its warped
  // boundary, rather than an approximate ellipsoid or interpolated height map.
  const groundCells = new Map(), groundBounds = new THREE.Box3();
  let groundCellSize = 1, groundMinX = 0, groundMinZ = 0;
  if (ground) {
    ground.updateWorldMatrix(true, false);
    const geometry = ground.geometry, position = geometry.attributes.position;
    const index = geometry.index, vertex = new THREE.Vector3();
    const world = new Float64Array(position.count * 3);
    const bounds = groundBounds;
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(ground.matrixWorld);
      world[i * 3] = vertex.x; world[i * 3 + 1] = vertex.y; world[i * 3 + 2] = vertex.z;
      bounds.expandByPoint(vertex);
    }
    const triangleCount = (index ? index.count : position.count) / 3;
    const projectedArea = (bounds.max.x - bounds.min.x) * (bounds.max.z - bounds.min.z);
    groundCellSize = Math.max(.75, Math.min(4, Math.sqrt(projectedArea / Math.max(1, triangleCount)) * 5));
    groundMinX = bounds.min.x; groundMinZ = bounds.min.z;
    for (let i = 0; i < triangleCount; i++) {
      const a = (index ? index.getX(i * 3) : i * 3) * 3;
      const b = (index ? index.getX(i * 3 + 1) : i * 3 + 1) * 3;
      const c = (index ? index.getX(i * 3 + 2) : i * 3 + 2) * 3;
      const ax = world[a], az = world[a + 2], bx = world[b], bz = world[b + 2], cx = world[c], cz = world[c + 2];
      const e1x = bx - ax, e1z = bz - az, e2x = cx - ax, e2z = cz - az;
      const determinant = e1x * e2z - e1z * e2x;
      if (Math.abs(determinant) < 1e-12) continue;
      const triangle = { ax, az, ay:world[a + 1], e1x, e1z, e2x, e2z,
        dy1:world[b + 1] - world[a + 1], dy2:world[c + 1] - world[a + 1], inverse:1 / determinant };
      const minX = Math.floor((Math.min(ax, bx, cx) - groundMinX) / groundCellSize);
      const maxX = Math.floor((Math.max(ax, bx, cx) - groundMinX) / groundCellSize);
      const minZ = Math.floor((Math.min(az, bz, cz) - groundMinZ) / groundCellSize);
      const maxZ = Math.floor((Math.max(az, bz, cz) - groundMinZ) / groundCellSize);
      for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
        const key = `${x},${z}`;
        if (!groundCells.has(key)) groundCells.set(key, []);
        groundCells.get(key).push(triangle);
      }
    }
  }
  function sampleGround(x, z) {
    const key = `${Math.floor((x - groundMinX) / groundCellSize)},${Math.floor((z - groundMinZ) / groundCellSize)}`;
    let height = -Infinity;
    for (const triangle of groundCells.get(key) || []) {
      const dx = x - triangle.ax, dz = z - triangle.az;
      const u = (dx * triangle.e2z - dz * triangle.e2x) * triangle.inverse;
      const v = (triangle.e1x * dz - triangle.e1z * dx) * triangle.inverse;
      if (u >= -1e-9 && v >= -1e-9 && u + v <= 1 + 1e-9) {
        height = Math.max(height, triangle.ay + u * triangle.dy1 + v * triangle.dy2);
      }
    }
    return height;
  }
  const groundHeight=(x,z)=>{const y=sampleGround(x,z);return y===-Infinity?ledge.position.y:y;};
  const contains=(x,z,margin=0)=>[[0,0],[margin,0],[-margin,0],[0,margin],[0,-margin]]
    .every(([dx,dz])=>sampleGround(x+dx,z+dz)!==-Infinity);
  let seed = 3109;
  const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
  const transform = new THREE.Object3D();
  function instances(geometry, material, points, level='always') {
    const chunks=new Map();
    for(const point of points){
      const key=landScale>1?`${Math.floor(point.x/14)},${Math.floor(point.z/14)}`:'all';
      if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(point);
    }
    for(const points of chunks.values()){
      const mesh = new THREE.InstancedMesh(geometry, material, points.length);
      points.forEach(({x, y, z, scale, rotation = [0, 0, 0], tint}, index) => {
        transform.position.set(x, y, z);transform.rotation.set(...rotation);transform.scale.set(...scale);transform.updateMatrix();
        mesh.setMatrixAt(index, transform.matrix);
        if(tint)mesh.setColorAt(index,new THREE.Color(tint));
      });
      mesh.castShadow = level==='always'||level==='coarse';mesh.receiveShadow = true;
      mesh.computeBoundingSphere();group.add(mesh);detailMeshes.push({mesh,level});
    }
  }

  // A narrow worn footpath follows the actual meadow triangles. Its broken
  // edges and occasional embedded stones read as use, not an evenly spaced
  // ornamental necklace across an otherwise unbroken lawn.
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-15, 0, 11.15), new THREE.Vector3(-12, 0, 11.5),
    new THREE.Vector3(-9.2, 0, 10.15), new THREE.Vector3(-6.7, 0, 10.5),
  ]);
  for(const point of path.points){point.x*=landScale;point.z*=landScale;}
  path.updateArcLengths();
  const trailPoints=path.getSpacedPoints(Math.ceil(path.getLength()/.45));
  function trailDistance(x,z){
    let nearest=Infinity;
    for(let i=1;i<trailPoints.length;i++){
      const a=trailPoints[i-1],b=trailPoints[i],dx=b.x-a.x,dz=b.z-a.z;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));
      nearest=Math.min(nearest,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));
    }
    return nearest;
  }
  const pathPositions=[],pathUvs=[],pathIndices=[],pathRows=Math.ceil(path.getLength()/.18),pathColumns=4;
  for(let row=0;row<=pathRows;row++){
    const t=row/pathRows,p=path.getPointAt(t),tangent=path.getTangentAt(t);
    const width=(.19+.038*Math.sin(t*57)+.025*Math.sin(t*133+.8))*(.68+.32*Math.sin(t*Math.PI)**.3);
    for(let col=0;col<=pathColumns;col++){
      const side=col/pathColumns*2-1;
      const ragged=width+Math.abs(side)**3*.036*Math.sin(row*1.9+side*4.7);
      const x=p.x+tangent.z*side*ragged,z=p.z-tangent.x*side*ragged;
      pathPositions.push(x,groundHeight(x,z)+.012,z);pathUvs.push(col/pathColumns,t);
      if(row<pathRows&&col<pathColumns){const a=row*(pathColumns+1)+col,b=a+pathColumns+1;pathIndices.push(a,b,a+1,a+1,b,b+1);}
    }
  }
  const pathGeometry=new THREE.BufferGeometry();pathGeometry.setAttribute('position',new THREE.Float32BufferAttribute(pathPositions,3));
  pathGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(pathUvs,2));pathGeometry.setIndex(pathIndices);pathGeometry.computeVertexNormals();
  const wornTrail=new THREE.Mesh(pathGeometry,materials.rock);wornTrail.name='grounded-worn-lookout-trail';wornTrail.receiveShadow=true;group.add(wornTrail);
  const stones=[];
  for(let i=0;i<Math.round(18*landScale);i++){
    const t=random(),p=path.getPointAt(t),tangent=path.getTangentAt(t),side=(random()-.5)*.4,s=.035+random()**2*.08;
    p.x+=tangent.z*side;p.z-=tangent.x*side;
    if(!contains(p.x,p.z,s))continue;
    stones.push({x:p.x,y:groundHeight(p.x,p.z)+.018,z:p.z,scale:[s*1.25,.018,s*.8],rotation:[0,random()*Math.PI,0]});
  }
  instances(new THREE.IcosahedronGeometry(1,1),materials.rock,stones);

  const shrubs=[],rocks=[],petals=[],hearts=[],stems=[],leaves=[],patches=[];
  const targetPatches=Math.round(6*landScale*landScale),patchCells=new Map(),patchCellSize=1.25;
  function clearPatch(x,z){
    const ix=Math.floor(x/patchCellSize),iz=Math.floor(z/patchCellSize);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const p of patchCells.get(`${ix+dx},${iz+dz}`)||[])
      if(Math.hypot(x-p[0],z-p[1])<patchCellSize)return false;
    return true;
  }
  for(let attempt=0;patches.length<targetPatches&&attempt<targetPatches*100;attempt++){
    const x=groundBounds.min.x+random()*(groundBounds.max.x-groundBounds.min.x);
    const z=groundBounds.min.z+random()*(groundBounds.max.z-groundBounds.min.z);
    if(!contains(x,z,1.0)||trailDistance(x,z)<.9||!clearPatch(x,z))continue;
    const habitat=coherentNoise3D(x*.046+13.8,.4,z*.058-7.2)*.75
      +coherentNoise3D(x*.17,.9,z*.13)*.25;
    // Broad connected belts feather into open grass rather than forming six
    // dense circular beds. A small spacing constraint prevents overlapping domes.
    if(random()>.28+Math.max(0,habitat+.14)*1.9)continue;
    const dx=groundHeight(x+.2,z)-groundHeight(x-.2,z),dz=groundHeight(x,z+.2)-groundHeight(x,z-.2);
    if(Math.hypot(dx,dz)>.55)continue;
    const patch=[x,z,.42+random()*.35];patches.push(patch);
    const key=`${Math.floor(x/patchCellSize)},${Math.floor(z/patchCellSize)}`;
    if(!patchCells.has(key))patchCells.set(key,[]);patchCells.get(key).push(patch);
  }
  for (const [cx, cz, radius] of patches) {
    for (let i = 0; i < 5; i++) {
      const angle = random() * Math.PI * 2, r = Math.sqrt(random()) * radius;
      const x = cx + Math.cos(angle) * r, z = cz + Math.sin(angle) * r, y = groundHeight(x, z);
      if(!contains(x,z,.35)||trailDistance(x,z)<.65)continue;
      const s = .13 + random() * .19;
      shrubs.push({x, y:y+s*.42, z, scale:[s*1.3,s*.7,s], rotation:[0,random()*6,0]});
      if(i<2&&contains(x+.18,z+.15,s*.8))rocks.push({x:x+.18,y:groundHeight(x+.18,z+.15)+s*.16,z:z+.15,scale:[s*.55,s*.35,s*.8],rotation:[0,random()*6,0]});
    }
    for (let i = 0; i < 15; i++) {
      const angle = random() * Math.PI * 2, r = Math.sqrt(random()) * radius * 1.5;
      const x = cx + Math.cos(angle) * r, z = cz + Math.sin(angle) * r;
      if(!contains(x,z,.08)||trailDistance(x,z)<.28)continue;
      const y = groundHeight(x,z), h = .10 + random() * .16, size = .024 + random() * .014;
      stems.push({x,y:y+h/2,z,scale:[.006,h,.006]});
      hearts.push({x,y:y+h,z,scale:[size*.6,size*.5,size*.6]});
      for(let j=0;j<5;j++){
        const a=j/5*Math.PI*2;
        petals.push({x:x+Math.cos(a)*size*.8,y:y+h,z:z+Math.sin(a)*size*.8,
          scale:[size,size*.35,size*.55],rotation:[0,-a,0]});
      }
      for(let j=0;j<2;j++) leaves.push({x:x+(j?1:-1)*.027,y:y+h*.45,z,
        scale:[.042,.008,.018],rotation:[0,angle,j?.45:-.45]});
    }
  }
  // Distant shrubs have an uneven low crown. Nearby foliage replaces that
  // volume with folded leaves and branches instead of decorating a smooth ball.
  const shrubCrown=new THREE.SphereGeometry(1,9,6),crownVertices=shrubCrown.attributes.position;
  for(let i=0;i<crownVertices.count;i++){
    const x=crownVertices.getX(i),y=crownVertices.getY(i),z=crownVertices.getZ(i),a=Math.atan2(z,x);
    const lobe=1+.19*Math.sin(a*3+y*2)+.11*Math.cos(a*5-y*3);
    crownVertices.setXYZ(i,x*lobe+y*.09,y*.85+.10*Math.sin(a*4)*(1-y*y),z*lobe);
  }
  shrubCrown.computeVertexNormals();instances(shrubCrown,materials.leaf,shrubs,'coarse');
  instances(new THREE.IcosahedronGeometry(1,1), materials.rock, rocks);
  instances(new THREE.CylinderGeometry(1,1,1,5), materials.trunk, stems,'fine');
  instances(new THREE.SphereGeometry(1,6,4), materials.flower, petals,'fine');
  instances(new THREE.SphereGeometry(1,6,4), materials.gold, hearts,'fine');
  instances(new THREE.SphereGeometry(1,6,4), materials.grass, leaves,'fine');

  // Fine plants live beside the existing trail and shrubs, leaving the viewing
  // clearing open. A folded, tapered leaf carries its own restrained vein shader.
  const leafPositions = [], leafUvs = [], leafIndices = [];
  for(let i=0;i<=4;i++){
    const t=i/4, width=Math.sin(t*Math.PI)*.23;
    for(const side of [-1,0,1]){
      leafPositions.push(t,Math.sin(t*Math.PI)*(.09+(side===0?.035:0)),side*width);
      leafUvs.push(t,(side+1)/2);
    }
    if(i<4)for(let j=0;j<2;j++){
      const q=i*3+j;leafIndices.push(q,q+1,q+3,q+1,q+4,q+3);
    }
  }
  const leafGeometry=new THREE.BufferGeometry();
  leafGeometry.setAttribute('position',new THREE.Float32BufferAttribute(leafPositions,3));
  leafGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(leafUvs,2));
  leafGeometry.setIndex(leafIndices);leafGeometry.computeVertexNormals();
  const fineLeaves=[], fernStems=[];
  const up=new THREE.Vector3(0,1,0);
  function stemBetween(a,b){
    const length=a.distanceTo(b), middle=a.clone().add(b).multiplyScalar(.5);
    const quaternion=new THREE.Quaternion().setFromUnitVectors(up,b.clone().sub(a).normalize());
    const rotation=new THREE.Euler().setFromQuaternion(quaternion);
    fernStems.push({x:middle.x,y:middle.y,z:middle.z,scale:[.004,length,.004],rotation:[rotation.x,rotation.y,rotation.z]});
  }
  const fernCenters=patches.filter((_,i)=>i%2===0).map(([x,z])=>[x,z]);
  for(const [cx,cz] of fernCenters){
    if(!contains(cx,cz,.5))continue;
    const base=groundHeight(cx,cz);
    for(let frond=0;frond<5;frond++){
      const angle=frond/5*Math.PI*2+random(), length=.30+random()*.16;
      let previous=new THREE.Vector3(cx,base,cz);
      for(let j=1;j<=6;j++){
        const t=j/6, reach=length*t, y=base+Math.sin(t*Math.PI*.76)*length*.72;
        const center=new THREE.Vector3(cx+Math.cos(angle)*reach,y,cz+Math.sin(angle)*reach);
        stemBetween(previous,center);previous=center;
        const size=length*.32*Math.sin(t*Math.PI*.88);
        for(const side of [-1,1])fineLeaves.push({x:center.x,y,z:center.z,
          scale:[size,size,size],rotation:[0,-angle+side*1.05,.10]});
      }
    }
    // A few fallen leaves and pebble-sized fragments give the path a lived-in edge.
    for(let i=0;i<6;i++){
      const angle=random()*Math.PI*2,r=.18+random()*.48;
      const x=cx+Math.cos(angle)*r,z=cz+Math.sin(angle)*r,size=.07+random()*.07;
      fineLeaves.push({x,y:groundHeight(x,z)+.013,z,scale:[size,size*.45,size],rotation:[0,random()*6.28,0],tint:0xd4cc9c});
    }
  }
  // Three unequal branch sprays form each shrub's actual close-up silhouette.
  // Eighteen broad folded leaves provide volume without a smooth filler sphere.
  for(const shrub of shrubs){
    const root=new THREE.Vector3(shrub.x,groundHeight(shrub.x,shrub.z)-.012,shrub.z);
    for(let branch=0;branch<3;branch++){
      const angle=shrub.rotation[1]+branch*2.399,reach=shrub.scale[0]*(.62+random()*.3);
      const tip=new THREE.Vector3(root.x+Math.cos(angle)*reach,root.y+shrub.scale[1]*(1.5+random()*.8),root.z+Math.sin(angle)*reach*.8);
      stemBetween(root,tip);
      for(let pair=0;pair<3;pair++)for(const side of [-1,1]){
        const along=.30+pair*.28,center=root.clone().lerp(tip,along);
        const size=shrub.scale[0]*(.59+random()*.20)*(1-pair*.08);
        fineLeaves.push({x:center.x,y:center.y,z:center.z,scale:[size,size,size],rotation:[-.12,-angle+side*.95,-.35+pair*.10]});
      }
    }
  }
  instances(leafGeometry,materials.leafDetail,fineLeaves,'fine');
  instances(new THREE.CylinderGeometry(1,1,1,5),materials.trunk,fernStems,'fine');
  const detailView=createDetailView(THREE),lodChunks=new Map(),lodMatrix=new THREE.Matrix4();
  // All representations of a spatial cell share one bound. Using each leaf
  // mesh's different envelope could otherwise reveal both crowns and leaves,
  // or neither, at the transition between coarse and fine detail.
  for(const record of detailMeshes){
    record.mesh.getMatrixAt(0,lodMatrix);
    const x=lodMatrix.elements[12],z=lodMatrix.elements[14];
    const key=landScale>1?`${Math.floor(x/14)},${Math.floor(z/14)}`:'all';
    if(!lodChunks.has(key))lodChunks.set(key,{bounds:new THREE.Box3(),records:[]});
    const chunk=lodChunks.get(key);record.mesh.computeBoundingBox();
    chunk.bounds.union(record.mesh.boundingBox);chunk.records.push(record);
  }
  let detailShadowRevision=0;
  const stats={patches:patches.length,shrubs:shrubs.length,flowers:hearts.length,fineLeaves:fineLeaves.length,shadowRevision:0};
  function updateDetail(camera,visibleWidth){
    group.updateWorldMatrix(true,true);detailView.prepare(camera,visibleWidth);
    for(const chunk of lodChunks.values()){
      const width=detailView.boxWidth(chunk.bounds,group.matrixWorld);
      const inView=detailView.boxVisible(chunk.bounds,group.matrixWorld);
      for(const {mesh,level} of chunk.records){
        const visible=inView&&(level==='always'||(level==='fine'?width<75:width>=75));
        if(mesh.castShadow&&visible!==mesh.visible)detailShadowRevision++;
        mesh.visible=visible;
      }
    }
    stats.shadowRevision=detailShadowRevision;
  }

  return {group, groundHeight, contains, trailDistance, updateDetail, stats};
}
