import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** Parte un titular en líneas visuales envueltas en máscaras */
function splitLines(el) {
  // solo espacios normales: se respetan los de no separación (100 %)
  const text = el.textContent.trim().replace(/[ \t\n\r]+/g, ' ');
  const words = text.split(' ');
  el.textContent = '';
  const spans = words.map((w, i) => {
    const s = document.createElement('span');
    s.textContent = w + (i < words.length - 1 ? ' ' : '');
    el.appendChild(s);
    return s;
  });
  const lines = [];
  let top = null;
  for (const s of spans) {
    const t = s.offsetTop;
    if (top === null || Math.abs(t - top) > 4) {
      lines.push([]);
      top = t;
    }
    lines[lines.length - 1].push(s.textContent);
  }
  el.textContent = '';
  el.setAttribute('aria-label', text);
  return lines.map((ws) => {
    const mask = document.createElement('span');
    mask.className = 'line-mask';
    mask.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span');
    inner.textContent = ws.join('');
    mask.appendChild(inner);
    el.appendChild(mask);
    return inner;
  });
}

export function initReveals({ reduced }) {
  if (reduced) return;
  document.querySelectorAll('[data-lines]').forEach((el) => {
    const lines = splitLines(el);
    gsap.set(lines, { yPercent: 105 });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 82%',
      once: true,
      onEnter: () => gsap.to(lines, { yPercent: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09 }),
    });
  });
}

/** Entrada de la portada tras el loader: el único momento orquestado de la página */
export function heroIntro({ reduced }) {
  const items = document.querySelectorAll('[data-intro]');
  if (reduced) {
    gsap.set(items, { opacity: 1 });
    return Promise.resolve();
  }
  const word = document.querySelector('.portada__word');
  const num = document.querySelector('.portada__num');
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.from(word, { yPercent: 40, opacity: 0, clipPath: 'inset(0 0 100% 0)', duration: 1.4 }, 0.1)
    .from(num, { yPercent: 40, opacity: 0, clipPath: 'inset(0 0 100% 0)', duration: 1.4 }, 0.28)
    .from('.portada__call', { y: 16, opacity: 0, duration: 1 }, 0.5)
    .from('.portada__foot', { y: 22, opacity: 0, duration: 1.1 }, 0.62)
    .from('.portada__cue', { opacity: 0, duration: 1 }, 1.1)
    .from('.topbar', { y: -20, opacity: 0, duration: 1 }, 0.7)
    .from('.rail', { opacity: 0, duration: 1 }, 1);
  return tl.then();
}
