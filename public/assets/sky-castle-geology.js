/**
 * Deterministic geological displacement, independent of Three.js and time.
 *
 * fractalRock(x, y, z) returns a signed value in [-1, 1]. Feed it object/world
 * coordinates in island units, then multiply by the desired displacement.
 * Always taper the result at a mesh's fixed rim, attachments, or water channel.
 * Coherent 3D fields keep the angular seam continuous without 2D UV wrapping.
 */

const mix = (a, b, t) => a + (b - a) * t;
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);

function latticeHash(x, y, z) {
  let value = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return (value ^ (value >>> 16)) >>> 0;
}

function gradient(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

/** Quintic-interpolated gradient noise: continuous values and derivatives. */
export function coherentNoise3D(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fade(fx), v = fade(fy), w = fade(fz);
  const corner = (dx, dy, dz) => gradient(latticeHash(ix + dx, iy + dy, iz + dz), fx - dx, fy - dy, fz - dz);
  return mix(
    mix(mix(corner(0, 0, 0), corner(1, 0, 0), u), mix(corner(0, 1, 0), corner(1, 1, 0), u), v),
    mix(mix(corner(0, 0, 1), corner(1, 0, 1), u), mix(corner(0, 1, 1), corner(1, 1, 1), u), v),
    w,
  );
}

function fbm(x, y, z, octaves = 4) {
  let sum = 0, weight = 0, amplitude = 1;
  for (let octave = 0; octave < octaves; octave++) {
    sum += amplitude * coherentNoise3D(x, y, z);
    weight += amplitude;
    amplitude *= 0.48;
    // Unequal translation and a small domain rotation prevent aligned grids.
    [x, y, z] = [x * 1.94 + z * 0.19 + 7.1, y * 2.03 - 11.7, z * 1.94 - x * 0.19 + 3.4];
  }
  return sum / weight;
}

function ridged(x, y, z) {
  let sum = 0, weight = 0, amplitude = 1, previous = 1;
  for (let octave = 0; octave < 3; octave++) {
    let ridge = 1 - Math.abs(coherentNoise3D(x, y, z));
    ridge *= ridge;
    sum += ridge * previous * amplitude;
    weight += amplitude;
    previous = Math.min(1, ridge * 1.65);
    amplitude *= 0.44;
    [x, y, z] = [x * 2.07 + 2.9, y * 2.11 + 8.3, z * 2.03 - 5.6];
  }
  return sum / weight;
}

export function fractalRock(x, y, z) {
  // Broad domain warping bends the fracture fields around the existing rock
  // mass. The displacement remains an ordinary scalar, not a new base shape.
  const wx = x + fbm(x * 0.34 + 12.7, y * 0.29, z * 0.34 - 2.1, 3) * 0.80;
  const wy = y + fbm(x * 0.31 - 7.3, y * 0.38 + 9.4, z * 0.31, 3) * 0.49;
  const wz = z + fbm(x * 0.34, y * 0.29 - 5.1, z * 0.34 + 17.3, 3) * 0.80;
  const crags = fbm(wx * 0.82, wy * 0.71, wz * 0.82);
  const fractures = (ridged(wx * 1.25 + 1.7, wy * 0.94, wz * 1.25 - 3.1) - 0.59) * 1.8;
  // Anisotropic strata create shallow broken shelves instead of regular rings.
  const shelves = fbm(wx * 0.47 - 8.3, wy * 2.45 + 4.8, wz * 0.47, 3);
  const erosion = fbm(wx * 3.10 + 3.4, wy * 2.35, wz * 3.10 - 9.2, 2);
  return Math.max(-1, Math.min(1, crags * 0.70 + fractures * 0.52 + shelves * 0.28 + erosion * 0.10));
}

const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const angularDistance = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Unequal bedding planes describe the large formation. These are deliberately
// authored geological masses, not a low-frequency noise field: the resulting
// silhouette has broad planar faces interrupted by faults and eroded shelves.
const fracturePlanes = [
  [ .05,.94, .045], [.48,.90,-.022], [.89,.96, .028], [1.32,.88, .052],
  [1.71,.95,-.018], [2.13,.91, .042], [2.58,.97,-.030], [2.96,.90, .024],
  [3.39,.96, .041], [3.83,.89,-.027], [4.22,.95, .032], [4.70,.91, .047],
  [5.08,.97,-.020], [5.50,.89, .037], [5.96,.95,-.029],
];
const faults = [
  [.29,.030,.065,.16], [1.03,.040,.050,-.13], [1.93,.022,.075,.11],
  [2.71,.046,.047,-.18], [3.57,.028,.068,.13], [4.39,.036,.056,-.10], [5.72,.025,.071,.16],
];
const beds = [.105,.205,.335,.475,.625,.775,.895];
const hangingMasses = [
  // angle, angular half-width, extra reach, extra drop
  [.42,.39,.125,1.85], [2.34,.29,.085,1.25], [3.49,.46,.135,1.60], [5.16,.32,.105,2.10],
];

/** Dimensionless macro structure; angle is periodic and depth runs rim 0–1. */
export function cliffFormation(angle, depth) {
  let planeRadius = Infinity;
  for (const [normal, distance, lean] of fracturePlanes) {
    const facing = Math.cos(angle - normal);
    if (facing <= .40) continue;
    // Each face leans independently, so the underside splits into overlapping
    // masses rather than repeating the same polygon at every elevation.
    const support = distance + lean * Math.sin(depth * Math.PI * 1.45) +
      .024 * Math.sin(normal * 3.7 + depth * 7.4) * Math.sin(depth * Math.PI);
    planeRadius = Math.min(planeRadius, support / facing);
  }
  let joints = 0;
  for (const [angle0, width, erosion, drift] of faults) {
    const delta = angularDistance(angle, angle0 + depth * drift);
    joints += erosion * Math.exp(-((delta / width) ** 2));
  }
  let ledges = 0;
  for (let i = 0; i < beds.length; i++) {
    const tilt = .020 * Math.sin(angle * 2 + i * 1.7) + .010 * Math.cos(angle * 5 - i);
    const d = depth - beds[i] - tilt;
    // A short shelf top and longer concave undercut, present on only part of
    // the circumference. No regular horizontal rings encircle the island.
    const patch = smooth(-.45,.55,Math.sin(angle * (i % 2 ? 3 : 2) + i * 2.1));
    const shelf = smooth(-.025,-.007,d) * (1 - smooth(.006,.027,d));
    const undercut = smooth(.008,.031,d) * (1 - smooth(.060,.103,d));
    ledges += patch * (shelf * .020 - undercut * .034);
  }
  let hangingReach = 0, hangingDrop = 0;
  for(const [axis,width,reach,drop] of hangingMasses) {
    const distance=Math.abs(angularDistance(angle,axis+depth*.045));
    // A wedge profile gives fractured descending planes and a distinct apex,
    // unlike a smooth Gaussian mound that would round each hanging mass.
    const mass=Math.max(0,1-distance/width);
    hangingReach+=mass*reach;
    hangingDrop+=mass*drop;
  }
  return { planeRadius, ledges, joints, hangingReach, hangingDrop };
}
