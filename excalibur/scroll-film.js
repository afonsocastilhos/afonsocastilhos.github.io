/* Quadros do vídeo enviado por Afonso: a rolagem controla o tempo da cena. */
(() => {
  'use strict';
  const section = document.querySelector('#seu-estilo');
  const canvas = section?.querySelector('.scroll-film-canvas');
  const scroller = document.querySelector('#pagina');
  if (!canvas || !scroller) return;
  const context = canvas.getContext('2d', {alpha: false});
  if (!context) return;
  const count = 96;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const cache = new Map();
  const failed = new Set();
  const inFlight = new Set();
  let desired = 0, active = false, started = false, animation = 0, drawn = -1;
  const source = index => `assets/scroll-film/frame-${String(index).padStart(3, '0')}.webp`;
  const render = () => {
    if (!cache.size) return;
    let best = cache.has(desired) ? desired : [...cache.keys()].reduce((a,b) => Math.abs(b-desired)<Math.abs(a-desired)?b:a);
    if (best === drawn) return;
    context.drawImage(cache.get(best), 0, 0, canvas.width, canvas.height);
    drawn = best;
    canvas.classList.add('is-ready');
  };
  const load = index => {
    inFlight.add(index);
    const image = new Image();
    image.decoding = 'async';
    image.onload = async () => {
      try { await image.decode(); } catch (_) { /* onload is a usable fallback */ }
      cache.set(index, image); inFlight.delete(index);
      while (cache.size > 24) {
        const farthest = [...cache.keys()].reduce((a,b) => Math.abs(b-desired)>Math.abs(a-desired)?b:a);
        cache.delete(farthest);
      }
      if (active || reduced.matches) render();
      fill();
    };
    image.onerror = () => {failed.add(index); inFlight.delete(index); fill();};
    image.src = source(index);
  };
  const fill = () => {
    if (!started || document.hidden) return;
    const candidates = reduced.matches ? [48] : Array.from({length: 17}, (_,i) => desired+i-8).filter(i => i>=0 && i<count).sort((a,b) => Math.abs(a-desired)-Math.abs(b-desired));
    for (const index of candidates) {
      if (inFlight.size >= 6) break;
      if (!cache.has(index) && !inFlight.has(index) && !failed.has(index)) load(index);
    }
  };
  const update = () => {
    animation = 0;
    const rect = section.getBoundingClientRect();
    const viewport = scroller.getBoundingClientRect();
    active = rect.bottom > viewport.top && rect.top < viewport.bottom;
    const progress = Math.max(0, Math.min(1, (viewport.bottom-rect.top)/(scroller.clientHeight+rect.height)));
    desired = reduced.matches ? 48 : Math.round(progress*(count-1));
    if (active || reduced.matches) render();
    if (started) fill();
  };
  const schedule = () => {if (!animation) animation=requestAnimationFrame(update);};
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {started=true; schedule(); observer.disconnect();}
  }, {root: scroller, rootMargin: '600px 0px'});
  observer.observe(section);
  scroller.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('resize', schedule, {passive: true});
  reduced.addEventListener('change', schedule);
  document.addEventListener('visibilitychange', () => {if (!document.hidden) schedule();});
  update();
})();
