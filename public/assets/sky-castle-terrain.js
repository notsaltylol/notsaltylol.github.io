import { createDetailView } from './sky-castle-lod.js';
import { createHabitat } from './sky-castle-habitat.js';
import { createGroundSampler } from './sky-castle-ground.js';
import { buildWaterfallGeometry } from './sky-castle-waterfall.js';
import { coherentNoise3D, fractalRock, cliffFormation } from './sky-castle-geology.js';

/** Continuous rolling terrain, an excavated lake, and a connected river/fall. */
export function buildTerrain(THREE, materials, { scale = 1, reservedAreas = [] } = {}) {
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('Terrain scale must be a positive finite number');
  const verticalScale = scale, areaScale = scale * scale;
  const isReserved=(x,z,margin=0)=>reservedAreas.some(area=>Math.hypot(x-area.x,z-area.z)<area.radius+margin);
  const group = new THREE.Group();
  group.name = 'living-floating-island';
  const waterLevel = 1.04 * verticalScale;
  const toLocal = (x, z) => ({ x:x / scale, z:z / scale });
  const toWorld = (x, z) => ({ x:x * scale, z:z * scale });
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const radius = a => 6.8 * (1 + .065 * Math.sin(a * 3 + .4) + .035 * Math.cos(a * 5 - .6) + .022 * Math.sin(a * 9)) * scale;
  const contains = (x, z, margin = 0) => Math.hypot(x, z / .76) < radius(Math.atan2(z / .76, x)) - margin;
  const localRiverX = z => 1.9 + .27 * Math.sin((z - 1) * 1.7);
  const riverX = z => localRiverX(z / scale) * scale;
  function lakeShoreRadius(angle) {
    const lobe = (center,width) => {
      const distance=Math.atan2(Math.sin(angle-center),Math.cos(angle-center));
      return Math.exp(-((distance/width)**2));
    };
    // Authored bays alternate with two substantial wooded peninsulas. A single
    // radial field drives the basin, shoreline mesh, depth and plant habitats;
    // the outline is deliberate at landscape scale, not a noisy oval edge.
    return 1+.025*Math.sin(angle*3+.4)
      +.23*lobe(-.25,.55)+.15*lobe(-2.65,.42)+.18*lobe(1.05,.60)
      -.43*lobe(-1.55,.25)-.37*lobe(2.45,.33)-.22*lobe(.45,.22);
  }
  const localLakeDistance = (x, z) => {
    const dx=(x-1.05)/2.35,dz=(z-.15)/1.65;
    return Math.hypot(dx,dz)/lakeShoreRadius(Math.atan2(dz,dx));
  };
  const lakeDistance = (x, z) => localLakeDistance(x / scale, z / scale);
  // Unequal ribs connect the summit to the surrounding meadow. Narrow steep
  // faces expose rock while broad upper shoulders retain turf and tree roots.
  function uplandRibs(x,z) {
    const dx=x+3.1,dz=z+1.7;
    const ridge=(cx,cz,width,length,tilt,amplitude)=>{
      const u=(dx-cx)+(dz-cz)*tilt,v=dz-cz;
      const cross=Math.exp(-Math.pow(Math.abs(u)/width,3.2));
      return amplitude*cross*Math.exp(-Math.pow(v/length,4));
    };
    return ridge(-1.14,.26,.24,1.04,.48,.48)
      +ridge(.94,-.48,.21,.90,-.26,.30)
      +ridge(-.31,-1.29,.31,.50,-.63,.26)
      +ridge(-.52,1.13,.21,.74,.80,.27);
  }
  function localHeight(x, z) {
    let h = 1.14 + .13 * Math.sin(x * .9 + z * .45) + .10 * Math.cos(z * 1.6 - x * .28);
    const dx=x+3.1,dz=z+1.7;
    // The castle stands on an oblique ridge with unequal shoulders and a
    // shallow approach saddle. These broad forms remain visible in overview.
    h += 1.40*Math.exp(-((dx+.24*dz)**2/2.35+dz*dz/1.78));
    h += .77*Math.exp(-((x+4.66)**2/.82+(z+2.10)**2/1.38));
    h += .48*Math.exp(-((x+3.64)**2/1.65+(z-.04)**2/.86));
    h += .56*Math.exp(-((x+1.77)**2/.72+(z+2.74)**2/1.17));
    h -= .23*Math.exp(-((x+4.08+.18*dz)**2/.11+(z+.78)**2/1.10));
    h += .55 * Math.exp(-((x - 3.7) ** 2 / 2.8 + (z + 2.8) ** 2 / 2));
    h += uplandRibs(x,z);
    // A hollow on the lake-facing flank separates the long sunward shoulder
    // from the quieter approach saddle. The keep remains above every rib.
    h -= .39*Math.exp(-((x+1.93-.26*(z+.62))**2/.32+(z+.62)**2/1.05));
    const originalUpland=h;
    // A narrow summit rises between two unequal shoulders. The long western
    // spur and the cut on the lake side make the castle cap an ascending rock
    // silhouette. The field ends before the meadow rim or the lake basin.
    const summitDistance=Math.hypot(dx,dz),summitMask=1-smooth(1.80,2.35,summitDistance);
    const summitLift=.64*Math.exp(-((dx+.34*dz)**2/.90+dz*dz/.70));
    const westShoulder=.26*Math.exp(-((dx+1.08+.48*(dz-.60))**2/.24+(dz-.60)**2/.92));
    const eastCleft=.22*Math.exp(-((dx-.89+.15*(dz-.58))**2/.14+(dz-.58)**2/.52));
    h+=(summitLift+westShoulder-eastCleft)*summitMask;
    const cap=2.39+.50*summitMask;
    if(h>cap)h=cap+.15*(1-Math.exp(-(h-cap)/.15));
    // A compact upper shoulder descends into the larger mountain. Preserve
    // the settlement's physical bearing area below so its gateway and paving
    // still meet the ground as the surrounding ridge becomes steeper.
    const benchX=Math.max(.50,1.38/scale),benchZ=Math.max(.48,1.38/scale);
    const benchAngle=Math.atan2(dz,dx);
    const benchDistance=Math.hypot((dx+.10*dz)/benchX,dz/benchZ)
      /(1+.075*Math.sin(benchAngle*3+.4)+.035*Math.cos(benchAngle*5));
    const terrace = Math.max(1-smooth(1,1.90,benchDistance),1-smooth(1.35/scale,1.50/scale,summitDistance));
    const shoulderDrop=.10*(1-Math.exp(-((Math.max(0,summitDistance-1.50/scale)/.50)**2)));
    h = h * (1 - terrace) + (3.35-shoulderDrop) * terrace;
    const oldX=Math.max(.68,1.38/scale),oldZ=Math.max(.59,1.38/scale);
    const oldDistance=Math.hypot((dx+.10*dz)/oldX,dz/oldZ)
      /(1+.075*Math.sin(benchAngle*3+.4)+.035*Math.cos(benchAngle*5));
    const oldTerrace=Math.max(1-smooth(1,1.80,oldDistance),1-smooth(1.35/scale,1.50/scale,summitDistance));
    const oldHill=originalUpland>2.39?2.39+.15*(1-Math.exp(-(originalUpland-2.39)/.15)):originalUpland;
    const oldHeight=oldHill*(1-oldTerrace)+2.78*oldTerrace;
    // One long southwest shoulder carries the oblique approach. Extending
    // only this sector breaks the circular collar below the protected court.
    const approachAngle=Math.atan2(Math.sin(benchAngle-2.21),Math.cos(benchAngle-2.21));
    const approachSector=Math.exp(-((approachAngle/.64)**2));
    const precinctLock=1-smooth(8.6/scale,(10.0+8*approachSector)/scale,summitDistance);
    h=h*(1-precinctLock)+(oldHeight+.57)*precinctLock;
    // A narrow rising ledge supports the last traverse into the gateway. Its
    // grade is independent of the steeper bare face below. Begin the blend
    // on the already level court so it cannot form a lip across the road.
    const entryAngle=Math.atan2(Math.sin(benchAngle-1.85),Math.cos(benchAngle-1.85));
    const entryShoulder=Math.exp(-((entryAngle/.88)**6))
      *smooth(.55,.72,summitDistance)*(1-smooth(1.12,1.44,summitDistance));
    const entryGrade=3.35-.65*Math.max(0,summitDistance-.68);
    if(scale>2)h+=Math.max(0,entryGrade-h)*entryShoulder;
    // End before the meadow rim and restore distant terrain exactly, including
    // the wider bearing pad used by small-scale previews.
    h=oldHeight+(h-oldHeight)*summitMask;
    const shoreDistance=localLakeDistance(x,z);
    // A shallow natural bank contains the lake where the underlying rolling
    // meadow dips just below water level. The outlet is excavated afterward.
    const bank=smooth(1.04,1.20,shoreDistance)*(1-smooth(1.30,1.43,shoreDistance));
    h+=Math.max(0,1.085-h)*bank;
    const basin = 1 - smooth(.90, 1.23, shoreDistance);
    const channel = (1 - smooth(.25, .63, Math.abs(x - localRiverX(z)))) * smooth(.6, 1.3, z);
    const excavation = Math.max(basin, channel);
    return h * (1 - excavation) + .55 * excavation;
  }
  const height = (x, z) => localHeight(x / scale, z / scale) * verticalScale;
  function localRockExposure(lx,lz,normalY){
    const d=Math.hypot(lx+3.1,lz+1.7);
    const mountain=(1-smooth(2.05,2.70,d))*smooth(.54,.84,d);
    if(mountain===0)return 0;
    const dxHill=lx+3.1,dzHill=lz+1.7;
    // Turf follows the rounded rib between two steep faces, joining back into
    // the low meadow instead of surrounding the summit with one tan apron.
    const grassyRib=Math.exp(-((dxHill+.35*(dzHill-.55)+.38)**2/.12+(dzHill-.8)**2/1.30))
      *smooth(.30,.60,normalY);
    return mountain*Math.max(1-smooth(.58,.82,normalY),smooth(.06,.27,uplandRibs(lx,lz))*.28)*(1-.80*grassyRib);
  }
  function rockExposure(x,z){
    const lx=x/scale,lz=z/scale,e=.012;
    const distance=Math.hypot(lx+3.1,lz+1.7);
    if(distance<=.54||distance>=2.70)return 0;
    const dx=(localHeight(lx+e,lz)-localHeight(lx-e,lz))/(2*e);
    const dz=(localHeight(lx,lz+e)-localHeight(lx,lz-e))/(2*e);
    return localRockExposure(lx,lz,1/Math.sqrt(1+dx*dx+dz*dz));
  }
  const castleAnchor = new THREE.Vector3(-3.1 * scale, height(-3.1 * scale, -1.7 * scale), -1.7 * scale);
  // The upper route climbs the long western shoulder, then traverses toward
  // the gate. Crossing the contours avoids a straight road up the steep face.
  const trailPoints=scale>2
    ?[[-.8,2.8],[-2.5,2.1],[-3.8,.9],[-4.28,.30],[-3.88,-.19],[-3.52,-.61],[-3.42,-.79],[-2.88,-.82],[-3.1,-1.7]]
    :[[-.8,2.8],[-2.5,2.1],[-3.8,.9],[-2.7,-.25],[-3.1,-1.7]];
  const trail = new THREE.CatmullRomCurve3(trailPoints.map(([x,z]) => new THREE.Vector3(x * scale, 0, z * scale)));
  const trailSteps = Math.max(100, Math.min(1200, Math.round(100 * scale)));
  const trailSamples = trail.getPoints(trailSteps);
  const trailSegments = trailSamples.slice(1).map((b, i) => {
    const a = trailSamples[i], dx = b.x - a.x, dz = b.z - a.z;
    return { x:a.x, z:a.z, dx, dz, length2:dx * dx + dz * dz, minX:Math.min(a.x,b.x), maxX:Math.max(a.x,b.x), minZ:Math.min(a.z,b.z), maxZ:Math.max(a.z,b.z) };
  });
  function buildTrailIndex(items) {
    const node = { minX:Infinity, maxX:-Infinity, minZ:Infinity, maxZ:-Infinity };
    for (const item of items) {
      node.minX = Math.min(node.minX, item.minX); node.maxX = Math.max(node.maxX, item.maxX);
      node.minZ = Math.min(node.minZ, item.minZ); node.maxZ = Math.max(node.maxZ, item.maxZ);
    }
    if (items.length <= 8) node.items = items;
    else {
      const axis = node.maxX - node.minX > node.maxZ - node.minZ ? 'X' : 'Z';
      items.sort((a,b) => a[`min${axis}`] + a[`max${axis}`] - b[`min${axis}`] - b[`max${axis}`]);
      const middle = Math.floor(items.length / 2);
      node.left = buildTrailIndex(items.slice(0,middle)); node.right = buildTrailIndex(items.slice(middle));
    }
    return node;
  }
  const trailIndex = buildTrailIndex(trailSegments.slice());
  function trailDistance(x, z) {
    let best2 = Infinity;
    const boxDistance = node => {
      const dx = Math.max(node.minX - x, 0, x - node.maxX), dz = Math.max(node.minZ - z, 0, z - node.maxZ);
      return dx * dx + dz * dz;
    };
    function visit(node) {
      if (boxDistance(node) >= best2) return;
      if (node.items) {
        for (const segment of node.items) {
          if (boxDistance(segment) >= best2) continue;
          const t = Math.max(0, Math.min(1, ((x - segment.x) * segment.dx + (z - segment.z) * segment.dz) / segment.length2));
          const dx = x - segment.x - segment.dx * t, dz = z - segment.z - segment.dz * t;
          best2 = Math.min(best2, dx * dx + dz * dz);
        }
      } else if (boxDistance(node.left) < boxDistance(node.right)) {
        visit(node.left); visit(node.right);
      } else {
        visit(node.right); visit(node.left);
      }
    }
    visit(trailIndex);
    return Math.sqrt(best2);
  }
  // A larger world gets more samples, not a scaled group of giant props. The
  // cap keeps the overview practical; world-frequency shaders retain fine detail.
  const density = Math.max(1, Math.min(2, scale));
  const segments = Math.round(160 * density), rings = Math.round(56 * density);
  const positions = [], uvs = [], indices = [];
  let refinedBankCells=0;
  if(scale<=2){
    for(let j=0;j<=rings;j++) for(let i=0;i<=segments;i++){
      const a=i/segments*Math.PI*2,r=radius(a)*j/rings;
      const x=Math.cos(a)*r,z=Math.sin(a)*r*.76;
      positions.push(x,height(x,z),z);uvs.push(x/14+.5,z/11+.5);
    }
    for(let j=0;j<rings;j++) for(let i=0;i<segments;i++){
      const a=j*(segments+1)+i,b=a+segments+1;
      if(j>0)indices.push(a,a+1,b);
      indices.push(a+1,b+1,b);
    }
  }else{
    // Refine only curved lake banks and channel sides. A shared integer grid
    // and stitched transition edges keep this adaptive surface watertight.
    const refinement=new Uint8Array(segments*rings).fill(1);
    for(let j=0;j<rings;j++) for(let i=0;i<segments;i++){
      const a=(i+.5)/segments*Math.PI*2,r=radius(a)*(j+.5)/rings;
      const x=Math.cos(a)*r,z=Math.sin(a)*r*.76,d=lakeDistance(x,z);
      const channel=Math.abs(x/scale-localRiverX(z/scale));
      const lakeBank=d>.91&&d<1.43,riverBank=z/scale>.6&&channel>.20&&channel<.69;
      const summitDistance=Math.hypot(x/scale+3.1,z/scale+1.7);
      const upland=summitDistance>.60&&summitDistance<2.55;
      if(!lakeBank&&!riverBank&&!upland)continue;
      const steep=(lakeBank&&d>1.01&&d<1.29)||(riverBank&&channel>.29&&channel<.65);
      const cellSize=Math.max(radius(a)/rings,r*Math.PI*2/segments);
      const target=Math.min(steep||upland?4:2,2**Math.max(0,Math.ceil(Math.log2(cellSize/(upland?.24:.22)))));
      refinement[j*segments+i]=target;
      if(target>1)refinedBankCells++;
    }
    const grid=8,fullU=segments*grid,fullV=rings*grid,vertices=new Map();
    function vertex(u,v){
      u=((u%fullU)+fullU)%fullU;
      if(v===0)u=0;
      const key=v*fullU+u;
      if(vertices.has(key))return vertices.get(key);
      const a=u/fullU*Math.PI*2,r=radius(a)*v/fullV;
      let x=Math.cos(a)*r,z=Math.sin(a)*r*.76,y=height(x,z);
      if(v===fullV){
        // Extra rim vertices lie on the original meadow/cliff boundary
        // segments, rather than sampling a slightly different curved rim.
        const left=Math.floor(u/grid),blend=u/grid-left;
        const a0=left/segments*Math.PI*2,a1=(left+1)/segments*Math.PI*2;
        const x0=Math.cos(a0)*radius(a0),z0=Math.sin(a0)*radius(a0)*.76;
        const x1=Math.cos(a1)*radius(a1),z1=Math.sin(a1)*radius(a1)*.76;
        x=x0+(x1-x0)*blend;z=z0+(z1-z0)*blend;
        y=height(x0,z0)+(height(x1,z1)-height(x0,z0))*blend;
      }
      const index=positions.length/3;vertices.set(key,index);
      positions.push(x,y,z);uvs.push(x/14+.5,z/11+.5);return index;
    }
    const level=(i,j)=>j<0||j>=rings?1:refinement[j*segments+(i+segments)%segments];
    const triangle=(a,b,c)=>{if(a!==b&&b!==c&&c!==a)indices.push(a,b,c);};
    for(let j=0;j<rings;j++) for(let i=0;i<segments;i++){
      const n=level(i,j),step=grid/n;
      for(let v=0;v<n;v++) for(let u=0;u<n;u++){
        const x0=i*grid+u*step,x1=x0+step,y0=j*grid+v*step,y1=y0+step;
        const edgeLevels=[v===0?level(i,j-1):n,u===n-1?level(i+1,j):n,v===n-1?level(i,j+1):n,u===0?level(i-1,j):n];
        if(edgeLevels.every(value=>value<=n)){
          const a=vertex(x0,y0),b=vertex(x1,y0),c=vertex(x1,y1),d=vertex(x0,y1);
          triangle(a,b,d);triangle(b,c,d);
        }else{
          const corners=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]],boundary=[];
          for(let edge=0;edge<4;edge++){
            const count=Math.max(1,edgeLevels[edge]/n),a=corners[edge],b=corners[(edge+1)%4];
            for(let k=0;k<count;k++)boundary.push(vertex(a[0]+(b[0]-a[0])*k/count,a[1]+(b[1]-a[1])*k/count));
          }
          const center=vertex((x0+x1)/2,(y0+y1)/2);
          for(let k=0;k<boundary.length;k++)triangle(center,boundary[k],boundary[(k+1)%boundary.length]);
        }
      }
    }
  }
  function geometry(pos, uv, idx) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  function add(g, material) {
    const m = new THREE.Mesh(g, material); m.castShadow = m.receiveShadow = true; group.add(m); return m;
  }
  const meadowGeometry=geometry(positions,uvs,indices);
  const exposedRock=[];
  const meadowNormals=meadowGeometry.attributes.normal;
  for(let i=0;i<positions.length;i+=3){
    const x=positions[i]/scale,z=positions[i+2]/scale;
    exposedRock.push(localRockExposure(x,z,meadowNormals.getY(i/3)));
  }
  meadowGeometry.setAttribute('terrainRock',new THREE.Float32BufferAttribute(exposedRock,1));
  const meadowMaterial=materials.meadow||materials.grass;
  const meadow = add(meadowGeometry, meadowMaterial);
  meadow.name = 'continuous-sculpted-meadow';
  const surfaceHeight=createGroundSampler(meadow.geometry,{cellSize:Math.max(.25,Math.min(2,scale*.2))});
  let lipLocalZ = 2;
  while (contains(localRiverX(lipLocalZ) * scale, lipLocalZ * scale)) lipLocalZ += .012;
  lipLocalZ -= .012;
  const lipZ = lipLocalZ * scale;
  const fallAngle=Math.atan2(lipZ/.76,riverX(lipZ));
  // The exposed cut beside the fall is bare stone, not a dangling grassy bank.
  // Partition existing triangles into two batches; their vertices, normals and
  // shared edges remain exact, with no overlay surface or extra bank geometry.
  const meadowGrass=[],meadowStone=[];
  const bankA=new THREE.Vector3(),bankB=new THREE.Vector3(),bankC=new THREE.Vector3();
  for(let i=0;i<indices.length;i+=3){
    const ia=indices[i],ib=indices[i+1],ic=indices[i+2];
    bankA.fromArray(positions,ia*3);bankB.fromArray(positions,ib*3);bankC.fromArray(positions,ic*3);
    const x=(bankA.x+bankB.x+bankC.x)/3,y=(bankA.y+bankB.y+bankC.y)/3,z=(bankA.z+bankB.z+bankC.z)/3;
    const nearLip=z>lipZ-.45*scale&&Math.abs(x-riverX(z))<.85*scale&&y<waterLevel+.70*scale;
    const steep=nearLip&&bankB.sub(bankA).cross(bankC.sub(bankA)).normalize().y<.80;
    (steep?meadowStone:meadowGrass).push(ia,ib,ic);
  }
  if(meadowStone.length){
    meadow.geometry.setIndex([...meadowGrass,...meadowStone]);
    meadow.geometry.clearGroups();
    meadow.geometry.addGroup(0,meadowGrass.length,0);
    meadow.geometry.addGroup(meadowGrass.length,meadowStone.length,1);
    meadow.material=[meadowMaterial,materials.rock];
  }

  // The fixed meadow boundary blends into independently leaning rock faces.
  // Broken shelves and deep fault clefts shape the mass before fine erosion.
  const cliffP = [], cliffU = [], cliffI = [];
  const cliffSegments = segments * 2, cliffRings = Math.round(72 * Math.max(1, Math.min(2, verticalScale)));
  function inscriptionProtection(a, x, y) {
    const nameX = smooth(-4.65,-4.25,x/scale)*(1-smooth(-1.60,-1.20,x/scale));
    // Protect the fitted letter band, not the entire face beneath it.
    // The former broad mask erased much of the geology below the lettering.
    const nameY = smooth(-1.04,-.82,y/verticalScale)*(1-smooth(-.30,-.06,y/verticalScale));
    return 1 - nameX * nameY * smooth(.45,.72,Math.sin(a))*.98;
  }
  function cliffBase(a, t) {
    const channelAngle=Math.abs(Math.atan2(Math.sin(a-fallAngle),Math.cos(a-fallAngle)));
    const clearFall=smooth(.11,.27,channelAngle);
    const rimY=height(Math.cos(a)*radius(a),Math.sin(a)*radius(a)*.76);
    const y=rimY*(1-t)-5.20*verticalScale*t;
    const formation=cliffFormation(a,t,y/verticalScale);
    // The bedrock profile inherits the exact unequal meadow boundary. A
    // direct ratio removes the old broad interpolated collar while keeping
    // each wedge and oblique shelf connected to the land above it.
    const r=radius(a)*formation.radius/6.8;
    let x=Math.cos(a)*r+formation.centerX*scale;
    let z=Math.sin(a)*r*.76+formation.centerZ*scale;
    // The outlet retains the original recession envelope. No projecting ledge
    // may enter the falling water column, even beside a deep hanging block.
    if(clearFall<1){
      const riverRadius=radius(a)*(1-.14*smooth(0,.009,t)-.75*smooth(.08,1,t));
      // Retreat straight behind the lip first. Pulling X inward on this first
      // row would drag a steep bank triangle across the waterfall's left edge.
      const channelXRadius=radius(a)+(riverRadius-radius(a))*smooth(.015,.12,t);
      const riverX=Math.cos(a)*channelXRadius-.70*t*scale;
      const riverZ=Math.sin(a)*riverRadius*.76+.16*t*scale;
      x=riverX+(x-riverX)*clearFall;z=riverZ+(z-riverZ)*clearFall;
    }
    return [x, y, z];
  }
  for (let j = 0; j <= cliffRings; j++) for (let i = 0; i <= cliffSegments; i++) {
    const a = (i === cliffSegments ? 0 : i / cliffSegments) * Math.PI * 2, t = j / cliffRings;
    let [x, y, z] = cliffBase(a, t);
    if (j === 0 || j === cliffRings) {
      // Subdivide the exact meadow segments instead of sampling a subtly
      // different curve. The meadow/cliff boundary remains watertight.
      const edge = i / 2, left = Math.floor(edge) % segments, right = (left + 1) % segments, blend = edge % 1;
      const p = cliffBase(left / segments * Math.PI * 2, t), q = cliffBase(right / segments * Math.PI * 2, t);
      [x, y, z] = p.map((coordinate, axis) => coordinate + (q[axis] - coordinate) * blend);
    } else {
      const channelAngle = Math.abs(Math.atan2(Math.sin(a - fallAngle), Math.cos(a - fallAngle)));
      const clearFall = smooth(.16, .32, channelAngle);
      const rimAndTip = smooth(.025, .17, t) * (1 - smooth(.81, .985, t));
      // Preserve a quiet face for the small raycast stone inscription. This
      // mask is spatial, so nearby rock still receives geological variation.
      const nameProtection = inscriptionProtection(a, x, y);
      const envelope = rimAndTip * clearFall * nameProtection;
      const mediumScale = Math.sqrt(scale);
      const mediumCrags = scale === 1 ? 0 : coherentNoise3D(x / mediumScale, y / mediumScale, z / mediumScale) * .26 * (mediumScale - 1);
      const displacement = (fractalRock(x, y, z) * .64 + mediumCrags) * envelope;
      // Mostly outward displacement adds face crags. A smaller vertical
      // component creates irregular shelves without distorting the whole mass.
      x += Math.cos(a) * displacement;
      z += Math.sin(a) * displacement * .76;
      const verticalErosion = scale === 1 ? fractalRock(x * .67 + 17.3, y * .91 - 4.8, z * .67) : coherentNoise3D(x * .67 + 17.3, y * .91 - 4.8, z * .67);
      y += verticalErosion * .105 * envelope;
    }
    cliffP.push(x, y, z); cliffU.push(i / cliffSegments, t);
  }
  for (let j = 0; j < cliffRings; j++) for (let i = 0; i < cliffSegments; i++) {
    const a = j * (cliffSegments + 1) + i, b = a + cliffSegments + 1;
    cliffI.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const tip=cliffP.length/3;cliffP.push(-.38 * scale,-5.27 * verticalScale,-.13 * scale);cliffU.push(.5,1);
  for(let i=0;i<cliffSegments;i++){const a=cliffRings*(cliffSegments+1)+i;cliffI.push(a,a+1,tip);}
  const cliffGeometry = geometry(cliffP, cliffU, cliffI);
  // The UV seam duplicates vertices. Average their normals explicitly so
  // rotating around the complete island cannot reveal a lighting seam.
  const normal = cliffGeometry.attributes.normal;
  for (let j = 0; j <= cliffRings; j++) {
    const first = j * (cliffSegments + 1), last = first + cliffSegments;
    const n = new THREE.Vector3(normal.getX(first) + normal.getX(last), normal.getY(first) + normal.getY(last), normal.getZ(first) + normal.getZ(last)).normalize();
    normal.setXYZ(first, n.x, n.y, n.z); normal.setXYZ(last, n.x, n.y, n.z);
  }
  // Turf uses the exact cliff triangles, never a second coarse skin. This
  // matters where the authored crags fold under the rim: an overlay would
  // bridge their sharp shoulders and show floating green stripes from below.
  const rimTurfDepth=[];
  for(let i=0;i<=cliffSegments;i++){
    const a=(i===cliffSegments?0:i/cliffSegments)*Math.PI*2;
    const habitat=coherentNoise3D(Math.cos(a)*3.1+9.2,.7,Math.sin(a)*3.1);
    const fine=coherentNoise3D(Math.cos(a)*17.2,1.6,Math.sin(a)*17.2);
    const channelAngle=Math.abs(Math.atan2(Math.sin(a-fallAngle),Math.cos(a-fallAngle)));
    rimTurfDepth.push((.004+.023*smooth(-.03,.42,habitat)+.004*smooth(-.10,.38,fine))*smooth(.18,.34,channelAngle));
  }
  const bareRock=[],rimTurf=[],turfA=new THREE.Vector3(),turfB=new THREE.Vector3(),turfC=new THREE.Vector3();
  for(let k=0;k<cliffI.length;k+=3){
    const a=cliffI[k],b=cliffI[k+1],c=cliffI[k+2];
    const depth=(Math.floor(a/(cliffSegments+1))+Math.floor(b/(cliffSegments+1))+Math.floor(c/(cliffSegments+1)))/(3*cliffRings);
    const habitat=(rimTurfDepth[a%(cliffSegments+1)]+rimTurfDepth[b%(cliffSegments+1)]+rimTurfDepth[c%(cliffSegments+1)])/3;
    let grassy=false;
    // A turf edge stays physically thin when the land is enlarged; scaling
    // it with the island creates a false green skirt on exposed rock ledges.
    if(depth<Math.min(habitat,.018/verticalScale)){
      turfA.fromArray(cliffP,a*3);turfB.fromArray(cliffP,b*3).sub(turfA);turfC.fromArray(cliffP,c*3).sub(turfA);
      const face=turfB.cross(turfC).normalize();
      // Plants occupy the upward-facing ledges, not the hanging underside.
      const x=(cliffP[a*3]+cliffP[b*3]+cliffP[c*3])/3;
      const z=(cliffP[a*3+2]+cliffP[b*3+2]+cliffP[c*3+2])/3;
      const nearOutlet=z>lipZ-.50*scale&&Math.abs(x-riverX(z))<1.0*scale;
      grassy=face.y>(nearOutlet?.72:.68);
    }
    (grassy?rimTurf:bareRock).push(a,b,c);
  }
  cliffGeometry.setIndex([...bareRock,...rimTurf]);
  cliffGeometry.addGroup(0,bareRock.length,0);
  if(rimTurf.length)cliffGeometry.addGroup(bareRock.length,rimTurf.length,1);
  const cliff=add(cliffGeometry,[materials.rock,materials.grass]);
  cliff.name='continuous-eroded-cliff';cliff.userData.rimTurfTriangles=rimTurf.length/3;

  // Lake vertices are built directly in XZ, so water shader ripples remain in
  // the horizontal plane. Its edge disappears into the excavated shoreline.
  const lakeSegments = Math.round(100 * Math.max(1, Math.min(4, scale)));
  const lakeRings = Math.round(12 * Math.max(1, Math.min(2, scale)));
  const waterP = [1.05 * scale, waterLevel, .15 * scale], waterU = [.5, .5], waterI = [];
  const waterDepth = [Math.max(0, waterLevel - height(1.05 * scale, .15 * scale))];
  for (let ring = 1; ring <= lakeRings; ring++) for (let i = 0; i <= lakeSegments; i++) {
    const a = i / lakeSegments * Math.PI * 2, r = ring / lakeRings;
    const shore=lakeShoreRadius(a);
    // Extend the hidden mesh under the natural bank so land clips its edge.
    const x = (1.05 + Math.cos(a) * 2.35 * 1.26 * r * shore) * scale;
    const z = (.15 + Math.sin(a) * 1.65 * 1.26 * r * shore) * scale;
    waterP.push(x, waterLevel, z);
    waterU.push(.5 + .5 * Math.cos(a) * r, .5 + .5 * Math.sin(a) * r);
    waterDepth.push(Math.max(0, waterLevel - height(x, z)));
    if (i === lakeSegments) continue;
    const vertex = 1 + (ring - 1) * (lakeSegments + 1) + i;
    if (ring === 1) waterI.push(0, vertex + 1, vertex);
    else {
      const previous = vertex - lakeSegments - 1;
      waterI.push(previous, previous + 1, vertex, previous + 1, vertex + 1, vertex);
    }
  }
  const lakeGeometry = geometry(waterP, waterU, waterI);
  lakeGeometry.setAttribute('waterDepth', new THREE.Float32BufferAttribute(waterDepth, 1));
  const lake = add(lakeGeometry, materials.water);
  lake.name = 'excavated-lake-water';
  lake.castShadow = false; lake.renderOrder = 2;
  const riverP = [], riverU = [], riverI = [], riverDepth = [], riverFlow = [];
  const riverSteps = Math.round(80 * Math.max(1, Math.min(4, scale)));
  const riverColumns = Math.round(4 * Math.max(1, Math.min(3, scale)));
  for (let i = 0; i <= riverSteps; i++) {
    const z = scale + (lipZ - scale) * i / riverSteps;
    const width = (.41 + .045 * Math.sin(z / scale * 2)) * scale;
    for (let j = 0; j <= riverColumns; j++) {
      const x = riverX(z) + (j / riverColumns * 2 - 1) * width;
      riverP.push(x, waterLevel, z); riverU.push(j / riverColumns, i / riverSteps);
      riverDepth.push(Math.max(0, waterLevel - height(x, z)));
      // Lake and river overlap on a common plane at the mouth. Keep their
      // material inputs identical until clear of the hidden lake mesh edge.
      riverFlow.push(smooth(1.34,1.95,lakeDistance(x,z)));
      if (i < riverSteps && j < riverColumns) {
        const a = i * (riverColumns + 1) + j, b = a + riverColumns + 1;
        riverI.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const riverGeometry = geometry(riverP, riverU, riverI);
  riverGeometry.setAttribute('waterDepth', new THREE.Float32BufferAttribute(riverDepth, 1));
  riverGeometry.setAttribute('waterFlow', new THREE.Float32BufferAttribute(riverFlow, 1));
  const river = add(riverGeometry, materials.water);
  river.name = 'connected-river-water';
  river.castShadow = false; river.renderOrder = 2;
  const lip = new THREE.Vector3(riverX(lipZ), waterLevel, lipZ);
  const lipWidth=2*(.41+.045*Math.sin(lipLocalZ*2))*scale;
  const fallGeometry=buildWaterfallGeometry(THREE,{lip,width:lipWidth,scale,verticalScale});
  const waterfall = add(fallGeometry, materials.waterfall);
  waterfall.name='rolling-turbulent-waterfall';
  waterfall.castShadow = false; waterfall.renderOrder = 3;

  const stoneChunks = [], flowerChunks = [];
  function scatterChunks(instances, target, name) {
    if (scale === 1) {
      instances.name = name; instances.computeBoundingSphere();
      group.add(instances); target.push(instances); return;
    }
    const cells = new Map(), matrix = new THREE.Matrix4(), cellSize = 16;
    for (let i = 0; i < instances.count; i++) {
      instances.getMatrixAt(i, matrix);
      const key = `${Math.floor(matrix.elements[12] / cellSize)},${Math.floor(matrix.elements[14] / cellSize)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(i);
    }
    for (const [cell, ids] of cells) {
      const chunk = new THREE.InstancedMesh(instances.geometry, instances.material, ids.length);
      chunk.name = `${name}-${cell}`;
      chunk.castShadow = instances.castShadow; chunk.receiveShadow = instances.receiveShadow;
      ids.forEach((id, index) => { instances.getMatrixAt(id, matrix); chunk.setMatrixAt(index, matrix); });
      chunk.computeBoundingSphere(); chunk.computeBoundingBox();
      group.add(chunk); target.push(chunk);
    }
    instances.dispose();
  }
  const detailView=createDetailView(THREE);
  let detailShadowRevision=0;
  function updateDetail(camera, visibleWidth) {
    group.updateWorldMatrix(true,true);detailView.prepare(camera,visibleWidth);
    for (const chunk of flowerChunks) chunk.visible=detailView.meshVisible(chunk)&&detailView.meshWidth(chunk)<=65;
    for (const chunk of stoneChunks) {
      const visible=detailView.meshVisible(chunk)&&detailView.meshWidth(chunk)<=140;
      if(visible!==chunk.visible)detailShadowRevision++;
      chunk.visible=visible;
    }
    detailStats.shadowRevision=detailShadowRevision;
  }

  // Local outcrops and flower colonies sit within broad coherent habitats.
  // Every stone/flower keeps its physical size and population at larger scales;
  // only the distribution changes from uniform noise to clearings and patches.
  let seed = 8753, scatterAttempts = 0;
  const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
  const rockGeo = new THREE.IcosahedronGeometry(1, 2);
  const stoneCount = Math.max(1, Math.round(46 * areaScale)), flowerCount = Math.max(1, Math.round(380 * areaScale));
  const dummy = new THREE.Object3D();
  const landscapeHabitat=createHabitat({kind:'main',scale}),habitatValues={};
  function habitat(x,z,flowers){
    landscapeHabitat.sample(x,z,habitatValues);
    return flowers?habitatValues.flowers:habitatValues.stone;
  }
  function legalScatter(x, z, flowers) {
    return contains(x, z, flowers ? .45 : .25) && !isReserved(x,z,flowers?.16:.4) &&
      height(x,z) >= waterLevel + (flowers ? .12 : .05) &&
      Math.hypot(x-castleAnchor.x,z-castleAnchor.z) >= (flowers ? 1.5 : 1.3) &&
      trailDistance(x,z) >= (flowers ? .26 : .50) && habitat(x,z,flowers)>.015 && (!flowers||rockExposure(x,z)<.15);
  }
  function makePatches(count, flowers) {
    const patches = [];
    for (let i=0;i<count;i++) {
      let x, z, fallback;
      // Bounded habitat rejection: legal candidates are remembered so a rare
      // awkward habitat never causes an unbounded startup loop.
      for (let attempt=0;attempt<256;attempt++) {
        scatterAttempts++;
        x=(random()-.5)*13*scale; z=(random()-.5)*9*scale;
        if (!legalScatter(x,z,flowers)) continue;
        fallback=[x,z];
        if (random()<habitat(x,z,flowers)) break;
      }
      if (!fallback) {
        // Existing accepted patches are always valid. At the first patch use
        // a deterministic bounded lattice search instead of blind rejection.
        if (patches.length) fallback=[patches[0].x,patches[0].z];
        else for(let iz=0;iz<40 && !fallback;iz++) for(let ix=0;ix<40;ix++) {
          const px=(ix/39-.5)*12*scale,pz=(iz/39-.5)*8*scale;
          if(legalScatter(px,pz,flowers)){fallback=[px,pz];break;}
        }
      }
      if (!fallback) throw new Error('No habitable terrain for the requested scatter scale');
      [x,z]=fallback;
      patches.push({x,z, radius:(flowers ? 1.0+random()*1.6 : .45+random()*.85)*Math.min(1,Math.sqrt(scale)),
        aspect:.45+random()*.65, angle:random()*Math.PI*2, phase:random()*Math.PI*2});
    }
    return patches;
  }
  function samplePatch(patch, flowers) {
    for(let attempt=0;attempt<32;attempt++) {
      scatterAttempts++;
      const angle=random()*Math.PI*2;
      const r=Math.pow(random(),.7)*patch.radius*(1+.20*Math.sin(angle*3+patch.phase)+.10*Math.cos(angle*5-patch.phase));
      const px=Math.cos(angle)*r,pz=Math.sin(angle)*r*patch.aspect;
      const x=patch.x+px*Math.cos(patch.angle)-pz*Math.sin(patch.angle);
      const z=patch.z+px*Math.sin(patch.angle)+pz*Math.cos(patch.angle);
      if(legalScatter(x,z,flowers)) return [x,z];
    }
    return [patch.x,patch.z];
  }
  const stonePatches=makePatches(Math.max(4,Math.ceil(stoneCount/15)),false);
  const stones = new THREE.InstancedMesh(rockGeo, materials.rock, stoneCount);
  for(let i=0;i<stoneCount;i++) {
    const [x,z]=samplePatch(stonePatches[i%stonePatches.length],false);
    const s=.07+random()*.16;
    dummy.position.set(x,surfaceHeight(x,z)-.025,z); dummy.scale.set(s*(1+random()),s*.60,s);
    dummy.rotation.set(random()*.6,random()*6.28,random()*.4); dummy.updateMatrix(); stones.setMatrixAt(i,dummy.matrix);
  }
  stones.castShadow = stones.receiveShadow = true; scatterChunks(stones, stoneChunks, 'terrain-scattered-stones');
  const flowerPatches=makePatches(Math.max(6,Math.ceil(flowerCount/70)),true);
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 5, 4), materials.flower, flowerCount);
  for(let i=0;i<flowerCount;i++) {
    const [x,z]=samplePatch(flowerPatches[i%flowerPatches.length],true);
    dummy.position.set(x,surfaceHeight(x,z)+.12,z); dummy.scale.set(1.3,.5,1.3);
    dummy.rotation.set(0,random()*6,0); dummy.updateMatrix(); flowers.setMatrixAt(i,dummy.matrix);
  }
  scatterChunks(flowers, flowerChunks, 'terrain-meadow-flowers');

  // A winding limestone route climbs the hill; each section follows terrain.
  const pathP = [], pathU = [], pathI = [],pathColumns=4;
  for (let i = 0; i <= trailSteps; i++) {
    const t = i / trailSteps, p = trail.getPoint(t), tangent = trail.getTangent(t), width = .17;
    for(let col=0;col<=pathColumns;col++){const side=col/pathColumns*2-1,x=p.x+tangent.z*width*side,z=p.z-tangent.x*width*side;pathP.push(x,surfaceHeight(x,z)+.018,z);pathU.push(col/pathColumns,t);}
    if(i<trailSteps)for(let col=0;col<pathColumns;col++){const a=i*(pathColumns+1)+col,b=a+pathColumns+1;pathI.push(a,b,a+1,a+1,b,b+1);}
  }
  // Worn limestone carries the route without competing with the pale keep.
  // Share the live palette color; tint only this material's diffuse response.
  const trailMaterial=materials.stone.clone();trailMaterial.color=materials.stone.color;
  trailMaterial.side=THREE.DoubleSide;trailMaterial.name='worn-limestone-path';
  trailMaterial.onBeforeCompile=shader=>{
    materials.stone.onBeforeCompile(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.rgb *= vec3(0.58,0.61,0.56);');
  };
  trailMaterial.customProgramCacheKey=()=>materials.stone.customProgramCacheKey()+'-worn-path';
  const trailMesh = add(geometry(pathP,pathU,pathI),trailMaterial);trailMesh.castShadow=false;
  trailMesh.name = 'limestone-walking-route';trailMesh.geometry.userData.pathColumns=pathColumns;
  const detailStats = { stoneCount, flowerCount, stoneChunks:stoneChunks.length, flowerChunks:flowerChunks.length,
    meadowTriangles:indices.length / 3, lipBankTriangles:meadowStone.length/3, refinedBankCells, cliffTriangles:cliffI.length / 3, lakeTriangles:waterI.length / 3, riverTriangles:riverI.length / 3,
    stonePatches:stonePatches.length, flowerPatches:flowerPatches.length, scatterAttempts, trailWidth:.34 };
  return { group, scale, verticalScale, height, surfaceHeight, contains, radius, lakeDistance, riverX, waterLevel, lip, castleAnchor,
    toLocal, toWorld, trail, trailDistance, isReserved, rockExposure, updateDetail, detailStats };
}
