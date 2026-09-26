import * as THREE from 'three';
import { COLORS, glowSprite, clamp } from '../util.js';

/** Suelo: rejilla táctica en shader, se atenúa con la distancia */
export function createGround() {
  const uniforms = {
    uCenter: { value: new THREE.Vector2(0, 0) },
    uBlue: { value: 0 },
    uOpacity: { value: 1 },
    uLine: { value: new THREE.Color('#22324f') },
    uLineMajor: { value: new THREE.Color('#34496f') },
    uBlueLine: { value: COLORS.blue.clone() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec2 uCenter;
      uniform float uBlue;
      uniform float uOpacity;
      uniform vec3 uLine;
      uniform vec3 uLineMajor;
      uniform vec3 uBlueLine;
      varying vec3 vW;
      float grid(vec2 p, float size, float w) {
        vec2 g = abs(fract(p / size - 0.5) - 0.5) / fwidth(p / size);
        return 1.0 - min(min(g.x, g.y) / w, 1.0);
      }
      void main() {
        vec2 p = vW.xz;
        float d = length(p - uCenter);
        float minor = grid(p, 2.0, 1.0);
        float major = grid(p, 10.0, 1.2);
        float fade = 1.0 - smoothstep(30.0, 170.0 + uBlue * 120.0, d);
        vec3 base = mix(uLine, uLineMajor, major);
        vec3 col = mix(base, uBlueLine * 0.42, uBlue);
        float a = max(minor * 0.45 * (1.0 - uBlue * 0.85), major * (0.9 - uBlue * 0.35)) * fade * uOpacity;
        // cruces en los nudos mayores
        gl_FragColor = vec4(col, a);
      }`,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 1, 1), mat);
  plane.rotation.x = -Math.PI / 2;
  return { object: plane, uniforms };
}

/** Torres de telefonía de celosía */
function towerGeometry(h = 17, base = 1.7, top = 0.35, levels = 9) {
  const pts = [];
  const corner = (y) => {
    const w = base + (top - base) * (y / h);
    return [[-w, y, -w], [w, y, -w], [w, y, w], [-w, y, w]];
  };
  for (let l = 0; l < levels; l++) {
    const y0 = (l / levels) * h;
    const y1 = ((l + 1) / levels) * h;
    const a = corner(y0);
    const b = corner(y1);
    for (let k = 0; k < 4; k++) {
      const n = (k + 1) % 4;
      pts.push(...a[k], ...b[k]); // montante
      pts.push(...b[k], ...b[n]); // horizontal
      pts.push(...a[k], ...b[n]); // diagonal
      pts.push(...a[n], ...b[k]); // diagonal cruzada
    }
  }
  // mástil superior
  pts.push(0, h, 0, 0, h + 2.2, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

export function createTowers() {
  const group = new THREE.Group();
  const geo = towerGeometry();
  const spots = [
    [-30, -26], [34, -34], [-44, 16], [44, 14], [8, -52], [-12, 44],
  ];
  const towers = spots.map(([x, z], i) => {
    const t = new THREE.Group();
    t.position.set(x, 0, z);
    t.rotation.y = i * 0.7;
    const mat = new THREE.LineBasicMaterial({ color: '#5d6b85', transparent: true, opacity: 0.8 });
    t.add(new THREE.LineSegments(geo, mat));
    // antenas panel
    const antMat = new THREE.MeshStandardMaterial({ color: '#8a93a6', roughness: 0.6 });
    for (let k = 0; k < 3; k++) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.3, 0.12), antMat);
      const ang = (k / 3) * Math.PI * 2;
      a.position.set(Math.cos(ang) * 0.55, 16.6, Math.sin(ang) * 0.55);
      a.rotation.y = -ang;
      t.add(a);
    }
    const light = glowSprite(COLORS.blue, 2.2, 1);
    light.position.y = 19.4;
    t.add(light);
    const rings = [0, 1].map(() => {
      const r = new THREE.Mesh(
        new THREE.RingGeometry(0.94, 1, 64),
        new THREE.MeshBasicMaterial({ color: COLORS.blue, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      r.rotation.x = -Math.PI / 2;
      r.position.y = 16.8;
      t.add(r);
      return r;
    });
    group.add(t);
    return { t, mat, light, rings, failAt: 0.12 + i * 0.12, seed: Math.random() * 10 };
  });

  const cLive = COLORS.blue.clone();
  const cDead = COLORS.red.clone();
  const cSteel = new THREE.Color('#5d6b85');
  const cDim = new THREE.Color('#6b3a48');

  return {
    group,
    /** fail: 0 (todas operativas) → 1 (todas caídas) */
    update(t, fail, opacity = 1) {
      towers.forEach((tw) => {
        const local = clamp((fail - tw.failAt) / 0.14);
        const dead = local >= 1;
        const flicker = local > 0 && !dead ? (Math.sin(t * 38 + tw.seed) > 0 ? 1 : 0.1) : 1;
        tw.light.material.color.copy(local > 0 ? cDead : cLive);
        tw.light.material.opacity = opacity * (dead ? 0.35 + 0.35 * (Math.sin(t * 2.2 + tw.seed) > 0.6 ? 1 : 0) : flicker);
        tw.mat.color.copy(cSteel).lerp(cDim, local);
        tw.mat.opacity = 0.8 * opacity;
        tw.rings.forEach((r, k) => {
          const ph = (t * 0.55 + k * 0.5 + tw.seed) % 1;
          r.scale.setScalar(1 + ph * 16);
          r.material.color.copy(local > 0 ? cDead : cLive);
          r.material.opacity = (1 - ph) * 0.5 * (1 - local) * opacity * flicker;
        });
      });
    },
  };
}

/** Dispositivos sobre el terreno: personas, vehículos, puestos de mando */
export function createDevices({ quality }) {
  const n = quality === 'high' ? 900 : 520;
  const pos = new Float32Array(n * 3);
  const rnd = new Float32Array(n);
  const dist = new Float32Array(n);
  const clusters = [
    [12, 8, 5, 0.18], // puesto de mando
    [-18, 14, 7, 0.2], // campamento
    [22, -18, 9, 0.28], // evento masivo
    [-10, -22, 4, 0.1],
  ];
  for (let i = 0; i < n; i++) {
    let x;
    let z;
    const pick = Math.random();
    let acc = 0;
    let placed = false;
    for (const [cx, cz, r, w] of clusters) {
      acc += w;
      if (pick < acc) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * r;
        x = cx + Math.cos(a) * d;
        z = cz + Math.sin(a) * d;
        placed = true;
        break;
      }
    }
    if (!placed) {
      const a = Math.random() * Math.PI * 2;
      const d = 6 + Math.sqrt(Math.random()) * 48;
      x = Math.cos(a) * d;
      z = Math.sin(a) * d;
    }
    pos.set([x, 0.25, z], i * 3);
    rnd[i] = Math.random();
    dist[i] = Math.hypot(x, z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
  geo.setAttribute('aDist', new THREE.BufferAttribute(dist, 1));
  const uniforms = {
    uTime: { value: 0 },
    uFail: { value: 0 },
    uCover: { value: -1 },
    uOpacity: { value: 1 },
    uPixelRatio: { value: 1 },
    uLive: { value: COLORS.blue.clone() },
    uLost: { value: COLORS.red.clone() },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aRand;
      attribute float aDist;
      uniform float uTime;
      uniform float uFail;
      uniform float uCover;
      uniform float uPixelRatio;
      varying float vLost;
      varying float vBlink;
      varying float vWave;
      void main() {
        float lost = step(aRand, uFail) * step(uCover, aDist);
        vLost = lost;
        vBlink = 0.45 + 0.55 * step(0.0, sin(uTime * 5.0 + aRand * 30.0));
        vWave = smoothstep(4.0, 0.0, abs(aDist - uCover)); // frente de la onda de cobertura
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (2.8 + lost * 1.4 + vWave * 3.5) * uPixelRatio * (60.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLive;
      uniform vec3 uLost;
      uniform float uOpacity;
      varying float vLost;
      varying float vBlink;
      varying float vWave;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.05, d);
        vec3 col = mix(uLive, uLost, vLost) + vWave * 0.8;
        float k = mix(1.0, vBlink, vLost);
        gl_FragColor = vec4(col, a * k * uOpacity);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  return { object: points, uniforms };
}
