/*
 * Reusable, fully three-dimensional architecture and vegetation.
 *
 * All colors and lighting come from the supplied materials. Small pieces are
 * merged by material, so ornament does not become hundreds of draw calls.
 * Local ground is y = 0. No camera, lights, image planes, or DOM are used here.
 */

function createWorkshop(THREE, materials) {
  const group = new THREE.Group();
  const buckets = new Map();
  const fallback = materials.stone;
  const material = (name) => materials[name] || fallback;

  function add(geometry, name, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1], outline = false) {
    const selected = typeof name === 'string' ? material(name) : name;
    const key = `${selected.uuid}:${outline ? 'outline' : 'detail'}`;
    if (!buckets.has(key)) buckets.set(key, { material: selected, outline, geometries: [] });
    const transform = new THREE.Object3D();
    transform.position.set(...position);
    transform.rotation.set(...rotation);
    transform.scale.set(...scale);
    transform.updateMatrix();
    const transformed = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    transformed.applyMatrix4(transform.matrix);
    buckets.get(key).geometries.push(transformed);
    geometry.dispose();
  }

  function box(name, x, y, z, w, h, d, rotation = [0, 0, 0], outline = false) {
    add(new THREE.BoxGeometry(w, h, d), name, [x, y, z], rotation, [1, 1, 1], outline);
  }

  function cylinder(name, x, y, z, radiusTop, radiusBottom, height, outline = false, segments = 32) {
    add(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), name, [x, y, z], [0, 0, 0], [1, 1, 1], outline);
  }

  function lathe(name, x, y, z, points, outline = true) {
    add(new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(r, h)), 40), name, [x, y, z], [0, 0, 0], [1, 1, 1], outline);
  }

  function tube(name, points, radius, segments = 24) {
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point))), segments, radius, 6, false), name);
  }

  function finish() {
    for (const bucket of buckets.values()) {
      const count = bucket.geometries.reduce((sum, geometry) => sum + geometry.attributes.position.count, 0);
      const positions = new Float32Array(count * 3);
      const normals = new Float32Array(count * 3);
      const uvs = new Float32Array(count * 2);
      let offset = 0;
      for (const geometry of bucket.geometries) {
        const attributes = geometry.attributes;
        positions.set(attributes.position.array, offset * 3);
        normals.set(attributes.normal.array, offset * 3);
        if (attributes.uv) uvs.set(attributes.uv.array, offset * 2);
        offset += attributes.position.count;
        geometry.dispose();
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, bucket.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.outline = bucket.outline;
      group.add(mesh);
    }
    return group;
  }

  return { group, add, box, cylinder, lathe, tube, finish };
}

// A round-headed arch, drawn in its wall's XY plane. Unlike a dark decal, a
// hole in an extruded wall remains an open passage from the reverse angle.
function archPath(THREE, x, bottom, width, height, PathType = THREE.Path) {
  const shape = new PathType();
  const radius = width / 2;
  const spring = bottom + height - radius;
  shape.moveTo(x - radius, bottom);
  shape.lineTo(x + radius, bottom);
  shape.lineTo(x + radius, spring);
  shape.absarc(x, spring, radius, 0, Math.PI, false);
  shape.lineTo(x - radius, bottom);
  return shape;
}

function extrudedArch(THREE, width, height, rim, depth) {
  const shape = archPath(THREE, 0, 0, width, height, THREE.Shape);
  shape.holes.push(archPath(THREE, 0, rim, width - rim * 2, height - rim * 2));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 });
}

function arcadeGeometry(THREE, width, height, depth, count, openingHeight) {
  const wall = new THREE.Shape();
  wall.moveTo(-width / 2, 0);
  wall.lineTo(width / 2, 0);
  wall.lineTo(width / 2, height);
  wall.lineTo(-width / 2, height);
  wall.closePath();
  const bay = width / count;
  for (let i = 0; i < count; i++) {
    wall.holes.push(archPath(THREE, -width / 2 + bay * (i + 0.5), 0.025, bay * 0.70, openingHeight));
  }
  return new THREE.ExtrudeGeometry(wall, { depth, bevelEnabled: false, curveSegments: 16 });
}

/** A closed four-sided hip roof; ridge runs along local X, eaves at y=0. */
export function createHippedRoofGeometry(THREE,{width,depth,rise,hip=Math.min(depth*.45,width*.22),thickness=.035}) {
  const x=width/2,z=depth/2,r=Math.max(.025,x-hip),p=[],uv=[];
  const faces=[
    [[-x,0,z],[x,0,z],[r,rise,0],[-r,rise,0]],
    [[x,0,-z],[-x,0,-z],[-r,rise,0],[r,rise,0]],
    [[x,0,z],[x,0,-z],[r,rise,0]],
    [[-x,0,-z],[-x,0,z],[-r,rise,0]],
    [[-x,-thickness,z],[x,-thickness,z],[x,0,z],[-x,0,z]],
    [[x,-thickness,-z],[-x,-thickness,-z],[-x,0,-z],[x,0,-z]],
    [[x,-thickness,z],[x,-thickness,-z],[x,0,-z],[x,0,z]],
    [[-x,-thickness,-z],[-x,-thickness,z],[-x,0,z],[-x,0,-z]],
    [[-x,-thickness,-z],[x,-thickness,-z],[x,-thickness,z],[-x,-thickness,z]],
  ];
  for(const face of faces)for(let i=1;i<face.length-1;i++)for(const v of [face[0],face[i],face[i+1]]){
    p.push(...v);uv.push(v[0]/width+.5,v[2]/depth+.5);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.computeVertexNormals();
  return geometry;
}

export function buildCastle(THREE, materials) {
  const work = createWorkshop(THREE, materials);
  const { add, box, cylinder, lathe, tube } = work;
  work.group.name = 'Sky castle — limestone terraces and copper roofs';

  // Unequal foundation courses follow the occupied rooms. Their clipped,
  // staggered edges avoid making the keep look like a cake on circular tiers.
  function foundation(points, bottom, height, material) {
    const shape = new THREE.Shape();
    points.forEach(([x,z],i) => i ? shape.lineTo(x,-z) : shape.moveTo(x,-z));
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});
    g.rotateX(-Math.PI/2);
    add(g, material, [0,bottom,0], [0,0,0], [1,1,1], true);
  }
  foundation([[-1.48,-.83],[-.73,-1.08],[.79,-1.02],[1.43,-.49],[1.42,.63],[.88,1.01],[.32,1.08],[-.51,1.12],[-1.45,.67]],0,.18,'stone');
  foundation([[-1.25,-.78],[-.52,-.91],[.81,-.86],[1.21,-.38],[1.28,.49],[.72,.91],[-.54,.96],[-1.20,.55]],.16,.26,'stone');
  for (let i = 0; i < 7; i++) {
    box('stone', 0.12, 0.030 + i * 0.060, 1.20 - i * 0.082, 0.58, 0.060, 0.17);
  }

  function window(x, y, z, yaw, width = 0.16, height = 0.44) {
    const transform = new THREE.Matrix4().makeRotationY(yaw);
    const offset = (localX, localZ) => new THREE.Vector3(localX, 0, localZ).applyMatrix4(transform).add(new THREE.Vector3(x, y, z));
    const recess = archPath(THREE, 0, 0, width, height, THREE.Shape);
    add(new THREE.ShapeGeometry(recess, 14), 'dark', [x, y, z], [0, yaw, 0]);
    const rim = offset(0, 0.002);
    add(extrudedArch(THREE, width + 0.075, height + 0.053, 0.038, 0.023), 'stoneLight', [rim.x, y - 0.025, rim.z], [0, yaw, 0]);
    const mullion = offset(0, 0.026);
    box('stone', mullion.x, y + height * 0.40, mullion.z, 0.018, height * 0.72, 0.024, [0, yaw, 0]);
    const sill = offset(0, 0.025);
    box('stoneLight', sill.x, y - 0.031, sill.z, width + 0.10, 0.043, 0.10, [0, yaw, 0]);
  }

  function finial(x, y, z, height = 0.36) {
    cylinder('gold', x, y + height * 0.30, z, 0.012, 0.022, height * 0.6, false, 12);
    add(new THREE.SphereGeometry(0.048, 12, 10), 'gold', [x, y + height * 0.47, z]);
    add(new THREE.ConeGeometry(0.041, height * 0.42, 12), 'gold', [x, y + height * 0.83, z]);
  }

  function masonryCourses(x, z, radius, height, base, windows) {
    const radiusAt = (y) => {
      const middle = height * 0.48;
      const t = y < middle ? (y - 0.19) / (middle - 0.19) : (y - middle) / (height - 0.15 - middle);
      return radius * (y < middle ? 1 - t * 0.03 : 0.97 - t * 0.03) + 0.0017;
    };
    const clearOfWindows = (angle, y) => {
      for (let level = 0; level < 2; level++) {
        const bottom = height * (level ? 0.68 : 0.24) - 0.06;
        const top = bottom + Math.min(0.54, height * 0.22) + 0.12;
        if (y < bottom || y > top) continue;
        const pitch = Math.PI * 2 / windows;
        const relative = angle - (level ? Math.PI / windows : 0);
        const nearest = Math.round(relative / pitch) * pitch;
        if (Math.abs(relative - nearest) < (radius * 0.185 + 0.052) / radius) return false;
      }
      return true;
    };
    const point = (angle, y) => [x + Math.sin(angle) * radiusAt(y), base + y, z + Math.cos(angle) * radiusAt(y)];
    const joints = [];
    const band = (a0, a1, y0, y1) => {
      const a = point(a0, y0), b = point(a1, y0), c = point(a1, y1), d = point(a0, y1);
      joints.push(...a, ...b, ...d, ...b, ...c, ...d);
    };
    const courseHeight = 0.185;
    const columns = Math.max(9, Math.round(radius * Math.PI * 2 / 0.22));
    // Hairline mortar is actual recessed-looking geometry. Window openings
    // interrupt the joints, and alternate rows use a half-brick bond.
    for (let row = 0, y = 0.22; y < height - 0.21; row++, y += courseHeight) {
      for (let segment = 0; segment < 80; segment++) {
        const a0 = segment / 80 * Math.PI * 2, a1 = (segment + 1) / 80 * Math.PI * 2;
        if (clearOfWindows(a0, y) && clearOfWindows(a1, y)) band(a0, a1, y - 0.0015, y + 0.0015);
      }
      const yTop = Math.min(y + courseHeight, height - 0.20);
      for (let column = 0; column < columns; column++) {
        const angle = (column + (row % 2) * 0.5) / columns * Math.PI * 2;
        if (![y, (y + yTop) / 2, yTop].every(level => clearOfWindows(angle, level))) continue;
        const halfWidth = 0.0015 / radius;
        band(angle - halfWidth, angle + halfWidth, y, yTop);
      }
    }
    // Flat shallow joint strips need two triangles each, rather than a full
    // tube. This keeps fine coursing affordable even on a small display.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(joints, 3));
    geometry.computeVertexNormals();
    add(geometry, 'dark');
  }

  function tower({ x, z, radius, height, base = 0.43, roof = 'dome', roofHeight = 0.70, windows = 6 }) {
    const top = base + height;
    // Entasis and several ledges make these feel like built masonry towers,
    // instead of uniform cylinders stacked under primitive cones.
    lathe('stone', x, base, z, [[0, 0], [radius * 1.10, 0], [radius * 1.10, 0.13], [radius, 0.19], [radius * 0.97, height * 0.48], [radius * 0.94, height - 0.15], [radius, height - 0.12], [radius, height], [0, height]]);
    masonryCourses(x, z, radius, height, base, windows);
    for (const level of [0.17, height + 0.015]) {
      cylinder('stone', x, base + level, z, radius * 1.045, radius * 1.065, 0.045);
    }
    cylinder('stoneLight', x, top + 0.055, z, radius * 1.15, radius * 1.05, 0.08);
    cylinder('roof', x, top + 0.105, z, radius * 1.12, radius * 1.12, 0.020);
    for (let level = 0; level < 2; level++) {
      for (let i = 0; i < windows; i++) {
        const angle = i / windows * Math.PI * 2 + (level ? Math.PI / windows : 0);
        const r = radius * (level ? 0.955 : 0.99);
        window(x + Math.sin(angle) * r, base + height * (level ? 0.68 : 0.24), z + Math.cos(angle) * r, angle, radius * 0.37, Math.min(0.54, height * 0.22));
      }
    }
    const roofBase = top + 0.12;
    const r = radius * 1.19;
    if (roof === 'dome') {
      lathe('roof', x, roofBase, z, [[0, 0], [r, 0], [r * 1.035, roofHeight * 0.09], [r * 1.015, roofHeight * 0.23], [r * 0.93, roofHeight * 0.43], [r * 0.75, roofHeight * 0.65], [r * 0.48, roofHeight * 0.84], [r * 0.15, roofHeight * 0.98], [0, roofHeight]]);
      // Fine copper ribs follow the dome profile without making it faceted.
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        tube('gold', [[x + Math.sin(angle) * r, roofBase + 0.015, z + Math.cos(angle) * r], [x + Math.sin(angle) * r * 1.018, roofBase + roofHeight * 0.20, z + Math.cos(angle) * r * 1.018], [x + Math.sin(angle) * r * 0.78, roofBase + roofHeight * 0.63, z + Math.cos(angle) * r * 0.78], [x + Math.sin(angle) * r * 0.40, roofBase + roofHeight * 0.89, z + Math.cos(angle) * r * 0.40], [x, roofBase + roofHeight, z]], 0.008, 20);
      }
    } else {
      lathe('roof', x, roofBase, z, [[0, 0], [r * 1.08, 0], [r * 1.11, 0.055], [r * 0.90, roofHeight * 0.13], [r * 0.73, roofHeight * 0.31], [r * 0.49, roofHeight * 0.56], [r * 0.24, roofHeight * 0.79], [r * 0.045, roofHeight], [0, roofHeight]]);
      cylinder('gold', x, roofBase + 0.03, z, r * 1.10, r * 1.10, 0.018);
      const profile = [[0.13, 0.90], [0.31, 0.73], [0.56, 0.49], [0.79, 0.24], [1, 0.045]];
      for (let row = 0; row < 7; row++) {
        const t = 0.19 + row * 0.105;
        const upper = profile.findIndex(([level]) => level >= t);
        const [y0, r0] = profile[upper - 1], [y1, r1] = profile[upper];
        const ringRadius = r * (r0 + (r1 - r0) * (t - y0) / (y1 - y0));
        // Thin tile lips follow the actual curved roof profile.
        add(new THREE.TorusGeometry(ringRadius + 0.003, 0.009, 4, 40), 'roof', [x, roofBase + roofHeight * t, z], [Math.PI / 2, 0, 0]);
      }
    }
    finial(x, roofBase + roofHeight, z, radius < 0.3 ? 0.25 : 0.34);
    // Slender buttresses run into the lower stonework. Their sloped cap is a
    // three-point prism rather than a series of blocky crenellations.
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const r = radius * 1.04;
      box('stoneLight', x + Math.sin(a) * r, base + height * 0.12, z + Math.cos(a) * r, radius * 0.15, height * 0.24, radius * 0.18, [0, a, 0]);
    }
  }

  // Tall forms sit behind the terrace. Their off-center distribution leaves
  // readable gaps of sky and distinct roof lines through an entire orbit.
  tower({ x: -0.43, z: -0.49, radius: 0.42, height: 2.91, roofHeight: 0.77 });
  tower({ x: 0.48, z: -0.71, radius: 0.275, height: 3.14, roof: 'spire', roofHeight: 0.73, windows: 5 });
  tower({ x: 1.05, z: 0.02, radius: 0.32, height: 2.06, roofHeight: 0.58, windows: 5 });
  tower({ x: -1.11, z: 0.21, radius: 0.27, height: 1.74, roof: 'spire', roofHeight: 0.64, windows: 5 });

  function roofedHall(x, y, z, width, height, depth) {
    box('stone', x, y + height / 2, z, width, height, depth, [0, 0, 0], true);
    for (const level of [0.06, height - 0.035]) {
      box('stoneLight', x, y + level, z, width + 0.045, 0.046, depth + 0.055);
    }
    const roofWidth=width+.14,roofDepth=depth+.17,rise=depth*.55,hip=Math.min(roofDepth*.42,roofWidth*.22),ridge=roofWidth/2-hip;
    add(createHippedRoofGeometry(THREE,{width:roofWidth,depth:roofDepth,rise,hip,thickness:.035}),
      'roof',[x,y+height,z],[0,0,0],[1,1,1],true);
    // Projecting timber soffits, stone cornices, and a capped ridge give roofs
    // thickness and load-bearing edges instead of a plain triangular extrusion.
    box('wood',x,y+height-.024,z,roofWidth-.035,.035,roofDepth-.035);
    box('stoneLight',x,y+height-.067,z,width+.055,.048,depth+.055);
    tube('roof',[[x-ridge,y+height+rise+.015,z],[x+ridge,y+height+rise+.015,z]],.026,4);
    for(const side of [-1,1]){
      for(let row=1;row<=5;row++){
        const t=row/6,half=ridge+hip*t;
        tube('roof',[[x-half,y+height+rise*(1-t)+.008,z+side*roofDepth/2*t],
          [x+half,y+height+rise*(1-t)+.008,z+side*roofDepth/2*t]],.008,3);
      }
      for(let i=0;i<Math.ceil(width/.20);i++){
        const xx=x-width/2+(i+.5)*width/Math.ceil(width/.20);
        box('wood',xx,y+height-.049,z+side*(depth/2+.035),.028,.048,.11);
      }
      for(const end of [-1,1])tube('roof',[[x+end*ridge,y+height+rise+.011,z],
        [x+end*roofWidth/2,y+height+.011,z+side*roofDepth/2]],.015,2);
    }
    const count = Math.max(2, Math.floor(width / 0.37));
    for (let i = 0; i < count; i++) {
      const wx = x - width / 2 + (i + 0.5) * width / count;
      window(wx, y + 0.16, z + depth / 2 + 0.006, 0, 0.14, height * 0.58);
      window(wx, y + 0.16, z - depth / 2 - 0.006, Math.PI, 0.14, height * 0.58);
    }
  }

  // Low wings give the ensemble a broad, inhabited base. Roofs step down to
  // the loggia instead of every form being another narrow vertical tower.
  roofedHall(-0.10, 1.37, -0.02, 1.91, 0.66, 0.70);
  roofedHall(-0.78, 0.91, -0.68, 1.03, 0.53, 0.63);

  // Open loggias, visible from front and side. Each bay has real depth,
  // continuous curved soffits, and a thin rim around its opening.
  const frontY = 0.35;
  add(arcadeGeometry(THREE, 2.22, 1.01, 0.15, 5, 0.80), 'stone', [-0.02, frontY, 0.73], [0, 0, 0], [1, 1, 1], true);
  box('stoneLight', -0.02, frontY + 1.02, 0.76, 2.36, 0.095, 0.25);
  box('stone', -0.02, frontY + 1.12, 0.57, 2.27, 0.13, 0.62);
  for (let i = 0; i < 5; i++) {
    const x = -1.11 + 2.22 / 5 * (i + 0.5) - 0.02;
    add(extrudedArch(THREE, 2.22 / 5 * 0.70 + 0.047, 0.85, 0.028, 0.028), 'stoneLight', [x, frontY + 0.015, 0.883]);
  }
  for (const side of [-1, 1]) {
    add(arcadeGeometry(THREE, 1.13, 0.89, 0.13, 3, 0.70), 'stone', [side * 1.02, 0.37, -0.07], [0, side * Math.PI / 2, 0], [1, 1, 1], true);
    box('stoneLight', side * 1.02, 1.30, -0.07, 0.21, 0.095, 1.26);
    box('stone', side * 0.92, 1.40, -0.07, 0.38, 0.13, 1.19);
  }

  function archedDoor(x, y, z, yaw, width, height) {
    const shape = archPath(THREE, 0, 0, width, height, THREE.Shape);
    const matrix = new THREE.Matrix4().makeRotationY(yaw);
    const at = (u, v, outward) => new THREE.Vector3(u, v, outward).applyMatrix4(matrix).add(new THREE.Vector3(x, y, z));
    add(new THREE.ExtrudeGeometry(shape, { depth: 0.015, bevelEnabled: false, curveSegments: 16 }), 'wood', [x, y, z], [0, yaw, 0]);
    const rim = at(0, -0.024, 0.012);
    add(extrudedArch(THREE, width + 0.10, height + 0.08, 0.05, 0.032), 'stoneLight', rim.toArray(), [0, yaw, 0]);
    for (let plank = 1; plank < 6; plank++) {
      const u = -width / 2 + plank * width / 6;
      const archTop = height - width / 2 + Math.sqrt((width / 2) ** 2 - u ** 2);
      const a = at(u, 0.018, 0.017), b = at(u, archTop - 0.025, 0.017);
      tube('dark', [a.toArray(), b.toArray()], 0.0022, 1);
    }
    for (const level of [height * 0.21, height * 0.62]) {
      const center = at(0, level, 0.021);
      box('gold', center.x, center.y, center.z, width * 0.86, 0.014, 0.016, [0, yaw, 0]);
    }
    for (const side of [-1, 1]) {
      const handle = at(side * width * 0.10, height * 0.40, 0.031);
      add(new THREE.TorusGeometry(0.015, 0.0035, 5, 14), 'gold', handle.toArray(), [0, yaw, 0]);
    }
    const threshold = at(0, -0.024, 0.022);
    box('stoneLight', threshold.x, threshold.y, threshold.z, width + 0.12, 0.044, 0.14, [0, yaw, 0]);
  }
  archedDoor(0.12, 0.45, 0.866, 0, 0.22, 0.48);
  archedDoor(-1.30, 0.94, -0.68, -Math.PI / 2, 0.24, 0.43);

  // A pair of usable roof terraces, with slender balusters and coping.
  for (const [left, right] of [[-1.08, -0.18], [0.41, 1.06]]) {
    const y = 1.72, z = 0.88;
    tube('stoneLight', [[left, y, z], [right, y, z]], 0.025, 2);
    box('stoneLight', (left + right) / 2, 1.535, z, right - left + 0.04, 0.044, 0.10);
    const count = Math.ceil((right - left) / 0.13);
    for (let i = 0; i <= count; i++) {
      const x = left + (right - left) * i / count;
      lathe('stoneLight', x, 1.55, z, [[0, 0], [0.024, 0], [0.024, 0.023], [0.014, 0.08], [0.019, 0.12], [0.014, 0.16], [0.023, 0.17], [0, 0.17]], false);
    }
  }

  for (let i = 0; i < 7; i++) {
    const y = 0.061 + i * 0.060, z = 1.235 - i * 0.082;
    box('stone', 0.12, y, z, 0.56, 0.007, 0.017);
  }

  // Small roofed bridges bind the independent towers into one castle.
  box('stone', 0.02, 2.13, -0.43, 0.95, 0.43, 0.36, [0, 0, 0], true);
  box('stoneLight', 0.02, 1.90, -0.43, 1.03, 0.07, 0.41);
  box('stoneLight', 0.02, 2.37, -0.43, 1.04, 0.08, 0.43);
  for (const z of [-0.626, -0.234]) {
    for (const x of [-0.13, 0.12, 0.37]) window(x, 1.96, z, z < -0.4 ? Math.PI : 0, 0.11, 0.28);
  }

  // Low surviving parapet fragments leave the entry open and silhouette
  // irregular. The former continuous pearl-like balustrade is gone.
  for (const [x,z,width,angle] of [[-.86,.91,.68,-.12],[.91,.84,.40,.35],[-1.29,.37,.35,-.9]]) {
    box('stone', x,.30,z,width,.20,.13,[0,angle,0]);
    box('stoneLight',x-width*.14,.408,z,width*.57,.035,.15,[0,angle,0]);
  }

  // Sparse vines follow two sheltered corners, leaving the entry and the
  // majority of the stonework clear. Small paired leaves sit along each stem.
  for (const [anchorX, anchorZ, height] of [[-1.10, 0.47, 0.99], [1.025, -0.49, 0.76]]) {
    const stem = [];
    for (let i = 0; i <= 12; i++) stem.push([anchorX + Math.sin(i * 0.61) * 0.026, 0.46 + i / 12 * height, anchorZ + Math.sin(i * 0.40) * 0.015]);
    tube('trunk', stem, 0.006, 12);
    for (let i = 0; i < 9; i++) {
      const y = 0.52 + i / 9 * height;
      const x = anchorX + Math.sin(i * 0.72) * 0.025 + (i % 2 ? -0.030 : 0.030);
      add(new THREE.SphereGeometry(0.038, 10, 8), 'leaf', [x, y, anchorZ + 0.02], [0.1, 0, (i % 2 ? -1 : 1) * 0.6], [0.85, 1.25, 0.28]);
    }
  }

  const castle = work.finish();
  castle.userData.kind = 'castle';
  return castle;
}

/** Shared unit-size branching plan. Both foliage LODs use these exact masses. */
export function createTreeStructure({seed=1,kind='broadleaf',form}={}) {
  let state=Math.max(1,Math.floor(seed)%2147483647);
  const random=()=>(state=state*16807%2147483647)/2147483647;
  const habit=kind==='cypress'?'cypress':form||['spreading','upright','windswept'][Math.floor(seed/7)%3];
  const branches=[],crowns=[],yaw=random()*Math.PI*2;
  const trunk=[[0,0,0],[-.022,.19,.006],[.018,.39,-.012],[habit==='windswept'?.11:.026,.68,.018]];
  branches.push({points:trunk,radius:.029});
  if(habit==='cypress') {
    for(let i=0;i<7;i++) {
      const t=i/6,a=i*2.399963+yaw,y=.30+t*.60,r=.108*(1-.67*t);
      const center=[Math.cos(a)*r*.34+Math.sin(y*3.6)*.028,y,Math.sin(a)*r*.34];
      crowns.push({center,rx:r,rz:r*.71,up:.16*(1-.30*t),down:.051,yaw:a,tilt:.20,phase:random()*6.28});
      branches.push({points:[[.01,y-.13,0],[center[0]*.7,y-.055,center[2]*.7],center],radius:.009*(1-.55*t)});
    }
  } else {
    // A few unequal scaffold limbs each carry a fan of foliage, leaving real
    // sky gaps between the lower boughs. Height/width varies by tree habit.
    const plans=habit==='upright'
      ? [[-.09,.69,.01,.23,.18],[.045,.82,-.06,.22,.18],[.14,.60,.10,.19,.16]]
      : habit==='windswept'
      ? [[-.17,.61,.025,.235,.16],[.09,.77,-.045,.30,.205],[.215,.65,.13,.225,.175]]
      : [[-.14,.71,.015,.28,.22],[.125,.79,-.08,.255,.205],[.07,.62,.155,.25,.19]];
    for(let i=0;i<plans.length;i++) {
      const [x,y,z,rx,rz]=plans[i],a=Math.atan2(z,x)+yaw;
      const cx=x*Math.cos(yaw)-z*Math.sin(yaw),cz=x*Math.sin(yaw)+z*Math.cos(yaw);
      const center=[cx*.92+(random()-.5)*.024,y+(random()-.5)*.021,cz*.92+(random()-.5)*.024];
      const start=[.008,.30+i*.032,-.008],elbow=[cx*.53,y-.16,cz*.55];
      branches.push({points:[start,elbow,center],radius:.0135-i*.0007});
      crowns.push({center,rx:rx*(.94+random()*.12),rz:rz*(.94+random()*.10),up:.165+random()*.036,down:.053+random()*.017,yaw:a,tilt:habit==='windswept'?.16:.035,phase:random()*6.28});
    }
  }
  return {habit,branches,crowns};
}

// Lobed leaf fans have a vaulted top and a shallow, irregular lower skirt.
// They are neither sphere clusters nor horizontal disks. The same sampled
// shell is kept in both LODs, including the gaps and exposed scaffold limbs.
function treeCrownPoint(THREE,crown,angle,latitude) {
  const ring=Math.sin(latitude),vertical=Math.cos(latitude);
  const scallop=1+.16*Math.sin(angle*3+crown.phase)+.095*Math.cos(angle*5-crown.phase*.7);
  const x=Math.cos(angle)*ring*crown.rx*scallop;
  const z=Math.sin(angle)*ring*crown.rz*(1+.08*Math.sin(angle*4+crown.phase));
  const crest=.56+.44*Math.sin(angle*3+crown.phase);
  const top=crown.up*(.64*Math.pow(Math.max(0,vertical),.72)+.55*crest*ring*Math.sqrt(Math.max(0,vertical)));
  const y=(vertical>=0?top:-crown.down*Math.pow(-vertical,.54))+x*crown.tilt
    +ring*.018*Math.sin(angle*3+crown.phase);
  const c=Math.cos(crown.yaw),s=Math.sin(crown.yaw);
  return new THREE.Vector3(crown.center[0]+x*c-z*s,crown.center[1]+y,crown.center[2]+x*s+z*c);
}

export function buildTree(THREE, materials, {height=1,seed=1,kind='broadleaf',form,detail='full'}={}) {
  const work=createWorkshop(THREE,materials),{add}=work,h=height;
  const structure=createTreeStructure({seed,kind,form});
  const cypress=structure.habit==='cypress',crownSides=cypress?8:16,crownRings=5;
  let state=Math.max(1,(Math.floor(seed)+5123)%2147483647);
  const random=()=>(state=state*16807%2147483647)/2147483647;
  work.group.name=`${structure.habit} tree — shared branching crown`;
  function branch(points,radius,segments=5) {
    for(let i=1;i<points.length;i++) {
      const a=new THREE.Vector3(...points[i-1]),b=new THREE.Vector3(...points[i]);
      const vector=b.clone().sub(a),length=vector.length();if(length<.00001)continue;
      const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),vector.normalize());
      const geometry=new THREE.CylinderGeometry(radius*(1-i/points.length*.79),radius*(1-(i-1)/points.length*.79),length,segments,1,true);
      geometry.applyQuaternion(q);geometry.translate(...a.add(b).multiplyScalar(.5).toArray());
      add(geometry,'trunk',[0,0,0],[0,0,0],[h,h,h]);
    }
  }
  for(const b of structure.branches)branch(b.points,b.radius);
  for(const crown of structure.crowns) {
    const points=[],uv=[],index=[],around=crownSides,rings=crownRings;
    for(let j=0;j<=rings;j++)for(let i=0;i<=around;i++){
      const p=treeCrownPoint(THREE,crown,i/around*Math.PI*2,j/rings*Math.PI);
      points.push(p.x,p.y,p.z);uv.push(i/around,j/rings);
    }
    for(let j=0;j<rings;j++)for(let i=0;i<around;i++){
      const a=j*(around+1)+i,b=a+around+1;
      if(j>0)index.push(a,a+1,b);
      if(j<rings-1)index.push(a+1,b+1,b);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(index);geometry.computeVertexNormals();
    // Welded seam/pole normals prevent a crease as the tree turns around.
    const n=geometry.attributes.normal;
    for(let i=0;i<=around;i++){n.setXYZ(i,0,1,0);n.setXYZ(rings*(around+1)+i,0,-1,0);}
    for(let j=0;j<=rings;j++){
      const a=j*(around+1),b=a+around;
      const normal=new THREE.Vector3().fromBufferAttribute(n,a).add(new THREE.Vector3().fromBufferAttribute(n,b)).normalize();
      n.setXYZ(a,normal.x,normal.y,normal.z);n.setXYZ(b,normal.x,normal.y,normal.z);
    }
    add(geometry,'leaf',[0,0,0],[0,0,0],[h,h,h],true);
  }
  const leafPositions = [], leafNormals = [], leafUVs = [];
  let leafCount = 0;
  function pointedLeaf(origin, direction, outward, length, width) {
    const forward = direction.clone().normalize();
    const normal = outward.clone().addScaledVector(forward, -outward.dot(forward)).normalize();
    if (normal.lengthSq() < 0.001) normal.set(0, 1, 0).addScaledVector(forward, -forward.y).normalize();
    const sideways = new THREE.Vector3().crossVectors(normal, forward).normalize();
    // Closed, gently folded leaves remain visible from both sides. The ridge
    // catches light; UVs follow the midrib from the attached base to the tip.
    const rim = [[0, 0, 0], [-0.50, -0.018, 0.48], [0, 0.030, 1], [0.50, -0.018, 0.48]];
    const front = [0, 0.045, 0.48], back = [0, -0.020, 0.48];
    const vertex = ([x, y, z], upper) => {
      const p = origin.clone().addScaledVector(sideways, x * width).addScaledVector(normal, y * width).addScaledVector(forward, z * length);
      leafPositions.push(p.x, p.y, p.z);
      const n = normal.clone().addScaledVector(sideways, x * 0.11).addScaledVector(forward, (z - 0.48) * 0.035).normalize().multiplyScalar(upper ? 1 : -1);
      leafNormals.push(n.x, n.y, n.z);
      leafUVs.push(z, x + 0.5);
    };
    for (let i = 0; i < rim.length; i++) {
      const next = (i + 1) % rim.length;
      vertex(front, true); vertex(rim[i], true); vertex(rim[next], true);
      vertex(back, false); vertex(rim[next], false); vertex(rim[i], false);
    }
    leafCount++;
  }

  if(detail!=='coarse') {
    const clusterCount=cypress?52:172;
    for(let cluster=0;cluster<clusterCount;cluster++) {
      const crown=structure.crowns[cluster%structure.crowns.length];
      const order=Math.floor(cluster/structure.crowns.length),angle=order*2.399963+crown.phase;
      const latitude=.30+(order*.61803398875%1)*2.30;
      // Interpolate the authored shell triangles: leaves touch their parent
      // spray even at coarse tessellation, rather than floating off an
      // idealized analytic surface between the sampled shell vertices.
      const sample=(a,t)=>{
        const around=crownSides,rings=crownRings,turn=((a/(Math.PI*2))%1+1)%1*around;
        const row=Math.min(rings-.000001,Math.max(0,t/Math.PI*rings)),i=Math.floor(turn),j=Math.floor(row),u=turn-i,v=row-j;
        const p00=treeCrownPoint(THREE,crown,i/around*Math.PI*2,j/rings*Math.PI);
        const p10=treeCrownPoint(THREE,crown,(i+1)/around*Math.PI*2,j/rings*Math.PI);
        const p01=treeCrownPoint(THREE,crown,i/around*Math.PI*2,(j+1)/rings*Math.PI);
        if(u+v<=1)return p00.multiplyScalar(1-u-v).addScaledVector(p10,u).addScaledVector(p01,v);
        const p11=treeCrownPoint(THREE,crown,(i+1)/around*Math.PI*2,(j+1)/rings*Math.PI);
        return p11.multiplyScalar(u+v-1).addScaledVector(p10,1-v).addScaledVector(p01,1-u);
      };
      const center=sample(angle,latitude).multiplyScalar(h);
      const da=sample(angle+.004,latitude).multiplyScalar(h).sub(center);
      const dt=sample(angle,latitude+.004).multiplyScalar(h).sub(center);
      const normal=new THREE.Vector3().crossVectors(da,dt).normalize();
      const tangent=da.normalize(),bitangent=new THREE.Vector3().crossVectors(normal,tangent).normalize();
      const axis=cypress?new THREE.Vector3(0,1,0).addScaledVector(tangent,.20).normalize()
        :tangent.clone().multiplyScalar(.86).addScaledVector(bitangent,.36).normalize();
      const across=new THREE.Vector3().crossVectors(normal,axis).normalize();
      // Fine twigs are attached to the same scaffold fan, not an unrelated
      // random leaf cloud. Their short length leaves the broad silhouette.
      if(cluster%3===0) {
        const attached=new THREE.Vector3(...crown.center).multiplyScalar(h);
        branch([attached.clone().lerp(center,.58).divideScalar(h).toArray(),center.clone().divideScalar(h).toArray()],.0022,4);
      }
      const perCluster=cypress?7:5;
      for(let leaf=0;leaf<perCluster;leaf++) {
        const side=leaf%2?-1:1;
        const direction=axis.clone().multiplyScalar(.82).addScaledVector(across,side*(.44+random()*.10)).addScaledVector(normal,.035).normalize();
        const length=h*(cypress?.035+random()*.010:.042+random()*.014);
        const origin=center.clone().addScaledVector(axis,h*(leaf-(perCluster-1)/2)*(cypress?.006:.007)).addScaledVector(normal,h*.003);
        pointedLeaf(origin,direction,normal,length,length*(cypress?.42:.52));
      }
    }
    const leaves=new THREE.BufferGeometry();
    leaves.setAttribute('position',new THREE.Float32BufferAttribute(leafPositions,3));
    leaves.setAttribute('normal',new THREE.Float32BufferAttribute(leafNormals,3));
    leaves.setAttribute('uv',new THREE.Float32BufferAttribute(leafUVs,2));
    add(leaves,'leafDetail',[0,0,0],[0,0,0],[1,1,1],true);
  }
  const tree=work.finish();tree.userData.kind='tree';tree.userData.form=structure.habit;
  tree.userData.leafCount=leafCount;tree.userData.detail=detail;return tree;
}

export function buildPavilion(THREE, materials) {
  const work = createWorkshop(THREE, materials);
  const { add, cylinder, lathe, tube } = work;
  work.group.name = 'Open six-column domed pavilion';
  cylinder('stone', 0, 0.05, 0, 0.63, 0.66, 0.10, true, 48);
  cylinder('stoneLight', 0, 0.14, 0, 0.57, 0.59, 0.08, true, 48);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const x = Math.sin(a) * 0.44, z = Math.cos(a) * 0.44;
    lathe('stoneLight', x, 0.18, z, [[0, 0], [0.071, 0], [0.071, 0.045], [0.049, 0.08], [0.038, 0.45], [0.036, 0.92], [0.07, 0.965], [0.07, 1.01], [0, 1.01]], true);
    const next = a + Math.PI / 3;
    const arc = [];
    for (let j = 0; j <= 18; j++) {
      const t = j / 18;
      arc.push([Math.sin(a) * 0.44 * (1 - t) + Math.sin(next) * 0.44 * t, 0.88 + Math.sin(t * Math.PI) * 0.25, Math.cos(a) * 0.44 * (1 - t) + Math.cos(next) * 0.44 * t]);
    }
    tube('stoneLight', arc, 0.027, 18);
  }
  cylinder('stoneLight', 0, 1.21, 0, 0.55, 0.53, 0.12, true, 48);
  cylinder('gold', 0, 1.29, 0, 0.565, 0.565, 0.036);
  lathe('roof', 0, 1.31, 0, [[0, 0], [0.56, 0], [0.56, 0.07], [0.51, 0.21], [0.38, 0.39], [0.17, 0.53], [0, 0.57]], true);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    tube('gold', [[Math.sin(a) * 0.56, 1.32, Math.cos(a) * 0.56], [Math.sin(a) * 0.53, 1.49, Math.cos(a) * 0.53], [Math.sin(a) * 0.36, 1.72, Math.cos(a) * 0.36], [0, 1.88, 0]], 0.008, 16);
  }
  cylinder('gold', 0, 1.955, 0, 0.008, 0.02, 0.15, false, 10);
  add(new THREE.SphereGeometry(0.036, 12, 8), 'gold', [0, 1.93, 0]);
  add(new THREE.ConeGeometry(0.027, 0.085, 12), 'gold', [0, 2.045, 0]);
  const pavilion = work.finish();
  pavilion.userData.kind = 'pavilion';
  return pavilion;
}
