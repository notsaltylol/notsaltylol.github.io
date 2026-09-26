/**
 * Shared landscape composition, in authored landscape coordinates rather than
 * plant-sized noise. Woods occupy a few connected shoulders; open routes and
 * viewing meadows join the landmarks. Every species samples the same map.
 * This only changes placement probabilities, never model size or population.
 */
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const MAIN_WOODS=[[-4.65,-.8,1.15,2.45,-.17],[-1.8,-3.62,2.55,.88,.17],
  [3.8,-2.55,1.58,1.42,-.30],[4.65,1.85,1.12,1.95,.23],[-.45,3.64,2.55,.64,.13]];
const LOOKOUT_WOODS=[[-6.4,-.75,1.9,1.23,-.20],[-3.95,1.83,2.42,.90,.10],
  [-.8,2.12,1.68,.85,-.25],[4.2,1.33,2.52,1.08,.17],[5.6,-1.57,1.35,1.0,-.38]];
const MAIN_FLOWERS=[[-4.40,2.05,.90,.50,-.58],[-1.38,2.82,.82,.43,.25],
  [3.42,2.80,.75,.55,.45],[3.92,-.94,.52,1.12,-.32],[-.55,-2.38,.91,.43,.14]];
const LOOKOUT_FLOWERS=[[-5.75,.63,.96,.45,-.24],[-2.40,1.30,1.17,.48,.16],
  [2.35,1.15,1.10,.42,-.31],[4.22,-1.78,.78,.40,.21],[-4.25,-1.55,.93,.49,.14]];
const MAIN_ROUTE=[[-4.3,2.45],[-3.45,1.1],[-2.75,.18],[-2.95,-.82],[-3.1,-1.7]];
const LOOKOUT_ROUTE=[[-7,.65],[-4,.8],[-1.2,-.35],[1.3,0]];
function distanceToRoute(x,z,route){
  let distance=Infinity;
  for(let i=1;i<route.length;i++){
    const a=route[i-1],b=route[i],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));
    distance=Math.min(distance,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
  }
  return distance;
}
function patchValue(x,z,p){
  const dx=x-p[0],dz=z-p[1],c=Math.cos(p[4]),s=Math.sin(p[4]);
  const u=(dx*c+dz*s)/p[2],v=(-dx*s+dz*c)/p[3];
  // Broad unequal edges keep stands connected, with small bays and glades.
  const ripple=.10*Math.sin(x*2.1+z*.74)+.07*Math.sin(z*2.8-x*.63);
  return 1-smooth(.54,1.16,Math.hypot(u,v)+ripple);
}
function maximum(x,z,patches){let value=0;for(const p of patches)value=Math.max(value,patchValue(x,z,p));return value;}

export function createHabitat({kind='main',scale=1,originX=0,originZ=0,radius=0}={}){
  const unit=kind==='satellite'&&radius>0?radius/1.45:scale;
  const woods=kind==='main'?MAIN_WOODS:kind==='lookout'?LOOKOUT_WOODS:
    [[-.67,-.30,.61,.77,-.4],[.56,.40,.63,.70,.25]];
  const flowers=kind==='main'?MAIN_FLOWERS:kind==='lookout'?LOOKOUT_FLOWERS:
    [[-.43,.61,.52,.24,.25],[.64,-.41,.40,.25,-.3]];
  const route=kind==='main'?MAIN_ROUTE:kind==='lookout'?LOOKOUT_ROUTE:[[-.2,-.1],[.9,-.7]];
  function sample(worldX,worldZ,out={}){
    const x=(worldX-originX)/unit,z=(worldZ-originZ)/unit;
    const rawWoods=maximum(x,z,woods),routeDistance=distanceToRoute(x,z,route);
    const corridor=1-smooth(kind==='lookout'?.38:.20,kind==='lookout'?.78:.48,routeDistance);
    const viewing=kind==='lookout'?patchValue(x,z,[1.3,-.42,2.55,1.43,-.12]):
      kind==='main'?patchValue(x,z,[-2.05,1.58,1.13,.72,-.35]):patchValue(x,z,[0,0,.32,.35,0]);
    const clearing=Math.max(corridor,viewing);
    const woodland=rawWoods*(1-clearing);
    const edge=4*rawWoods*(1-rawWoods)*(1-clearing*.75);
    const drift=maximum(x,z,flowers)*(1-clearing*.92)*(1-woodland*.92);
    const folds=.5+.5*Math.sin(x*1.9+Math.sin(z*1.1)*1.8-z*.42);
    out.woodland=woodland;out.clearing=clearing;out.woodlandEdge=edge;
    out.grass=clamp((.64*edge+.47*drift+.34*woodland+.24*folds*(1-woodland))*(1-clearing*.98));
    out.fern=clamp((.82*woodland+.26*edge)*(1-clearing));
    out.clover=clamp((.78*drift+.37*edge+.11*woodland)*(1-clearing*.98));
    out.shrub=clamp((.80*woodland+.44*edge)*(1-clearing));
    out.flowers=clamp(drift);
    out.stone=clamp((.60*edge+.30*woodland)*(.45+.55*folds)*(1-clearing*.94));
    return out;
  }
  return {kind,sample,woodlandPatches:woods.map(p=>({x:originX+p[0]*unit,z:originZ+p[1]*unit,
    rx:p[2]*unit,rz:p[3]*unit,angle:p[4]}))};
}
