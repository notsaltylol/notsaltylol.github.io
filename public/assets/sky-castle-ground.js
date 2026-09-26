/** Index an XZ terrain mesh for exact barycentric ground-height queries.
 * A procedural height function can differ from its rendered triangles between
 * vertices. Roads and paving need the latter to avoid alternating buried faces.
 */
export function createGroundSampler(geometry,{cellSize=1}={}) {
  if(!Number.isFinite(cellSize)||cellSize<=0)throw new RangeError('Ground cell size must be positive');
  const p=geometry.attributes.position,index=geometry.index,cells=new Map();
  const count=index?index.count:p.count;
  for(let i=0;i<count;i+=3){
    const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1,c=index?index.getX(i+2):i+2;
    const ax=p.getX(a),az=p.getZ(a),bx=p.getX(b),bz=p.getZ(b),cx=p.getX(c),cz=p.getZ(c);
    const e1x=bx-ax,e1z=bz-az,e2x=cx-ax,e2z=cz-az,det=e1x*e2z-e1z*e2x;
    if(Math.abs(det)<1e-12)continue;
    const t={ax,az,ay:p.getY(a),e1x,e1z,e2x,e2z,dy1:p.getY(b)-p.getY(a),dy2:p.getY(c)-p.getY(a),inverse:1/det};
    const x0=Math.floor(Math.min(ax,bx,cx)/cellSize),x1=Math.floor(Math.max(ax,bx,cx)/cellSize);
    const z0=Math.floor(Math.min(az,bz,cz)/cellSize),z1=Math.floor(Math.max(az,bz,cz)/cellSize);
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
      const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(t);
    }
  }
  return function groundHeight(x,z){
    let height=-Infinity;
    for(const t of cells.get(`${Math.floor(x/cellSize)},${Math.floor(z/cellSize)}`)||[]){
      const dx=x-t.ax,dz=z-t.az,u=(dx*t.e2z-dz*t.e2x)*t.inverse,v=(t.e1x*dz-t.e1z*dx)*t.inverse;
      if(u>=-1e-8&&v>=-1e-8&&u+v<=1.00000001)height=Math.max(height,t.ay+u*t.dy1+v*t.dy2);
    }
    return height;
  };
}
