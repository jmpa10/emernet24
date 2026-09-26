import { gsap } from 'gsap';

/**
 * Loader: la marca se dibuja trazo a trazo mientras el porcentaje sigue la carga real.
 * `progress(v)` informa de la carga (0→1); `finish()` resuelve cuando ha salido.
 */
export function createLoader({ reduced }) {
  const el = document.getElementById('loader');
  const pct = document.getElementById('loader-pct');
  const strokes = el.querySelectorAll('.lg-stroke');
  const fills = el.querySelectorAll('.lg-fill');
  const shown = { v: 0 };
  let target = 0;
  const t0 = performance.now();

  const draw = gsap.timeline();
  if (reduced) {
    gsap.set(strokes, { strokeDashoffset: 0 });
    gsap.set(fills, { opacity: 1 });
  } else {
    draw
      .to(strokes, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', stagger: 0.05 })
      .to(fills, { opacity: 1, duration: 0.5, stagger: 0.012, ease: 'power1.out' }, 0.45);
  }

  const tick = () => {
    shown.v += (target - shown.v) * 0.12;
    pct.textContent = String(Math.round(shown.v * 100)).padStart(2, '0');
  };
  gsap.ticker.add(tick);

  return {
    progress(v) {
      target = Math.max(target, Math.min(1, v));
    },
    async finish() {
      target = 1;
      const minTime = reduced ? 200 : 1700;
      const wait = Math.max(0, minTime - (performance.now() - t0));
      await new Promise((r) => setTimeout(r, wait));
      await new Promise((r) => {
        const check = () => (shown.v > 0.985 ? r() : requestAnimationFrame(check));
        check();
      });
      pct.textContent = '100';
      gsap.ticker.remove(tick);
      await gsap
        .timeline()
        .to(el.children, { opacity: 0, y: -16, duration: reduced ? 0.01 : 0.45, ease: 'power2.in', stagger: 0.05 })
        .to(el, { opacity: 0, duration: reduced ? 0.01 : 0.6, ease: 'power2.out' })
        .then();
      el.remove();
    },
  };
}
