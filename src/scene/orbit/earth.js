import * as THREE from 'three';
import landUrl from '../../assets/land.png';

export const EARTH_R = 10;

// Dirección de España (lat 40, lon -3.7) en coordenadas locales de la esfera
export function latLonToVec(lat, lon, r = 1, out = new THREE.Vector3()) {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return out.set(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)).multiplyScalar(r);
}

function loadMask() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      resolve({ data: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height });
    };
    img.onerror = () => resolve(null);
    img.src = landUrl;
  });
}

const vert = /* glsl */ `
  attribute float aLand;
  attribute float aSpain;
  attribute float aRand;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  varying float vLand;
  varying float vSpain;
  varying float vFacing;
  varying float vTw;
  void main() {
    vLand = aLand;
    vSpain = aSpain;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normalize(position));
    vFacing = dot(n, normalize(-mv.xyz));
    vTw = 0.75 + 0.25 * sin(uTime * (1.2 + aRand * 2.0) + aRand * 40.0);
    float s = uSize * (0.55 + aLand * 0.65 + aSpain * 0.5);
    gl_PointSize = s * uPixelRatio * (38.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const frag = /* glsl */ `
  uniform vec3 uLand;
  uniform vec3 uOcean;
  uniform vec3 uSpain;
  uniform float uFade;
  varying float vLand;
  varying float vSpain;
  varying float vFacing;
  varying float vTw;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.1, d);
    float rim = smoothstep(-0.05, 0.35, vFacing);
    vec3 col = mix(uOcean, uLand, vLand);
    col = mix(col, uSpain, vSpain);
    float alpha = a * rim * mix(0.35, 1.0, vLand) * mix(1.0, vTw, vSpain) * uFade;
    gl_FragColor = vec4(col, alpha);
  }
`;

const atmoVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const atmoFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uStrength;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = 1.0 - abs(dot(vN, vV));
    float g = pow(f, uPower) * uStrength;
    gl_FragColor = vec4(uColor * g, g);
  }
`;

export async function createEarth({ quality }) {
  const group = new THREE.Group();
  const mask = await loadMask();
  const N = quality === 'high' ? 42000 : 20000;

  const pos = [];
  const land = [];
  const spain = [];
  const rand = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const x = Math.cos(th) * r;
    const z = Math.sin(th) * r;
    const lat = Math.asin(y) * (180 / Math.PI);
    const lon = Math.atan2(-z, x) * (180 / Math.PI);
    let isLand = 0;
    if (mask) {
      const mx = Math.floor(((lon + 180) / 360) * mask.w) % mask.w;
      const my = Math.min(mask.h - 1, Math.floor(((90 - lat) / 180) * mask.h));
      isLand = mask.data[(my * mask.w + mx) * 4] > 127 ? 1 : 0;
    }
    if (!isLand && Math.random() > 0.2) continue;
    const isSpain = isLand && lat > 36 && lat < 43.8 && lon > -9.4 && lon < 3.4 ? 1 : 0;
    v.set(x, y, z).multiplyScalar(EARTH_R);
    pos.push(v.x, v.y, v.z);
    land.push(isLand);
    spain.push(isSpain);
    rand.push(Math.random());
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aLand', new THREE.Float32BufferAttribute(land, 1));
  geo.setAttribute('aSpain', new THREE.Float32BufferAttribute(spain, 1));
  geo.setAttribute('aRand', new THREE.Float32BufferAttribute(rand, 1));

  const uniforms = {
    uTime: { value: 0 },
    uSize: { value: quality === 'high' ? 1.25 : 1.6 },
    uPixelRatio: { value: 1 },
    uLand: { value: new THREE.Color('#9ec4f0') },
    uOcean: { value: new THREE.Color('#1f3a66') },
    uSpain: { value: new THREE.Color('#FF6B1A') },
    uFade: { value: 1 },
  };
  const points = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(points);

  // núcleo opaco para ocultar la cara trasera
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 0.992, 96, 64),
    new THREE.MeshBasicMaterial({ color: '#03060c' }),
  );
  group.add(core);

  // atmósfera: halo exterior + brillo interior
  const atmoUniforms = { uColor: { value: new THREE.Color('#3FA9FF') }, uPower: { value: 4.0 }, uStrength: { value: 1.3 } };
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 1.08, 96, 64),
    new THREE.ShaderMaterial({
      vertexShader: atmoVert,
      fragmentShader: atmoFrag,
      uniforms: atmoUniforms,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(atmo);
  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 1.002, 96, 64),
    new THREE.ShaderMaterial({
      vertexShader: atmoVert,
      fragmentShader: atmoFrag,
      uniforms: { uColor: { value: new THREE.Color('#2f7fd0') }, uPower: { value: 5.0 }, uStrength: { value: 0.75 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(inner);

  // Orientar: España arriba (+Y) y el norte hacia el fondo (-Z)
  const spainDir = latLonToVec(40.2, -3.7);
  const q = new THREE.Quaternion().setFromUnitVectors(spainDir, new THREE.Vector3(0, 1, 0));
  const north = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const ang = Math.atan2(north.x, -north.z);
  const q2 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
  group.quaternion.copy(q2.multiply(q));

  return {
    group,
    uniforms,
    update(t, dpr) {
      uniforms.uTime.value = t;
      uniforms.uPixelRatio.value = dpr;
    },
  };
}

export function createStars({ quality }) {
  const n = quality === 'high' ? 2600 : 1200;
  const pos = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.randomDirection().multiplyScalar(260 + Math.random() * 120);
    pos.set([v.x, v.y, v.z], i * 3);
    size[i] = Math.pow(Math.random(), 3) * 2.2 + 0.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPixelRatio: { value: 1 }, uTime: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      uniform float uPixelRatio;
      uniform float uTime;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vA = 0.55 + 0.45 * sin(uTime * 0.8 + position.x * 0.13 + position.y * 0.07);
        gl_PointSize = aSize * uPixelRatio;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(vec3(0.82, 0.88, 1.0), smoothstep(0.5, 0.0, d) * vA * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  return {
    object: pts,
    update(t, dpr) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uPixelRatio.value = dpr;
    },
    material: mat,
  };
}
