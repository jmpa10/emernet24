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
  shell: new THREE.MeshStandardMaterial({ color: '#1b1e24', roughness: 0.7, metalness: 0.2, fog: false }),
  edge: new THREE.MeshStandardMaterial({ color: '#b7bec9', roughness: 0.4, metalness: 0.8, fog: false }),
  pole: new THREE.MeshStandardMaterial({ color: '#a9b1bc', roughness: 0.35, metalness: 0.85, fog: false }),
  white: new THREE.MeshStandardMaterial({ color: '#eef0f3', roughness: 0.5, metalness: 0.05, fog: false }),
  battery: new THREE.MeshStandardMaterial({ color: '#2f6fe0', emissive: '#2f6fe0', emissiveIntensity: 0.35, fog: false }),
  solar: new THREE.MeshStandardMaterial({ color: '#1b3a6b', roughness: 0.3, metalness: 0.5, emissive: '#0a2a5a', emissiveIntensity: 0.3, fog: false }),
};

const part = (geo, mat, x, y, z) => {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
};

/** como el módulo de la foto (escala ×1,6): caja técnica negra con cantoneras, placa solar
 *  inclinada encima y mástil al lado con antena parabólica arriba y antena sectorial */
function auxModel() {
  const g = new THREE.Group();
  const S = 1.3; // lado de la caja
  g.add(part(new THREE.BoxGeometry(S, S, S), M.shell, 0, S / 2, 0));
  // cantoneras de aluminio
  for (const x of [-S / 2, S / 2]) for (const z of [-S / 2, S / 2]) g.add(part(new THREE.BoxGeometry(0.05, S + 0.02, 0.05), M.edge, x, S / 2, z));
  for (const y of [0.02, S]) for (const z of [-S / 2, S / 2]) g.add(part(new THREE.BoxGeometry(S + 0.04, 0.04, 0.05), M.edge, 0, y, z));
  // frente abierto: batería azul visible
  g.add(part(new THREE.BoxGeometry(0.8, 0.38, 0.04), M.battery, 0, 0.3, S / 2 + 0.01));
  // placa solar inclinada sobre la caja
  const panel = part(new THREE.BoxGeometry(S + 0.1, 0.04, S * 0.9), M.solar, 0, S + 0.22, 0);
  panel.rotation.x = -0.32;
  g.add(panel);
  // mástil galvanizado junto a la caja
  const px = S / 2 + 0.22;
  g.add(part(new THREE.CylinderGeometry(0.06, 0.07, MAST_H, 10), M.pole, px, MAST_H / 2, 0));
  // antena sectorial a media altura
  g.add(part(new THREE.BoxGeometry(0.16, 0.9, 0.1), M.white, px + 0.14, MAST_H * 0.62, 0));
  // antena parabólica arriba, orientada hacia el nodo principal (+Z local)
  const dish = part(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 20), M.white, px - 0.12, MAST_H - 0.25, 0.2);
  dish.rotation.x = Math.PI / 2;
  g.add(dish);
  return g;
}

export function createMesh() {
  const group = new THREE.Group();
  const nodes = AUX_NODES.map(({ x, z, r }) => {
    const root = new THREE.Group();
    root.position.set(x, 0, z);
    root.rotation.y = Math.atan2(-x, -z); // la cara frontal y la parabólica miran al nodo principal
    const model = auxModel();
    root.add(model);
    const beacon = glowSprite(COLORS.signal, 4, 0);
    beacon.material.fog = false;
    beacon.position.set(0.87, MAST_H + 0.3, 0);
    root.add(beacon);
    const top = new THREE.Object3D();
    top.position.set(0.87, MAST_H - 0.25, 0.2); // la parabólica: allí llega el enlace de la malla
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
