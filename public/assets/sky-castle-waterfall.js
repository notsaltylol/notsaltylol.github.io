/**
 * A continuous ballistic lip, a pleated falling veil, and physical spray.
 * The surface and droplets share one geometry/material/draw. Motion is applied
 * by the water shader; no billboard or unrelated floating cloud is used here.
 */
export function buildWaterfallGeometry(THREE, {lip, width, scale=1, verticalScale=scale}={}) {
  if(!lip || !(width>0) || !(scale>0) || !(verticalScale>0)) throw new RangeError('Invalid waterfall dimensions');
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const length=7.25*verticalScale;
  const columns=Math.ceil(Math.max(48,Math.min(144,width*14))/12)*12;
  const rows=Math.round(Math.max(112,Math.min(320,length*4)));
  const p=[],uv=[],edges=[],particles=[],indices=[];
  const point=(u,t)=>{
    const down=length*t*t;
    const develop=smooth(.035,.20,t);
    const spread=1-.09*smooth(.16,.43,t)+.27*smooth(.49,.98,t);
    // Unequal falling tongues end at different heights. They share a single
    // joined lip, then fan into an aerated irregular lower contour.
    const tail=.89+.075*Math.sin(u*11+.6)+.035*Math.sin(u*29-1.2);
    const actualDown=down*(1+(tail-1)*smooth(.42,1,t));
    const shear=(.08*Math.sin(t*4.6)+.022*Math.sin(down*.22+u*3.7))*width*develop*smooth(.16,.46,t);
    const ripple=(.095*Math.sin(down*.63+u*width*1.15)
      +.045*Math.sin(down*1.41-u*width*2.3))*develop;
    const x=lip.x+(u-.5)*width*spread+shear+ripple;
    // Horizontal momentum produces a real lip roll before gravity takes over.
    // All folds face out from the recessed cliff, never through its rock skin.
    const pleat=(.045*width*(.5+.5*Math.sin(u*width*1.7+down*.11))
      +.055*(.5+.5*Math.sin(down*.77-u*width*2.4)))*develop;
    const z=lip.z+width*(.68*t+.040*smooth(0,.16,t))+pleat
      +.035*width*Math.sin(t*Math.PI)*Math.sin(u*8+t*7);
    return [x,lip.y-actualDown,z];
  };
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const t=row/rows,u=col/columns;
    p.push(...point(u,t));uv.push(u,1-t*t);
    edges.push(Math.min(1,Math.min(u,1-u)*12));particles.push(0,0,0);
    if(row<rows&&col<columns){const a=row*(columns+1)+col,b=a+columns+1;indices.push(a,a+1,b,a+1,b+1,b);}
  }
  const surfaceVertexCount=p.length/3,surfaceIndexCount=indices.length;
  let seed=71413;const random=()=>(seed=seed*16807%2147483647)/2147483647;
  const dropletCount=Math.round(Math.min(210,Math.max(30,width*22)));
  // Tiny elongated octahedra disperse from the actual lower flow. The shader
  // moves each drop down its bounded path, fading it at the wrap point.
  const facets=[0,2,4,2,1,4,1,3,4,3,0,4,2,0,5,1,2,5,3,1,5,0,3,5];
  let maximumTravel=0;
  for(let i=0;i<dropletCount;i++){
    const u=.035+random()*.93,t=.57+random()*.34,base=point(u,t);
    const side=(u-.5)*2,opening=smooth(.55,.92,t);
    base[0]+=side*(.035+random()*.07)*width*opening;
    base[2]+=(.05+random()*.13)*width*opening;
    const radius=Math.min(.078,.022+width*.0045)*(.48+random()*.62);
    const tall=radius*(2.2+random()*2.5),phase=random();
    const travel=Math.min(12,1.1+verticalScale*.65)*(0.65+random()*.55);
    maximumTravel=Math.max(maximumTravel,travel);
    const first=p.length/3;
    for(const offset of [[radius,0,0],[-radius,0,0],[0,0,radius],[0,0,-radius],[0,tall,0],[0,-tall,0]]){
      p.push(base[0]+offset[0],base[1]+offset[1],base[2]+offset[2]);
      uv.push(u,1-t*t);edges.push(1);particles.push(phase,travel,1);
    }
    for(const index of facets)indices.push(first+index);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  geometry.setAttribute('waterEdge',new THREE.Float32BufferAttribute(edges,1));
  geometry.setAttribute('waterParticle',new THREE.Float32BufferAttribute(particles,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();
  geometry.boundingBox.min.y-=maximumTravel;
  geometry.boundingBox.min.x-=.24;geometry.boundingBox.max.x+=.24;
  geometry.boundingBox.max.z+=.85;
  geometry.boundingSphere=new THREE.Sphere();geometry.boundingBox.getBoundingSphere(geometry.boundingSphere);
  geometry.userData.waterfall={rows,columns,surfaceVertexCount,surfaceIndexCount,dropletCount,
    triangles:indices.length/3,lipWidth:width,length,maximumTravel};
  return geometry;
}
