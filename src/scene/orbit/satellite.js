import * as THREE from 'three';
import { solarTexture, glowSprite, COLORS } from '../util.js';

export function createSatellite() {
  const sat = new THREE.Group();

  const metal = new THREE.MeshStandardMaterial({ color: '#dfe4ec', metalness: 0.75, roughness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1a2233', metalness: 0.6, roughness: 0.5 });
  const foil = new THREE.MeshStandardMaterial({ color: '#c9a45c', metalness: 0.95, roughness: 0.28, emissive: '#3a2600', emissiveIntensity: 0.25 });
  const tex = solarTexture().clone();
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 1);
  tex.needsUpdate = true;
  const cells = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.4, roughness: 0.35, emissive: '#0a2a5a', emissiveIntensity: 0.35 });

  // cuerpo
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 0.5), foil);
  sat.add(body);
  const bus = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.54), metal);
  bus.position.y = 0.3;
  sat.add(bus);

  // alas solares
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), metal);
    arm.rotation.z = Math.PI / 2;
    arm.position.x = side * 0.5;
    sat.add(arm);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.02, 0.62), cells);
    wing.position.x = side * 1.65;
    sat.add(wing);
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.8, 0.02, 0.62)),
      new THREE.LineBasicMaterial({ color: '#8aa6cc', transparent: true, opacity: 0.6 }),
    );
    frame.position.copy(wing.position);
    sat.add(frame);
  }

  // parábola hacia la Tierra (-Y)
  const dishGeo = new THREE.SphereGeometry(0.34, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.32);
  const dish = new THREE.Mesh(dishGeo, new THREE.MeshStandardMaterial({ color: '#f2f4f8', metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide }));
  dish.rotation.x = Math.PI;
  dish.position.y = -0.2;
  sat.add(dish);
  const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 6), dark);
  feed.position.y = -0.5;
  sat.add(feed);
  // punto del que nace el haz: la punta del alimentador de la parábola
  const emitter = new THREE.Object3D();
  emitter.position.y = -0.62;
  sat.add(emitter);

  // antena de señal y baliza roja (el "24")
  const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 6), metal);
  whip.position.set(0.14, 0.62, 0.14);
  sat.add(whip);
  const beacon = glowSprite(COLORS.red, 0.32, 1);
  beacon.position.set(0.14, 0.9, 0.14);
  sat.add(beacon);

  return { group: sat, beacon, emitter };
}

/** Enlace satélite → superficie: haz con pulsos que viajan + anillos en tierra */
export function createUplink() {
  const group = new THREE.Group();

  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: COLORS.blue.clone() }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        float edge = smoothstep(0.5, 0.0, abs(vUv.x - 0.5));
        float dash = smoothstep(0.55, 1.0, sin((vUv.y * 18.0 + uTime * 3.2) * 3.14159));
        float a = edge * (0.22 + dash * 0.9) * uOpacity;
        gl_FragColor = vec4(uColor * (1.0 + dash), a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  // plano que siempre mira a cámara (billboard sobre su eje)
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 1, 1, 1), beamMat);
  group.add(beam);

  const rings = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1, 96),
      new THREE.MeshBasicMaterial({ color: COLORS.signal, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    m.rotation.x = -Math.PI / 2;
    rings.push(m);
    group.add(m);
  }
  const spot = glowSprite(COLORS.signal, 0.55, 0.9);
  group.add(spot);
  // destello en la parábola: el haz sale del satélite
  const source = glowSprite(COLORS.blue, 0.42, 0.9);
  group.add(source);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  const up = new THREE.Vector3();

  return {
    group,
    /**
     * @param from posición del satélite (mundo)
     * @param to punto en superficie (mundo)
     */
    update(t, from, to, camera, opacity = 1) {
      a.copy(from);
      b.copy(to);
      mid.addVectors(a, b).multiplyScalar(0.5);
      dir.subVectors(a, b);
      const len = dir.length();
      dir.normalize();
      beam.position.copy(mid);
      beam.scale.set(1, len, 1);
      // orientar el plano: eje Y a lo largo del haz, cara hacia cámara
      toCam.subVectors(camera.position, mid).normalize();
      up.crossVectors(dir, toCam).normalize();
      const zAxis = new THREE.Vector3().crossVectors(up, dir).normalize();
      beam.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(up, dir, zAxis));
      beamMat.uniforms.uTime.value = t;
      beamMat.uniforms.uOpacity.value = opacity;

      source.position.copy(a);
      source.material.opacity = (0.75 + Math.sin(t * 6) * 0.15) * opacity;
      spot.position.copy(b);
      spot.material.opacity = 0.9 * opacity;
      rings.forEach((r, i) => {
        const k = (t * 0.45 + i / rings.length) % 1;
        r.position.copy(b);
        r.scale.setScalar(0.15 + k * 2.4);
        r.material.opacity = (1 - k) * 0.85 * opacity;
      });
    },
  };
}
