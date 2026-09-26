import { coherentNoise3D, fractalRock } from './sky-castle-geology.js';

/** Continuous rolling terrain, an excavated lake, and a connected river/fall. */
export function buildTerrain(THREE, materials, { scale = 1 } = {}) {
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('Terrain scale must be a positive finite number');
  const verticalScale = scale, areaScale = scale * scale;
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
  const localLakeDistance = (x, z) => Math.hypot((x - 1.05) / 2.35, (z - .15) / 1.65);
  const lakeDistance = (x, z) => localLakeDistance(x / scale, z / scale);
  function localHeight(x, z) {
    let h = 1.14 + .13 * Math.sin(x * .9 + z * .45) + .10 * Math.cos(z * 1.6 - x * .28);
    h += 2.05 * Math.exp(-((x + 3.1) ** 2 / 3.3 + (z + 1.7) ** 2 / 3.6));
    h += .55 * Math.exp(-((x - 3.7) ** 2 / 2.8 + (z + 2.8) ** 2 / 2));
    const terrace = 1 - smooth(.85, 1.5, Math.hypot((x + 3.1) / 1.5, (z + 1.7) / 1.15));
    h = h * (1 - terrace) + 2.78 * terrace;
    const basin = 1 - smooth(.90, 1.23, localLakeDistance(x, z));
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
  for (let j = 0; j <= rings; j++) {
    for (let i = 0; i <= segments; i++) {
      const a = i / segments * Math.PI * 2, r = radius(a) * j / rings;
      const x = Math.cos(a) * r, z = Math.sin(a) * r * .76;
      positions.push(x, height(x, z), z); uvs.push(x / 14 + .5, z / 11 + .5);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < segments; i++) {
    const a = j * (segments + 1) + i, b = a + segments + 1;
    indices.push(a, a + 1, b, a + 1, b + 1, b);
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

  // Large unequal buttresses form a single connected cliff, with smaller strata
  // sitting within the silhouette instead of a necklace of disconnected spikes.
  const cliffP = [], cliffU = [], cliffI = [];
  const cliffSegments = segments * 2, cliffRings = Math.round(72 * Math.max(1, Math.min(2, verticalScale)));
  function cliffBase(a, t) {
    const profile = [[0,1],[.08,1.005],[.23,.98],[.36,.94],[.56,.82],[.74,.61],[.90,.30],[1,.018]];
    let taper = 1;
    for (let k = 1; k < profile.length; k++) if (t >= profile[k-1][0] && t <= profile[k][0]) {
      const blend=(t-profile[k-1][0])/(profile[k][0]-profile[k-1][0]);
      taper=profile[k-1][1]*(1-blend)+profile[k][1]*blend;
    }
    const channelAngle=Math.abs(Math.atan2(Math.sin(a-fallAngle),Math.cos(a-fallAngle)));
    const clearFall=smooth(.10,.25,channelAngle);
    const buttress = 1 + clearFall*smooth(0,.18,t)*(1-smooth(.88,1,t))*(.22*Math.sin(a*5+.8)+.085*Math.sin(a*9)-.05*Math.cos(a*3));
    const r = radius(a) * taper * buttress;
    const x = Math.cos(a) * r - .8 * t * scale, z = Math.sin(a) * r * .76 + .22 * t * scale;
    const rimY = height(Math.cos(a) * radius(a), Math.sin(a) * radius(a) * .76);
    const fracture = Math.sin(Math.PI * t) * (.27 * Math.sin(a * 17 + t * 5) + .13 * Math.cos(a * 29));
    const depth=5.55+.65*Math.sin(a*3-.6)+.25*Math.cos(a*7);
    const y = rimY * (1 - t) - depth * verticalScale * t + fracture * verticalScale;
    return [x, y, z];
  }
  for (let j = 0; j <= cliffRings; j++) for (let i = 0; i <= cliffSegments; i++) {
    const a = (i === cliffSegments ? 0 : i / cliffSegments) * Math.PI * 2, t = j / cliffRings;
    let [x, y, z] = cliffBase(a, t);
    if (j === 0 || j === cliffRings) {
      // The denser mesh subdivides the exact old boundary segments. It does
      // not move the meadow rim, its attachments, or the original bottom ring.
      const edge = i / 2, left = Math.floor(edge) % segments, right = (left + 1) % segments, blend = edge % 1;
      const p = cliffBase(left / segments * Math.PI * 2, t), q = cliffBase(right / segments * Math.PI * 2, t);
      [x, y, z] = p.map((coordinate, axis) => coordinate + (q[axis] - coordinate) * blend);
    } else {
      const channelAngle = Math.abs(Math.atan2(Math.sin(a - fallAngle), Math.cos(a - fallAngle)));
      const clearFall = smooth(.16, .32, channelAngle);
      const rimAndTip = smooth(.025, .17, t) * (1 - smooth(.81, .985, t));
      // Preserve a quiet face for the small raycast stone inscription. This
      // mask is spatial, so nearby rock still receives geological variation.
      const nameX = smooth(-5.35, -4.90, x / scale) * (1 - smooth(-1.10, -.65, x / scale));
      const nameY = smooth(-2.35, -1.98, y / verticalScale) * (1 - smooth(-.42, -.08, y / verticalScale));
      const nameFront = smooth(.70, .96, Math.sin(a));
      const nameProtection = 1 - nameX * nameY * nameFront * .94;
      const envelope = rimAndTip * clearFall * nameProtection;
      const mediumScale = Math.sqrt(scale);
      const mediumCrags = scale === 1 ? 0 : coherentNoise3D(x / mediumScale, y / mediumScale, z / mediumScale) * .42 * (mediumScale - 1);
      const displacement = (fractalRock(x, y, z) * .88 + mediumCrags) * envelope;
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
  const tip=cliffP.length/3;cliffP.push(-.8 * scale,-6.48 * verticalScale,.22 * scale);cliffU.push(.5,1);
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
  // A narrow uneven turf skirt integrates meadow and rock at the rim.
  const skirtP = [], skirtU = [], skirtI = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i <= segments; i++) {
    const a = i / segments * Math.PI * 2, r = radius(a) + .006;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * .76;
    skirtP.push(x, height(x, z) - j * (.11 + .08 * (1 + Math.sin(a * 17))), z);
    skirtU.push(i / segments, j);
  }
  for (let i = 0; i < segments; i++) skirtI.push(i, i + 1, i + segments + 1, i + 1, i + segments + 2, i + segments + 1);
  add(geometry(skirtP, skirtU, skirtI), materials.grass);

  // Lake vertices are built directly in XZ, so water shader ripples remain in
  // the horizontal plane. Its edge disappears into the excavated shoreline.
  const lakeSegments = Math.round(100 * Math.max(1, Math.min(4, scale)));
  const waterP = [1.05 * scale, waterLevel, .15 * scale], waterU = [.5, .5], waterI = [];
  for (let i = 0; i <= lakeSegments; i++) {
    const a = i / lakeSegments * Math.PI * 2;
    waterP.push((1.05 + Math.cos(a) * 2.35 * 1.20) * scale, waterLevel, (.15 + Math.sin(a) * 1.65 * 1.20) * scale);
    waterU.push(.5 + .5 * Math.cos(a), .5 + .5 * Math.sin(a));
    if (i < lakeSegments) waterI.push(0, i + 2, i + 1);
  }
  const lake = add(geometry(waterP, waterU, waterI), materials.water);
  lake.castShadow = false; lake.renderOrder = 2;
  const riverP = [], riverU = [], riverI = [];
  const riverSteps = Math.round(80 * Math.max(1, Math.min(4, scale)));
  for (let i = 0; i <= riverSteps; i++) {
    const z = scale + (lipZ - scale) * i / riverSteps;
    const width = (.41 + .045 * Math.sin(z / scale * 2)) * scale;
    for (const side of [-1, 1]) { riverP.push(riverX(z) + side * width, waterLevel, z); riverU.push((side + 1) / 2, i / riverSteps); }
    if (i < riverSteps) { const a = i * 2; riverI.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const river = add(geometry(riverP, riverU, riverI), materials.water);
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

  // Low stones and tufts share instanced geometry; density adds scale without
  // thousands of individual draw calls or sphere-shaped tree canopies.
  let seed = 8753;
  const random = () => { seed = seed * 16807 % 2147483647; return seed / 2147483647; };
  const rockGeo = new THREE.IcosahedronGeometry(1, 2);
  const stoneCount = Math.max(1, Math.round(46 * areaScale)), flowerCount = Math.max(1, Math.round(380 * areaScale));
  const stones = new THREE.InstancedMesh(rockGeo, materials.stone, stoneCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < stoneCount; i++) {
    let x, z;
    do { x = (random() - .5) * 13 * scale; z = (random() - .5) * 9 * scale; } while (!contains(x, z, .25) || height(x, z) < waterLevel + .05 || Math.hypot(x - castleAnchor.x, z - castleAnchor.z) < 1.3 || (scale !== 1 && trailDistance(x,z) < .50));
    const s = .07 + random() * .16;
    dummy.position.set(x, height(x, z) - .025, z); dummy.scale.set(s * (1 + random()), s * .60, s);
    dummy.rotation.set(random() * .6, random() * 6.28, random() * .4); dummy.updateMatrix(); stones.setMatrixAt(i, dummy.matrix);
  }
  stones.castShadow = stones.receiveShadow = true; scatterChunks(stones, stoneChunks, 'terrain-scattered-stones');
  // Preserve the established flower positions while the richer botanical module
  // replaces the old triangle grass. No legacy blade meshes are allocated.
  let sampled = 0;
  while (sampled < 650) {
    const x = (random() - .5) * 13.8 * scale, z = (random() - .5) * 10.4 * scale;
    if (!contains(x, z, .18) || height(x, z) < waterLevel + .045 || Math.hypot(x - castleAnchor.x, z - castleAnchor.z) < 1.5) continue;
    random(); random(); sampled++;
  }
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 5, 4), materials.flower, flowerCount);
  for (let i = 0; i < flowerCount; i++) {
    let x, z;
    do { x = (random() - .5) * 13.2 * scale; z = (random() - .5) * 9.6 * scale; } while (!contains(x, z, .45) || height(x, z) < waterLevel + .12 || Math.hypot(x - castleAnchor.x, z - castleAnchor.z) < 1.5 || (scale !== 1 && trailDistance(x,z) < .26));
    dummy.position.set(x, height(x, z) + .12, z); dummy.scale.set(1.3, .5, 1.3); dummy.rotation.set(0, random() * 6, 0); dummy.updateMatrix(); flowers.setMatrixAt(i, dummy.matrix);
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
    meadowTriangles:indices.length / 3, cliffTriangles:cliffI.length / 3, trailWidth:.34 };
  return { group, scale, verticalScale, height, contains, radius, lakeDistance, riverX, waterLevel, lip, castleAnchor,
    toLocal, toWorld, trail, trailDistance, updateDetail, detailStats };
}
