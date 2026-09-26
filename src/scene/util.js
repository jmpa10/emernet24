import * as THREE from 'three';

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a));
export const smooth = (a, b, v) => {
  const t = invLerp(a, b, v);
  return t * t * (3 - 2 * t);
};
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** sube en [a,b], se mantiene, baja en [c,d] */
export const bump = (a, b, c, d, v) => smooth(a, b, v) * (1 - smooth(c, d, v));

export const COLORS = {
  bg: new THREE.Color('#05080F'),
  ink: new THREE.Color('#F2F4F8'),
  signal: new THREE.Color('#FF6B1A'),
  red: new THREE.Color('#E3262F'),
  blue: new THREE.Color('#3FA9FF'),
  steel: new THREE.Color('#8A93A6'),
};

let panelTex = null;
/** Textura de células fotovoltaicas (compartida por satélite y remolque) */
export function solarTexture() {
  if (panelTex) return panelTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#0b1830';
  g.fillRect(0, 0, 256, 256);
  const n = 6;
  const s = 256 / n;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const grad = g.createLinearGradient(i * s, j * s, (i + 1) * s, (j + 1) * s);
      grad.addColorStop(0, '#1b3a6b');
      grad.addColorStop(1, '#0e2144');
      g.fillStyle = grad;
      g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    }
  }
  g.strokeStyle = 'rgba(160,190,230,0.35)';
  g.lineWidth = 1;
  for (let i = 1; i < n * 2; i++) {
    g.beginPath();
    g.moveTo(0, (i * s) / 2);
    g.lineTo(256, (i * s) / 2);
    g.stroke();
  }
  panelTex = new THREE.CanvasTexture(c);
  panelTex.colorSpace = THREE.SRGBColorSpace;
  panelTex.anisotropy = 4;
  return panelTex;
}

/** Sprite radial suave para brillos aditivos */
let glowTex = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function glowSprite(color, size = 1, opacity = 1) {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

/** Interpolación Catmull-Rom sobre claves {s, pos, target} no equiespaciadas */
export function samplePath(keys, s, outPos, outTarget) {
  if (s <= keys[0].s) {
    outPos.copy(keys[0].pos);
    outTarget.copy(keys[0].target);
    return;
  }
  const last = keys[keys.length - 1];
  if (s >= last.s) {
    outPos.copy(last.pos);
    outTarget.copy(last.target);
    return;
  }
  let i = 0;
  while (i < keys.length - 2 && s > keys[i + 1].s) i++;
  const k0 = keys[Math.max(0, i - 1)];
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k3 = keys[Math.min(keys.length - 1, i + 2)];
  const t = easeInOut(invLerp(k1.s, k2.s, s));
  hermite(k0.pos, k1.pos, k2.pos, k3.pos, t, outPos);
  hermite(k0.target, k1.target, k2.target, k3.target, t, outTarget);
}

function hermite(p0, p1, p2, p3, t, out) {
  // Catmull-Rom con tangentes atenuadas (0.35) para evitar sobrepasos
  const k = 0.35;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  for (const a of ['x', 'y', 'z']) {
    const m1 = (p2[a] - p0[a]) * k;
    const m2 = (p3[a] - p1[a]) * k;
    out[a] = h00 * p1[a] + h10 * m1 + h01 * p2[a] + h11 * m2;
  }
}
