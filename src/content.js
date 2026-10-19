// Datos que usa la parte interactiva. Los textos largos viven en index.html
// (así la web se lee y se indexa sin JavaScript).

// Etiquetas técnicas que acompañan a cada paso del despliegue (HUD sobre el 3D)
export const HUD_LABELS = [
  { k: 'Campo FV', v: '3 × 600 W · MPPT 60 A' },
  { k: 'Batería LiFePO4', v: '24 V · inversor 1,6 kVA' },
  { k: 'Mástil telescópico', v: '12 m · viento máx. 50 km/h' },
  { k: 'Starlink HP · 2 antenas', v: '2 × 400 Mbps = 800 Mbps' },
  { k: 'WiFi 6 · 3 AP sectoriales 360°', v: '> 1.000 (aprox. 3.000) dispositivos simultáneos' },
  { k: 'Caja técnica IP54', v: 'estado: operativo' },
  { k: 'Nodo auxiliar · WiFi mesh', v: 'repite la señal del nodo principal' },
];

// Tramos del despliegue dentro de la sección fijada del nodo (0 → 1). El nodo principal se
// despliega hasta MESH_START; el último tramo es la malla de nodos auxiliares.
export const MESH_START = 0.86;
const DEPLOY_STEPS = [0.26, 0.405, 0.555, 0.68, 0.845]; // límites entre los 6 pasos del nodo principal
export const NODE_STEPS = [...DEPLOY_STEPS.map((b) => b * MESH_START), MESH_START]; // límites entre los 7 pasos

/** progreso del nodo (0 → 1) → despliegue del nodo principal (0 → 1) y de la malla (0 → 1) */
export const deployOf = (p) => Math.min(1, p / MESH_START);
export const meshOf = (p) => Math.min(1, Math.max(0, (p - MESH_START) / (1 - MESH_START)));

// Pausas del scroll: cada paso ocupa 1/7 del recorrido fijado; el despliegue avanza durante
// la primera parte (MOVE) y el resto se queda "pillado" para leer el paso con calma.
const MOVE = 0.55;
export function holdProgress(raw) {
  const n = NODE_STEPS.length + 1;
  const bounds = [0, ...NODE_STEPS, 1];
  const r = Math.min(Math.max(raw, 0), 1) * n;
  const i = Math.min(n - 1, Math.floor(r));
  const t = Math.min(1, (r - i) / MOVE);
  const e = t * t * (3 - 2 * t);
  const end = i === n - 1 ? bounds[n] : bounds[i + 1] - 0.0005;
  return bounds[i] + (end - bounds[i]) * e;
}

// Tramo del despliegue (deployOf) en el que la cúpula WiFi crece y devuelve la cobertura
export const DOME_GROW = [0.7, 0.83];

// Caída de la red en la sección del problema (tramo del progreso fijado 0 → 1).
// En móvil empieza más tarde: primero se lee el texto y después la escena ocupa la pantalla.
export const SIGNAL_LOSS = { wide: [0.08, 0.86], narrow: [0.36, 0.94] };

// Centros del proyecto. Coordenadas aproximadas por municipio.
// PENDIENTE DE CONFIRMAR: IES Gregorio Prieto (se asume Valdepeñas) e IES Juan Bosco
// (se asume Alcázar de San Juan).
export const CENTERS = [
  { id: 'gp', name: 'IES Gregorio Prieto', lat: 38.762, lon: -3.385, lead: true },
  { id: 'cat', name: 'CIPFP Catarroja', lat: 39.403, lon: -0.403 },
  { id: 'can', name: 'IES Estelas de Cantabria', lat: 43.235, lon: -4.06 },
  { id: 'mal', name: 'IES Martín de Aldehuela', lat: 36.72, lon: -4.42 },
  { id: 'jb', name: 'IES Juan Bosco', lat: 39.39, lon: -3.21 },
];
