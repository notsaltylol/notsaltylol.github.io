import { createDetailView } from './sky-castle-lod.js';
import { createHabitat } from './sky-castle-habitat.js';
/**
 * Fine botanical geometry for the floating island.
 *
 * Grass uses folded, tapered ribbons with four curved sections; ferns have
 * separate paired leaflets and curved rachises. Clover has three lobed leaves.
 * Nothing is a camera-facing card. Local plant meshes are instanced in irregular
 * patches, with shared live materials and protected paths, water and foundations.
 */
export function buildBotany(THREE, materials, terrain) {
  const worldScale = terrain.scale || 1, areaScale = worldScale * worldScale;
  const groundHeight=(x,z)=>{const y=terrain.surfaceHeight?.(x,z);return Number.isFinite(y)?y:terrain.height(x,z);};
  const world = (x, z) => terrain.toWorld ? terrain.toWorld(x, z) : { x:x * worldScale, z:z * worldScale };
  const habitat=createHabitat({kind:'main',scale:worldScale}),habitatValue={};
  const group = new THREE.Group();
  group.name = 'fine-island-botany';
  const leafMaterial = materials.leafDetail || materials.leaf;
  let seed = 572691;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const range = (a, b) => a + random() * (b - a);
  const up = new THREE.Vector3(0, 1, 0);
  const transform = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3(), scale = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3(), vertex = new THREE.Vector3(), normal = new THREE.Vector3();
  const localGeometry = new Set();
  const hold = g => { localGeometry.add(g); return g; };
  const point = new THREE.Vector3();

  // The same spline used by buildTerrain, sampled densely enough to protect the
  // complete winding path, including its tight turn below the castle.
  const trail = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.8, 0, 2.8), new THREE.Vector3(-2.5, 0, 2.1),
    new THREE.Vector3(-3.8, 0, .9), new THREE.Vector3(-2.7, 0, -.25),
    new THREE.Vector3(-3.1, 0, -1.7),
  ]);
  const trailPoints = (terrain.trail || trail).getPoints(160);
  const distanceToTrail = (x, z) => terrain.trailDistance ? terrain.trailDistance(x, z) : Math.min(...trailPoints.map(p => Math.hypot(x - p.x, z - p.z)));
  const gardens = [[-4.55, .25], [-2, 2.15], [4.55, 2.2]].map(([x, z]) => world(x, z));
  function dryLand(x, z) {
    const lake = terrain.lakeDistance ? terrain.lakeDistance(x, z) : Math.hypot((x / worldScale - 1.05) / 2.35, (z / worldScale - .15) / 1.65);
    const wetFootprint = lake < 1.25 || (z > worldScale && Math.abs(x - terrain.riverX(z)) < .63 * worldScale);
    return !wetFootprint || terrain.height(x, z) > terrain.waterLevel + .055;
  }
  function allowed(x, z, clearance = .15, protectGardens = true) {
    if((terrain.rockExposure?.(x,z)||0)>.15)return false;
    if(terrain.isReserved?.(x,z,clearance))return false;
    if (!terrain.contains(x, z, .24 + clearance) || !dryLand(x, z)) return false;
    if (Math.hypot((x - terrain.castleAnchor.x) / 1.52, (z - terrain.castleAnchor.z) / 1.25) < 1.03) return false;
    if (Math.hypot(x - 4.1 * worldScale, z + 2.6 * worldScale) < .57) return false;
    if (z > 2.45 * worldScale && z < 2.93 * worldScale && x > -.78 * worldScale && x < 3.5 * worldScale) return false;
    if (distanceToTrail(x, z) < .19 + clearance) return false;
    if (protectGardens && gardens.some(p => Math.hypot(x - p.x, z - p.z) < .57)) return false;
    return true;
  }

  function bucket() { return { positions:[], normals:[], uvs:[], indices:[] }; }
  function mergeInto(bag, shape, p = [0, 0, 0], s = [1, 1, 1], rotation = [0, 0, 0]) {
    position.set(...p); scale.set(...s); quaternion.setFromEuler(new THREE.Euler(...rotation));
    transform.compose(position, quaternion, scale); normalMatrix.getNormalMatrix(transform);
    const pos = shape.getAttribute('position');
    if (!shape.getAttribute('normal')) shape.computeVertexNormals();
    const nor = shape.getAttribute('normal'), uv = shape.getAttribute('uv');
    const offset = bag.positions.length / 3;
    for (let i = 0; i < pos.count; i++) {
      vertex.fromBufferAttribute(pos, i).applyMatrix4(transform);
      normal.fromBufferAttribute(nor, i).applyNormalMatrix(normalMatrix);
      bag.positions.push(vertex.x, vertex.y, vertex.z);
      bag.normals.push(normal.x, normal.y, normal.z);
      bag.uvs.push(uv ? uv.getX(i) : .5, uv ? uv.getY(i) : .5);
    }
    if (shape.index) for (let i = 0; i < shape.index.count; i++) bag.indices.push(offset + shape.index.getX(i));
    else for (let i = 0; i < pos.count; i++) bag.indices.push(offset + i);
  }
  function finish(bag) {
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.Float32BufferAttribute(bag.positions, 3));
    shape.setAttribute('normal', new THREE.Float32BufferAttribute(bag.normals, 3));
    shape.setAttribute('uv', new THREE.Float32BufferAttribute(bag.uvs, 2));
    shape.setIndex(bag.indices); shape.computeBoundingSphere(); return shape;
  }

  // Shared botanical materials render both sides of these genuinely curved
  // surfaces. u runs root→tip, v runs edge→midrib→edge across each blade.
  function ribbon({ height = .28, width = .026, bend = .14, yaw = 0, segments = 4, horizontal = false }) {
    const p = [], uv = [], ix = [], row = 3, count = (segments + 1) * row;
    for (let face = 0; face < 1; face++) {
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const taper = Math.pow(1 - t, .66) * (.65 + .35 * Math.sin(t * Math.PI));
        const w = width * taper;
        for (const side of [-1, 0, 1]) {
          const ridge = side === 0 ? width * .22 * Math.sin(t * Math.PI) : 0;
          if (horizontal) {
            p.push(t * height, Math.sin(t * Math.PI) * bend + ridge, side * w);
          } else {
            const forward = bend * t * t + ridge;
            p.push(Math.sin(yaw) * forward + Math.cos(yaw) * side * w,
              height * t - .014, Math.cos(yaw) * forward - Math.sin(yaw) * side * w);
          }
          uv.push(t, (side + 1) / 2);
        }
      }
      for (let i = 0; i < segments; i++) for (let side = 0; side < 2; side++) {
        const a = face * count + i * row + side, b = a + row;
        if (face === 0) ix.push(a, b, a + 1, a + 1, b, b + 1);
        else ix.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    shape.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    shape.setIndex(ix); shape.computeVertexNormals(); return hold(shape);
  }
  function grassShape(blades, taller) {
    const bag = bucket();
    for (let i = 0; i < blades; i++) {
      const angle = i * 2.399 + .23;
      const shape = ribbon({ height:range(taller ? .18 : .13, taller ? .29 : .24),
        width:range(.02375, .03875), bend:range(.085, .18), yaw:angle });
      mergeInto(bag, shape, [Math.cos(angle) * .027, 0, Math.sin(angle) * .027]);
    }
    return finish(bag);
  }
  const tallGrassGeometry = grassShape(5, true);
  const fineGrassGeometry = grassShape(4, false);

  // Four arcing fronds, with the leaflets narrowing toward the tip. The short
  // leaflets use the same UV convention as the detailed leaf-vein material.
  const fernBag = bucket();
  const leaflet = ribbon({ height:1, width:.19, bend:.10, horizontal:true, segments:2 });
  for (let f = 0; f < 4; f++) {
    const angle = f * Math.PI / 2 + .18, length = .34 + (f % 2) * .065, rise = .235;
    const curvePoints = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      curvePoints.push(new THREE.Vector3(Math.cos(angle) * length * t, Math.sin(t * Math.PI * .87) * rise, Math.sin(angle) * length * t));
    }
    const curve = new THREE.CatmullRomCurve3(curvePoints);
    mergeInto(fernBag, hold(new THREE.TubeGeometry(curve, 6, .006, 3, false)));
    for (let pair = 0; pair < 5; pair++) {
      const t = .19 + pair * .155;
      const centre = curve.getPoint(t);
      const size = (.115 - pair * .011) * Math.sin(t * Math.PI) ** .40;
      for (const side of [-1, 1]) {
        const yaw = -angle + side * 1.0;
        mergeInto(fernBag, leaflet, centre.toArray(), [size, size, size], [0, yaw, .12 + t * .17]);
      }
    }
  }
  const fernGeometry = finish(fernBag);

  // Three heart-shaped lobes around one low stem, with a slight central fold.
  const cloverBag = bucket();
  const heart = (() => {
    const outline = [[0, 0], [-.037, .03], [-.050, .067], [-.042, .099], [-.017, .113],
      [0, .099], [.017, .113], [.042, .099], [.050, .067], [.037, .03]];
    const p = [], uv = [], ix = [], count = outline.length + 1;
    for (let face = 0; face < 1; face++) {
      p.push(.055, .014, 0); uv.push(.055 / .113, .5);
      for (const [width, length] of outline) {
        p.push(length, .004 + Math.sin(length / .113 * Math.PI) * .006, width);
        uv.push(length / .113, width < 0 ? 0 : width > 0 ? 1 : .5);
      }
      for (let i = 0; i < outline.length; i++) {
        const a = face * count, b = a + 1 + i, c = a + 1 + (i + 1) % outline.length;
        if (face === 0) ix.push(a, b, c); else ix.push(a, c, b);
      }
    }
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    shape.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    shape.setIndex(ix); shape.computeVertexNormals(); return hold(shape);
  })();
  for (let i = 0; i < 3; i++) mergeInto(cloverBag, heart, [0, .047, 0], [1, 1, 1], [0, i * Math.PI * 2 / 3, .08]);
  mergeInto(cloverBag, hold(new THREE.CylinderGeometry(.004, .005, .061, 5, 1)), [0, .017, 0]);
  const cloverGeometry = finish(cloverBag);

  const reedBag = bucket();
  mergeInto(reedBag, hold(new THREE.CylinderGeometry(.0055, .008, .40, 5, 1)), [0, .19, 0]);
  for (let i = 0; i < 2; i++) {
    const blade = ribbon({ height:.22 - i * .045, width:.017, bend:.15, yaw:i * Math.PI + .4 });
    mergeInto(reedBag, blade, [0, .075 + i * .09, 0]);
  }
  const reedGeometry = finish(reedBag);
  const seedHeadGeometry = new THREE.CapsuleGeometry(.016, .080, 2, 5);

  // Population follows land area; every tuft retains its original physical
  // size. More small habitats are added instead of stretching a dozen old ones.
  function habitats(base, count, radius, clearance = .2, species='grass') {
    const result = base.map(([x, z, r]) => { const p = world(x, z); return [p.x, p.z, r || radius]; })
      .filter(([x,z])=>allowed(x,z,clearance)&&habitat.sample(x,z,habitatValue)[species]>.20&&habitatValue.clearing<.65);
    for (let attempt = 0; result.length < count && attempt < count * 100; attempt++) {
      const x = range(-6.7, 6.7) * worldScale, z = range(-5.05, 5.05) * worldScale;
      const density=habitat.sample(x,z,habitatValue)[species];
      if(habitatValue.clearing>.65||density<.14||random()>Math.min(1,density*density*1.8)||!allowed(x,z,clearance))continue;
      result.push([x, z, radius * range(.78, 1.22)]);
    }
    return result;
  }
  const patchCenters = habitats([
    [-5.15, 1.05, .64], [-4.95, -2.8, .60], [-4.1, 2.65, .70],
    [-2.05, 3.45, .62], [.15, 3.76, .57], [4.6, 3.0, .60],
    [5.3, .76, .73], [5.13, -1.18, .68], [3.0, -3.75, .74],
    [.65, -3.45, .78], [-1.25, -3.7, .62], [-5.4, -.40, .57],
  ], Math.round(6 * areaScale), .95);
  // Spatial hashing keeps rejection sampling linear at tens of thousands of roots.
  function spacedPopulation(minDistance) {
    const cells = new Map(), cellSize = minDistance;
    return (x, z) => {
      const cx = Math.floor(x / cellSize), cz = Math.floor(z / cellSize);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const points = cells.get(`${cx + dx},${cz + dz}`);
        if (points && points.some(p => Math.hypot(x - p.x, z - p.z) < minDistance)) return false;
      }
      const key = `${cx},${cz}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push({ x, z }); return true;
    };
  }
  const grassSpacing = spacedPopulation(.115);
  function scatter(count, patches, clearance, spacing, sizeRange, offsetY = 0, species='grass') {
    const roots = [], target = Math.round(count * areaScale);
    for (let attempt = 0; roots.length < target && attempt < target * 55; attempt++) {
      const patch = patches[Math.floor(random() * patches.length)];
      const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * patch[2];
      const x = patch[0] + Math.cos(angle) * radius, z = patch[1] + Math.sin(angle) * radius;
      const density=habitat.sample(x,z,habitatValue)[species];
      if(habitatValue.clearing>.72||density<.11||!allowed(x,z,clearance)||!spacing(x,z))continue;
      roots.push({ x, z, y:groundHeight(x, z) + offsetY, size:range(...sizeRange),
        yaw:range(0, Math.PI * 2), phase:range(0, Math.PI * 2) });
    }
    return roots;
  }
  const tallRoots = scatter(170, patchCenters, .15, grassSpacing, [.72, 1.18]);
  const fineRoots = scatter(60, patchCenters, .15, grassSpacing, [.75, 1.25]);
  const fernPatches = habitats([[-4.75, 1.6], [4.7, -1.55], [-.9, -3.85], [3.9, 2.1]], Math.round(1.2 * areaScale), .95, .45, 'fern');
  const fernRoots = scatter(12, fernPatches, .27, spacedPopulation(.41), [.80, 1.12], .007, 'fern');
  const cloverPatches = habitats([[-4.75, .85], [-1.15, 3.15], [4.85, .35], [.20, -3.15]], Math.round(2.4 * areaScale), .65, .2, 'clover');
  const cloverRoots = scatter(60, cloverPatches, .12, spacedPopulation(.115), [.80, 1.25], .003, 'clover');
  const reedRoots = [];
  const reedGroups = Math.max(4, Math.round(4 * worldScale));
  for (let cluster = 0; cluster < reedGroups; cluster++) {
    const baseAngle = worldScale === 1 ? [.10, 1.94, 2.73, 4.55][cluster] : cluster / reedGroups * Math.PI * 2 + .08;
    for (let i = 0; i < 3; i++) {
      const angle = baseAngle + (i - 1) * .045 / worldScale;
      let radius = 1.03, x = 0, z = 0;
      for (; radius < 1.40; radius += .012 / worldScale) {
        const p = world(1.05 + Math.cos(angle) * 2.35 * radius, .15 + Math.sin(angle) * 1.65 * radius);
        x = p.x; z = p.z;
        if (terrain.height(x, z) > terrain.waterLevel + .065) break;
      }
      if (!allowed(x, z, .07, false)) continue;
      reedRoots.push({ x, z, y:groundHeight(x, z), size:range(.78, 1.14), yaw:range(0, Math.PI * 2), phase:range(0, Math.PI * 2) });
    }
  }

  // Coarse 3D silhouettes only replace subpixel plants. Full leaf geometry is
  // retained in spatial chunks and becomes visible as the camera approaches.
  const overviewGrassBag = bucket();
  for (let i = 0; i < 3; i++) mergeInto(overviewGrassBag, ribbon({ height:.20 + i * .025, width:.033, bend:.06, yaw:i * 2.399, segments:1 }));
  const overviewGrass = finish(overviewGrassBag);
  const overviewFernBag = bucket();
  for (let i = 0; i < 3; i++) mergeInto(overviewFernBag, ribbon({ height:.29, width:.085, bend:.055, horizontal:true, segments:1 }), [0, .035, 0], [1, 1, 1], [0, i * Math.PI * 2 / 3, .30]);
  const overviewFern = finish(overviewFernBag);
  const chunks = new Map(), chunkSize = worldScale > 1 ? 16 : 64;
  let fullTriangles = 0, overviewTriangles = 0;
  const trianglesOf = shape => (shape.index ? shape.index.count : shape.getAttribute('position').count) / 3;
  function chunkFor(root) {
    const cx = Math.floor((root.x + chunkSize / 2) / chunkSize), cz = Math.floor((root.z + chunkSize / 2) / chunkSize);
    const key = `${cx},${cz}`;
    if (!chunks.has(key)) {
      const high = new THREE.Group(), low = new THREE.Group();
      high.name = `botany-detail-${key}`; low.name = `botany-overview-${key}`;
      group.add(high, low);
      chunks.set(key, { high, low, bounds:new THREE.Box3(), animated:[], highTriangles:0, lowTriangles:0 });
    }
    const chunk = chunks.get(key);
    chunk.bounds.expandByPoint(new THREE.Vector3(root.x - .65, root.y - .05, root.z - .65));
    chunk.bounds.expandByPoint(new THREE.Vector3(root.x + .65, root.y + .75, root.z + .65));
    return chunk;
  }
  function fillMatrices(mesh, roots, time, wind, seedOffset) {
    roots.forEach((root, i) => {
      const sway = wind * (.034 * Math.sin(time * 3 + root.phase) + .017 * Math.sin(time * 5 + root.phase * .7));
      quaternion.setFromEuler(new THREE.Euler(sway * .48, root.yaw, sway));
      position.set(root.x, root.y, root.z);
      if (seedOffset) position.add(point.set(0, .426 * root.size, 0).applyQuaternion(quaternion));
      transform.compose(position, quaternion, scale.setScalar(root.size)); mesh.setMatrixAt(i, transform);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  function instances(name, shape, material, roots, wind = 0, seedOffset = false, overviewShape = null, overviewMaterial = material) {
    const perChunk = new Map();
    for (const root of roots) {
      const chunk = chunkFor(root);
      if (!perChunk.has(chunk)) perChunk.set(chunk, []);
      perChunk.get(chunk).push(root);
    }
    for (const [chunk, positions] of perChunk) {
      const mesh = new THREE.InstancedMesh(shape, material, positions.length);
      mesh.name = name; mesh.receiveShadow = true; mesh.castShadow = false;
      mesh.userData.botanyRoots = positions.map(root => ({ x:root.x, y:root.y, z:root.z }));
      fillMatrices(mesh, positions, 0, wind, seedOffset); mesh.computeBoundingSphere(); chunk.high.add(mesh);
      const count = trianglesOf(shape) * positions.length;
      fullTriangles += count; chunk.highTriangles += count;
      if (wind) chunk.animated.push({ mesh, roots:positions, wind, seedOffset });
      if (overviewShape) {
        const lowMesh = new THREE.InstancedMesh(overviewShape, overviewMaterial, positions.length);
        lowMesh.name = `${name}-overview`; lowMesh.receiveShadow = true; lowMesh.castShadow = false;
        fillMatrices(lowMesh, positions, 0, 0, seedOffset); lowMesh.computeBoundingSphere(); chunk.low.add(lowMesh);
        const lowCount = trianglesOf(overviewShape) * positions.length;
        overviewTriangles += lowCount; chunk.lowTriangles += lowCount;
      }
    }
  }
  instances('curved-meadow-grass', tallGrassGeometry, materials.grass, tallRoots, 1, false, overviewGrass);
  instances('short-folded-grass', fineGrassGeometry, materials.grass, fineRoots, .7, false, overviewGrass);
  instances('paired-leaflet-ferns', fernGeometry, leafMaterial, fernRoots, 0, false, overviewFern, materials.leaf);
  instances('heart-leaf-clover', cloverGeometry, leafMaterial, cloverRoots);
  instances('shoreline-reed-leaves', reedGeometry, materials.leaf, reedRoots, .55, false, reedGeometry);
  instances('reed-seed-heads', seedHeadGeometry, materials.wood, reedRoots, .55, true, seedHeadGeometry);
  for (const shape of localGeometry) shape.dispose();

  const stats = { scale:worldScale, drawCalls:0, triangles:0, fullDetailTriangles:fullTriangles,
    overviewTriangles, chunks:chunks.size, grassClumps:tallRoots.length + fineRoots.length,
    grassBlades:tallRoots.length * 5 + fineRoots.length * 4, ferns:fernRoots.length,
    cloverPlants:cloverRoots.length, reeds:reedRoots.length, detailMode:'overview',
    trailProtected:true, bridgeProtected:true,grassHabitats:patchCenters.length,fernHabitats:fernPatches.length,cloverHabitats:cloverPatches.length };
  const detailView=createDetailView(THREE);
  const defaultWidth=worldScale>1?280:28;
  function updateDetail(camera, visibleWidth=defaultWidth) {
    group.updateWorldMatrix(true,true);detailView.prepare(camera,visibleWidth);
    stats.drawCalls=stats.triangles=0;
    let closeChunks=0,farChunks=0;
    for (const chunk of chunks.values()) {
      const visible=detailView.boxVisible(chunk.bounds,group.matrixWorld);
      const close=detailView.boxWidth(chunk.bounds,group.matrixWorld)<=72;
      chunk.high.visible=visible&&close;chunk.low.visible=visible&&!close;
      if(visible){
        if(close)closeChunks++;else farChunks++;
        stats.drawCalls+=(close?chunk.high:chunk.low).children.length;
        stats.triangles+=close?chunk.highTriangles:chunk.lowTriangles;
      }
    }
    stats.detailMode=closeChunks?(farChunks?'mixed':'full'):'overview';
  }
  function animate(phase, options = {}) {
    if (options.camera) updateDetail(options.camera, options.visibleWidth);
    const cycle = ((phase % 1) + 1) % 1, time = cycle * Math.PI * 2;
    for (const chunk of chunks.values()) {
      if (!chunk.high.visible) continue;
      for (const record of chunk.animated) fillMatrices(record.mesh, record.roots, time, record.wind, record.seedOffset);
    }
  }
  updateDetail(null, defaultWidth); animate(0);
  group.userData.botany = stats;
  return { group, animate, updateDetail, stats };
}
