// Datos que usa la parte interactiva. Los textos largos viven en index.html
// (así la web se lee y se indexa sin JavaScript).

// Etiquetas técnicas que acompañan a cada paso del despliegue (HUD sobre el 3D)
export const HUD_LABELS = [
  { k: 'Campo FV', v: '4 × 400 W · MPPT 60 A' },
  { k: 'Batería LiFePO4', v: '24 V · inversor 1,6 kVA' },
  { k: 'Mástil telescópico', v: '12 m · viento máx. 50 km/h' },
  { k: 'Starlink HP', v: 'latencia < 50 ms · > 100 Mbps' },
  { k: 'WiFi 6 · 2 AP sectoriales', v: 'señal ≥ −65 dBm a 200 m' },
  { k: 'Caja técnica IP54', v: 'estado: operativo' },
];

// Tramos del despliegue dentro de la sección fijada del nodo (0 → 1)
export const NODE_STEPS = [0.26, 0.405, 0.555, 0.68, 0.845]; // límites entre los 6 pasos

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
