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

// The main island is an assemblage of broken rock volumes, not an angular
// extrusion with several hanging tips. Positions, scale, shear and fracture
// directions are deliberately unequal. The small fBm surface above is shared
// with other islands and remains independent of this authored large structure.
const cragVolumes = [
  // center X/Y/Z; half widths X/Y/Z; fracture yaw; two vertical shears; bevel
  [-5.10,-.48,1.85, 1.42,1.64,1.22, -.35,.20,-.08,1.58],
  [-3.05,-1.02,2.75, 1.68,1.78,1.08, -.10,-.08,.16,1.77],
  [-.60,-.70,3.36, 1.10,1.48,.94, .30,.22,-.18,1.58],
  [2.74,-.33,3.02, 1.00,1.37,1.02, -.27,-.14,.23,1.65],
  [4.85,-.63,1.66, 1.28,1.34,1.31, .44,-.35,-.16,1.57],
  [5.13,-.48,-1.08, 1.20,1.70,1.43, -.20,.12,.24,1.64],
  [3.64,-.38,-3.00, 1.55,1.54,1.12, .35,-.23,.12,1.54],
  [.85,-1.15,-3.43, 1.53,1.60,1.06, -.17,.27,-.32,1.72],
  [-2.85,-.75,-3.03, 1.60,1.20,1.12, .27,-.25,-.32,1.60],
  [-4.68,-.29,-1.54, 1.39,1.45,1.36, -.46,.14,.11,1.54],
  [-3.39,-2.45,1.64, 1.40,1.34,1.04, .31,.31,-.22,1.58],
  [-.89,-3.02,1.58, 1.31,1.63,1.23, -.24,-.19,.14,1.65],
  [1.51,-2.47,1.92, 1.11,1.44,1.04, .42,.24,-.15,1.52],
  [3.14,-2.21,-.40, 1.24,1.36,1.14, -.37,-.22,.24,1.57],
  [.72,-2.97,-1.56, 1.31,1.65,1.12, .19,.17,-.27,1.62],
  [-2.16,-2.74,-1.50, 1.25,1.40,1.17, -.41,-.25,.10,1.57],
  [-.33,-4.16,-.16, 1.08,1.02,.97, .34,-.18,.25,1.61],
];

// Clip a horizontal radial ray against each sheared bevelled polyhedron. The
// resulting outer surface contains real inclined planes and deep re-entrant
// fractures; no disconnected rock meshes or intersecting caps are necessary.
const crags = cragVolumes.map(([x,y,z,sx,sy,sz,yaw,leanX,leanZ,bevel],index) => {
  const c=Math.cos(yaw),s=Math.sin(yaw),planes=[];
  const plane=(nx,ny,nz,cut)=>{
    const a=nx*c/sx-nz*s/sz,b=ny/sy-nx*leanX/sx-nz*leanZ/sz,d=nx*s/sx+nz*c/sz;
    planes.push([a,b,d,cut+a*x+b*y+d*z]);
  };
  // Lower fracture faces narrow unequally in two directions. Some blocks
  // retain a broad blunt foot, others finish on a long oblique cleave; there
  // is no rotationally symmetric cone or repeated hanging-tip profile.
  const taperX=[.29,.21,.34,.15,.30,.19,.27,.23,.31,.16,.12,.18,.29,.23,.14,.26,.08][index];
  const taperZ=[.17,.23,.13,.32,.18,.28,.12,.25,.16,.31,.23,.13,.18,.11,.27,.17,.12][index];
  for(const sign of [-1,1]){plane(sign,-taperX,0,1-taperX);plane(0,sign,0,1);plane(0,-taperZ,sign,1-taperZ);}
  for(const a of [-1,1])for(const b of [-1,1]){
    plane(a,-.14,b,bevel-.14);plane(a,b,0,bevel+.03);plane(0,a,b,bevel-.04);
  }
  plane(index%3===0?-1:1,-1,index%2?-1:1,1.45+(index%4)*.11);
  // Long oblique breaks cut the exposed face above and below its middle bed.
  // They turn box-like end caps into unequal wedge planes without pinching
  // every crag to a point. Their heights vary from block to block.
  const radial=Math.hypot(x,z)||1,outX=(x*c+z*s)/radial,outZ=(-x*s+z*c)/radial;
  plane(outX,-1.10,outZ,1.10+(index%3)*.15);
  plane(outX,.80,outZ,1.19+(index%2)*.16);
  if(index!==1)plane(outX*.62-outZ*.55,-.12,outZ*.62+outX*.55,1.01+(index%4)*.055);
  return {minY:y-sy,maxY:y+sy,planes};
});
const coreProfile=[[0,1],[.10,.89],[.25,.72],[.43,.53],[.62,.37],[.79,.22],[.93,.105],[1,.026]];

/** Radial envelope of authored 3D crags, in unscaled island coordinates. */
export function cliffFormation(angle,depth,height=1.14-6.34*depth){
  let taper=1;
  for(let i=1;i<coreProfile.length;i++)if(depth>=coreProfile[i-1][0]&&depth<=coreProfile[i][0]){
    const [a,ra]=coreProfile[i-1],[b,rb]=coreProfile[i];taper=ra+(rb-ra)*(depth-a)/(b-a);break;
  }
  const centerX=-.38*smooth(.08,.90,depth)+.11*Math.sin(Math.PI*depth),centerZ=-.13*smooth(.14,.92,depth);
  const dx=Math.cos(angle),dz=Math.sin(angle)*.76;
  let radius=6.8*taper;
  // Irregular broad core facets stay behind the main crags and close their
  // fractures toward one offset, narrowing underside instead of a tip row.
  let support=Infinity;
  for(const [normal,distance] of [[.16,.91],[1.03,.95],[1.91,.88],[2.69,.94],[3.46,.90],[4.34,.96],[5.21,.89],[5.84,.97]]){
    const facing=Math.cos(angle-normal);if(facing>.25)support=Math.min(support,distance/facing);
  }
  radius*=support;
  for(const crag of crags){
    if(height<crag.minY||height>crag.maxY)continue;
    let near=0,far=Infinity;
    for(const [nx,ny,nz,limit] of crag.planes){
      const remaining=limit-nx*centerX-ny*height-nz*centerZ,velocity=nx*dx+nz*dz;
      if(Math.abs(velocity)<1e-10){if(remaining<0){far=-1;break;}continue;}
      const hit=remaining/velocity;
      if(velocity>0)far=Math.min(far,hit);else near=Math.max(near,hit);
      if(near>far)break;
    }
    if(far>=near&&Number.isFinite(far))radius=Math.max(radius,far);
  }
  return {radius,centerX,centerZ};
}
