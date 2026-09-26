// Convierte el scroll en un escalar de historia `story`:
//   story = índice de sección + progreso dentro de ella (0 portada … 5 cierre).
// Para secciones fijadas (data-pin) ofrece además `pinned(i)`: progreso 0→1
// mientras el contenido está pegado a la pantalla.

import { clamp } from './scene/util.js';

export class ScrollStory {
  constructor() {
    this.sections = [...document.querySelectorAll('[data-scene]')];
    this.tops = [];
    this.heights = [];
    this.vh = window.innerHeight;
    this.story = 0;
    this.progress = 0;
    this.measure();
    window.addEventListener('resize', () => this.measure());
  }

  measure() {
    this.vh = window.innerHeight;
    const y = window.scrollY;
    this.tops = this.sections.map((el) => el.getBoundingClientRect().top + y);
    this.heights = this.sections.map((el) => el.offsetHeight);
    this.docEnd = document.documentElement.scrollHeight - this.vh;
  }

  update(y = window.scrollY) {
    const { tops } = this;
    const n = tops.length;
    let i = 0;
    while (i < n - 1 && y >= tops[i + 1]) i++;
    const end = i < n - 1 ? tops[i + 1] : Math.max(tops[i] + 1, this.docEnd);
    this.story = i + clamp((y - tops[i]) / (end - tops[i]));
    this.progress = clamp(y / Math.max(1, this.docEnd));
    this.y = y;
    return this.story;
  }

  /** progreso 0→1 del tramo fijado de la sección i */
  pinned(i, y = this.y) {
    const run = this.heights[i] - this.vh;
    return clamp((y - this.tops[i]) / Math.max(1, run));
  }

  /** fracción de `story` en la que termina el tramo fijado de la sección i */
  pinEnd(i) {
    const run = this.heights[i] - this.vh;
    const span = (this.tops[i + 1] ?? this.tops[i] + this.heights[i]) - this.tops[i];
    return clamp(run / Math.max(1, span));
  }
}
