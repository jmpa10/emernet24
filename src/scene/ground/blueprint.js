import * as THREE from 'three';
import { COLORS, clamp, easeOut } from '../util.js';

/**
 * Genera las aristas del nodo (en su estado actual) como una sola geometría,
 * relativa a `root`. Se llama con el nodo ya desplegado.
 */
export function bakeEdges(root, solids) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const out = [];
  const v = new THREE.Vector3();
  const m = new THREE.Matrix4();
  for (const mesh of solids) {
    if (!mesh.visible) continue;
    const edges = new THREE.EdgesGeometry(mesh.geometry, 28);
    m.multiplyMatrices(inv, mesh.matrixWorld);
    const p = edges.attributes.position;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      out.push(v.x, v.y, v.z);
    }
    edges.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  return g;
}

export function createBlueprint(edgeGeo, { quality }) {
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: COLORS.blue, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const hero = new THREE.LineSegments(edgeGeo, mat);
  group.add(hero);

  // retícula de réplicas alrededor del original
  const cols = quality === 'high' ? 9 : 7;
  const rows = quality === 'high' ? 7 : 7;
  const gap = 26;
  const replicas = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const x = (i - (cols - 1) / 2) * gap;
      const z = (j - (rows - 1) / 2) * gap;
      if (x === 0 && z === 0) continue;
      const m = mat.clone();
      const r = new THREE.LineSegments(edgeGeo, m);
      r.position.set(x, 0, z);
      r.rotation.y = 0;
      group.add(r);
      replicas.push({ obj: r, mat: m, d: Math.hypot(x, z) });
    }
  }
  const maxD = Math.max(...replicas.map((r) => r.d));

  // marcas de replanteo (cruces) en cada emplazamiento
  const crossPts = [];
  for (const r of replicas) {
    const { x, z } = r.obj.position;
    crossPts.push(x - 2, 0.02, z, x + 2, 0.02, z, x, 0.02, z - 2, x, 0.02, z + 2);
  }
  const crossGeo = new THREE.BufferGeometry();
  crossGeo.setAttribute('position', new THREE.Float32BufferAttribute(crossPts, 3));
  const crossMat = new THREE.LineBasicMaterial({ color: COLORS.signal, transparent: true, opacity: 0, depthWrite: false });
  group.add(new THREE.LineSegments(crossGeo, crossMat));

  return {
    group,
    /** show: el original en líneas; spread: cuántas réplicas aparecen */
    update(show, spread) {
      mat.opacity = show * 0.95;
      hero.visible = show > 0.001;
      crossMat.opacity = clamp(spread * 2) * 0.55;
      for (const r of replicas) {
        const k = easeOut(clamp((spread * 1.25 - r.d / maxD) * 3));
        r.obj.visible = k > 0.001;
        r.mat.opacity = k * 0.75 * (1 - (r.d / maxD) * 0.45);
        r.obj.scale.setScalar(0.6 + 0.4 * k);
      }
    },
  };
}
