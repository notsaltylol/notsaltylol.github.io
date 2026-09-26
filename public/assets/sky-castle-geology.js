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

// These few large fracture faces and hanging blocks define the silhouette.
// Small fractal weathering above deliberately remains compatible with the
// satellites and foreground; it never substitutes for the main massing.
const fracturePlanes = [
  [.08,.96,.09], [.66,.86,-.08], [1.16,.97,.11], [1.82,.89,-.045],
  [2.46,.95,.15], [3.04,.83,-.10], [3.70,.96,.055], [4.33,.87,-.12],
  [4.98,.97,.13], [5.60,.88,-.075], [6.05,.95,.035],
];
const faults = [
  // angle, width, radial recession, leaning direction
  [.74,.060,.095,-.18], [1.54,.046,.085,.12], [2.80,.072,.12,-.16],
  [3.68,.052,.092,.17], [4.73,.065,.105,-.12], [5.75,.044,.078,.14],
];
const shelves = [
  // center angle, angular extent, depth, shelf reach, undercut, bed tilt
  [.24,.80,.18,.048,.064,-.042], [2.28,.71,.30,.062,.072,.035],
  [3.87,.64,.22,.072,.085,-.029], [5.10,.74,.43,.051,.069,.036],
  [.96,.43,.56,.037,.060,.023],
];
const hangingMasses = [
  // axis, half-width, radial reach, extra drop, lean, surviving block-foot width
  [.20,.43,.235,1.50,-.14,.16], [2.02,.70,.42,2.35,.045,.61],
  [3.23,.31,.18,.95,-.16,.14], [4.22,.64,.37,2.10,.10,.43],
  [5.46,.30,.22,1.30,-.10,.18],
];

/** Dimensionless macro structure; angle is periodic and depth runs rim 0–1. */
export function cliffFormation(angle, depth) {
  let planeRadius = Infinity;
  for(const [normal,distance,lean] of fracturePlanes){
    const facing=Math.cos(angle-normal);
    if(facing<=.35)continue;
    const support=distance+lean*Math.sin(depth*Math.PI*.88);
    planeRadius=Math.min(planeRadius,support/facing);
  }
  let joints=0;
  for(const [axis,width,recession,lean] of faults){
    const d=angularDistance(angle,axis+depth*lean)/width;
    joints+=recession*Math.exp(-d*d);
  }
  let ledges=0;
  for(const [axis,width,level,reach,cut,tilt] of shelves){
    const delta=angularDistance(angle,axis),patch=1-smooth(width*.56,width,Math.abs(delta));
    const d=depth-level-delta*tilt;
    const shelf=smooth(-.033,-.013,d)*(1-smooth(.006,.029,d));
    const undercut=smooth(.021,.047,d)*(1-smooth(.094,.145,d));
    ledges+=patch*(shelf*reach-undercut*cut);
  }
  let hangingReach=0,hangingDrop=0,buttress=0;
  for(const [axis,width,reach,drop,lean,foot] of hangingMasses){
    const distance=Math.abs(angularDistance(angle,axis+depth*lean));
    const wedge=Math.max(0,1-distance/width);
    // The wide western foot is a surviving bedding block, while the shorter
    // eastern buttress tapers off axis. Their unequal widths and abrupt broken
    // shoulders keep the lower silhouette from becoming a row of hanging cones.
    const mass=Math.pow(Math.min(1,wedge/(1-foot)),.82);
    // Two offset breaks interrupt the broad block with a shelf and a slight
    // undercut. They affect its large planes, not the shared fine-rock noise.
    const broadBlock=foot>.4?1:0;
    const breakDepth=depth+angularDistance(angle,axis)*.10;
    const bedStep=broadBlock*(.12*smooth(.45,.485,breakDepth)-.15*smooth(.535,.58,breakDepth)
      +.09*smooth(.71,.75,breakDepth)-.12*smooth(.80,.835,breakDepth));
    hangingReach=Math.max(hangingReach,mass*reach*(1+bedStep));
    hangingDrop=Math.max(hangingDrop,mass*drop);
    buttress=Math.max(buttress,mass);
  }
  return {planeRadius,ledges,joints,hangingReach,hangingDrop,buttress};
}
