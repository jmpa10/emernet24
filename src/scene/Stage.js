import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { COLORS } from './util.js';
import { createEarth, createStars } from './orbit/earth.js';
import { createSatellite, createUplink } from './orbit/satellite.js';
import { createGround, createTowers, createDevices } from './ground/terrain.js';
import { createNode } from './ground/node.js';
import { createCoverage, createSkyLink } from './ground/coverage.js';
import { bakeEdges, createBlueprint } from './ground/blueprint.js';

export function detectQuality() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const cores = navigator.hardwareConcurrency || 4;
  return coarse || small || cores <= 4 ? 'low' : 'high';
}

export function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export async function createStage(canvas, { quality }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setClearColor(COLORS.bg, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const maxDpr = quality === 'high' ? 2 : 1.5;
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2500);

  // entorno para reflejos suaves en metal y pintura
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // ───────── Escena A: órbita
  const orbit = new THREE.Scene();
  orbit.background = COLORS.bg.clone();
  orbit.environment = envMap;
  orbit.environmentIntensity = 0.5;
  const stars = createStars({ quality });
  orbit.add(stars.object);
  const earth = await createEarth({ quality });
  orbit.add(earth.group);
  const sat = createSatellite();
  sat.group.scale.setScalar(0.62);
  orbit.add(sat.group);
  const uplink = createUplink();
  orbit.add(uplink.group);
  const sun = new THREE.DirectionalLight('#ffffff', 2.4);
  sun.position.set(20, 12, 8);
  orbit.add(sun, new THREE.AmbientLight('#6f86b0', 0.5));

  // ───────── Escena B: terreno
  const ground = new THREE.Scene();
  ground.background = COLORS.bg.clone();
  ground.fog = new THREE.FogExp2(COLORS.bg, 0.0065);
  ground.environment = envMap;
  ground.environmentIntensity = 0.32;
  ground.add(new THREE.HemisphereLight('#9fb7df', '#0a0f1a', 1.0));
  const moon = new THREE.DirectionalLight('#dbe6ff', 2.0);
  moon.position.set(-14, 22, 16);
  ground.add(moon);
  const rim = new THREE.DirectionalLight('#FF6B1A', 1.1);
  rim.position.set(12, 5, -14);
  ground.add(rim);

  const floor = createGround();
  ground.add(floor.object);
  const towers = createTowers();
  ground.add(towers.group);
  const devices = createDevices({ quality });
  ground.add(devices.object);
  const node = createNode();
  ground.add(node.root);
  const coverage = createCoverage();
  ground.add(coverage.group);
  const skylink = createSkyLink();
  ground.add(skylink.group);

  // el plano técnico se hornea con el nodo desplegado y se restaura
  Object.assign(node.state, { roll: 1, jacks: 1, panels: 1, door: 0, battery: 1, mast: 1 });
  node.apply(0);
  const blueprint = createBlueprint(bakeEdges(node.root, node.solids), { quality });
  ground.add(blueprint.group);
  Object.assign(node.state, { roll: 0, jacks: 0, panels: 0, door: 0, battery: 0, mast: 0 });
  node.apply(0);

  // ───────── Post-proceso (solo calidad alta)
  let composer = null;
  let renderPass = null;
  let bloom = null;
  if (quality === 'high') {
    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(orbit, camera);
    composer.addPass(renderPass);
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.62, 0.5, 0.86);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  let width = 1;
  let height = 1;
  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = camera.aspect < 0.8 ? 58 : 40;
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setPixelRatio(dpr);
      composer.setSize(width, height);
    }
  }
  resize();
  window.addEventListener('resize', resize);

  function render(scene) {
    if (composer) {
      renderPass.scene = scene;
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  // compila shaders por adelantado para evitar tirones en el primer scroll
  renderer.compile(orbit, camera);
  renderer.compile(ground, camera);

  return {
    renderer,
    camera,
    orbit,
    ground,
    earth,
    stars,
    sat,
    uplink,
    floor,
    towers,
    devices,
    node,
    coverage,
    skylink,
    blueprint,
    render,
    get size() {
      return { width, height, dpr };
    },
  };
}
