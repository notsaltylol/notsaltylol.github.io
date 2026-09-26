import { buildTree as defaultBuildTree } from './sky-castle-models.js';

/**
 * Deterministic, life-size woodland for the enlarged island.
 *
 * Trees are instanced by material and spatial tile. Overview trees use small
 * continuous crowns; nearby visible trees replace those crowns with the same
 * detailed models used by the scene's landmarks. All materials remain shared.
 * Coordinates are in the returned group's local space, so satellite adapters
 * can place the group beneath a translated or rotated island parent.
 */
export function buildGroves(THREE, materials, terrain, {
  buildTree = defaultBuildTree,
  count = 760,
  islandKind = 'main',
  reservedPositions = [],
  heightRange = [.9, 1.8],
  seed = 61247,
  detailWidth = 42,
  detailTriangleBudget = 650000,
  maxDetailedTrees = 96,
} = {}) {
  const group = new THREE.Group();
  group.name = `${islandKind}-instanced-groves`;
  const requested = Math.max(0, Math.min(2000, Math.floor(count)));
  const terrainScale = terrain.scale || 1;
  const minHeight = Math.max(.3, Math.min(...heightRange));
  const maxHeight = Math.max(minHeight, Math.max(...heightRange));
  let randomState = Math.max(1, Math.floor(seed) % 2147483647);
  const random = () => (randomState = randomState * 16807 % 2147483647) / 2147483647;
  const between = (a, b) => a + (b - a) * random();
  const reserved = reservedPositions.map(point => Array.isArray(point)
    ? { x:point[0], z:point[1], radius:point[2] ?? 1.4 }
    : { x:point.x, z:point.z, radius:point.radius ?? 1.4 });

  if (islandKind === 'main') {
    const landmarks = [[-4.8,-1.2],[-4.1,.4],[-2.1,-2.8],[-1,-3.8],
      [2.8,-3.1],[4.7,-1.8],[4.5,1.4],[-4.8,2],[-.9,3.5],[4.1,-2.6]];
    for (const [x,z] of landmarks) reserved.push({x:x*terrainScale,z:z*terrainScale,radius:1.6});
    if (terrain.castleAnchor) reserved.push({x:terrain.castleAnchor.x,z:terrain.castleAnchor.z,radius:2.7});
    reserved.push({x:-.8*terrainScale,z:-2.8*terrainScale,radius:1.3});
    if (terrain.riverX) reserved.push({x:terrain.riverX(2.65*terrainScale),z:2.65*terrainScale,radius:2.0});
  }

  const trailDistance = terrain.worldTrailDistance || terrain.trailDistance;
  function allowed(x, z, height = maxHeight) {
    const crownRadius = height * .47;
    if (!terrain.contains(x,z,crownRadius+.15)) return false;
    const y = terrain.height(x,z);
    if (!Number.isFinite(y)) return false;
    if (reserved.some(p => Math.hypot(x-p.x,z-p.z) < p.radius+crownRadius)) return false;
    if (trailDistance && trailDistance.call(terrain,x,z) < crownRadius+.42) return false;
    // The normalized lake mask and height protect both banks and the river.
    if (terrain.lakeDistance && terrain.lakeDistance(x,z) < 1.27) return false;
    if (Number.isFinite(terrain.waterLevel) && y < terrain.waterLevel+.12) return false;
    if (islandKind === 'main' && terrain.riverX && z > terrainScale*.7
      && Math.abs(x-terrain.riverX(z)) < terrainScale*.63+crownRadius) return false;
    // Avoid trees growing sideways from steep exposed shoulders.
    const e = .24;
    if (Math.abs(terrain.height(x+e,z)-terrain.height(x-e,z)) > e*2.8
      || Math.abs(terrain.height(x,z+e)-terrain.height(x,z-e)) > e*2.8) return false;
    return true;
  }

  let bound = 0;
  for (let i=0;i<96;i++) bound = Math.max(bound, terrain.radius(i/96*Math.PI*2));
  if (!Number.isFinite(bound) || bound <= 0) throw new Error('Groves require a positive terrain.radius().');
  const tileSize = Math.max(5, Math.min(20, bound*.30));
  const centers = [];
  const centerTarget = Math.max(3, Math.ceil(requested/25));
  const minimumPatchRadius = Math.max(1.5, Math.sqrt(requested/centerTarget)*.50, bound*.045);
  for (let attempt=0;centers.length<centerTarget && attempt<centerTarget*250;attempt++) {
    const x=between(-bound,bound),z=between(-bound,bound);
    if (!allowed(x,z)) continue;
    const radius=between(minimumPatchRadius,Math.max(minimumPatchRadius*1.6,bound*.11));
    if (centers.some(p => Math.hypot(p.x-x,p.z-z)<Math.min(radius,p.radius)*.85)) continue;
    centers.push({x,z,radius});
  }

  const trees=[], occupied=new Map(), tiles=new Map();
  const spacing=.85, cellKey=(x,z)=>`${x},${z}`;
  function clearNeighbor(x,z,height) {
    const cx=Math.floor(x/spacing),cz=Math.floor(z/spacing);
    for(let dx=-2;dx<=2;dx++) for(let dz=-2;dz<=2;dz++) {
      for(const other of occupied.get(cellKey(cx+dx,cz+dz)) || []) {
        if(Math.hypot(x-other.x,z-other.z)<Math.max(.75,(height+other.height)*.31))return false;
      }
    }
    return true;
  }
  for(let attempt=0;trees.length<requested && attempt<requested*160;attempt++) {
    if(!centers.length)break;
    const patch=centers[Math.floor(random()*centers.length)];
    const angle=random()*Math.PI*2,r=Math.sqrt(random())*patch.radius;
    const x=patch.x+Math.cos(angle)*r,z=patch.z+Math.sin(angle)*r,height=between(minHeight,maxHeight);
    if(!allowed(x,z,height)||!clearNeighbor(x,z,height))continue;
    // Wide, smooth gaps make distinct stands, not a uniform carpet of trees.
    if(Math.sin(x/(bound*.15)+.7)*Math.cos(z/(bound*.13)-.4)<-.73)continue;
    const tx=Math.floor(x/tileSize),tz=Math.floor(z/tileSize),key=cellKey(tx,tz);
    if(!tiles.has(key)) {
      const hash=Math.abs((tx*73856093)^(tz*19349663)^Math.floor(seed));
      tiles.set(key,{key,variant:hash%4,trees:[],low:[],high:[],signature:null,inView:true,sphere:new THREE.Sphere()});
    }
    const tile=tiles.get(key);
    const tree={id:trees.length,x,y:terrain.height(x,z)-.018,z,height,yaw:random()*Math.PI*2,
      width:between(.88,1.12),variant:tile.variant,tile};
    trees.push(tree);tile.trees.push(tree);
    const bucketKey=cellKey(Math.floor(x/spacing),Math.floor(z/spacing));
    if(!occupied.has(bucketKey))occupied.set(bucketKey,[]);
    occupied.get(bucketKey).push(tree);
  }

  const triangleCount=g=>(g.index ? g.index.count : g.attributes.position.count)/3;
  function merge(parts) {
    let vertices=0;
    const expanded=parts.map(g=>{const plain=g.index?g.toNonIndexed():g;vertices+=plain.attributes.position.count;return plain;});
    const p=new Float32Array(vertices*3),n=new Float32Array(vertices*3),uv=new Float32Array(vertices*2);
    let offset=0;
    for(const g of expanded){p.set(g.attributes.position.array,offset*3);n.set(g.attributes.normal.array,offset*3);
      if(g.attributes.uv)uv.set(g.attributes.uv.array,offset*2);offset+=g.attributes.position.count;}
    for(const g of new Set([...parts,...expanded]))g.dispose();
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(p,3));
    g.setAttribute('normal',new THREE.BufferAttribute(n,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    g.computeBoundingSphere();return g;
  }
  const variantSeeds=[29,137,401,743];
  const variants=variantSeeds.map((variantSeed,index)=>{
    const kind=index===3?'cypress':'broadleaf';
    const trunk=new THREE.CylinderGeometry(.019,.035,.64,7,1).translate(.012,.32,0);
    let crown;
    if(kind==='cypress') {
      const profile=[];
      for(let j=0;j<=9;j++){const t=j/9;profile.push(new THREE.Vector2(.15*Math.pow(Math.sin(t*Math.PI),.75)*(1.17-.35*t),.20+.8*t));}
      crown=new THREE.LatheGeometry(profile,10);
    } else {
      crown=new THREE.SphereGeometry(1,12,8);
      const p=crown.attributes.position;
      for(let j=0;j<p.count;j++){
        const x=p.getX(j),y=p.getY(j),z=p.getZ(j),a=Math.atan2(z,x);
        const ripple=1+.075*Math.sin(a*3+variantSeed)*(1-y*y)+.045*Math.cos(a*7+y*4+variantSeed);
        p.setXYZ(j,(x*ripple+y*.14)*.408+.045,(y+.045*Math.cos(a*5+variantSeed)*(1-y*y)+x*.09)*.242+.74,z*ripple*.310);
      }
    }
    crown.computeVertexNormals();crown.computeBoundingSphere();
    const low=[{geometry:trunk,material:materials.trunk||materials.wood},{geometry:crown,material:materials.leaf}];
    return {seed:variantSeed,kind,low,high:null,lowTriangles:low.reduce((s,p)=>s+triangleCount(p.geometry),0),highTriangles:0};
  });

  const transform=new THREE.Object3D();
  function matrix(tree){transform.position.set(tree.x,tree.y,tree.z);transform.rotation.set(0,tree.yaw,0);
    transform.scale.set(tree.height*tree.width,tree.height,tree.height/tree.width);transform.updateMatrix();return transform.matrix;}
  function meshesFor(tile,parts,label) {
    return parts.map((part,index)=>{
      const mesh=new THREE.InstancedMesh(part.geometry,part.material,tile.trees.length);
      mesh.name=`grove-${label}-${tile.key}-${index}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow=mesh.receiveShadow=true;
      // The complete tile bound stays valid when active instance subsets change.
      mesh.boundingSphere=tile.sphere.clone();mesh.frustumCulled=true;
      mesh.count=0;mesh.visible=false;group.add(mesh);return mesh;
    });
  }
  function write(meshes,selected){
    for(const mesh of meshes){mesh.count=selected.length;mesh.visible=selected.length>0;}
    selected.forEach((tree,index)=>{const m=matrix(tree);for(const mesh of meshes)mesh.setMatrixAt(index,m);});
    for(const mesh of meshes)mesh.instanceMatrix.needsUpdate=true;
  }
  for(const tile of tiles.values()) {
    const box=new THREE.Box3();
    for(const tree of tile.trees){const r=tree.height*.58;box.expandByPoint(new THREE.Vector3(tree.x-r,tree.y-.05,tree.z-r));box.expandByPoint(new THREE.Vector3(tree.x+r,tree.y+tree.height*1.08,tree.z+r));}
    box.getBoundingSphere(tile.sphere);
    tile.low=meshesFor(tile,variants[tile.variant].low,'overview');write(tile.low,tile.trees);
    tile.signature='';
  }

  function prepareDetail(variant) {
    if(variant.high)return;
    const model=buildTree(THREE,materials,{height:1,seed:variant.seed,kind:variant.kind});
    model.updateMatrixWorld(true);
    const byMaterial=new Map(), originals=new Set();
    model.traverse(mesh=>{
      if(!mesh.isMesh)return;
      if(Array.isArray(mesh.material))throw new Error('Grove tree variants require one material per mesh.');
      if(!byMaterial.has(mesh.material))byMaterial.set(mesh.material,[]);
      byMaterial.get(mesh.material).push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));originals.add(mesh.geometry);
    });
    variant.high=[...byMaterial].map(([material,parts])=>({material,geometry:merge(parts)}));
    variant.highTriangles=variant.high.reduce((sum,p)=>sum+triangleCount(p.geometry),0);
    for(const geometry of originals)geometry.dispose();
  }

  const stats={requestedTrees:requested,treeCount:trees.length,tiles:tiles.size,variants:variants.length,
    overviewTriangles:[...tiles.values()].reduce((s,t)=>s+t.trees.length*variants[t.variant].lowTriangles,0),
    overviewDrawCalls:tiles.size*2,detailTriangleBudget,maxDetailedTrees,
    visibleTrees:trees.length,detailedTrees:0,activeTriangles:0,activeDrawCalls:tiles.size*2,shadowRevision:0,
    heightRange:[minHeight,maxHeight]};
  stats.activeTriangles=stats.overviewTriangles;
  const frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),worldSphere=new THREE.Sphere(),
    treeSphere=new THREE.Sphere(),worldPoint=new THREE.Vector3(),screenPoint=new THREE.Vector3(),
    worldScale=new THREE.Vector3(),cameraPosition=new THREE.Vector3();

  function updateDetail(camera,visibleWidth) {
    if(!camera)return;
    camera.updateMatrixWorld();group.updateWorldMatrix(true,false);
    group.getWorldScale(worldScale);camera.getWorldPosition(cameraPosition);
    const maximumScale=Math.max(Math.abs(worldScale.x),Math.abs(worldScale.y),Math.abs(worldScale.z));
    projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(projection);
    const width=Number.isFinite(visibleWidth)?visibleWidth:camera.isOrthographicCamera?(camera.right-camera.left)/camera.zoom:Infinity;
    const detailed=width<detailWidth,candidates=[],visibleTiles=[];
    let shadowChanged=false;
    for(const tile of tiles.values()){
      worldSphere.copy(tile.sphere).applyMatrix4(group.matrixWorld);
      const inView=frustum.intersectsSphere(worldSphere);
      if(inView!==tile.inView)shadowChanged=true;
      tile.inView=inView;
      for(const mesh of [...tile.low,...tile.high])mesh.visible=tile.inView&&mesh.count>0;
      if(!tile.inView)continue;
      visibleTiles.push(tile);
      if(!detailed)continue;
      for(const tree of tile.trees){
        worldPoint.set(tree.x,tree.y+tree.height*.55,tree.z).applyMatrix4(group.matrixWorld);
        treeSphere.center.copy(worldPoint);treeSphere.radius=tree.height*.72*maximumScale;
        if(!frustum.intersectsSphere(treeSphere))continue;
        screenPoint.copy(worldPoint).project(camera);
        // Highest screen coverage and central trees receive close detail first.
        candidates.push({tree,priority:screenPoint.x**2+screenPoint.y**2+worldPoint.distanceTo(cameraPosition)*.0001});
      }
    }
    candidates.sort((a,b)=>a.priority-b.priority||a.tree.id-b.tree.id);
    const selected=new Set();let detailTriangles=0;
    for(const {tree} of candidates){
      if(selected.size>=maxDetailedTrees)break;
      const variant=variants[tree.variant];prepareDetail(variant);
      if(detailTriangles+variant.highTriangles>detailTriangleBudget)continue;
      detailTriangles+=variant.highTriangles;selected.add(tree.id);
    }
    stats.visibleTrees=0;stats.detailedTrees=selected.size;stats.activeTriangles=0;stats.activeDrawCalls=0;
    for(const tile of visibleTiles){
      const high=tile.trees.filter(tree=>selected.has(tree.id));
      const signature=high.map(tree=>tree.id).join(',');
      if(signature!==tile.signature){
        shadowChanged=true;
        write(tile.low,tile.trees.filter(tree=>!selected.has(tree.id)));
        if(high.length&&!tile.high.length)tile.high=meshesFor(tile,variants[tile.variant].high,'detailed');
        if(tile.high.length)write(tile.high,high);
        tile.signature=signature;
      }
      const variant=variants[tile.variant];
      stats.visibleTrees+=tile.trees.length;
      stats.activeTriangles+=(tile.trees.length-high.length)*variant.lowTriangles+high.length*variant.highTriangles;
      stats.activeDrawCalls+=tile.low.filter(mesh=>mesh.count>0).length+tile.high.filter(mesh=>mesh.count>0).length;
    }
    if(shadowChanged)stats.shadowRevision++;
    return stats;
  }
  return {group,updateDetail,stats};
}
