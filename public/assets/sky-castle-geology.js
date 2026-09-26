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
