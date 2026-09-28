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
import { initReveals, initSoftReveals, heroIntro } from './sections/reveal.js';
import { countUp } from './sections/counters.js';
import { initMap } from './sections/map.js';
import { NODE_STEPS, SIGNAL_LOSS, DOME_GROW } from './content.js';
import { smooth, invLerp, easeOut } from './scene/util.js';

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
  lenis = new Lenis({ lerp: 0.07, wheelMultiplier: 0.85, smoothWheel: true });
  lenis.stop();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// ───────── menú móvil
const topbarEl = document.querySelector('.topbar');
const menuBtn = document.querySelector('.menu-btn');
function setMenu(open) {
  if (topbarEl.classList.contains('nav-open') === open) return;
  topbarEl.classList.toggle('nav-open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  menuBtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  if (open) {
    lenis?.stop();
    topbarEl.querySelector('.topnav a')?.focus();
  } else lenis?.start();
}
menuBtn.addEventListener('click', () => setMenu(!topbarEl.classList.contains('nav-open')));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && topbarEl.classList.contains('nav-open')) {
    setMenu(false);
    menuBtn.focus();
  }
});
matchMedia('(max-width: 900px)').addEventListener('change', (e) => !e.matches && setMenu(false));

document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id.length > 1 && document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    setMenu(false);
    if (lenis) lenis.scrollTo(target, { duration: 2 });
    else target.scrollIntoView();
    if (id === '#problema') target.setAttribute('tabindex', '-1'), target.focus({ preventScroll: true });
  });
});

// ───────── estado de la página ligado al scroll
const scroll = new ScrollStory();
const steps = [...document.querySelectorAll('.step')];
const ticks = [...document.querySelectorAll('#ticks button')];
const stepCount = document.getElementById('step-count');
const clock = document.getElementById('clock');
const coverage = document.getElementById('coverage-v');
const railFill = document.getElementById('rail-fill');
const railPct = document.getElementById('rail-pct');
const progressFill = document.getElementById('progress-fill');
const restore = document.getElementById('restore');
const restoreK = document.getElementById('restore-k');
const restoreV = document.getElementById('restore-v');
const topbar = document.querySelector('.topbar');
const rail = document.querySelector('.rail');
const navLinks = [...document.querySelectorAll('.topnav a')];
const problema = document.getElementById('problema');
const pinned = [...document.querySelectorAll('[data-scene]')]
  .map((el, i) => ({ el, i, last: '' }))
  .filter(({ el }) => el.hasAttribute('data-pin'));
const narrow = matchMedia('(max-width: 900px)');

let lastStep = -1;
let lastCov = '';
let lastClock = '';
let lastPct = '';
let lastSection = -1;
let lastCols = '';
let lastRestore = '';
let scrolled = false;
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
  // la cobertura vuelve a medida que crece la cúpula WiFi (cierra el 0 % del problema)
  const back = Math.round(easeOut(invLerp(...DOME_GROW, nodeP)) * 100);
  const r = `${back}`;
  if (r !== lastRestore) {
    restoreV.textContent = `${back} %`;
    restoreK.textContent = back >= 100 ? 'Cobertura restaurada' : 'Cobertura';
    restore.classList.toggle('is-lost', back < 50);
    restore.classList.toggle('is-back', back >= 100);
    lastRestore = r;
  }

  const secs = Math.round(Math.min(1, nodeP / 0.95) * 15 * 60);
  const c = nodeP >= 0.95 ? 'Operativo' : `T+ ${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  if (c !== lastClock) {
    clock.textContent = c;
    lastClock = c;
  }

  // cobertura en la sección del problema (misma curva que la escena 3D)
  const probP = scroll.pinned(1);
  const fail = S < 1 ? 0 : smooth(...SIGNAL_LOSS[narrow.matches ? 'narrow' : 'wide'], probP);
  const cov = `${Math.round((1 - fail) * 100)} %`;
  if (cov !== lastCov) {
    coverage.textContent = cov;
    coverage.classList.toggle('is-lost', fail > 0.5);
    lastCov = cov;
  }

  // en móvil el texto del problema se retira para que la caída de la red ocupe la pantalla
  const cols = narrow.matches && !reduced ? (1 - smooth(0.2, 0.34, probP)).toFixed(3) : '1';
  if (cols !== lastCols) {
    problema.style.setProperty('--cols', cols);
    lastCols = cols;
  }

  // las secciones fijadas entran y salen con un fundido (sin cortes del velo sobre el 3D)
  if (!reduced) {
    for (const p of pinned) {
      const top = scroll.tops[p.i];
      const end = top + scroll.heights[p.i] - scroll.vh;
      const enter = smooth(top - scroll.vh * 0.85, top - scroll.vh * 0.25, scroll.y);
      const exit = smooth(end + scroll.vh * 0.05, end + scroll.vh * 0.6, scroll.y);
      const vis = (enter * (1 - exit)).toFixed(3);
      if (vis !== p.last) {
        p.el.style.setProperty('--vis', vis);
        p.last = vis;
      }
    }
  }

  // raíl de progreso
  const pct = String(Math.round(scroll.progress * 100)).padStart(2, '0');
  if (pct !== lastPct) {
    railFill.style.transform = `scaleY(${scroll.progress.toFixed(3)})`;
    progressFill.style.transform = `scaleX(${scroll.progress.toFixed(3)})`;
    railPct.textContent = pct;
    lastPct = pct;
  }

  // el aviso de «desliza» de la portada se va en cuanto hay scroll
  if (scroll.y > 40 !== scrolled) {
    scrolled = scroll.y > 40;
    root.classList.toggle('has-scrolled', scrolled);
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

// ───────── saltar a un paso del despliegue (a mitad de su tramo)
ticks.forEach((btn, i) => {
  btn.addEventListener('click', () => {
    const bounds = [0, ...NODE_STEPS, 1];
    const p = (bounds[i] + bounds[i + 1]) / 2;
    const y = scroll.tops[2] + p * (scroll.heights[2] - scroll.vh);
    if (lenis) lenis.scrollTo(y, { duration: 1.4 });
    else window.scrollTo(0, y);
  });
});

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
  initSoftReveals({ reduced });
  scroll.measure();
  ScrollTrigger.refresh();

  let last = performance.now();
  gsap.ticker.add(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const S = scroll.update(window.scrollY);
    const hidden = scroll.y >= scroll.tops[5]; // el pie claro cubre toda la pantalla
    if (timeline && !hidden) {
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
