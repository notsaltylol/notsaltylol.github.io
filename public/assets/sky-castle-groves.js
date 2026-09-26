import { createDetailView } from './sky-castle-lod.js';
import { createHabitat } from './sky-castle-habitat.js';
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
  detailWidth = 60,
  detailTriangleBudget = 1800000,
  maxDetailedTrees = 240,
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
    const landmarks = [[-4.52,-1.48],[-4.1,.4],[-1.96,-2.8],[-1,-3.8],
      [2.8,-3.1],[4.7,-1.8],[4.5,1.4],[-4.8,2],[-.9,3.5],[4.1,-2.6]];
    for (const [x,z] of landmarks) reserved.push({x:x*terrainScale,z:z*terrainScale,radius:1.6});
    if (terrain.castleAnchor) reserved.push({x:terrain.castleAnchor.x,z:terrain.castleAnchor.z,radius:2.7});
    reserved.push({x:-.8*terrainScale,z:-2.8*terrainScale,radius:1.3});
    if (terrain.riverX) reserved.push({x:terrain.riverX(2.65*terrainScale),z:2.65*terrainScale,radius:2.0});
  }

  const trailDistance = terrain.worldTrailDistance || terrain.trailDistance;
  function allowed(x, z, height = maxHeight) {
    if((terrain.rockExposure?.(x,z)||0)>.15)return false;
    const crownRadius = height * .47;
    if(terrain.isReserved?.(x,z,crownRadius+.2))return false;
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
  const habitat=createHabitat({kind:islandKind,scale:terrainScale,radius:bound}),habitatValue={};
  const centers=habitat.woodlandPatches;
  const patchArea=centers.reduce((sum,p)=>sum+p.rx*p.rz,0);
  function chooseWoodland(){
    let choice=random()*patchArea;
    for(const p of centers){choice-=p.rx*p.rz;if(choice<=0)return p;}
    return centers.at(-1);
  }

  const smoothWoodland=value=>Math.min(1,(value-.20)/.60);
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
    const patch=chooseWoodland();
    const angle=random()*Math.PI*2,r=Math.sqrt(random())*1.12;
    const px=Math.cos(angle)*r*patch.rx,pz=Math.sin(angle)*r*patch.rz,c=Math.cos(patch.angle),s=Math.sin(patch.angle);
    const x=patch.x+px*c-pz*s,z=patch.z+px*s+pz*c,height=between(minHeight,maxHeight);
    const ecology=habitat.sample(x,z,habitatValue);
    // Whole stands share a connected shoulder. Open meadow corridors stay
    // empty; edge trees feather only the boundary of the same woodland mass.
    if(ecology.woodland<.24||random()>smoothWoodland(ecology.woodland))continue;
    if(!allowed(x,z,height)||!clearNeighbor(x,z,height))continue;
    const tx=Math.floor(x/tileSize),tz=Math.floor(z/tileSize);
    const stand=centers.indexOf(patch),selector=random();
    const variant=selector<.12?3:selector<.76?stand%3:Math.floor(random()*3);
    const key=cellKey(tx,tz)+","+variant;
    if(!tiles.has(key)) {
      tiles.set(key,{key,variant,trees:[],low:[],high:[],signature:null,inView:true,sphere:new THREE.Sphere()});
    }
    const tile=tiles.get(key);
    const sampledGround=terrain.surfaceHeight?.(x,z);
    const tree={id:trees.length,x,y:(Number.isFinite(sampledGround)?sampledGround:terrain.height(x,z))-.018,z,height,yaw:random()*Math.PI*2,
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
  function treeParts(options) {
    const model=buildTree(THREE,materials,{height:1,...options});
    model.updateMatrixWorld(true);
    const byMaterial=new Map(),originals=new Set();
    model.traverse(mesh=>{
      if(!mesh.isMesh)return;
      if(Array.isArray(mesh.material))throw new Error('Grove tree variants require one material per mesh.');
      if(!byMaterial.has(mesh.material))byMaterial.set(mesh.material,[]);
      byMaterial.get(mesh.material).push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));originals.add(mesh.geometry);
    });
    const parts=[...byMaterial].map(([material,geometries])=>({material,geometry:merge(geometries)}));
    for(const geometry of originals)geometry.dispose();
    return parts;
  }
  const variantSeeds=[29,137,401,743],forms=['spreading','upright','windswept','cypress'];
  const variants=variantSeeds.map((variantSeed,index)=>{
    const kind=index===3?'cypress':'broadleaf',form=forms[index];
    // Overview and detail are two samplings of the same branching plan. The
    // core crown shell is identical; only attached twigs/leaves are omitted.
    const low=treeParts({seed:variantSeed,kind,form,detail:'coarse'});
    return {seed:variantSeed,kind,form,low,high:null,lowTriangles:low.reduce((sum,p)=>sum+triangleCount(p.geometry),0),highTriangles:0};
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
    variant.high=treeParts({seed:variant.seed,kind:variant.kind,form:variant.form});
    variant.highTriangles=variant.high.reduce((sum,p)=>sum+triangleCount(p.geometry),0);
  }

  const stats={requestedTrees:requested,treeCount:trees.length,tiles:tiles.size,variants:variants.length,
    overviewTriangles:[...tiles.values()].reduce((s,t)=>s+t.trees.length*variants[t.variant].lowTriangles,0),
    overviewDrawCalls:tiles.size*2,detailTriangleBudget,maxDetailedTrees,
    visibleTrees:trees.length,detailedTrees:0,activeTriangles:0,activeDrawCalls:tiles.size*2,shadowRevision:0,
    heightRange:[minHeight,maxHeight],habitat:islandKind,woodlandStands:centers.length};
  stats.activeTriangles=stats.overviewTriangles;
  const detailView=createDetailView(THREE),treeSphere=new THREE.Sphere(),
    worldPoint=new THREE.Vector3(),screenPoint=new THREE.Vector3(),worldScale=new THREE.Vector3();
  const candidates=[],visibleTiles=[],selected=new Set();
  function updateDetail(camera,visibleWidth) {
    if(!camera)return;
    group.updateWorldMatrix(true,false);detailView.prepare(camera,visibleWidth);
    group.getWorldScale(worldScale);
    const maximumScale=Math.max(Math.abs(worldScale.x),Math.abs(worldScale.y),Math.abs(worldScale.z));
    candidates.length=visibleTiles.length=0;selected.clear();
    let shadowChanged=false;
    for(const tile of tiles.values()){
      const inView=detailView.sphereVisible(tile.sphere,group.matrixWorld);
      if(inView!==tile.inView)shadowChanged=true;
      tile.inView=inView;
      for(const mesh of tile.low)mesh.visible=tile.inView&&mesh.count>0;
      for(const mesh of tile.high)mesh.visible=tile.inView&&mesh.count>0;
      if(!tile.inView)continue;
      visibleTiles.push(tile);
      if(detailView.sphereWidth(tile.sphere,group.matrixWorld)>=detailWidth)continue;
      for(const tree of tile.trees){
        worldPoint.set(tree.x,tree.y+tree.height*.55,tree.z).applyMatrix4(group.matrixWorld);
        treeSphere.center.copy(worldPoint);treeSphere.radius=tree.height*.72*maximumScale;
        if(!detailView.sphereVisible(treeSphere))continue;
        if(detailView.sphereWidth(treeSphere)>=detailWidth)continue;
        screenPoint.copy(worldPoint).project(camera);
        // Projected crown area ranks the largest readable foliage first. Stable
        // centrality/ID ties keep the selection deterministic on every orbit.
        const radiusX=treeSphere.radius*2/detailView.widthAtPoint(worldPoint);
        const radiusY=radiusX*Math.abs(camera.projectionMatrix.elements[5]/camera.projectionMatrix.elements[0]);
        const coveredX=Math.max(0,Math.min(1,screenPoint.x+radiusX)-Math.max(-1,screenPoint.x-radiusX));
        const coveredY=Math.max(0,Math.min(1,screenPoint.y+radiusY)-Math.max(-1,screenPoint.y-radiusY));
        tree.detailCoverage=coveredX*coveredY;
        if(tree.detailCoverage===0)continue;
        tree.detailCentrality=screenPoint.x**2+screenPoint.y**2;
        candidates.push(tree);
      }
    }
    candidates.sort((a,b)=>b.detailCoverage-a.detailCoverage||a.detailCentrality-b.detailCentrality||a.id-b.id);
    let detailTriangles=0;
    for(const tree of candidates){
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
