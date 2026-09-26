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

// Connected, inclined bedrock wedges. Each cross-section is an irregular
// polygon rather than a box; several sloping fracture planes close the lower
// end, so no horizontal end cap can turn the underside into hanging blocks.
const volumes = [
  // center X/Y/Z; half widths X/Y/Z; yaw; vertical shears; variation
  [-5.02,-.25,1.67, 1.48,1.30,1.35, -.29,.25,-.15,0],
  [-3.08,-1.00,2.78, 1.89,2.07,1.15, -.06,-.13,.08,1],
  [-.48,-.80,3.26, 1.23,1.95,1.02, .36,.24,-.22,2],
  [2.77,-.22,2.79, 1.30,1.20,1.18, -.39,-.18,.19,3],
  [4.96,-.60,.76, 1.34,1.60,1.55, .34,-.28,-.14,4],
  [4.40,-.18,-2.29, 1.66,1.12,1.31, -.23,.12,.20,5],
  [1.43,-.58,-3.26, 1.74,1.55,1.15, .32,-.27,-.22,6],
  [-2.03,-.32,-3.05, 1.84,1.30,1.37, -.16,-.29,.18,7],
  [-4.60,-.48,-1.43, 1.45,1.64,1.50, -.43,.20,.21,8],
  [-1.20,-2.00,.25, 2.80,1.95,2.25, .21,.24,-.31,9],
  [2.20,-1.85,.60, 1.65,1.30,1.60, -.40,-.18,.24,10],
  [.90,-2.20,-1.10, 1.65,1.40,1.36, .27,.19,-.26,11],
  [-2.10,-1.90,-1.30, 1.45,1.15,1.33, -.32,-.27,.13,12],
];
const crags=volumes.map(([x,y,z,sx,sy,sz,yaw,leanX,leanZ,variant])=>{
  const c=Math.cos(yaw),s=Math.sin(yaw),planes=[];
  function plane(nx,ny,nz,cut){
    const a=nx*c/sx-nz*s/sz,b=ny/sy-nx*leanX/sx-nz*leanZ/sz,d=nx*s/sx+nz*c/sz;
    planes.push([a,b,d,cut+a*x+b*y+d*z,1/Math.hypot(a,b,d)]);
  }
  // One broad face, two narrower shoulders, and unequal back faces produce
  // a wedged plan. Tilts narrow the hanging rock continuously toward its foot.
  const polygon=variant===1?[0,Math.PI/2,Math.PI,3.84,5.43]:[.09,1.28,2.64,3.80,5.22];
  polygon.forEach((angle,i)=>{
    const tilt=(variant===1&&i===1)?.12:.39+((variant+i*3)%5)*.061;
    plane(Math.cos(angle),-tilt,Math.sin(angle),.86+((variant*2+i)%4)*.047);
  });
  // Upper cuts are buried against the meadow. The lower three faces meet
  // along an offset oblique ridge; their unequal pitches are visible in orbit.
  plane(.14,.98,-.17,1.05);
  const split=yaw+variant*.71;
  for(let i=0;i<3;i++){
    const angle=split+i*Math.PI*2/3;
    plane(Math.cos(angle)*(1.02+i*.17),-1,Math.sin(angle)*(1.02+i*.17),1.21+(variant%4)*.083+i*.11);
  }
  const radial=Math.hypot(x,z)||1,outX=(x*c+z*s)/radial,outZ=(-x*s+z*c)/radial;
  if(variant!==1&&variant!==9)plane(outX,-.92,outZ,1.10+(variant%3)*.09);
  if(variant===9)plane(.22,-1,.18,1.10);
  // A small secondary cleave removes one shoulder instead of beveling every
  // corner equally. This creates distinct broad planes, not uniform facets.
  plane(Math.cos(2.02+variant*.31),-.07,Math.sin(2.02+variant*.31),1.04);
  return planes;
});
const coreProfile=[[0,1],[.045,.965],[.12,.86],[.27,.70],[.44,.55],[.64,.39],[.83,.20],[1,.026]];
function coreRadius(depth){
  for(let i=1;i<coreProfile.length;i++)if(depth<=coreProfile[i][0]){
    const [a,ra]=coreProfile[i-1],[b,rb]=coreProfile[i];return 6.8*(ra+(rb-ra)*clamp01((depth-a)/(b-a)));
  }
  return .1768;
}
// Five linked buttresses interrupt the large principal faces. These are
// authored structural ribs and adjoining clefts, not a higher noise octave.
// Their unequal lengths finish inside the supporting body rather than making
// a repeated row of hanging blades along the bottom silhouette.
const buttresses=[
  // azimuth, breadth, relief, lean, start, end, adjoining cleft depth
  [.38,.39,.54,.22,.09,.67,.26],
  [2.35,.44,.57,-.44,.34,.84,.34],
  [2.71,.32,.65,-.12,.065,.61,.44],
  [3.66,.35,.44,.27,.13,.63,.28],
  [5.13,.47,.63,-.31,.10,.77,.31],
];
const angularDistance=(a,b)=>{
  const delta=(a-b)%(Math.PI*2);
  return delta>Math.PI?delta-Math.PI*2:delta< -Math.PI?delta+Math.PI*2:delta;
};
const ledges=[
    [2.68,.63,-2.85,.32,.21,-.16],
    [.15,.62,-.91,.27,-.22,.25],
    [4.78,.72,-2.02,.35,.28,.10],
  ];
function structuralRelief(angle,depth,height,radius){
  let relief=0;
  for(const [azimuth,width,strength,lean,start,end,cut]of buttresses){
    const center=azimuth+lean*depth;
    const across=Math.abs(angularDistance(angle,center))/width;
    const plane=clamp01((1-across)/.80);
    const rib=plane*smooth(0,.18,plane);
    const along=smooth(start,start+.13,depth)*(1-smooth(end-.18,end,depth));
    // The cleft crosses one shoulder obliquely. Its broad V is resolved by
    // several mesh cells; it never jumps from an off-axis rock to the core.
    const jointCenter=center+width*(.76-.27*depth);
    const joint=clamp01(1-Math.abs(angularDistance(angle,jointCenter))/.094);
    relief+=(strength*rib-cut*joint*smooth(0,.16,joint))*along;
  }
  // Three unequal recessed beds join different buttress systems. Each bed
  // occupies part of one face and dips across it, never wrapping as a ring.
  const rockX=Math.cos(angle)*radius,rockZ=Math.sin(angle)*radius*.76;
  for(const [azimuth,width,level,cut,slopeX,slopeZ]of ledges){
    const across=clamp01(1-Math.abs(angularDistance(angle,azimuth))/width);
    const sector=smooth(0,.28,across);
    const bed=height+slopeX*rockX+slopeZ*rockZ;
    const notch=smooth(level-.65,level-.30,bed)*(1-smooth(level-.035,level+.11,bed));
    relief-=cut*sector*notch;
  }
  return relief*smooth(.045,.12,depth)*(1-smooth(.80,.94,depth));
}

/** Radial envelope of connected oblique crags, in unscaled island units. */
export function cliffFormation(angle,depth,height=1.14-6.34*depth){
  const t=clamp01(depth),dx=Math.cos(angle),dz=Math.sin(angle)*.76;
  const centerX=-.38*smooth(.08,.93,t)+.11*Math.sin(Math.PI*t),centerZ=-.13*smooth(.14,.94,t);
  const dip=(.033*Math.sin(angle-.4)+.024*Math.cos(angle*2+.6))*Math.sin(Math.PI*t);
  const core=coreRadius(clamp01(t+dip));
  let radius=core;
  for(const planes of crags){
    let near=0,far=Infinity;
    for(const [nx,ny,nz,limit]of planes){
      const remaining=limit-nx*centerX-ny*height-nz*centerZ,velocity=nx*dx+nz*dz;
      if(Math.abs(velocity)<1e-10){if(remaining<0){far=-1;break;}continue;}
      const hit=remaining/velocity;
      if(velocity>0)far=Math.min(far,hit);else near=Math.max(near,hit);
      if(near>far)break;
    }
    if(far>=near&&Number.isFinite(far)){
      // A tangent ray has zero thickness. Let that wedge grow continuously
      // from the common bedrock instead of jumping to a distant outer face;
      // a hard maximum here produces false horizontal staircase ledges.
      const middle=(near+far)*.5;
      let embedded=Infinity;
      for(const [nx,ny,nz,limit,inverseLength]of planes){
        const distance=limit-nx*(centerX+dx*middle)-ny*height-nz*(centerZ+dz*middle);
        embedded=Math.min(embedded,distance*inverseLength);
      }
      const joined=core+(far-core)*smooth(0,.38,embedded);
      radius=Math.max(radius,joined);
    }
  }
  radius+=structuralRelief(angle,t,height,radius);
  // Fine unequal strata bend across neighboring wedges, with a few locally
  // projecting lips. Low amplitude leaves the principal fracture planes clear.
  const reveal=smooth(.045,.15,t)*(1-smooth(.80,.99,t));
  const bed=height+.34*dx*radius+.22*dz*radius;
  const strata=coherentNoise3D(dx*radius*.63+7.1,bed*3.2,dz*radius*.63-3.4)*.055;
  radius+=strata*reveal;
  // Fixed attachment at the top; the meadow does not grow a broad smooth
  // collar, and all irregular crags resolve into the same enclosed bottom.
  const rim=1-smooth(.006,.038,t),tip=smooth(.89,1,t);
  radius=radius*(1-rim)+6.8*rim;
  radius=radius*(1-tip)+coreRadius(t)*tip;
  return {radius:Math.max(.13,radius),centerX,centerZ};
}
