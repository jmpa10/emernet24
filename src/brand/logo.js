// Marca EMER-NET 24 redibujada en vectorial (a partir de LogoEmernet24.jpeg)
// para que funcione sobre fondo oscuro. Todo usa currentColor; el knockout
// (hueco entre el arco de enlace y los arcos de las estaciones) usa --logo-knock.

const cells = (x0) => {
  // 4 × 2 células de panel solar
  let out = '';
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 2; r++) {
      out += `<rect class="lg-fill" x="${x0 + c * 10 + 1}" y="${-10 + r * 10 + 1}" width="8" height="8" rx="0.6"/>`;
    }
  }
  return out;
};

const station = (cx) => [11, 17, 23]
  .map((r) => `<path class="lg-stroke" pathLength="1" d="M${cx - r} 128 A${r} ${r} 0 0 1 ${cx + r} 128"/>`)
  .join('');

export const logoSVG = (title = '') => `
<svg class="logo" viewBox="10 0 220 136" xmlns="http://www.w3.org/2000/svg" ${title ? `role="img" aria-label="${title}"` : 'aria-hidden="true"'}>
  <g fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round">
    ${station(78)}
    ${station(162)}
    <path d="M78 124 Q120 88 162 124" stroke="var(--logo-knock, #05080F)" stroke-width="11" stroke-linecap="butt"/>
    <path class="lg-stroke" pathLength="1" d="M78 124 Q120 88 162 124"/>
  </g>
  <path class="lg-fill" d="M22 129.4 L120 125.6 L218 129.4 L120 130.6 Z" fill="currentColor"/>
  <circle class="lg-fill" cx="78" cy="124" r="5.5" fill="currentColor"/>
  <circle class="lg-fill" cx="162" cy="124" r="5.5" fill="currentColor"/>

  <g transform="translate(118 50) rotate(40)" fill="currentColor">
    ${cells(-59)}
    ${cells(19)}
    <rect class="lg-fill" x="-19" y="-1.6" width="10" height="3.2"/>
    <rect class="lg-fill" x="9" y="-1.6" width="10" height="3.2"/>
    <rect class="lg-fill" x="-9" y="-13" width="18" height="26" rx="3"/>
    <circle cx="0" cy="-3" r="3" fill="var(--logo-knock, #05080F)"/>
    <g class="lg-fill">
      <rect x="-1.4" y="12" width="2.8" height="7"/>
      <path d="M-11 19 Q0 31 11 19 Z"/>
      <rect x="-1" y="24" width="2" height="9"/>
      <circle cx="0" cy="34.5" r="2.6"/>
    </g>
    <g fill="none" stroke="currentColor" stroke-width="4.4" stroke-linecap="round">
      <path class="lg-stroke lg-signal" pathLength="1" d="M-8 -24 A12 12 0 0 1 8 -24"/>
      <path class="lg-stroke lg-signal" pathLength="1" d="M-14 -31 A20 20 0 0 1 14 -31"/>
      <path class="lg-stroke lg-signal" pathLength="1" d="M-20 -38 A28 28 0 0 1 20 -38"/>
    </g>
  </g>
</svg>`;

export function mountLogos(root = document) {
  root.querySelectorAll('[data-logo]').forEach((el) => {
    el.innerHTML = logoSVG();
  });
}
