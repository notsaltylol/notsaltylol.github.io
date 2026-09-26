/**
 * Allocation-free detail measurements after prepare(). A perspective camera's
 * visible width grows with view-space depth; a focus-plane width cannot decide
 * the detail of every object in a large landscape. Bounds use their near face
 * so plants at the front of a chunk retain detail until they become small.
 */
export function createDetailView(THREE) {
  const frustum=new THREE.Frustum(),projection=new THREE.Matrix4();
  const sphere=new THREE.Sphere(),box=new THREE.Box3();
  let camera=null,perspective=false,fixedWidth=Infinity,widthPerDepth=0;
  let near=.001,view=null;
  function prepare(nextCamera,fallbackWidth=Infinity) {
    camera=nextCamera||null;perspective=Boolean(camera?.isPerspectiveCamera);
    fixedWidth=Number.isFinite(fallbackWidth)&&fallbackWidth>0?fallbackWidth:Infinity;
    if(!camera)return;
    camera.updateMatrixWorld();
    projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);view=camera.matrixWorldInverse.elements;
    near=Math.max(.001,camera.near||.001);
    if(perspective)widthPerDepth=2/Math.abs(camera.projectionMatrix.elements[0]);
    else if(camera.isOrthographicCamera)fixedWidth=Math.abs(camera.right-camera.left)/camera.zoom;
  }
  const depthAt=p=>-(view[2]*p.x+view[6]*p.y+view[10]*p.z+view[14]);
  function widthAtPoint(point) {
    if(!perspective)return fixedWidth;
    const depth=depthAt(point);
    return depth<=0?Infinity:Math.max(near,depth)*widthPerDepth;
  }
  function sphereFrom(local,matrixWorld) {
    sphere.copy(local);if(matrixWorld)sphere.applyMatrix4(matrixWorld);return sphere;
  }
  function sphereWidth(local,matrixWorld=null) {
    if(!perspective)return fixedWidth;
    sphereFrom(local,matrixWorld);
    const depth=depthAt(sphere.center);
    return depth+sphere.radius<=0?Infinity:Math.max(near,depth-sphere.radius)*widthPerDepth;
  }
  function sphereVisible(local,matrixWorld=null) {
    return !camera||frustum.intersectsSphere(sphereFrom(local,matrixWorld));
  }
  function boxFrom(local,matrixWorld) {
    box.copy(local);if(matrixWorld)box.applyMatrix4(matrixWorld);return box;
  }
  function boxWidth(local,matrixWorld=null) {
    if(!perspective)return fixedWidth;
    boxFrom(local,matrixWorld);if(box.isEmpty())return Infinity;
    // Project the AABB half extents onto the view axis without allocating its
    // eight corners. Transformed groups are bounded conservatively in world space.
    const x=(box.min.x+box.max.x)*.5,y=(box.min.y+box.max.y)*.5,z=(box.min.z+box.max.z)*.5;
    const depth=-(view[2]*x+view[6]*y+view[10]*z+view[14]);
    const radius=(Math.abs(view[2])*(box.max.x-box.min.x)+Math.abs(view[6])*(box.max.y-box.min.y)+Math.abs(view[10])*(box.max.z-box.min.z))*.5;
    return depth+radius<=0?Infinity:Math.max(near,depth-radius)*widthPerDepth;
  }
  function boxVisible(local,matrixWorld=null) {
    return !camera||frustum.intersectsBox(boxFrom(local,matrixWorld));
  }
  function meshBounds(mesh) {
    // Instanced bounds include every instance. The geometry bound alone would
    // incorrectly put an entire plant patch at its untransformed local origin.
    if(mesh.isInstancedMesh){if(!mesh.boundingSphere)mesh.computeBoundingSphere();return mesh.boundingSphere;}
    if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();return mesh.geometry.boundingSphere;
  }
  const meshWidth=mesh=>sphereWidth(meshBounds(mesh),mesh.matrixWorld);
  const meshVisible=mesh=>sphereVisible(meshBounds(mesh),mesh.matrixWorld);
  return {prepare,widthAtPoint,sphereWidth,sphereVisible,boxWidth,boxVisible,meshWidth,meshVisible};
}
