import * as THREE from 'three';
import { COLORS, glowSprite, clamp, easeOut, invLerp, smooth } from '../util.js';
import { createCoverage, createSkyLink } from './coverage.js';

// Nodos auxiliares: repiten la señal del nodo principal y cierran las zonas de sombra
// formando una malla WiFi. Posición en el suelo (x, z) y radio de su cúpula.
export const AUX_NODES = [
  { x: -64, z: 48, r: 32 },
  { x: 66, z: -46, r: 32 },
  { x: -42, z: -68, r: 30 },
];

// enlaces de la malla: -1 es el nodo principal
const LINKS = [
  [-1, 0],
  [-1, 1],
  [-1, 2],
  [0, 2],
  [2, 1],
];

const MAST_H = 6.5;

const M = {
  shell: new THREE.MeshStandardMaterial({ color: '#d6cab0', roughness: 0.55, metalness: 0.05, fog: false }),
  panel: new THREE.MeshStandardMaterial({ color: '#1a1f29', roughness: 0.6, metalness: 0.4, fog: false }),
  pole: new THREE.MeshStandardMaterial({ color: '#2a2f38', roughness: 0.5, metalness: 0.6, fog: false }),
  stripe: new THREE.MeshStandardMaterial({ color: '#FF6B1A', emissive: '#FF6B1A', emissiveIntensity: 0.5, fog: false }),
};

/** caja técnica con mástil en trípode y tres antenas, como el módulo de la foto (escala ×1,6) */
function auxModel() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.4, 1.5), M.shell);
  box.position.y = 0.7;
  g.add(box);
  const front = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.04), M.panel);
  front.position.set(0.2, 1.0, 0.77);
  g.add(front);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.06, 1.52), M.stripe);
  stripe.position.y = 0.55;
  g.add(stripe);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, MAST_H, 8), M.pole);
  pole.position.set(1.4, MAST_H / 2, -0.4);
  g.add(pole);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 6), M.pole);
    leg.position.set(1.4 + Math.cos(a) * 0.5, 1.0, -0.4 + Math.sin(a) * 0.5);
    leg.lookAt(1.4, 2.2, -0.4);
    leg.rotateX(Math.PI / 2);
    g.add(leg);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), M.panel);
    ant.position.set(1.4 + (k - 1) * 0.28, MAST_H + 0.5, -0.4);
    g.add(ant);
  }
  return g;
}

export function createMesh() {
  const group = new THREE.Group();
  const nodes = AUX_NODES.map(({ x, z, r }) => {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = Math.atan2(-x, -z); // la cara frontal mira al nodo principal
    const model = auxModel();
    root.add(model);
    const beacon = glowSprite(COLORS.signal, 4, 0);
    beacon.material.fog = false;
    beacon.position.set(0, MAST_H + 1.4, 0);
    root.add(beacon);
    const top = new THREE.Object3D();
    top.position.set(0, MAST_H + 1.1, 0);
    root.add(top);
    const dome = createCoverage();
    dome.group.position.set(x, 0, z);
    group.add(root, dome.group);
    return { root, model, beacon, top, dome, r };
  });
  const links = LINKS.map(([a, b]) => {
    const l = createSkyLink({ width: 0.9, fade: false, skySize: 2.2, footSize: 2.2 });
    group.add(l.group);
    return { a, b, link: l };
  });

  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const state = { domes: AUX_NODES.map(() => -1) }; // radio actual de cada cúpula (-1 apagada)

  return {
    group,
    state,
    /** anclaje del HUD: lo alto del primer nodo auxiliar */
    anchor: nodes[0].top,
    /** p: progreso de la malla 0 → 1; mainTop: punto alto del nodo principal (mundo) */
    update(t, p, opacity, mainTop, camera) {
      group.visible = opacity > 0.001 && p > 0.001;
      nodes.forEach((n, k) => {
        const d = k * 0.08;
        const up = easeOut(invLerp(0.02 + d, 0.2 + d, p));
        n.root.visible = up > 0.001 && group.visible;
        n.model.scale.set(1, Math.max(0.001, up), 1);
        n.beacon.material.opacity = up * opacity * (Math.sin(t * 6 + k * 2) > 0 ? 1 : 0.3);
        const grow = easeOut(invLerp(0.34 + d, 0.7 + d, p));
        const r = n.r * grow;
        n.dome.update(t, r, smooth(0.32 + d, 0.42 + d, p) * opacity * 0.85);
        state.domes[k] = grow > 0.01 && opacity > 0.01 ? r : -1;
      });
      links.forEach(({ a, b, link }, k) => {
        const end = (i, v) => (i < 0 ? v.copy(mainTop) : nodes[i].top.getWorldPosition(v));
        end(a, from);
        end(b, to);
        const on = smooth(0.18 + k * 0.05, 0.32 + k * 0.05, p);
        link.update(t, from, to, camera, clamp(on * opacity));
      });
    },
  };
}
