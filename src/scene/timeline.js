import * as THREE from 'three';
import { samplePath, smooth, bump, invLerp, clamp, easeOut } from './util.js';
import { NODE_STEPS } from '../content.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Cámara en órbita (story 0 → 0.72)
const ORBIT_KEYS = [
  { s: 0, pos: V(0, 11.5, 13.2), target: V(0, 10.75, 0) },
  { s: 0.38, pos: V(0, 11.4, 9), target: V(0, 10.2, -3) },
  { s: 0.72, pos: V(0, 10.2, 0.45), target: V(0, 9.9, -0.3) },
];

export const SWITCH = 0.72; // cambio de escena órbita → terreno

/** Claves del terreno. Algunas dependen de la longitud real de las secciones fijadas. */
function groundKeys(pe) {
  const n = (p) => 2 + p * pe[2]; // progreso fijado del nodo → story
  return [
    { s: SWITCH, pos: V(0, 200, 70), target: V(0, 0, 0) },
    { s: 1.0, pos: V(54, 48, 92), target: V(0, 6, 0) },
    { s: 1 + pe[1], pos: V(40, 30, 68), target: V(0, 5, 0) },
    { s: 2.0, pos: V(15, 5.5, 18), target: V(-2, 1.6, 0) },
    { s: n(0.1), pos: V(9.5, 3.8, 11), target: V(0, 1.7, 0) },
    { s: n(0.22), pos: V(7.8, 7.4, 8.8), target: V(0, 2.4, 0) },
    { s: n(0.36), pos: V(3.4, 1.9, 6.3), target: V(0.6, 1.25, 0.8) },
    { s: n(0.5), pos: V(15.5, 4.2, 17.5), target: V(0.5, 6.4, 0) },
    { s: n(0.64), pos: V(8.4, 2.8, 11.8), target: V(0.9, 10.2, -1) },
    { s: n(0.8), pos: V(96, 62, 120), target: V(0, 2, 0) },
    { s: n(0.97), pos: V(78, 38, 98), target: V(0, 3, 0) },
    { s: 3.0, pos: V(64, 58, 64), target: V(0, 0, 0) },
    { s: 4.0, pos: V(10, 70, 58), target: V(0, 0, 0) },
    { s: 4 + pe[4], pos: V(0, 150, 40), target: V(0, 0, 8) },
    { s: 5.0, pos: V(0, 175, 30), target: V(0, 0, 8) },
  ];
}

export function createTimeline(stage, scroll, { reduced }) {
  const { camera } = stage;
  let keys = groundKeys(pe());
  window.addEventListener('resize', () => (keys = groundKeys(pe())));

  function pe() {
    return [0, 1, 2, 3, 4].map((i) => scroll.pinEnd(i));
  }

  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const goalPos = new THREE.Vector3();
  const goalTarget = new THREE.Vector3();
  let first = true;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  const satPos = new THREE.Vector3();
  const spainPt = new THREE.Vector3(0, 10.02, 0);
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const flash = document.getElementById('stage-flash');

  const out = { scene: 'orbit', step: 0, nodeP: 0, fail: 0, hud: false };
  let intro = 1; // 0 → 1: acercamiento inicial de la cámara tras el loader

  /** story con el movimiento reducido: cada sección se muestra en su estado final */
  function effectiveStory(S) {
    if (!reduced) return S;
    const p = pe();
    if (S < 1) return 0;
    if (S < 2) return 1 + p[1];
    if (S < 3) return 2 + p[2] * 0.97;
    if (S < 4) return 3;
    if (S < 5) return 4 + p[4];
    return 5;
  }

  function update(t, dt, rawStory) {
    const S = effectiveStory(rawStory);
    const { width, height, dpr } = stage.size;
    const desktop = width > 900;
    const nodeP = clamp(invLerp(2, 2 + scroll.pinEnd(2), S));
    const probP = clamp(invLerp(1, 1 + scroll.pinEnd(1), S));
    out.nodeP = nodeP;

    // ── cámara
    const inOrbit = S < SWITCH;
    out.scene = inOrbit ? 'orbit' : 'ground';
    if (inOrbit) {
      samplePath(ORBIT_KEYS, S, goalPos, goalTarget);
      const k = 1 - intro;
      goalPos.z += k * 26;
      goalPos.y += k * 7;
    } else samplePath(keys, S, goalPos, goalTarget);

    mouse.sx += (mouse.x - mouse.sx) * 0.04;
    mouse.sy += (mouse.y - mouse.sy) * 0.04;
    if (!reduced) {
      const dist = goalPos.distanceTo(goalTarget);
      const k = inOrbit ? 0.035 : 0.018;
      goalPos.x += mouse.sx * dist * k;
      goalPos.y -= mouse.sy * dist * k * 0.6;
    }

    // al cruzar el cambio de escena no se amortigua (evita barrido entre mundos)
    const jumped = first || (camera.userData.scene && camera.userData.scene !== out.scene) || reduced;
    const damp = jumped ? 1 : 1 - Math.pow(0.0009, dt);
    camPos.lerp(goalPos, damp);
    camTarget.lerp(goalTarget, damp);
    if (jumped) {
      camPos.copy(goalPos);
      camTarget.copy(goalTarget);
    }
    camera.userData.scene = out.scene;
    first = false;
    camera.position.copy(camPos);
    camera.lookAt(camTarget);

    // encuadre desplazado a la derecha en escritorio (deja sitio al texto)
    const shift = desktop ? smooth(0.85, 1.05, S) * (1 - smooth(2.86, 3.2, S)) * 0.17 : 0;
    const shiftY = !desktop ? smooth(1.7, 2.05, S) * (1 - smooth(2.86, 3.2, S)) * 0.05 : 0;
    if (shift > 0.0005 || shiftY > 0.0005) camera.setViewOffset(width, height, -width * shift, height * shiftY, width, height);
    else if (camera.view) camera.clearViewOffset();

    // ── destello del cambio de escena
    const fl = reduced ? 0 : bump(0.5, SWITCH - 0.015, SWITCH + 0.01, 0.98, S);
    flash.style.opacity = fl.toFixed(3);

    if (inOrbit) {
      // ── escena órbita
      stage.earth.update(t, dpr);
      stage.stars.update(t, dpr);
      stage.earth.group.rotation.y = 0; // España fija arriba
      const narrow = camera.aspect < 0.8;
      satPos.set(narrow ? 1.0 : 2.7, (narrow ? 13.9 : 13.1) + Math.sin(t * 0.6) * 0.08, narrow ? 4.5 : 3.2);
      stage.sat.group.position.copy(satPos);
      stage.sat.group.rotation.set(1.05 + Math.sin(t * 0.3) * 0.06, 0.25 + Math.sin(t * 0.17) * 0.12, -0.55);
      stage.sat.beacon.material.opacity = Math.sin(t * 3.2) > 0.3 ? 1 : 0.15;
      stage.uplink.update(t, tmpA.copy(satPos).add(tmpB.set(0, -0.4, 0)), spainPt, camera, 1 - smooth(0.3, 0.55, S));
      stage.render(stage.orbit);
      out.hud = false;
      return out;
    }

    // ── escena terreno
    const fail = S < 1 ? 0 : smooth(0.08, 0.86, probP);
    out.fail = fail;
    const blue = smooth(3.55, 4.15, S);
    const spread = smooth(4.08, 4 + scroll.pinEnd(4) * 0.9, S);
    const worldFade = 1 - smooth(3.6, 4.05, S);

    // nodo
    const ns = stage.node.state;
    ns.roll = S < 2 ? 0 : invLerp(0, 0.1, nodeP);
    ns.jacks = invLerp(0.08, 0.14, nodeP);
    ns.panels = invLerp(0.12, 0.25, nodeP);
    ns.door = invLerp(0.26, 0.3, nodeP) * (1 - invLerp(0.4, 0.44, nodeP));
    ns.battery = invLerp(0.29, 0.39, nodeP);
    ns.mast = invLerp(0.41, 0.54, nodeP);
    ns.beacons = S > 2 ? worldFade : 0;
    stage.node.apply(t);
    stage.node.root.visible = S > 1.6 && blue < 0.5;

    // enlace Starlink
    const link = invLerp(0.56, 0.64, nodeP) * worldFade;
    stage.node.starlinkObj.getWorldPosition(tmpA);
    tmpB.set(-38, 150, -70);
    stage.skylink.update(t, tmpA, tmpB, camera, link);

    // cúpula
    const domeR = 56 * easeOut(invLerp(0.7, 0.83, nodeP));
    const domeA = invLerp(0.69, 0.74, nodeP) * worldFade;
    stage.coverage.update(t, domeR, domeA);

    // torres y dispositivos
    stage.towers.update(t, fail, worldFade);
    stage.towers.group.visible = worldFade > 0.01;
    const du = stage.devices.uniforms;
    du.uTime.value = t;
    du.uFail.value = fail;
    du.uCover.value = domeA > 0.01 ? domeR : -1;
    du.uOpacity.value = worldFade;
    du.uPixelRatio.value = dpr;
    stage.devices.object.visible = worldFade > 0.01;

    // plano técnico
    stage.floor.uniforms.uBlue.value = blue;
    stage.blueprint.update(blue, spread);

    // paso activo del despliegue
    let step = 0;
    while (step < NODE_STEPS.length && nodeP >= NODE_STEPS[step]) step++;
    out.step = step;
    out.hud = !reduced && S > 2 + 0.1 * scroll.pinEnd(2) && S < 2 + scroll.pinEnd(2) * 0.995;

    stage.render(stage.ground);
    return out;
  }

  return {
    update,
    out,
    setIntro(k) {
      intro = k;
    },
  };
}
