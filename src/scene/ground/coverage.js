import * as THREE from 'three';
import { COLORS, glowSprite } from '../util.js';

/** Cúpula de cobertura WiFi 6 (hemisferio con retícula y barrido) */
export function createCoverage() {
  const group = new THREE.Group();
  const uniforms = {
    uTime: { value: 0 },
    uOpacity: { value: 0 },
    uColor: { value: COLORS.blue.clone() },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 96, 48, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        varying vec3 vN;
        varying vec3 vV;
        varying vec3 vP;
        void main() {
          vP = position;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uOpacity;
        uniform vec3 uColor;
        varying vec3 vN;
        varying vec3 vV;
        varying vec3 vP;
        float line(float v, float n, float w) {
          float f = abs(fract(v * n) - 0.5);
          return smoothstep(w, 0.0, f - (0.5 - w));
        }
        void main() {
          float fres = pow(1.0 - abs(dot(vN, vV)), 2.2);
          float lat = asin(clamp(vP.y, 0.0, 1.0)) / 1.5708;
          float lon = atan(vP.z, vP.x) / 6.28318 + 0.5;
          float g = max(line(lat, 7.0, 0.012), line(lon, 36.0, 0.01)) * 0.22;
          float scan = smoothstep(0.05, 0.0, abs(lat - fract(uTime * 0.18))) * 0.6;
          float base = smoothstep(0.06, 0.0, lat) * 0.35;
          float a = (0.015 + fres * 0.3 + g + scan * (0.25 + fres * 0.5) + base) * uOpacity;
          gl_FragColor = vec4(uColor * (1.0 + scan), a);
        }`,
    }),
  );
  group.add(dome);

  // borde en el suelo
  const edge = new THREE.Mesh(
    new THREE.RingGeometry(0.985, 1, 180),
    new THREE.MeshBasicMaterial({ color: COLORS.blue, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  edge.rotation.x = -Math.PI / 2;
  edge.position.y = 0.05;
  group.add(edge);

  // ondas WiFi que salen del nodo por el suelo
  const ripples = [0, 1, 2].map(() => {
    const r = new THREE.Mesh(
      new THREE.RingGeometry(0.97, 1, 128),
      new THREE.MeshBasicMaterial({ color: COLORS.blue, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.06;
    group.add(r);
    return r;
  });

  const anchor = new THREE.Object3D();
  group.add(anchor);

  return {
    group,
    anchor,
    /** radius en unidades de escena, opacity 0→1 */
    update(t, radius, opacity) {
      const r = Math.max(0.001, radius);
      dome.scale.set(r, r * 0.62, r);
      uniforms.uTime.value = t;
      uniforms.uOpacity.value = opacity;
      edge.scale.setScalar(r);
      edge.material.opacity = opacity * 0.9;
      ripples.forEach((m, k) => {
        const ph = (t * 0.35 + k / 3) % 1;
        m.scale.setScalar(Math.max(0.001, ph * r));
        m.material.opacity = (1 - ph) * 0.7 * opacity;
      });
      const dir = new THREE.Vector3(0.62, 0.42, 0.66).normalize();
      anchor.position.set(dir.x * r, dir.y * r * 0.62, dir.z * r);
      dome.visible = edge.visible = opacity > 0.001;
    },
  };
}

/** Haz Starlink: desde la antena del mástil hacia un satélite en el cielo */
export function createSkyLink() {
  const group = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: COLORS.blue.clone() } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float edge = smoothstep(0.5, 0.0, abs(vUv.x - 0.5));
        float pulses = smoothstep(0.6, 1.0, sin((vUv.y * 26.0 - uTime * 4.0) * 3.14159));
        float fade = smoothstep(1.0, 0.55, vUv.y);
        float a = edge * (0.18 + pulses) * fade * uOpacity;
        gl_FragColor = vec4(uColor * (1.0 + pulses * 0.6), a);
      }`,
  });
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 1), mat);
  group.add(beam);
  const sky = glowSprite(COLORS.ink, 3, 0);
  group.add(sky);
  const foot = glowSprite(COLORS.blue, 1.4, 0);
  group.add(foot);

  const mid = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  const xAxis = new THREE.Vector3();
  const zAxis = new THREE.Vector3();
  const m4 = new THREE.Matrix4();

  return {
    group,
    update(t, from, to, camera, opacity) {
      mid.addVectors(from, to).multiplyScalar(0.5);
      dir.subVectors(to, from);
      const len = dir.length();
      dir.normalize();
      toCam.subVectors(camera.position, mid).normalize();
      xAxis.crossVectors(dir, toCam).normalize();
      zAxis.crossVectors(xAxis, dir).normalize();
      beam.quaternion.setFromRotationMatrix(m4.makeBasis(xAxis, dir, zAxis));
      beam.position.copy(mid);
      beam.scale.set(1, len, 1);
      mat.uniforms.uTime.value = t;
      mat.uniforms.uOpacity.value = opacity;
      sky.position.copy(to);
      sky.material.opacity = opacity * (0.6 + 0.4 * Math.sin(t * 3));
      foot.position.copy(from);
      foot.material.opacity = opacity;
      group.visible = opacity > 0.001;
    },
  };
}
