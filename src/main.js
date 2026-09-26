import '@fontsource/barlow/300.css';
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-condensed/400.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/sections.css';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { mountLogos } from './brand/logo.js';
import { ScrollStory } from './scroll.js';
import { createLoader } from './sections/loader.js';
import { initReveals, heroIntro } from './sections/reveal.js';
import { countUp } from './sections/counters.js';
import { initMap } from './sections/map.js';
import { NODE_STEPS } from './content.js';

gsap.registerPlugin(ScrollTrigger);

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
if (reduced) root.classList.add('reduced');

mountLogos();
const loader = createLoader({ reduced });
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// ───────── scroll suave
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true });
  lenis.stop();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.6 });
    else target.scrollIntoView();
    if (id === '#problema') target.setAttribute('tabindex', '-1'), target.focus({ preventScroll: true });
  });
});

// ───────── estado de la página ligado al scroll
const scroll = new ScrollStory();
const steps = [...document.querySelectorAll('.step')];
const ticks = [...document.querySelectorAll('#ticks i')];
const stepCount = document.getElementById('step-count');
const clock = document.getElementById('clock');
const coverage = document.getElementById('coverage-v');
const railFill = document.getElementById('rail-fill');
const railPct = document.getElementById('rail-pct');
const topbar = document.querySelector('.topbar');
const rail = document.querySelector('.rail');
const navLinks = [...document.querySelectorAll('.topnav a')];

let lastStep = -1;
let lastCov = '';
let lastClock = '';
let lastPct = '';
let lastSection = -1;
let onLight = false;

function stepFor(p) {
  let s = 0;
  while (s < NODE_STEPS.length && p >= NODE_STEPS[s]) s++;
  return s;
}

function updateDom(S) {
  // paso del despliegue
  const nodeP = scroll.pinned(2);
  const step = stepFor(nodeP);
  if (step !== lastStep) {
    steps.forEach((el, i) => el.classList.toggle('is-active', i === step));
    ticks.forEach((el, i) => {
      el.classList.toggle('is-done', i < step);
      el.classList.toggle('is-now', i === step);
    });
    stepCount.textContent = `Paso ${step + 1} de 6`;
    countUp(steps[step].querySelector('.step__num'), { reduced });
    lastStep = step;
  }
  const secs = Math.round(Math.min(1, nodeP / 0.95) * 15 * 60);
  const c = nodeP >= 0.95 ? 'Operativo' : `T+ ${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  if (c !== lastClock) {
    clock.textContent = c;
    lastClock = c;
  }

  // cobertura en la sección del problema
  const fail = S < 1 ? 0 : Math.min(1, Math.max(0, (scroll.pinned(1) - 0.08) / 0.78));
  const cov = `${Math.round((1 - fail) * 100)} %`;
  if (cov !== lastCov) {
    coverage.textContent = cov;
    coverage.classList.toggle('is-lost', fail > 0.5);
    lastCov = cov;
  }

  // raíl de progreso
  const pct = String(Math.round(scroll.progress * 100)).padStart(2, '0');
  if (pct !== lastPct) {
    railFill.style.transform = `scaleY(${scroll.progress.toFixed(3)})`;
    railPct.textContent = pct;
    lastPct = pct;
  }

  // barra superior sobre el pie claro
  const light = scroll.y + 40 > scroll.tops[5];
  if (light !== onLight) {
    topbar.classList.toggle('on-light', light);
    rail.classList.toggle('on-light', light);
    onLight = light;
  }

  const sec = Math.floor(S + 0.02);
  if (sec !== lastSection) {
    const ids = ['portada', 'problema', 'nodo', 'red', 'impacto', 'cierre'];
    navLinks.forEach((a) => a.setAttribute('aria-current', String(a.getAttribute('href') === `#${ids[sec]}`)));
    lastSection = sec;
  }
}

// ───────── arranque
async function boot() {
  loader.progress(0.08);
  initMap({ reduced });

  let timeline = null;
  let hud = null;
  const { hasWebGL, detectQuality, createStage } = await import('./scene/Stage.js');
  loader.progress(0.3);

  if (hasWebGL()) {
    try {
      const quality = detectQuality();
      root.dataset.quality = quality;
      const stage = await createStage(document.getElementById('stage'), { quality });
      loader.progress(0.8);
      const { createTimeline } = await import('./scene/timeline.js');
      const { createHud } = await import('./scene/hud.js');
      timeline = createTimeline(stage, scroll, { reduced });
      hud = createHud(stage);
    } catch (err) {
      console.warn('WebGL no disponible, se muestra la versión estática.', err);
      root.classList.add('no-webgl');
    }
  } else {
    root.classList.add('no-webgl');
  }

  await document.fonts.ready;
  loader.progress(0.95);
  initReveals({ reduced });
  scroll.measure();
  ScrollTrigger.refresh();

  let last = performance.now();
  gsap.ticker.add(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const S = scroll.update(window.scrollY);
    if (timeline) {
      const out = timeline.update(now / 1000, dt, S);
      hud.update(out.hud, out.step);
    }
    updateDom(S);
  });

  if (timeline) timeline.setIntro(0);
  await loader.finish();
  if (timeline) gsap.to({ k: 0 }, { k: 1, duration: reduced ? 0.01 : 2.6, ease: 'power3.out', onUpdate() { timeline.setIntro(this.targets()[0].k); } });
  lenis?.start();
  heroIntro({ reduced });
}

window.addEventListener('resize', () => {
  scroll.measure();
});

boot();
