/**
 * Small stylized travelers: feet at local y=0, looking toward local -Z.
 * Static anatomy is batched by shared material; the closed cape is the only
 * moving mesh. No facial marks or separate details below the readable scale.
 */
export function buildTraveler(THREE, materials, { seed = 1, companion = false } = {}) {
  if(!Number.isFinite(seed))throw new RangeError('Traveler seed must be finite');
  const group=new THREE.Group();group.name=companion?'cloaked-companion':'cloaked-traveler';
  const buckets=new Map(),up=new THREE.Vector3(0,1,0);
  const phaseOffset=(Math.abs(Math.trunc(seed))*1.61803398875)%6.28318530718;
  const pose=Math.sin(phaseOffset)*.004;
  const skin=materials.stoneLight,cloth=companion?materials.stone:materials.roof;
  const tunic=companion?materials.roof:materials.dark;
  function add(geometry,material,position=[0,0,0],scale=[1,1,1],quaternion=null){
    const mesh=new THREE.Object3D();mesh.position.set(...position);mesh.scale.set(...scale);
    if(quaternion)mesh.quaternion.copy(quaternion);mesh.updateMatrix();
    const transformed=geometry.index?geometry.toNonIndexed():geometry.clone();
    transformed.applyMatrix4(mesh.matrix);geometry.dispose();
    if(!buckets.has(material))buckets.set(material,[]);buckets.get(material).push(transformed);
  }
  function ellipsoid(material,position,scale,segments=10,rows=6){
    add(new THREE.SphereGeometry(1,segments,rows),material,position,scale);
  }
  function limb(material,a,b,r0,r1){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),direction=end.clone().sub(start);
    add(new THREE.CylinderGeometry(r1,r0,direction.length(),8),material,
      start.clone().add(end).multiplyScalar(.5).toArray(),[1,1,1],new THREE.Quaternion().setFromUnitVectors(up,direction.normalize()));
  }
  // Separated feet, slightly bent knees, and a narrow waist keep the silhouette
  // recognizably human even when the figure occupies only a few dozen pixels.
  for(const side of [-1,1]){
    const x=side*.029,z=side*(companion?.014:.005)+pose;
    ellipsoid(materials.dark,[x,.018,z-.014],[.021,.018,.039],8,5);
    const ankle=[x,.034,z],knee=[x+side*.004,.143,z-(side===-1?.010:0)],hip=[side*.027,.272,.004];
    limb(materials.dark,ankle,knee,.014,.017);limb(tunic,knee,hip,.018,.024);
    ellipsoid(tunic,knee,[.018,.020,.018],8,5);
  }
  const torsoPoints=[[0,.25],[.036,.25],[.043,.285],[.041,.335],[.061,.396],[.050,.422],[.022,.436],[0,.436]];
  add(new THREE.LatheGeometry(torsoPoints.map(([r,y])=>new THREE.Vector2(r,y)),12),tunic,[0,0,0],[1,1,.65]);
  limb(skin,[0,.431,0],[0,.473,0],.014,.015);
  // The free arm drops beneath the cloak; the other forearm meets the staff.
  const leftShoulder=[-.052,.406,-.012],leftElbow=[-.070,.346,-.025],leftHand=[-.062,.294,-.031];
  limb(tunic,leftShoulder,leftElbow,.019,.016);limb(tunic,leftElbow,leftHand,.016,.012);
  ellipsoid(tunic,leftShoulder,[.020,.022,.020],8,5);
  ellipsoid(tunic,leftElbow,[.017,.018,.017],8,5);
  ellipsoid(skin,leftHand,[.012,.018,.012],8,5);
  const staffX=companion?.091:.102;
  const rightShoulder=[.052,.404,-.012],rightElbow=[.082,.350,-.030],rightHand=[staffX,.367,-.052];
  limb(tunic,rightShoulder,rightElbow,.019,.015);limb(tunic,rightElbow,rightHand,.015,.011);
  ellipsoid(tunic,rightShoulder,[.020,.022,.020],8,5);
  ellipsoid(tunic,rightElbow,[.017,.017,.017],8,5);
  ellipsoid(skin,rightHand,[.013,.015,.014],8,5);
  // Face and hair are masses, not miniature eyes or other unstable pixel marks.
  ellipsoid(skin,[0,.496,-.001],[.031,.041,.030],12,8);
  add(new THREE.SphereGeometry(1,12,6,0,Math.PI*2,0,1.43),companion?materials.dark:materials.stone,
    [0,.499,.001],[.034,.043,.033]);
  ellipsoid(companion?materials.dark:materials.stone,[0,.488,.019],[.031,.031,.019],10,6);
  ellipsoid(skin,[0,.493,-.031],[.008,.011,.010],6,4);
  if(!companion){
    const hair=new THREE.CatmullRomCurve3([[0,.484,.032],[-.006,.463,.039],[-.012,.451,.045]].map(p=>new THREE.Vector3(...p)));
    add(new THREE.TubeGeometry(hair,4,.006,5,false),materials.stone);
  }
  // A small asymmetrical collar connects the cape to the shoulders.
  add(new THREE.TorusGeometry(.024,.007,5,12,Math.PI*1.75),cloth,[0,.441,-.001],[1,.75,1],
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));
  ellipsoid(materials.gold,[.015,.435,-.020],[.0055,.006,.004],6,4);
  const staffPoints=[[staffX+.004,.004,-.050],[staffX,.18,-.050],[staffX,.367,-.052],
    [staffX+.004,companion?.487:.519,-.047],[staffX+.018,companion?.512:.554,-.055]];
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(staffPoints.map(p=>new THREE.Vector3(...p))),10,.0052,6,false),materials.wood);
  for(const [material,geometries] of buckets){
    const count=geometries.reduce((n,g)=>n+g.attributes.position.count,0),positions=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2);
    let offset=0;
    for(const g of geometries){positions.set(g.attributes.position.array,offset*3);normals.set(g.attributes.normal.array,offset*3);if(g.attributes.uv)uvs.set(g.attributes.uv.array,offset*2);offset+=g.attributes.position.count;g.dispose();}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2));geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);mesh.name='traveler-batched-anatomy';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }
  const columns=24,rows=18,layerVertices=(columns+1)*(rows+1),capePositions=[],capeUvs=[],capeIndices=[];
  for(let layer=0;layer<2;layer++)for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){
    const t=row/rows,u=column/columns,a=(u-.5)*3.40;
    const shoulder=Math.min(1,t/.10),width=.031+shoulder*.042+t*.050,depth=.024+shoulder*.024+t*.030;
    const trailing=companion?.55:1,fold=(Math.sin(a*4.5+t*.7)*.0035+Math.sin(a*8.0-t*.3)*.0012)*(.15+Math.pow(t,.65));
    const radius=width+fold,flow=-.046*t*t*trailing-.017*t*t*t*Math.max(0,-Math.sin(a))*trailing;
    const x=Math.sin(a)*radius+flow;
    const y=.449-(companion?.319:.369)*t+.064*Math.pow(t,4)*Math.max(0,-Math.sin(a))*trailing+.008*Math.sin(a*2)*t*t*t;
    const z=Math.cos(a)*(depth+fold)+.049*t*t*trailing+(layer===0?.001:-.001);
    capePositions.push(x,y,z);capeUvs.push(u,t);
  }
  const index=(layer,row,column)=>layer*layerVertices+row*(columns+1)+column;
  for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
    for(let layer=0;layer<2;layer++){
      const a=index(layer,row,column),b=a+1,c=a+columns+1,d=c+1;
      if(layer===0)capeIndices.push(a,c,b,b,c,d);else capeIndices.push(a,b,c,b,d,c);
    }
  }
  // Close the thin hem and open-front edges with real cloth thickness, keeping
  // shared materials single-sided and avoiding changes to the global palette.
  const boundary=[];
  for(let c=0;c<=columns;c++)boundary.push(index(0,0,c));
  for(let r=1;r<=rows;r++)boundary.push(index(0,r,columns));
  for(let c=columns-1;c>=0;c--)boundary.push(index(0,rows,c));
  for(let r=rows-1;r>0;r--)boundary.push(index(0,r,0));
  for(let i=0;i<boundary.length;i++){
    const a=boundary[i],b=boundary[(i+1)%boundary.length];capeIndices.push(a,b,a+layerVertices,b,b+layerVertices,a+layerVertices);
  }
  const capeGeometry=new THREE.BufferGeometry();capeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(capePositions,3));capeGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(capeUvs,2));capeGeometry.setIndex(capeIndices);capeGeometry.computeVertexNormals();capeGeometry.computeBoundingSphere();
  capeGeometry.boundingSphere.radius+=.006;
  const base=new Float32Array(capeGeometry.attributes.position.array),weights=new Float32Array(base.length/3);
  for(let i=0;i<weights.length;i++){const row=Math.floor((i%layerVertices)/(columns+1));weights[i]=(row/rows)**2;}
  const cape=new THREE.Mesh(capeGeometry,cloth);cape.name='folded-traveler-cape';cape.castShadow=false;cape.receiveShadow=true;group.add(cape);
  // The scene caches its large shadow map. A coarse, static cape proxy retains
  // the draped silhouette without requesting a shadow refresh on every flutter.
  const proxyPositions=[],proxyIndices=[],proxyColumns=8,proxyRows=6,proxyLayer=(proxyColumns+1)*(proxyRows+1);
  for(let layer=0;layer<2;layer++)for(let row=0;row<=proxyRows;row++)for(let column=0;column<=proxyColumns;column++){
    const source=index(layer,row*3,column*3)*3;proxyPositions.push(base[source],base[source+1],base[source+2]);
  }
  for(let layer=0;layer<2;layer++)for(let row=0;row<proxyRows;row++)for(let column=0;column<proxyColumns;column++){
    const a=layer*proxyLayer+row*(proxyColumns+1)+column,b=a+1,c=a+proxyColumns+1,d=c+1;
    if(layer===0)proxyIndices.push(a,c,b,b,c,d);else proxyIndices.push(a,b,c,b,d,c);
  }
  const proxyBoundary=[];
  for(let c=0;c<=proxyColumns;c++)proxyBoundary.push(c);
  for(let r=1;r<=proxyRows;r++)proxyBoundary.push(r*(proxyColumns+1)+proxyColumns);
  for(let c=proxyColumns-1;c>=0;c--)proxyBoundary.push(proxyRows*(proxyColumns+1)+c);
  for(let r=proxyRows-1;r>0;r--)proxyBoundary.push(r*(proxyColumns+1));
  for(let i=0;i<proxyBoundary.length;i++){
    const a=proxyBoundary[i],b=proxyBoundary[(i+1)%proxyBoundary.length];proxyIndices.push(a,b,a+proxyLayer,b,b+proxyLayer,a+proxyLayer);
  }
  const proxyGeometry=new THREE.BufferGeometry();proxyGeometry.setAttribute('position',new THREE.Float32BufferAttribute(proxyPositions,3));proxyGeometry.setIndex(proxyIndices);proxyGeometry.computeVertexNormals();proxyGeometry.computeBoundingSphere();
  const shadowProxy=new THREE.Mesh(proxyGeometry,new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false}));
  shadowProxy.name='static-cape-shadow-proxy';shadowProxy.castShadow=true;group.add(shadowProxy);
  let lastPhase=0;
  function animate(phase){
    const loop=((phase%1)+1)%1;if(loop===lastPhase)return;lastPhase=loop;
    const angle=loop*Math.PI*2,positions=capeGeometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      const side=(i%(columns+1))/columns,offset=phaseOffset+side*.7,w=weights[i];
      positions.setXYZ(i,base[i*3]+(Math.sin(angle+offset)-Math.sin(offset))*.0024*w,
        base[i*3+1],base[i*3+2]+(Math.cos(angle+offset)-Math.cos(offset))*.0016*w);
    }
    positions.needsUpdate=true;capeGeometry.computeVertexNormals();
  }
  const bounds=new THREE.Box3().setFromObject(group);
  const stats={seed,companion,drawCalls:group.children.length,
    triangles:group.children.reduce((sum,mesh)=>sum+(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3,0),
    height:bounds.max.y-bounds.min.y,footY:bounds.min.y,capeTriangles:capeIndices.length/3,
    shadowProxyTriangles:proxyIndices.length/3};
  group.userData.traveler=stats;
  return {group,animate,stats};
}
