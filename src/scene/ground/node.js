import * as THREE from 'three';
import { solarTexture, glowSprite, COLORS, clamp, easeInOut, easeOut, lerp } from '../util.js';

// Nodo EMER-NET 24 (1 unidad = 1 m). Remolque con la lanza hacia +X,
// puerta de la caja técnica en la cara +Z y mástil en la esquina trasera (-Z).

const M = {
  white: new THREE.MeshStandardMaterial({ color: '#e7ebf1', roughness: 0.5, metalness: 0.08 }),
  orange: new THREE.MeshStandardMaterial({ color: '#FF6B1A', roughness: 0.45, metalness: 0.1, emissive: '#FF6B1A', emissiveIntensity: 0.08 }),
  steel: new THREE.MeshStandardMaterial({ color: '#4a5263', roughness: 0.4, metalness: 0.7 }),
  alu: new THREE.MeshStandardMaterial({ color: '#9aa3b0', roughness: 0.45, metalness: 0.75 }),
  dark: new THREE.MeshStandardMaterial({ color: '#161b25', roughness: 0.75, metalness: 0.3 }),
  tire: new THREE.MeshStandardMaterial({ color: '#0c0e12', roughness: 0.92 }),
  rack: new THREE.MeshStandardMaterial({ color: '#0e131c', roughness: 0.6, metalness: 0.4 }),
  red: new THREE.MeshStandardMaterial({ color: '#E3262F', emissive: '#E3262F', emissiveIntensity: 1.4 }),
};

const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};
const cyl = (r, h, mat, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);

/** barra entre dos puntos */
function beam(a, b, size, mat) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.BoxGeometry(size, size, d.length()), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.lookAt(b);
  return m;
}

function decalTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 128);
  g.font = '600 78px "Barlow Condensed", "Barlow", sans-serif';
  g.textBaseline = 'middle';
  g.fillStyle = '#12264A';
  g.fillText('EMER-NET', 8, 66);
  const w = g.measureText('EMER-NET').width;
  g.fillStyle = '#E3262F';
  g.fillText('24', 8 + w + 10, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.85)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function createNode() {
  const root = new THREE.Group(); // se desplaza en la entrada
  const rig = new THREE.Group(); // todo el remolque
  root.add(rig);
  const solids = []; // mallas para el modo plano técnico

  const add = (parent, m) => {
    parent.add(m);
    if (m.isMesh) solids.push(m);
    return m;
  };

  // ───── sombra de contacto
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 3.6),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0.3, 0.012, 0);
  root.add(shadow);

  // ───── chasis
  const chassis = new THREE.Group();
  rig.add(chassis);
  for (const z of [-0.78, 0.78]) add(chassis, box(3.4, 0.1, 0.08, M.steel, 0, 0.6, z));
  for (const x of [-1.5, -0.1, 1.3]) add(chassis, box(0.08, 0.08, 1.6, M.steel, x, 0.6, 0));
  add(chassis, box(3.12, 0.05, 1.74, M.dark, 0, 0.675, 0));
  add(chassis, beam(new THREE.Vector3(1.6, 0.6, 0.76), new THREE.Vector3(3.05, 0.52, 0), 0.08, M.steel));
  add(chassis, beam(new THREE.Vector3(1.6, 0.6, -0.76), new THREE.Vector3(3.05, 0.52, 0), 0.08, M.steel));
  const hitch = add(chassis, cyl(0.07, 0.12, M.alu));
  hitch.position.set(3.12, 0.5, 0);
  const jockey = add(chassis, cyl(0.035, 0.5, M.alu));
  jockey.position.set(2.55, 0.38, 0);
  const jw = add(chassis, cyl(0.09, 0.06, M.tire));
  jw.rotation.x = Math.PI / 2;
  jw.position.set(2.55, 0.1, 0);
  const axle = add(chassis, cyl(0.04, 2.1, M.steel));
  axle.rotation.x = Math.PI / 2;
  axle.position.set(-0.1, 0.34, 0);

  const wheels = [];
  for (const z of [-1.0, 1.0]) {
    const w = new THREE.Group();
    w.position.set(-0.1, 0.34, z);
    const tire = add(w, cyl(0.34, 0.22, M.tire, 32));
    tire.rotation.x = Math.PI / 2;
    const rim = add(w, cyl(0.2, 0.235, M.alu, 20));
    rim.rotation.x = Math.PI / 2;
    for (let k = 0; k < 5; k++) {
      const nut = add(w, cyl(0.022, 0.24, M.dark, 6));
      nut.rotation.x = Math.PI / 2;
      nut.position.set(Math.cos((k / 5) * Math.PI * 2) * 0.1, Math.sin((k / 5) * Math.PI * 2) * 0.1, 0);
    }
    chassis.add(w);
    wheels.push(w);
    const fender = add(
      chassis,
      new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.28, 24, 1, true, -Math.PI / 2, Math.PI), M.dark),
    );
    fender.material = M.dark.clone();
    fender.material.side = THREE.DoubleSide;
    fender.rotation.x = Math.PI / 2;
    fender.rotation.y = Math.PI / 2;
    fender.position.set(-0.1, 0.36, z);
  }
  for (const z of [-0.7, 0.7]) add(chassis, box(0.04, 0.08, 0.2, M.red, -1.72, 0.6, z));

  // gatos estabilizadores
  const jacks = [];
  for (const [x, z] of [[-1.5, -0.86], [-1.5, 0.86], [1.3, -0.86], [1.3, 0.86]]) {
    const j = new THREE.Group();
    j.position.set(x, 0, z);
    const sleeve = add(j, box(0.09, 0.3, 0.09, M.steel, 0, 0.55, 0));
    const leg = new THREE.Group();
    add(leg, cyl(0.03, 0.55, M.alu)).position.y = 0.28;
    add(leg, box(0.22, 0.02, 0.22, M.steel, 0, 0.01, 0));
    j.add(leg);
    chassis.add(j);
    jacks.push(leg);
    void sleeve;
  }

  // ───── caja técnica IP54
  const cabin = new THREE.Group();
  rig.add(cabin);
  const Y0 = 0.7;
  const H = 1.55;
  const L = 2.9;
  const D = 1.7;
  add(cabin, box(L, H, D, M.white, 0, Y0 + H / 2, 0));
  add(cabin, box(L + 0.02, 0.2, D + 0.02, M.orange, 0, Y0 + 0.28, 0));
  for (const x of [-L / 2, L / 2]) for (const z of [-D / 2, D / 2]) add(cabin, box(0.07, H + 0.02, 0.07, M.orange, x, Y0 + H / 2, z));
  for (const z of [-D / 2, D / 2]) add(cabin, box(L + 0.07, 0.06, 0.07, M.orange, 0, Y0 + H, z));
  for (const x of [-L / 2, L / 2]) add(cabin, box(0.07, 0.06, D + 0.07, M.orange, x, Y0 + H, 0));
  // rejillas de ventilación
  for (let k = 0; k < 5; k++) add(cabin, box(0.5, 0.025, 0.01, M.dark, -1.0, Y0 + 1.05 + k * 0.06, -D / 2 - 0.005));
  for (let k = 0; k < 5; k++) add(cabin, box(0.01, 0.025, 0.5, M.dark, -L / 2 - 0.005, Y0 + 1.05 + k * 0.06, 0));
  // rótulo
  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.29),
    new THREE.MeshStandardMaterial({ map: decalTexture(), transparent: true, roughness: 0.6 }),
  );
  decal.position.set(-0.72, Y0 + 1.12, D / 2 + 0.004);
  cabin.add(decal);

  // rack interior (visible con la puerta abierta)
  const rack = new THREE.Group();
  rack.position.set(0.7, Y0 + 0.08, D / 2 + 0.003);
  add(rack, box(1.26, 1.36, 0.01, M.rack, 0, 0.68, 0));
  const leds = [];
  for (let u = 0; u < 4; u++) {
    add(rack, box(1.1, 0.13, 0.02, M.dark, 0, 1.2 - u * 0.17, 0.01));
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.02, 0.01),
      new THREE.MeshBasicMaterial({ color: u % 2 ? COLORS.blue : '#5cf09a' }),
    );
    led.position.set(0.45 - (u % 3) * 0.08, 1.2 - u * 0.17, 0.025);
    rack.add(led);
    leds.push(led);
  }
  // baterías LiFePO4: 6 módulos con barra de carga
  const cellFill = [];
  const fillMat = new THREE.MeshBasicMaterial({ color: COLORS.blue, transparent: true, opacity: 0.95 });
  for (let k = 0; k < 6; k++) {
    const x = -0.5 + k * 0.2;
    add(rack, box(0.16, 0.42, 0.03, M.dark, x, 0.3, 0.01));
    const fill = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.36, 0.01), fillMat);
    fill.geometry.translate(0, 0.18, 0);
    fill.position.set(x, 0.12, 0.03);
    fill.scale.y = 0.001;
    rack.add(fill);
    cellFill.push(fill);
  }
  const batteryGlow = glowSprite(COLORS.blue, 1.6, 0);
  batteryGlow.position.set(0, 0.35, 0.3);
  rack.add(batteryGlow);
  cabin.add(rack);

  // puerta con bisagra en el borde derecho
  const door = new THREE.Group();
  door.position.set(1.36, Y0 + 0.76, D / 2 + 0.05);
  add(door, box(1.32, 1.4, 0.03, M.white, -0.66, 0, 0));
  add(door, box(1.32, 0.12, 0.034, M.orange, -0.66, -0.42, 0));
  add(door, box(0.04, 0.22, 0.05, M.alu, -1.22, 0.05, 0.02));
  cabin.add(door);

  // balizas naranjas en el techo
  const beacons = [];
  for (const z of [-0.62, 0.62]) {
    add(cabin, box(0.12, 0.08, 0.12, M.orange, 1.28, Y0 + H + 0.06, z));
    const g = glowSprite(COLORS.signal, 0.5, 0);
    g.position.set(1.28, Y0 + H + 0.12, z);
    cabin.add(g);
    beacons.push(g);
  }

  // ───── campo solar (4 paneles)
  const tex = solarTexture();
  const panelTop = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.28, metalness: 0.5, emissive: '#0a2a5a', emissiveIntensity: 0.2 });
  const panelMats = [M.alu, M.alu, panelTop, M.dark, M.alu, M.alu];
  const panels = [];
  const ROOF = Y0 + H;
  const tilt = THREE.MathUtils.degToRad(18);
  const qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt);
  const arrayCenter = new THREE.Vector3(-0.05, ROOF + 0.55, 0);
  const slots = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]];
  slots.forEach(([c, r], k) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.035, 1.0), panelMats);
    solids.push(p);
    const stowed = { pos: new THREE.Vector3(-0.05, ROOF + 0.05 + k * 0.045, 0), q: new THREE.Quaternion() };
    const local = new THREE.Vector3(c * 1.63, 0, r * 1.03).applyQuaternion(qTilt);
    const deployed = { pos: arrayCenter.clone().add(local), q: qTilt.clone() };
    p.position.copy(stowed.pos);
    rig.add(p);
    panels.push({ mesh: p, stowed, deployed });
  });
  // soportes del campo solar
  const struts = [];
  for (const [x, z] of [[-1.2, -0.7], [1.1, -0.7], [-1.2, 0.7], [1.1, 0.7]]) {
    const s = add(rig, box(0.04, 1, 0.04, M.alu, x, ROOF, z));
    s.geometry.translate(0, 0.5, 0);
    s.scale.y = 0.001;
    struts.push({ mesh: s, z });
  }

  // ───── mástil telescópico
  const mast = new THREE.Group();
  mast.position.set(1.18, 0, -1.02);
  rig.add(mast);
  add(mast, box(0.08, 0.06, 0.22, M.steel, 0, 1.2, 0.12));
  add(mast, box(0.08, 0.06, 0.22, M.steel, 0, 2.05, 0.12));
  const base = add(mast, cyl(0.095, 2.3, M.steel, 20));
  base.position.y = 0.72 + 1.15;
  const BASE_TOP = 3.0;
  const STEP = 2.0;
  const SEC_LEN = 2.5;
  const sections = [];
  for (let i = 0; i < 4; i++) {
    const s = add(mast, cyl(0.078 - i * 0.012, SEC_LEN, M.alu, 16));
    sections.push(s);
  }
  const head = new THREE.Group();
  mast.add(head);
  add(head, box(0.95, 0.045, 0.045, M.steel, 0, 0, 0));
  for (const x of [-0.46, 0.46]) {
    const ap = add(head, box(0.075, 0.56, 0.16, M.white, x, -0.05, 0));
    void ap;
  }
  const stalk = add(head, cyl(0.02, 0.4, M.steel));
  stalk.position.y = 0.2;
  const starlink = new THREE.Group();
  starlink.position.y = 0.42;
  starlink.rotation.z = 0.35;
  add(starlink, box(0.5, 0.03, 0.3, M.white, 0, 0, 0));
  head.add(starlink);
  const topLight = glowSprite(COLORS.red, 0.7, 0.9);
  topLight.position.y = 0.72;
  head.add(topLight);

  // vientos del mástil
  const guyMat = new THREE.LineBasicMaterial({ color: '#8a93a6', transparent: true, opacity: 0 });
  const guyGeo = new THREE.BufferGeometry();
  const guyPos = new Float32Array(3 * 2 * 3);
  guyGeo.setAttribute('position', new THREE.BufferAttribute(guyPos, 3));
  const guys = new THREE.LineSegments(guyGeo, guyMat);
  mast.add(guys);
  const stakes = [0, 2.1, 4.2].map((a) => new THREE.Vector3(Math.cos(a + 0.6) * 5.5, 0, Math.sin(a + 0.6) * 5.5));

  // ───── anclas para el HUD (en coordenadas locales de rig)
  const anchors = {
    panels: new THREE.Object3D(),
    battery: new THREE.Object3D(),
    mast: new THREE.Object3D(),
    link: new THREE.Object3D(),
    box: new THREE.Object3D(),
  };
  anchors.panels.position.set(0.9, ROOF + 0.9, 0.4);
  rig.add(anchors.panels);
  anchors.battery.position.set(0.3, 0.5, 0.05);
  rack.add(anchors.battery);
  head.add(anchors.mast);
  anchors.mast.position.set(0.46, 0.1, 0);
  starlink.add(anchors.link);
  anchors.box.position.set(0, Y0 + H + 0.1, 0.4);
  rig.add(anchors.box);

  const state = { roll: 1, jacks: 0, panels: 0, door: 0, battery: 0, mast: 0, link: 0, beacons: 0, solid: 1 };

  function apply(t) {
    // entrada rodando desde -X
    const r = easeOut(clamp(state.roll));
    root.position.x = lerp(-34, 0, r);
    const rollAngle = (root.position.x / 0.34);
    wheels.forEach((w) => (w.rotation.z = -rollAngle));

    // gatos
    const j = easeInOut(clamp(state.jacks));
    jacks.forEach((leg) => (leg.position.y = lerp(0.36, 0, j)));

    // paneles con arco y escalonado
    panels.forEach((p, k) => {
      const tk = easeInOut(clamp((state.panels - k * 0.14) / 0.58));
      p.mesh.position.lerpVectors(p.stowed.pos, p.deployed.pos, tk);
      p.mesh.position.y += Math.sin(tk * Math.PI) * 0.55;
      p.mesh.quaternion.slerpQuaternions(p.stowed.q, p.deployed.q, tk);
    });
    const st = easeInOut(clamp((state.panels - 0.5) / 0.5));
    struts.forEach(({ mesh, z }) => {
      const h = z > 0 ? 0.55 - 0.16 : 0.55 + 0.16;
      mesh.scale.y = Math.max(0.001, h * st);
    });

    // puerta y batería
    door.rotation.y = easeInOut(clamp(state.door)) * 1.8;
    const b = clamp(state.battery);
    cellFill.forEach((f, k) => (f.scale.y = Math.max(0.001, clamp(b * 1.3 - k * 0.05))));
    batteryGlow.material.opacity = b * (0.55 + 0.15 * Math.sin(t * 3));
    leds.forEach((l, k) => (l.visible = b > 0.05 && Math.sin(t * (4 + k) + k) > -0.3));

    // mástil
    const m = easeInOut(clamp(state.mast));
    sections.forEach((s, i) => {
      const top = BASE_TOP + m * STEP * (i + 1);
      s.position.y = top - SEC_LEN / 2;
    });
    const mastTop = BASE_TOP + m * STEP * 4;
    head.position.y = mastTop + 0.05;
    head.rotation.y = m * 0.6;
    topLight.material.opacity = m > 0.2 ? (Math.sin(t * 4) > 0 ? 0.95 : 0.25) : 0;
    const gA = clamp((m - 0.75) / 0.25);
    guyMat.opacity = gA * 0.55;
    const attach = mastTop - 1.6;
    stakes.forEach((sk, k) => {
      guyPos.set([0, attach, 0, sk.x, 0, sk.z], k * 6);
    });
    guyGeo.attributes.position.needsUpdate = true;

    // balizas
    const bc = clamp(state.beacons);
    beacons.forEach((g, k) => {
      const ph = Math.sin(t * 7 + k * Math.PI);
      g.material.opacity = bc * (ph > 0.2 ? 1 : 0.08);
    });
  }

  return { root, rig, solids, anchors, state, apply, starlinkObj: starlink };
}
