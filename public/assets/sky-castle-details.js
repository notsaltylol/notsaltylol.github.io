import { createDetailView } from './sky-castle-lod.js';
/**
 * Small, grounded landscape stories for the shared 3D island.
 *
 * Geometry is merged by the supplied material rather than cloned or individually
 * drawn. The bridge has a real open arch; shoreline stones sample the actual
 * shore, and ivy clings to raycast cliff points. The only animated pieces are
 * shallow lily leaves, whose transforms repeat exactly at phase 0 and phase 1.
 */
export function buildLandscapeDetails(THREE, materials, terrain) {
  const worldScale = terrain.scale || 1, areaScale = worldScale * worldScale;
  const world = (x, z) => terrain.toWorld ? terrain.toWorld(x, z) : { x:x * worldScale, z:z * worldScale };
  const group = new THREE.Group();
  group.name = 'handcrafted-landscape-details';
  const bags = new Map(), gardenChunks = new Map();
  let activeBags = bags;
  const temporaryGeometry = new Set();
  const transform = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  let seed = 83147;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const range = (a, b) => a + (b - a) * random();
  const dryGround = (x, z) => {
    const lakeDistance = terrain.lakeDistance ? terrain.lakeDistance(x, z) : Math.hypot((x / worldScale - 1.05) / 2.35, (z / worldScale - .15) / 1.65);
    const inWaterFootprint = lakeDistance < 1.24 || (z > worldScale && Math.abs(x - terrain.riverX(z)) < .60 * worldScale);
    return !inWaterFootprint || terrain.height(x, z) > terrain.waterLevel + .025;
  };
  const geo = value => { temporaryGeometry.add(value); return value; };
  const block = geo(new THREE.BoxGeometry(1, 1, 1));
  const pebble = geo(new THREE.IcosahedronGeometry(1, 1));
  const coarseShrub = geo(new THREE.IcosahedronGeometry(1, 0));
  const petal = geo(new THREE.SphereGeometry(1, 8, 4));
  const flowerCenter = geo(new THREE.IcosahedronGeometry(1, 0));
  const stem = geo(new THREE.CylinderGeometry(1, 1, 1, 5, 1));
  const up = new THREE.Vector3(0, 1, 0);

  function stamp(shape, materialKey, p, s = [1, 1, 1], rotation = [0, 0, 0]) {
    position.set(...p); scale.set(...s);
    quaternion.setFromEuler(new THREE.Euler(...rotation));
    transform.compose(position, quaternion, scale);
    append(shape, materialKey, transform);
  }
  function append(shape, materialKey, matrix) {
    if (!activeBags.has(materialKey)) activeBags.set(materialKey, { positions:[], normals:[], uvs:[], indices:[] });
    const bag = activeBags.get(materialKey);
    const p = shape.getAttribute('position');
    if (!shape.getAttribute('normal')) shape.computeVertexNormals();
    const n = shape.getAttribute('normal'), uv = shape.getAttribute('uv');
    const offset = bag.positions.length / 3;
    normalMatrix.getNormalMatrix(matrix);
    for (let i = 0; i < p.count; i++) {
      vertex.fromBufferAttribute(p, i).applyMatrix4(matrix);
      normal.fromBufferAttribute(n, i).applyNormalMatrix(normalMatrix);
      bag.positions.push(vertex.x, vertex.y, vertex.z);
      bag.normals.push(normal.x, normal.y, normal.z);
      bag.uvs.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
    }
    if (shape.index) {
      for (let i = 0; i < shape.index.count; i++) bag.indices.push(offset + shape.index.getX(i));
    } else {
      for (let i = 0; i < p.count; i++) bag.indices.push(offset + i);
    }
  }
  function twig(a, b, radius = .009, materialKey = 'leaf') {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    if (direction.lengthSq() < 1e-8) return;
    quaternion.setFromUnitVectors(up, direction.clone().normalize());
    transform.compose(start.add(end).multiplyScalar(.5), quaternion, scale.set(radius, direction.length(), radius));
    append(stem, materialKey, transform);
  }

  // A folded, curved leaf with an actual central ridge and pointed silhouette.
  const leaf = (() => {
    const p = [], uv = [], ix = [], segments = 6;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments, width = Math.sin(t * Math.PI) * .25;
      for (const side of [-1, 0, 1]) {
        p.push(t, Math.sin(t * Math.PI) * (.10 + (side === 0 ? .06 : 0)), side * width);
        uv.push(t, (side + 1) / 2);
      }
      if (i < segments) for (let j = 0; j < 2; j++) {
        const a = i * 3 + j;
        ix.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
      }
    }
    const shape = new THREE.BufferGeometry();
    shape.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    shape.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    shape.setIndex(ix); shape.computeVertexNormals();
    return geo(shape);
  })();

  // A wider river gets more arches and more masonry, never enlarged bricks.
  // At scale 10 the crossing is a three-arch footbridge with a level stone deck.
  const bridgeZ = 2.65 * worldScale, bridgeX = terrain.riverX(bridgeZ);
  const bridgeHalfSpan = .93 * worldScale;
  const archCount = Math.max(1, Math.ceil(worldScale / 3.8));
  const moduleWidth = bridgeHalfSpan * 2 / archCount;
  const bridgeWidth = archCount > 1 ? 1.05 : .61;
  const bankLeft = terrain.height(bridgeX - bridgeHalfSpan, bridgeZ);
  const bankRight = terrain.height(bridgeX + bridgeHalfSpan, bridgeZ);
  const springY = Math.max(terrain.waterLevel + .02, Math.min(bankLeft, bankRight) - .11);
  const innerRadius = archCount > 1 ? moduleWidth * .5 - .38 : .73;
  const outerRadius = innerRadius + .20;
  const archRise = archCount > 1 ? Math.min(1.55, innerRadius * .56) : .43;
  const deckY = springY + archRise + .20;
  function archWedge(a, b, innerX, outerX, innerY, outerY, depth) {
    const shape = new THREE.Shape();
    const point = (angle, rx, ry) => [Math.sin(angle) * rx, springY + Math.cos(angle) * ry];
    shape.moveTo(...point(a, innerX, innerY)); shape.lineTo(...point(b, innerX, innerY));
    shape.lineTo(...point(b, outerX, outerY)); shape.lineTo(...point(a, outerX, outerY)); shape.closePath();
    return geo(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled:false, curveSegments:1, steps:1 }).translate(0, 0, -depth / 2));
  }
  for (let arch = 0; arch < archCount; arch++) {
    const center = bridgeX - bridgeHalfSpan + (arch + .5) * moduleWidth;
    const wedges = Math.max(13, Math.ceil(Math.PI * Math.sqrt((outerRadius ** 2 + (archRise + .16) ** 2) / 2) / .19));
    for (let i = 0; i < wedges; i++) {
      const a = -Math.PI / 2 + i / wedges * Math.PI + .0025;
      const b = -Math.PI / 2 + (i + 1) / wedges * Math.PI - .0025;
      stamp(archWedge(a, b, innerRadius, outerRadius, archRise, archRise + .16, bridgeWidth),
        i % 4 === 1 ? 'stoneLight' : 'stone', [center, 0, bridgeZ]);
      if (archCount === 1) for (const side of [-1, 1]) {
        stamp(archWedge(a, b, outerRadius - .018, outerRadius + .035, archRise + .17, archRise + .31, .067),
          'stoneLight', [center, 0, bridgeZ + side * .28]);
      }
    }
  }
  if (archCount > 1) {
    // The spandrels and deck are courses of ordinary-size blocks. Cells inside
    // each arch are omitted, leaving genuine passages above the water surface.
    const columns = Math.ceil(bridgeHalfSpan * 2 / .23), unit = bridgeHalfSpan * 2 / columns;
    const widthBlocks = Math.ceil(bridgeWidth / .22), unitZ = bridgeWidth / widthBlocks;
    for (let c = 0; c < columns; c++) {
      const x = bridgeX - bridgeHalfSpan + (c + .5) * unit;
      const arch = Math.min(archCount - 1, Math.floor((x - bridgeX + bridgeHalfSpan) / moduleWidth));
      const center = bridgeX - bridgeHalfSpan + (arch + .5) * moduleWidth;
      const distance = Math.abs(x - center);
      const curveTop = distance < outerRadius ? springY + (archRise + .16) * Math.sqrt(1 - (distance / outerRadius) ** 2) : springY;
      const ground = terrain.height(x, bridgeZ);
      for (let y = Math.max(ground + .06, curveTop + .065); y < deckY - .06; y += .13) {
        for (const side of [-1, 1]) stamp(block, 'stone', [x, y, bridgeZ + side * (bridgeWidth / 2 - .06)], [unit - .007, .124, .12]);
      }
      for (let z = 0; z < widthBlocks; z++) stamp(block, 'stoneLight', [x, deckY, bridgeZ - bridgeWidth / 2 + (z + .5) * unitZ], [unit - .008, .10, unitZ - .008]);
      if (c % 2 === 0) for (const side of [-1, 1]) stamp(block, 'stone', [x, deckY + .12, bridgeZ + side * (bridgeWidth / 2 - .025)], [unit * 1.91, .15, .09]);
    }
    // Narrow piers are also coursed masonry. The central opening remains clear.
    for (let pier = 1; pier < archCount; pier++) {
      const x = bridgeX - bridgeHalfSpan + pier * moduleWidth, bottom = terrain.height(x, bridgeZ) - .035;
      for (let y = bottom + .065; y < springY + .08; y += .13) {
        for (let side = 0; side < 2; side++) for (let z = 0; z < 5; z++) stamp(block, 'stone',
          [x + (side - .5) * .21, y, bridgeZ - bridgeWidth / 2 + (z + .5) * bridgeWidth / 5], [.205, .125, bridgeWidth / 5 - .006]);
      }
    }
  }
  let bridgeLeftEnd = bridgeX - bridgeHalfSpan;
  for (const side of [-1, 1]) {
    const bank = side < 0 ? bankLeft : bankRight;
    const steps = archCount > 1 ? Math.max(3, Math.ceil((deckY - bank) / .12)) : 3;
    for (let step = 0; step < steps; step++) {
      const x = bridgeX + side * (bridgeHalfSpan + .10 + step * .19);
      const ground = terrain.height(x, bridgeZ);
      const top = archCount > 1 ? Math.max(ground + .04, deckY - (step + .5) * .12) : Math.max(ground + .07, springY + .10 - step * .025);
      const widthBlocks = Math.ceil(bridgeWidth / .22), unitZ = bridgeWidth / widthBlocks;
      for (let z = 0; z < widthBlocks; z++) stamp(block, 'stone', [x, top - .035, bridgeZ - bridgeWidth / 2 + (z + .5) * unitZ], [.184, .07, unitZ - .007]);
      for (let y = ground + .05; y < top - .04; y += .12) for (const edge of [-1, 1]) stamp(block, 'stone', [x, y, bridgeZ + edge * (bridgeWidth / 2 - .055)], [.184, .116, .11]);
    }
    if (side < 0) bridgeLeftEnd -= .20 + steps * .19;
  }
  // A longer approach is made of more stones, with their original physical size.
  const targetX = -.8 * worldScale, targetZ = 2.8 * worldScale;
  const approachCount = Math.max(5, Math.ceil(Math.hypot(bridgeLeftEnd - targetX, bridgeZ - targetZ) / .28));
  for (let i = 0; i < approachCount; i++) {
    const t = (i + .5) / approachCount;
    const x = bridgeLeftEnd * (1 - t) + targetX * t, z = bridgeZ * (1 - t) + targetZ * t + Math.sin(t * Math.PI) * .055;
    stamp(pebble, 'stone', [x, terrain.height(x, z) + .013, z], [.118, .031, .096], [0, -.13 + (i % 5) * .085, 0]);
  }

  // Find the actual water/ground transition rather than arranging a perfect
  // decorative ellipse. Broken groups leave breathing room around the lake.
  let shoreStoneCount = 0;
  const shorelineSamples = Math.round(40 * worldScale);
  for (let i = 0; i < shorelineSamples; i++) {
    const angle = i / shorelineSamples * Math.PI * 2 + range(-.07, .07) / worldScale;
    // Exposed stone gathers in irregular groups, with long untouched banks.
    if (Math.sin(angle * 3 + .5) + Math.sin(angle * 5 + .2) < -.12 || i % 9 === 0) continue;
    let r = .94, x = 0, z = 0;
    while (r < 1.37) {
      const p = world(1.05 + Math.cos(angle) * 2.35 * r, .15 + Math.sin(angle) * 1.65 * r);
      x = p.x; z = p.z;
      if (terrain.height(x, z) > terrain.waterLevel + .017) break;
      r += .009 / worldScale;
    }
    if (!terrain.contains(x, z, .24) || (z > 1.25 * worldScale && Math.abs(x - terrain.riverX(z)) < .78 * worldScale)) continue;
    const size = range(.075, .145);
    stamp(pebble, i % 3 ? 'rock' : 'stone', [x, terrain.height(x, z) + .015, z],
      [size * range(1.2, 1.8), size * .54, size], [range(-.2, .2), range(0, Math.PI), range(-.15, .15)]);
    shoreStoneCount++;
    if (i % 3 === 0) {
      const xx = x + Math.cos(angle + .8) * size * 1.8, zz = z + Math.sin(angle + .8) * size;
      stamp(pebble, 'stone', [xx, terrain.height(xx, zz) + .012, zz], [size * .64, size * .32, size * .53], [0, angle, 0]);
      shoreStoneCount++;
    }
  }

  // Each blossom has petals and a seed centre rather than a single colored dot.
  function blossom(x, y, z, size, phase = 0, materialKey = 'flower') {
    for (let p = 0; p < 5; p++) {
      const angle = phase + p / 5 * Math.PI * 2;
      stamp(petal, materialKey, [x + Math.cos(angle) * size * .43, y, z + Math.sin(angle) * size * .43],
        [size * .55, size * .13, size * .30], [0, -angle, .11]);
    }
    stamp(flowerCenter, 'gold', [x, y + size * .11, z], [size * .23, size * .16, size * .23]);
  }
  let gardenCount = 0;
  const gardenCenters = [[-4.55, .25], [-2.00, 2.15], [4.55, 2.20]].map(([x, z]) => { const p = world(x, z); return [p.x, p.z]; });
  const targetGardens = Math.round(3 * areaScale);
  for (let attempt = 0; gardenCenters.length < targetGardens && attempt < targetGardens * 50; attempt++) {
    const x = range(-6.5, 6.5) * worldScale, z = range(-4.8, 4.8) * worldScale;
    if (!terrain.contains(x, z, 1) || !dryGround(x, z) || terrain.isReserved?.(x,z,.85)) continue;
    if (terrain.trailDistance && terrain.trailDistance(x, z) < .85) continue;
    if (Math.hypot(x - terrain.castleAnchor.x, z - terrain.castleAnchor.z) < 1.75) continue;
    if (z > 2.45 * worldScale && z < 2.93 * worldScale && x > -.85 * worldScale && x < 3.5 * worldScale) continue;
    if (gardenCenters.some(p => Math.hypot(x - p[0], z - p[1]) < 1.45)) continue;
    gardenCenters.push([x, z]);
  }
  for (const [gx, gz] of gardenCenters) {
    if (!terrain.contains(gx, gz, .8) || !dryGround(gx, gz) || terrain.isReserved?.(gx,gz,.85)) continue;
    gardenCount++;
    const chunkSize = worldScale > 1 ? 16 : 64;
    const key = `${Math.floor((gx + chunkSize / 2) / chunkSize)},${Math.floor((gz + chunkSize / 2) / chunkSize)}`;
    if (!gardenChunks.has(key)) gardenChunks.set(key, { highBags:new Map(), lowBags:new Map(), bounds:new THREE.Box3() });
    const chunk = gardenChunks.get(key);
    chunk.bounds.expandByPoint(new THREE.Vector3(gx - .85, terrain.height(gx, gz) - .25, gz - .85));
    chunk.bounds.expandByPoint(new THREE.Vector3(gx + .85, terrain.height(gx, gz) + .85, gz + .85));
    activeBags = chunk.lowBags;
    for (let b = 0; b < 3; b++) {
      const x = gx + Math.cos(b * 2.399) * .22, z = gz + Math.sin(b * 2.399) * .22;
      stamp(coarseShrub, 'leaf', [x, terrain.height(x, z) + .11, z], [.24, .16, .20], [0, b, 0]);
    }
    activeBags = chunk.highBags;
    for (let b = 0; b < 7; b++) {
      const angle = b / 7 * Math.PI * 2 + range(-.25, .25), radius = range(.13, .43);
      const x = gx + Math.cos(angle) * radius, z = gz + Math.sin(angle) * radius;
      const y = terrain.height(x, z), height = range(.18, .34);
      twig([x, y - .02, z], [x + .018, y + height, z], .010);
      for (let l = 0; l < 5; l++) {
        const leafAngle = angle + l * 2.399, length = range(.18, .32);
        stamp(leaf, 'leaf', [x, y + .045 + l / 5 * height, z], [length, length, length], [0, leafAngle, range(.12, .5)]);
      }
    }
    for (let f = 0; f < 12; f++) {
      const angle = range(0, Math.PI * 2), radius = range(.16, .62);
      const x = gx + Math.cos(angle) * radius, z = gz + Math.sin(angle) * radius;
      if (!terrain.contains(x, z, .15) || !dryGround(x, z)) continue;
      const y = terrain.height(x, z), h = range(.10, .23), size = range(.057, .092);
      twig([x, y - .016, z], [x, y + h, z], .0045);
      stamp(leaf, 'leaf', [x, y + h * .35, z], [.11, .11, .11], [0, angle, .36]);
      blossom(x, y + h, z, size, angle, f % 4 === 0 ? 'stoneLight' : 'flower');
    }
  }

  activeBags = bags;
  // Low, slightly broken retaining walls flank the climb to the castle. The
  // middle stays open where the existing path approaches the entrance.
  const castle = terrain.castleAnchor;
  for (const [start, end] of [[-.25, .77], [2.13, 2.92]]) {
    const blocks = Math.max(8, Math.round(8 * worldScale));
    for (let i = 0; i < blocks; i++) {
      const angle = start + (end - start) * (i + .5) / blocks;
      const x = castle.x + Math.cos(angle) * 1.74 * worldScale, z = castle.z + Math.sin(angle) * 1.43 * worldScale;
      const ground = terrain.height(x, z), length = 1.58 * worldScale * (end - start) / blocks - .012;
      for (let row = 0; row < (i === 0 || i === blocks - 1 ? 1 : 2); row++) {
        stamp(block, row ? 'stoneLight' : 'stone', [x, ground + .065 + row * .12, z],
          [length, .12, .14], [0, -angle + Math.PI / 2, 0]);
      }
    }
  }

  // Sparse trailing ivy follows the irregular cliff rather than floating on an
  // assumed cylinder. Leaves sit just outside the real rock surface.
  let ivyLeafCount = 0;
  const cliff = terrain.group.getObjectByName('continuous-eroded-cliff');
  if (cliff) {
    terrain.group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(), surfaceNormal = new THREE.Vector3();
    const ivyAngles = worldScale === 1 ? [.30, .61, 2.00, 2.53, 3.67, 5.55] : Array.from({ length:Math.round(6 * worldScale) }, (_, i) => i / Math.round(6 * worldScale) * Math.PI * 2 + .08);
    // A broad-phase collision index uses the real cliff's triangles. Ivy only
    // touches the upper 1.3 units, so scanning its complete underside per leaf
    // would waste hundreds of millions of triangle tests on the large island.
    const minimumIvyY = Math.min(...ivyAngles.map(a => {
      const r = terrain.radius ? terrain.radius(a) : 6.8 * worldScale;
      return terrain.height(Math.cos(a) * r, Math.sin(a) * r * .76) - 1.45;
    }));
    const sourcePositions = cliff.geometry.attributes.position, sourceIndex = cliff.geometry.index;
    const sectors = Array.from({ length:32 }, () => []), proxies = new Map();
    for (let i = 0; i < sourceIndex.count; i += 3) {
      const a = sourceIndex.getX(i), b = sourceIndex.getX(i + 1), c = sourceIndex.getX(i + 2);
      if (Math.max(sourcePositions.getY(a), sourcePositions.getY(b), sourcePositions.getY(c)) < minimumIvyY) continue;
      const angle = Math.atan2((sourcePositions.getZ(a) + sourcePositions.getZ(b) + sourcePositions.getZ(c)) / .76,
        sourcePositions.getX(a) + sourcePositions.getX(b) + sourcePositions.getX(c));
      const sector = Math.floor(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * sectors.length);
      sectors[sector].push(a, b, c);
    }
    function collisionSector(angle) {
      const sector = Math.floor(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * sectors.length);
      if (!proxies.has(sector)) {
        const shape = new THREE.BufferGeometry(); shape.setAttribute('position', sourcePositions);
        shape.setIndex([-1, 0, 1].flatMap(offset => sectors[(sector + offset + sectors.length) % sectors.length]));
        const proxy = new THREE.Mesh(shape, cliff.material); proxy.matrixAutoUpdate = false; proxy.matrixWorld.copy(cliff.matrixWorld);
        proxies.set(sector, proxy);
      }
      return proxies.get(sector);
    }
    for (const angle of ivyAngles) {
      const collider = collisionSector(angle);
      const dx = Math.cos(angle), dz = Math.sin(angle) * .76;
      let radius = terrain.radius ? terrain.radius(angle) : 4 * worldScale;
      while (terrain.contains(dx * radius, dz * radius)) radius += .018;
      const rx = dx * (radius - .025), rz = dz * (radius - .025);
      const rimHeight = terrain.height(rx, rz);
      let previous = null;
      for (let i = 0; i < 9; i++) {
        const y = rimHeight - .10 - i * .135;
        const origin = new THREE.Vector3(dx * (radius + Math.max(2, worldScale * .35)), y, dz * (radius + Math.max(2, worldScale * .35)));
        ray.set(origin, new THREE.Vector3(-dx, 0, -dz).normalize());
        const hit = ray.intersectObject(collider, false)[0];
        if (!hit) { previous = null; continue; }
        surfaceNormal.copy(hit.face.normal).transformDirection(cliff.matrixWorld);
        const point = hit.point.clone().addScaledVector(surfaceNormal, .033);
        if (previous) twig(previous.toArray(), point.toArray(), .008, 'trunk');
        previous = point;
        for (const side of [-1, 1]) {
          const length = range(.14, .22);
          stamp(leaf, 'leaf', point.toArray(), [length, length, length], [0, -angle + side * .85, -.35 - random() * .2]);
          ivyLeafCount++;
        }
      }
    }
  }

  // Static architecture and shore props stay available at every scale. Garden
  // leaves and individual petals live in bounded chunks with coarse shrub bodies.
  function assemble(source, target, prefix, shadow = true) {
    let triangles = 0;
    for (const [materialKey, bag] of source) {
      const shape = new THREE.BufferGeometry();
      shape.setAttribute('position', new THREE.Float32BufferAttribute(bag.positions, 3));
      shape.setAttribute('normal', new THREE.Float32BufferAttribute(bag.normals, 3));
      shape.setAttribute('uv', new THREE.Float32BufferAttribute(bag.uvs, 2));
      shape.setIndex(bag.indices); shape.computeBoundingSphere();
      const mesh = new THREE.Mesh(shape, materials[materialKey]);
      mesh.name = `${prefix}-${materialKey}`; mesh.castShadow = shadow; mesh.receiveShadow = true;
      target.add(mesh); triangles += bag.indices.length / 3;
    }
    return triangles;
  }
  const staticGroup = new THREE.Group(); staticGroup.name = 'bridge-shore-and-ruins'; group.add(staticGroup);
  const staticTriangles = assemble(bags, staticGroup, 'landscape-details');
  let gardenFullTriangles = 0, gardenLowTriangles = 0;
  for (const [key, chunk] of gardenChunks) {
    chunk.high = new THREE.Group(); chunk.low = new THREE.Group();
    chunk.high.name = `garden-detail-${key}`; chunk.low.name = `garden-overview-${key}`;
    chunk.highTriangles = assemble(chunk.highBags, chunk.high, 'garden-leaves', false);
    chunk.lowTriangles = assemble(chunk.lowBags, chunk.low, 'garden-masses', false);
    gardenFullTriangles += chunk.highTriangles; gardenLowTriangles += chunk.lowTriangles;
    group.add(chunk.high, chunk.low);
    delete chunk.highBags; delete chunk.lowBags;
  }
  for (const shape of temporaryGeometry) shape.dispose();

  // Shallow extruded leaves float above the ripples; each turns about its own
  // centre. No animated positions accumulate, so rerenders remain deterministic.
  const padShape = new THREE.Shape();
  padShape.moveTo(0, 0);
  padShape.lineTo(Math.cos(.16), Math.sin(.16));
  padShape.absarc(0, 0, 1, .16, Math.PI * 2 - .16, false);
  padShape.lineTo(0, 0);
  const padGeometry = new THREE.ExtrudeGeometry(padShape, { depth:.055, bevelEnabled:false, curveSegments:12, steps:1 });
  padGeometry.rotateX(-Math.PI / 2);
  const pads = [];
  const lilyClusters = Math.max(4, Math.round(4 * worldScale));
  for (let cluster = 0; cluster < lilyClusters; cluster++) {
    const angle = cluster / lilyClusters * Math.PI * 2 + .13;
    const radius = range(.77, .91);
    const center = world(1.05 + Math.cos(angle) * 2.35 * radius, .15 + Math.sin(angle) * 1.65 * radius);
    for (let i = 0; i < 2; i++) {
      const x = center.x + range(-.20, .20), z = center.z + range(-.20, .20);
      if (terrain.height(x, z) >= terrain.waterLevel - .05) continue;
      pads.push({ x, z, size:range(.105, .17), yaw:range(0, Math.PI * 2) });
    }
  }
  const lilies = new THREE.InstancedMesh(padGeometry, materials.leaf, pads.length);
  lilies.name = 'slowly-drifting-lily-leaves'; lilies.castShadow = lilies.receiveShadow = true;
  lilies.renderOrder = 4; group.add(lilies);
  const lilyTriangles = (padGeometry.index ? padGeometry.index.count : padGeometry.getAttribute('position').count) / 3 * pads.length;
  function animate(phase) {
    const cycle = ((phase % 1) + 1) % 1, time = cycle * Math.PI * 2;
    pads.forEach((pad, i) => {
      position.set(pad.x, terrain.waterLevel + .031 + Math.sin(time + i) * .003, pad.z);
      quaternion.setFromAxisAngle(up, pad.yaw + Math.sin(time + i * .7) * .10);
      transform.compose(position, quaternion, scale.set(pad.size, pad.size, pad.size));
      lilies.setMatrixAt(i, transform);
    });
    lilies.instanceMatrix.needsUpdate = true;
  }
  animate(0);
  const stats = { scale:worldScale, drawCalls:0, triangles:0,
    fullDetailTriangles:staticTriangles + gardenFullTriangles + lilyTriangles,
    overviewTriangles:staticTriangles + gardenLowTriangles, gardenChunks:gardenChunks.size,
    bridge:true, bridgeArches:archCount, bridgeSpan:bridgeHalfSpan * 2,
    shoreStones:shoreStoneCount, gardens:gardenCount, ivyLeaves:ivyLeafCount, lilyLeaves:pads.length };
  const detailView=createDetailView(THREE);
  const defaultWidth=worldScale>1?280:28;
  let detailShadowRevision=0;
  function updateDetail(camera, visibleWidth=defaultWidth) {
    group.updateWorldMatrix(true,true);detailView.prepare(camera,visibleWidth);
    const lilyVisible=detailView.meshVisible(lilies)&&detailView.meshWidth(lilies)<=140;
    if(lilyVisible!==lilies.visible)detailShadowRevision++;
    lilies.visible=lilyVisible;stats.shadowRevision=detailShadowRevision;
    stats.drawCalls=staticGroup.children.length+(lilies.visible?1:0);
    stats.triangles=staticTriangles+(lilies.visible?lilyTriangles:0);
    for(const chunk of gardenChunks.values()){
      const visible=detailView.boxVisible(chunk.bounds,group.matrixWorld);
      const near=detailView.boxWidth(chunk.bounds,group.matrixWorld)<=66;
      chunk.high.visible=visible&&near;chunk.low.visible=visible&&!near;
      if(visible){
        stats.drawCalls+=(near?chunk.high:chunk.low).children.length;
        stats.triangles+=near?chunk.highTriangles:chunk.lowTriangles;
      }
    }
  }
  updateDetail(null, defaultWidth);
  group.userData.landscapeDetails = stats;
  return { group, animate, updateDetail, stats };
}
