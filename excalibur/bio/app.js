(() => {
  const hero = document.querySelector('.hero');
  const actions = document.querySelector('.floating-actions');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let scheduled = false;
  function updateActions() {
    // Show on the way out of the opening screen; hide again on returning to it.
    const threshold = Math.min(120, hero.offsetHeight * 0.16);
    const visible = window.scrollY > threshold;
    actions.classList.toggle('is-visible', visible);
    actions.inert = !visible;
    scheduled = false;
  }
  function onScroll() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateActions); }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  window.addEventListener('pageshow', updateActions);
  updateActions();
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    document.body.classList.add('motion-ready');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('is-revealed'); observer.unobserve(entry.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }
  document.getElementById('year').textContent = new Date().getFullYear();
})();
