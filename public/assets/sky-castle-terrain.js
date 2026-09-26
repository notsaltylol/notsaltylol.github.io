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
    // Two broad eroded coves and an open eastern bay break the manufactured
    // ellipse. The same boundary drives excavation, ecology and water depth.
    return 1+.036*Math.sin(angle*2+.4)+.022*Math.cos(angle*3-1.2)
      -.13*lobe(2.55,.36)-.085*lobe(-1.48,.29)+.10*lobe(-.25,.63);
  }
  const localLakeDistance = (x, z) => {
    const dx=(x-1.05)/2.35,dz=(z-.15)/1.65;
    return Math.hypot(dx,dz)/lakeShoreRadius(Math.atan2(dz,dx));
  };
  const lakeDistance = (x, z) => localLakeDistance(x / scale, z / scale);
  function localHeight(x, z) {
    let h = 1.14 + .13 * Math.sin(x * .9 + z * .45) + .10 * Math.cos(z * 1.6 - x * .28);
    h += 2.05 * Math.exp(-((x + 3.1) ** 2 / 3.3 + (z + 1.7) ** 2 / 3.6));
    h += .55 * Math.exp(-((x - 3.7) ** 2 / 2.8 + (z + 2.8) ** 2 / 2));
    const terrace = 1 - smooth(.85, 1.5, Math.hypot((x + 3.1) / 1.5, (z + 1.7) / 1.15));
    h = h * (1 - terrace) + 2.78 * terrace;
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
  const castleAnchor = new THREE.Vector3(-3.1 * scale, height(-3.1 * scale, -1.7 * scale), -1.7 * scale);
  const trail = new THREE.CatmullRomCurve3([[-.8,2.8],[-2.5,2.1],[-3.8,.9],[-2.7,-.25],[-3.1,-1.7]].map(([x,z]) => new THREE.Vector3(x * scale, 0, z * scale)));
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
      indices.push(a,a+1,b,a+1,b+1,b);
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
      if(!lakeBank&&!riverBank)continue;
      const steep=(lakeBank&&d>1.01&&d<1.29)||(riverBank&&channel>.29&&channel<.65);
      const cellSize=Math.max(radius(a)/rings,r*Math.PI*2/segments);
      const target=Math.min(steep?4:2,2**Math.max(0,Math.ceil(Math.log2(cellSize/.22))));
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
  const meadow = add(geometry(positions, uvs, indices), materials.grass);
  meadow.name = 'continuous-sculpted-meadow';
  let lipLocalZ = 2;
  while (contains(localRiverX(lipLocalZ) * scale, lipLocalZ * scale)) lipLocalZ += .012;
  lipLocalZ -= .012;
  const lipZ = lipLocalZ * scale;
  const fallAngle=Math.atan2(lipZ/.76,riverX(lipZ));

  // The fixed meadow boundary blends into independently leaning rock faces.
  // Broken shelves and deep fault clefts shape the mass before fine erosion.
  const cliffP = [], cliffU = [], cliffI = [];
  const cliffSegments = segments * 2, cliffRings = Math.round(72 * Math.max(1, Math.min(2, verticalScale)));
  const cliffProfile = [[0,1],[.065,.982],[.16,.953],[.30,.88],[.42,.77],[.57,.65],[.71,.49],[.83,.32],[.94,.125],[1,.016]];
  function inscriptionProtection(a, x, y) {
    const nameX = smooth(-5.35, -4.90, x / scale) * (1 - smooth(-1.10, -.65, x / scale));
    const nameY = smooth(-2.35, -1.98, y / verticalScale) * (1 - smooth(-.42, -.08, y / verticalScale));
    return 1 - nameX * nameY * smooth(.70, .96, Math.sin(a)) * .94;
  }
  function cliffBase(a, t) {
    let taper = 1;
    for (let k = 1; k < cliffProfile.length; k++) if (t >= cliffProfile[k-1][0] && t <= cliffProfile[k][0]) {
      const blend=(t-cliffProfile[k-1][0])/(cliffProfile[k][0]-cliffProfile[k-1][0]);
      taper=cliffProfile[k-1][1]*(1-blend)+cliffProfile[k][1]*blend;
    }
    const channelAngle=Math.abs(Math.atan2(Math.sin(a-fallAngle),Math.cos(a-fallAngle)));
    const clearFall=smooth(.11,.27,channelAngle);
    const rimY = height(Math.cos(a) * radius(a), Math.sin(a) * radius(a) * .76);
    const formation = cliffFormation(a, t);
    // The lower core pulls upward between four unequal suspended rock masses.
    // Their tips sit at different depths, breaking the single-cone silhouette.
    const hanging = Math.max(0,Math.min(1,(t-.30)/.53,(1-t)/.17));
    const underside = Math.sin(Math.PI * t) * smooth(.34,.82,t) *
      (.18 * Math.sin(a * 3 + .7) + .10 * Math.cos(a * 7 - t * 3));
    const y = rimY * (1 - t) - (4.80 * t + formation.hangingDrop * hanging + underside) * verticalScale;
    const planeBlend = smooth(.012,.115,t) * (1-smooth(.92,1,t));
    const baseRadius = radius(a) * taper * (1-planeBlend) + 6.8 * scale * taper * formation.planeRadius * planeBlend;
    const x0 = Math.cos(a) * baseRadius - .8 * t * scale;
    const relief = smooth(.022,.095,t) * (1-smooth(.89,1,t)) * clearFall * inscriptionProtection(a,x0,y);
    const ribReach = formation.hangingReach * smooth(.30,.59,t) * (1-smooth(.83,.975,t));
    const r = baseRadius + 6.8 * scale * (taper * (formation.ledges - formation.joints) * relief + ribReach);
    const x = Math.cos(a) * r - .8 * t * scale, z = Math.sin(a) * r * .76 + .22 * t * scale;
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
  const tip=cliffP.length/3;cliffP.push(-.8 * scale,-4.88 * verticalScale,.22 * scale);cliffU.push(.5,1);
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
  const cliff = add(cliffGeometry, materials.rock);
  cliff.name = 'continuous-eroded-cliff';
  // Turf trails irregularly over the first rock beds, following their actual
  // surface. Patchy depths avoid a constant-height green rim or floating lip.
  const skirtP = [], skirtU = [], skirtI = [];
  const skirtRows=4;
  for (let j = 0; j <= skirtRows; j++) for (let i = 0; i <= cliffSegments; i++) {
    const a = (i===cliffSegments?0:i/cliffSegments) * Math.PI * 2;
    const habitat=coherentNoise3D(Math.cos(a)*3.1+9.2,.7,Math.sin(a)*3.1);
    const fine=coherentNoise3D(Math.cos(a)*17.2,1.6,Math.sin(a)*17.2);
    const depth=.008+.026*smooth(-.25,.35,habitat)+.005*smooth(-.2,.3,fine);
    let [x,y,z]=cliffBase(a,depth*j/skirtRows);
    if(j===0){
      const edge=i/2,left=Math.floor(edge)%segments,right=(left+1)%segments,blend=edge%1;
      const p=cliffBase(left/segments*Math.PI*2,0),q=cliffBase(right/segments*Math.PI*2,0);
      [x,y,z]=p.map((value,axis)=>value+(q[axis]-value)*blend);
    }
    skirtP.push(x+Math.cos(a)*.016,y+.002,z+Math.sin(a)*.016);
    skirtU.push(i/cliffSegments,j/skirtRows);
  }
  for (let j=0;j<skirtRows;j++) for (let i=0;i<cliffSegments;i++) {
    const a=j*(cliffSegments+1)+i,b=a+cliffSegments+1;
    skirtI.push(a,a+1,b,a+1,b+1,b);
  }
  const turf=add(geometry(skirtP,skirtU,skirtI),materials.grass);turf.name='broken-turf-and-rock-rim';

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
  const riverP = [], riverU = [], riverI = [], riverDepth = [];
  const riverSteps = Math.round(80 * Math.max(1, Math.min(4, scale)));
  const riverColumns = Math.round(4 * Math.max(1, Math.min(3, scale)));
  for (let i = 0; i <= riverSteps; i++) {
    const z = scale + (lipZ - scale) * i / riverSteps;
    const width = (.41 + .045 * Math.sin(z / scale * 2)) * scale;
    for (let j = 0; j <= riverColumns; j++) {
      const x = riverX(z) + (j / riverColumns * 2 - 1) * width;
      riverP.push(x, waterLevel, z); riverU.push(j / riverColumns, i / riverSteps);
      riverDepth.push(Math.max(0, waterLevel - height(x, z)));
      if (i < riverSteps && j < riverColumns) {
        const a = i * (riverColumns + 1) + j, b = a + riverColumns + 1;
        riverI.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const riverGeometry = geometry(riverP, riverU, riverI);
  riverGeometry.setAttribute('waterDepth', new THREE.Float32BufferAttribute(riverDepth, 1));
  const river = add(riverGeometry, materials.water);
  river.name = 'connected-river-water';
  river.castShadow = false; river.renderOrder = 2;
  const lip = new THREE.Vector3(riverX(lipZ), waterLevel, lipZ);
  const fallP = [], fallU = [], fallI = [];
  const fallRows = Math.round(80 * Math.max(1, Math.min(2, verticalScale))), fallColumns = Math.round(12 * Math.max(1, Math.min(4, scale)));
  for (let j = 0; j <= fallRows; j++) for (let i = 0; i <= fallColumns; i++) {
    const t = j / fallRows, side = i / fallColumns - .5;
    const width = (.89 * (1 - .24 * t) + .06 * Math.sin(t * 17 + side * 2)) * scale;
    fallP.push(lip.x + side * width, waterLevel - t * 7.4 * verticalScale, lip.z + .05 + .46 * Math.sin(t * Math.PI / 2));
    fallU.push(i / fallColumns, 1 - t);
    if (j < fallRows && i < fallColumns) { const a = j * (fallColumns + 1) + i; fallI.push(a, a + 1, a + fallColumns + 1, a + 1, a + fallColumns + 2, a + fallColumns + 1); }
  }
  const waterfall = add(geometry(fallP, fallU, fallI), materials.waterfall);
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
  function updateDetail(camera, visibleWidth) {
    // Close views reveal every full-size instance. At the vast overview these
    // subpixel details are hidden; each spatial chunk also uses frustum culling.
    for (const chunk of flowerChunks) chunk.visible = visibleWidth <= 65;
    for (const chunk of stoneChunks) chunk.visible = visibleWidth <= 140;
  }

  // Local outcrops and flower colonies sit within broad coherent habitats.
  // Every stone/flower keeps its physical size and population at larger scales;
  // only the distribution changes from uniform noise to clearings and patches.
  let seed = 8753, scatterAttempts = 0;
  const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
  const rockGeo = new THREE.IcosahedronGeometry(1, 2);
  const stoneCount = Math.max(1, Math.round(46 * areaScale)), flowerCount = Math.max(1, Math.round(380 * areaScale));
  const dummy = new THREE.Object3D();
  function legalScatter(x, z, flowers) {
    return contains(x, z, flowers ? .45 : .25) && !isReserved(x,z,flowers?.16:.4) &&
      height(x,z) >= waterLevel + (flowers ? .12 : .05) &&
      Math.hypot(x-castleAnchor.x,z-castleAnchor.z) >= (flowers ? 1.5 : 1.3) &&
      trailDistance(x,z) >= (flowers ? .26 : .50);
  }
  function habitat(x, z, flowers) {
    const local = toLocal(x,z);
    const field = coherentNoise3D(local.x * .70 + (flowers ? 8.1 : -3.7), 2.4, local.z * .70);
    if (flowers) {
      const shore = Math.exp(-(((lakeDistance(x,z)-1.36)/.28) ** 2));
      const lowMeadow = 1-smooth(1.45,2.5,height(x,z)/verticalScale);
      return .07 + .72 * smooth(-.23,.35,field) * lowMeadow + .20 * shore;
    }
    const rim = smooth(.66,.94,Math.hypot(x,z/.76)/radius(Math.atan2(z/.76,x)));
    return .06 + .66 * smooth(-.20,.35,field) + .25 * rim;
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
  const stones = new THREE.InstancedMesh(rockGeo, materials.stone, stoneCount);
  for(let i=0;i<stoneCount;i++) {
    const [x,z]=samplePatch(stonePatches[i%stonePatches.length],false);
    const s=.07+random()*.16;
    dummy.position.set(x,height(x,z)-.025,z); dummy.scale.set(s*(1+random()),s*.60,s);
    dummy.rotation.set(random()*.6,random()*6.28,random()*.4); dummy.updateMatrix(); stones.setMatrixAt(i,dummy.matrix);
  }
  stones.castShadow = stones.receiveShadow = true; scatterChunks(stones, stoneChunks, 'terrain-scattered-stones');
  const flowerPatches=makePatches(Math.max(6,Math.ceil(flowerCount/70)),true);
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 5, 4), materials.flower, flowerCount);
  for(let i=0;i<flowerCount;i++) {
    const [x,z]=samplePatch(flowerPatches[i%flowerPatches.length],true);
    dummy.position.set(x,height(x,z)+.12,z); dummy.scale.set(1.3,.5,1.3);
    dummy.rotation.set(0,random()*6,0); dummy.updateMatrix(); flowers.setMatrixAt(i,dummy.matrix);
  }
  scatterChunks(flowers, flowerChunks, 'terrain-meadow-flowers');

  // A winding limestone route climbs the hill; each section follows terrain.
  const pathP = [], pathU = [], pathI = [];
  for (let i = 0; i <= trailSteps; i++) {
    const t = i / trailSteps, p = trail.getPoint(t), tangent = trail.getTangent(t), width = .17;
    for (const side of [-1, 1]) { const x = p.x + tangent.z * width * side, z = p.z - tangent.x * width * side; pathP.push(x, height(x,z) + .023, z); pathU.push((side+1)/2,t); }
    if (i < trailSteps) { const a = i * 2; pathI.push(a,a+2,a+1,a+1,a+2,a+3); }
  }
  const trailMesh = add(geometry(pathP,pathU,pathI), materials.stone); trailMesh.material.side = THREE.DoubleSide; trailMesh.castShadow = false;
  trailMesh.name = 'limestone-walking-route';
  const detailStats = { stoneCount, flowerCount, stoneChunks:stoneChunks.length, flowerChunks:flowerChunks.length,
    meadowTriangles:indices.length / 3, refinedBankCells, cliffTriangles:cliffI.length / 3, lakeTriangles:waterI.length / 3, riverTriangles:riverI.length / 3,
    stonePatches:stonePatches.length, flowerPatches:flowerPatches.length, scatterAttempts, trailWidth:.34 };
  return { group, scale, verticalScale, height, contains, radius, lakeDistance, riverX, waterLevel, lip, castleAnchor,
    toLocal, toWorld, trail, trailDistance, isReserved, updateDetail, detailStats };
}
