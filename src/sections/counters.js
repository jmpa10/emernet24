import { gsap } from 'gsap';

const fmt = new Intl.NumberFormat('es-ES', { useGrouping: 'always' });

/** Anima la cifra de un paso de 0 a su valor final */
export function countUp(el, { reduced }) {
  const to = Number(el.dataset.to);
  const format = el.dataset.format === 'miles' ? (v) => fmt.format(v) : (v) => String(v);
  if (reduced) {
    el.textContent = format(to);
    return;
  }
  el._tween?.kill();
  const o = { v: 0 };
  el._tween = gsap.to(o, {
    v: to,
    duration: 1,
    ease: 'expo.out',
    onUpdate: () => (el.textContent = format(Math.round(o.v))),
  });
}
