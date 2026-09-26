import * as THREE from 'three';
import { HUD_LABELS } from '../content.js';

/** Etiqueta HTML con línea guía, anclada a un punto 3D proyectado a pantalla */
export function createHud(stage) {
  const root = document.getElementById('hud');
  const label = document.getElementById('hud-label');
  const line = document.getElementById('hud-line');
  const dot = document.getElementById('hud-dot');
  const ring = document.getElementById('hud-ring');
  const { anchors } = stage.node;
  const targets = [anchors.panels, anchors.battery, anchors.mast, anchors.link, stage.coverage.anchor, anchors.box];

  const v = new THREE.Vector3();
  let current = -1;
  let lx = null;
  let ly = null;

  function setLabel(i) {
    const d = HUD_LABELS[i];
    label.innerHTML = `<b>${d.k}</b>${d.v}`;
  }

  return {
    update(visible, step) {
      root.classList.toggle('is-on', visible);
      if (!visible) {
        lx = null;
        return;
      }
      if (step !== current) {
        current = step;
        setLabel(step);
        lx = null;
      }
      const cam = stage.camera;
      const { width, height } = stage.size;
      targets[step].getWorldPosition(v);
      v.project(cam);
      if (v.z > 1) return;
      // el desplazamiento de encuadre (setViewOffset) ya está en la matriz de proyección
      const x = (v.x * 0.5 + 0.5) * width;
      const y = (-v.y * 0.5 + 0.5) * height;
      const mobile = width < 700;
      const right = x < width * 0.72;
      const ox = (mobile ? 36 : 70) * (right ? 1 : -1);
      const oy = mobile ? -54 : -80;
      const lw = label.offsetWidth;
      const lh = label.offsetHeight;
      let tx = right ? x + ox : x + ox - lw;
      let ty = y + oy - lh;
      tx = Math.min(width - lw - 12, Math.max(12, tx));
      ty = Math.min(height - lh - 12, Math.max(64, ty));
      // suavizado de la etiqueta
      lx = lx === null ? tx : lx + (tx - lx) * 0.25;
      ly = ly === null ? ty : ly + (ty - ly) * 0.25;
      label.style.transform = `translate3d(${lx.toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
      const ex = right ? lx : lx + lw;
      const ey = ly + lh;
      line.setAttribute('x1', x.toFixed(1));
      line.setAttribute('y1', y.toFixed(1));
      line.setAttribute('x2', ex.toFixed(1));
      line.setAttribute('y2', ey.toFixed(1));
      dot.setAttribute('cx', x.toFixed(1));
      dot.setAttribute('cy', y.toFixed(1));
      ring.setAttribute('cx', x.toFixed(1));
      ring.setAttribute('cy', y.toFixed(1));
    },
  };
}
