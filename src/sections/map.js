// Mapa de España en matriz de puntos (Natural Earth, dominio público) con los
// cinco centros enlazados. Canvas 2D: ligero y nítido en cualquier densidad.
import grid from '../assets/spain-grid.json';
import { CENTERS } from '../content.js';

const C = {
  other: 'rgba(138,147,166,0.22)',
  spain: 'rgba(186,194,208,0.62)',
  near: '#3FA9FF',
  lead: '#FF6B1A',
  blue: '#3FA9FF',
  ink: '#F2F4F8',
  mute: '#8A93A6',
};

export function initMap({ reduced }) {
  const canvas = document.getElementById('map');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const list = document.getElementById('centros');

  const toCell = (lat, lon) => ({
    i: (lon - grid.lonMin) / grid.stepLon - 0.5,
    j: (grid.latMax - lat) / grid.step - 0.5,
  });
  const centers = CENTERS.map((c) => ({ ...c, ...toCell(c.lat, c.lon) }));
  const lead = centers.find((c) => c.lead);

  const pts = (arr, kind) => {
    const out = [];
    for (let k = 0; k < arr.length; k += 2) {
      const i = arr[k];
      const j = arr[k + 1];
      let near = 0;
      if (kind !== 'other') {
        for (const c of centers) {
          const d = Math.hypot(i - c.i, j - c.j);
          if (d < 2.6) near = Math.max(near, 1 - d / 2.6);
        }
      }
      out.push({ i, j, kind, near });
    }
    return out;
  };
  const dots = [...pts(grid.other, 'other'), ...pts(grid.spain, 'spain'), ...pts(grid.canarias, 'spain')];

  let W = 0;
  let H = 0;
  let cell = 1;
  let dpr = 1;
  const base = document.createElement('canvas'); // matriz de puntos pre-renderizada
  const bctx = base.getContext('2d');
  const px = (i) => (i + 0.5) * cell;

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width;
    H = r.height;
    canvas.width = base.width = Math.round(W * dpr);
    canvas.height = base.height = Math.round(H * dpr);
    cell = Math.min(W / grid.cols, H / grid.rows);
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, W, H);
    const r0 = Math.max(1, cell * 0.26);
    for (const d of dots) {
      if (d.kind === 'other') bctx.fillStyle = C.other;
      else if (d.near > 0) {
        bctx.fillStyle = C.near;
        bctx.globalAlpha = 0.35 + d.near * 0.5;
      } else bctx.fillStyle = C.spain;
      bctx.beginPath();
      bctx.arc(px(d.i), px(d.j), r0, 0, Math.PI * 2);
      bctx.fill();
      bctx.globalAlpha = 1;
    }
  }

  let hot = null;
  let start = null;
  let running = false;

  function draw(now) {
    if (start === null) start = now;
    const t = (now - start) / 1000;
    const intro = reduced ? 1 : Math.min(1, t / 1.2);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // barrido de izquierda a derecha en la entrada
    const sx = intro * canvas.width;
    if (sx > 0) ctx.drawImage(base, 0, 0, sx, canvas.height, 0, 0, sx, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (intro < 1) {
      const x = sx / dpr;
      const g = ctx.createLinearGradient(x - 40, 0, x, 0);
      g.addColorStop(0, 'rgba(63,169,255,0)');
      g.addColorStop(1, 'rgba(63,169,255,0.35)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 40, 0, 40, H);
      ctx.fillStyle = C.blue;
      ctx.fillRect(x - 1, 0, 1.5, H);
    }

    // recuadro de Canarias
    const [oi, oj, cw, ch] = grid.inset;
    ctx.strokeStyle = 'rgba(138,147,166,0.35)';
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    ctx.strokeRect(oi * cell, oj * cell, cw * cell, ch * cell);
    ctx.setLineDash([]);

    // enlaces desde el centro líder
    const linkP = reduced ? 1 : Math.min(1, Math.max(0, (t - 1.0) / 1.4));
    for (const c of centers) {
      if (c === lead) continue;
      const ax = px(lead.i);
      const ay = px(lead.j);
      const bx = px(c.i);
      const by = px(c.j);
      // punto de control perpendicular al enlace: arco tipo salto por satélite
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      let nx = -dy / len;
      let ny = dx / len;
      if (ny > 0 || (ny === 0 && nx > 0)) (nx = -nx), (ny = -ny);
      const lift = Math.max(len * 0.32, cell * 3);
      const mx = (ax + bx) / 2 + nx * lift;
      const my = (ay + by) / 2 + ny * lift;
      const isHot = hot === c.id;
      ctx.strokeStyle = isHot ? C.blue : 'rgba(63,169,255,0.55)';
      ctx.lineWidth = isHot ? 2 : 1.2;
      ctx.beginPath();
      const steps = 40;
      for (let k = 0; k <= steps * linkP; k++) {
        const u = k / steps;
        const x = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * mx + u * u * bx;
        const y = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * my + u * u * by;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // paquete que viaja por el enlace
      if (linkP >= 1 && !reduced) {
        const u = (t * 0.35 + c.i * 0.07) % 1;
        const x = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * mx + u * u * bx;
        const y = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * my + u * u * by;
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // nodos
    const labelSize = Math.max(11, Math.min(13, W / 52));
    ctx.font = `500 ${labelSize}px Barlow, sans-serif`;
    for (const c of centers) {
      const x = px(c.i);
      const y = px(c.j);
      const col = c.lead ? C.lead : C.blue;
      const isHot = hot === c.id;
      const show = reduced ? 1 : Math.min(1, Math.max(0, (t - 0.6) / 0.5));
      ctx.globalAlpha = show;
      if (!reduced) {
        const ph = (t * 0.6 + c.i * 0.05) % 1;
        ctx.strokeStyle = col;
        ctx.globalAlpha = show * (1 - ph) * 0.8;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(x, y, 5 + ph * cell * 3.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = show;
      }
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, isHot ? 7 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#05080F';
      ctx.lineWidth = 2;
      ctx.stroke();
      // etiqueta
      const text = c.name;
      const tw = ctx.measureText(text).width;
      const leftSide = x + tw + 18 > W;
      const lx = leftSide ? x - 12 - tw : x + 12;
      const ly = c.id === 'jb' ? y - 10 : c.id === 'gp' ? y + 16 : y + 4;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(5,8,15,0.9)';
      ctx.lineWidth = 4;
      ctx.strokeText(text, lx, ly);
      ctx.fillStyle = isHot ? C.ink : 'rgba(242,244,248,0.88)';
      ctx.fillText(text, lx, ly);
      ctx.globalAlpha = 1;
    }

    if (running && !reduced) requestAnimationFrame(draw);
  }

  function play() {
    if (running) return;
    running = true;
    requestAnimationFrame(draw);
  }
  function pause() {
    running = false;
  }

  resize();
  window.addEventListener('resize', () => {
    resize();
    if (!running) requestAnimationFrame(draw);
  });

  const io = new IntersectionObserver(
    ([e]) => {
      if (e.isIntersecting) {
        if (reduced) requestAnimationFrame(draw);
        else play();
      } else pause();
    },
    { threshold: 0.05 },
  );
  io.observe(canvas);

  // resaltar un centro al pasar por la lista
  list?.querySelectorAll('[data-center]').forEach((li) => {
    const on = () => {
      hot = li.dataset.center;
      list.querySelectorAll('li').forEach((x) => x.classList.toggle('is-hot', x === li));
      if (!running) requestAnimationFrame(draw);
    };
    const off = () => {
      hot = null;
      li.classList.remove('is-hot');
      if (!running) requestAnimationFrame(draw);
    };
    li.addEventListener('pointerenter', on);
    li.addEventListener('pointerleave', off);
  });
}
