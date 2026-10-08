/* Navegação e componentes progressivos. O HTML preserva conteúdo e destinos. */
(() => {
  'use strict';
  const config = window.EXCALIBUR_CONFIG;
  if (!config) return;
  document.documentElement.classList.add('enhanced');
  const page = document.querySelector('#pagina');
  const menu = document.querySelector('#menu');
  const summary = menu.querySelector('summary');
  const navigation = document.querySelector('.navigation');
  const wheel = document.querySelector('.section-wheel');
  const wheelViewport = wheel.querySelector('.wheel-viewport');
  const navLinks = [...menu.querySelectorAll('nav a')];
  const sections = [...page.querySelectorAll('section[id]')];
  const mobile = matchMedia('(max-width: 1099px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const sectionLabel = link => link.querySelector('.nav-title').textContent.trim();
  const numberedLabel = link => link.querySelector('.nav-number').textContent.trim() + ' · ' + sectionLabel(link);
  const clampSection = index => Math.max(0, Math.min(navLinks.length - 1, index));
  let current = '';
  let gesture = null;
  let wheelPosition = 0;
  let wheelFrame = null;
  let wheelTarget = 0;
  let wheelDriving = false;
  let wheelStops = [];
  let suppressWheelClick = false;
  const currentIndex = () => Math.max(0, navLinks.findIndex(link => link.hash === '#' + current));
  const wheelRows = navLinks.map((link, index) => {
    link.setAttribute('aria-label', numberedLabel(link));
    const row = document.createElement('span');
    row.className = 'wheel-option';
    row.textContent = sectionLabel(link);
    row.dataset.index = index;
    wheelViewport.append(row);
    return row;
  });
  wheel.setAttribute('aria-valuemax', String(navLinks.length));
  const setCurrent = id => {
    if (id === current) return;
    current = id;
    navLinks.forEach(link => {
      if (link.hash === '#' + id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    const index = currentIndex();
    const link = navLinks[index];
    document.querySelector('#secao-atual').textContent = sectionLabel(link);
    document.querySelector('#secao-anterior').textContent = index > 0 ? sectionLabel(navLinks[index - 1]) : '';
    document.querySelector('#secao-proxima').textContent = index < navLinks.length - 1 ? sectionLabel(navLinks[index + 1]) : '';
    summary.setAttribute('aria-label', 'Navegar pelas seções. Atual: ' + numberedLabel(link));
    wheel.setAttribute('aria-valuenow', String(index + 1));
    wheel.setAttribute('aria-valuetext', `${index + 1} de ${navLinks.length}: ${sectionLabel(link)}`);
  };
  const rowHeight = () => wheelViewport.clientHeight / 3 || 36;
  const renderWheel = position => {
    wheelPosition = clampSection(position);
    const height = rowHeight();
    wheelRows.forEach((row, index) => {
      const distance = index - wheelPosition;
      const depth = Math.abs(distance);
      row.style.visibility = depth < 1.85 ? 'visible' : 'hidden';
      row.style.transform = `translateY(${distance * height}px) rotateX(${-distance * 24}deg) scale(${1 - Math.min(depth, 1.8) * .12})`;
      row.style.opacity = String(Math.max(0, 1 - depth * .48));
      row.classList.toggle('is-selected', index === Math.round(wheelPosition));
    });
  };
  const cancelWheelAnimation = () => {
    if (wheelFrame !== null) cancelAnimationFrame(wheelFrame);
    wheelFrame = null;
  };
  const measureWheelStops = () => {
    const viewport = page.getBoundingClientRect();
    const inset = parseFloat(getComputedStyle(page).scrollPaddingTop) || 0;
    const maxScroll = Math.max(0, page.scrollHeight - page.clientHeight);
    wheelStops = sections.map(section => Math.max(0, Math.min(maxScroll, page.scrollTop + section.getBoundingClientRect().top - viewport.top - page.clientTop - inset)));
  };
  const scrollAtPosition = position => {
    const lower = Math.floor(clampSection(position));
    const upper = Math.min(lower + 1, wheelStops.length - 1);
    return wheelStops[lower] + (wheelStops[upper] - wheelStops[lower]) * (position - lower);
  };
  const syncHistory = index => {
    const hash = navLinks[index].hash;
    if (location.hash !== hash) history.pushState(null, '', hash);
  };
  // Roda e conteúdo usam a mesma animação, inclusive no encaixe ao soltar.
  const settleWheel = (index, drivePage = true, commit = true) => {
    index = clampSection(Math.round(index));
    cancelWheelAnimation();
    wheelTarget = index;
    wheelDriving = drivePage;
    const startPosition = wheelPosition;
    const startScroll = page.scrollTop;
    if (drivePage) measureWheelStops();
    const targetScroll = wheelStops[index];
    const finish = () => {
      wheelFrame = null;
      renderWheel(index);
      if (drivePage) {
        page.scrollTo({top: targetScroll, behavior: 'instant'});
        setCurrent(sections[index].id);
        if (commit) syncHistory(index);
      }
      wheelDriving = false;
      navigation.removeAttribute('data-scrubbing');
      updateNavigationContrast();
    };
    if (reduced.matches || (Math.abs(startPosition - index) < .001 && (!drivePage || Math.abs(startScroll - targetScroll) < 1))) { finish(); return; }
    const started = performance.now();
    const tick = now => {
      const progress = Math.min(1, (now - started) / 220);
      const eased = 1 - Math.pow(1 - progress, 3);
      const position = startPosition + (index - startPosition) * eased;
      renderWheel(position);
      updateNavigationContrast();
      if (drivePage) {
        page.scrollTo({top: startScroll + (targetScroll - startScroll) * eased, behavior: 'instant'});
        setCurrent(sections[Math.round(position)].id);
      }
      if (progress < 1) wheelFrame = requestAnimationFrame(tick);
      else finish();
    };
    wheelFrame = requestAnimationFrame(tick);
  };
  const syncMenu = () => {
    cancelWheelAnimation();
    gesture = null;
    wheelDriving = false;
    navigation.removeAttribute('data-scrubbing');
    menu.open = !mobile.matches;
    wheel.hidden = !mobile.matches;
    summary.setAttribute('aria-expanded', String(menu.open));
    document.querySelector('.close-navigation').hidden = !mobile.matches;
    wheelTarget = currentIndex();
    renderWheel(wheelTarget);
  };
  syncMenu(); mobile.addEventListener('change', syncMenu);
  menu.addEventListener('toggle', () => summary.setAttribute('aria-expanded', String(menu.open)));
  // A cor acompanha a seção que está por trás do controle, inclusive no celular.
  const updateNavigationContrast = () => {
    const bounds = [...sections, document.querySelector(".footer")].filter(Boolean).map(section => ({section, rect: section.getBoundingClientRect()}));
    const setSurface = control => {
      const rect = control.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      let behind = bounds.find(item => item.rect.top <= center && item.rect.bottom > center)?.section;
      // No celular, o seletor também pode passar sobre cartões de outra cor.
      if (mobile.matches) {
        let element = document.elementsFromPoint(rect.right - (control === wheel ? 24 : 16), center).find(item => page.contains(item));
        while (element && element !== page) {
          const color = getComputedStyle(element).backgroundColor.match(/[\d.]+/g)?.map(Number);
          if (color && color.length >= 3 && (color.length < 4 || color[3] > .5)) { behind = element; break; }
          element = element.parentElement;
        }
      }
      const channels = behind ? getComputedStyle(behind).backgroundColor.match(/[\d.]+/g)?.map(Number) : null;
      const dark = channels && channels.length >= 3 && (channels.length < 4 || channels[3] > .5) && (channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 < 128);
      control.dataset.surface = dark ? 'dark' : 'light';
    };
    if (mobile.matches) {
      setSurface(wheel);
      wheelRows.filter(row => row.style.visibility === 'visible').forEach(setSurface);
    } else navLinks.forEach(setSurface);
  };
  let pending = false;
  const updateFromScroll = () => {
    updateNavigationContrast();
    if (wheelDriving || gesture) return;
    const viewport = page.getBoundingClientRect();
    const marker = viewport.top + Math.min(140, page.clientHeight * .25);
    let active = sections[0];
    for (const section of sections) if (section.getBoundingClientRect().top <= marker) active = section;
    if (page.scrollTop + page.clientHeight >= page.scrollHeight - 4) active = sections[sections.length - 1];
    setCurrent(active.id);
    if (mobile.matches && (wheelTarget !== currentIndex() || (wheelFrame === null && Math.abs(wheelPosition - currentIndex()) > .001))) settleWheel(currentIndex(), false, false);
  };
  page.addEventListener('scroll', () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { updateFromScroll(); pending = false; });
  }, {passive: true});
  window.addEventListener('resize', () => {
    if (gesture) finishWheelGesture(false);
    renderWheel(wheelPosition);
    updateFromScroll();
  });
  const closeNavigation = (restoreFocus = true) => {
    menu.open = false;
    if (restoreFocus) (mobile.matches ? wheel : summary).focus({preventScroll: true});
  };
  const scrollToSection = (id, focus = false) => {
    const target = document.getElementById(id);
    if (!target || !page.contains(target)) return;
    cancelWheelAnimation(); wheelDriving = false;
    if (mobile.matches) menu.open = false;
    if (focus) { target.tabIndex = -1; target.focus({preventScroll: true}); }
    target.scrollIntoView({behavior: reduced.matches ? 'auto' : 'smooth', block: 'start'});
    setCurrent(id);
  };
  // A roda do mouse sobre o menu continua movendo somente a página principal.
  const wheelOverControls = event => {
    if (event.ctrlKey || !event.deltaY || gesture) return;
    event.preventDefault();
    cancelWheelAnimation(); wheelDriving = false;
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? page.clientHeight : 1;
    page.scrollBy({top: event.deltaY * scale, behavior: 'instant'});
  };
  navigation.addEventListener('wheel', wheelOverControls, {passive: false});
  document.querySelector('.whatsapp-dock').addEventListener('wheel', wheelOverControls, {passive: false});
  wheel.addEventListener('pointerdown', event => {
    if (!mobile.matches || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    cancelWheelAnimation();
    page.scrollTo({top: page.scrollTop, behavior: 'instant'});
    measureWheelStops();
    gesture = {pointerId: event.pointerId, startY: event.clientY, lastY: event.clientY, startPosition: wheelPosition, rowHeight: rowHeight(), correction: page.scrollTop - scrollAtPosition(wheelPosition), moved: false};
    wheelDriving = true;
    wheel.setAttribute('data-pointer-focus', '');
    wheel.focus({preventScroll: true});
    wheel.setPointerCapture(event.pointerId);
  });
  wheel.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const delta = event.clientY - gesture.startY;
    gesture.lastY = event.clientY;
    if (!gesture.moved && Math.abs(delta) < 3) return;
    event.preventDefault();
    gesture.moved = true;
    navigation.setAttribute('data-scrubbing', '');
    // Arrastar para cima traz a próxima seção para o centro, como uma roda física.
    const position = clampSection(gesture.startPosition - delta / gesture.rowHeight);
    renderWheel(position);
    const correction = gesture.correction * Math.max(0, 1 - Math.abs(position - gesture.startPosition));
    page.scrollTo({top: scrollAtPosition(position) + correction, behavior: 'instant'});
    setCurrent(sections[Math.round(position)].id);
  });
  const finishWheelGesture = (commit = true) => {
    if (!gesture) return;
    const finished = gesture;
    gesture = null;
    if (wheel.hasPointerCapture(finished.pointerId)) wheel.releasePointerCapture(finished.pointerId);
    if (finished.moved) {
      suppressWheelClick = true;
      settleWheel(wheelPosition, true, commit);
      setTimeout(() => { suppressWheelClick = false; }, 400);
    } else {
      wheelDriving = false;
      navigation.removeAttribute('data-scrubbing');
      settleWheel(currentIndex(), false, false);
    }
  };
  wheel.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    const moved = gesture.moved;
    const center = wheel.getBoundingClientRect().top + wheel.clientHeight / 2;
    const tapOffset = Math.abs(event.clientY - center) < rowHeight() / 2 ? 0 : Math.sign(event.clientY - center);
    finishWheelGesture();
    if (!moved && tapOffset) settleWheel(currentIndex() + tapOffset);
  });
  wheel.addEventListener('pointercancel', () => finishWheelGesture(false));
  wheel.addEventListener('lostpointercapture', () => finishWheelGesture(false));
  wheel.addEventListener('click', event => {
    // Leitores de tela podem ativar vizinhos sem gerar eventos de ponteiro.
    if (suppressWheelClick || event.detail !== 0) return;
    const row = event.target.closest('.wheel-option');
    if (row) settleWheel(Number(row.dataset.index));
  });
  wheel.addEventListener('blur', () => wheel.removeAttribute('data-pointer-focus'));
  wheel.addEventListener('keydown', event => {
    wheel.removeAttribute('data-pointer-focus');
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(event.key)) return;
    event.preventDefault();
    const origin = wheelDriving ? wheelTarget : currentIndex();
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? navLinks.length - 1 : origin + ({ArrowDown: 1, ArrowUp: -1, PageDown: 3, PageUp: -3}[event.key]);
    settleWheel(target);
  });
  // Um novo gesto na página interrompe o encaixe, sem disputar com o visitante.
  page.addEventListener('pointerdown', () => {
    if (!wheelDriving || gesture) return;
    cancelWheelAnimation(); wheelDriving = false;
    navigation.removeAttribute('data-scrubbing'); updateFromScroll();
  }, {passive: true});
  navLinks.forEach((link, index) => link.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const destination = event.key === 'Home' ? 0 : event.key === 'End' ? navLinks.length - 1 : clampSection(index + (event.key === 'ArrowDown' ? 1 : -1));
    navLinks[destination].focus();
  }));
  document.querySelector('.close-navigation').addEventListener('click', () => closeNavigation());

  // Galeria: quatro imagens no computador, duas no celular, fluxo para a direita.
  // As cópias são apenas visuais e ficam fora da árvore de acessibilidade.
  const styles = document.querySelector('#estilos-lista');
  const originalSlides = [...styles.querySelectorAll('.style-slide')];
  const leadingCopies = document.createDocumentFragment();
  originalSlides.forEach(slide => {
    const copy = slide.cloneNode(true);
    copy.classList.add('carousel-copy');
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    styles.append(copy);
    const before = copy.cloneNode(true);
    before.inert = true;
    leadingCopies.append(before);
  });
  styles.prepend(leadingCopies);
  let loopWidth = 0;
  let carouselVisible = true;
  let carouselHover = false;
  let carouselTouch = false;
  let resumeAt = 0;
  let lastFrame = 0;
  let autoPosition = null;
  let frameId = null;
  const measureStyles = () => {
    autoPosition = null;
    const copy = styles.querySelector('.carousel-copy');
    loopWidth = originalSlides[0].offsetLeft - copy.offsetLeft;
    styles.scrollLeft = loopWidth;
  };
  const pauseStyles = () => { resumeAt = performance.now() + 2400; };
  const galleryTick = time => {
    frameId = null;
    const elapsed = lastFrame ? Math.min(time - lastFrame, 64) : 0;
    lastFrame = time;
    const keyboardFocus = styles.contains(document.activeElement) && document.activeElement.matches(':focus-visible');
    const canAdvance = !reduced.matches && carouselVisible && !document.hidden && !carouselHover && !carouselTouch && !keyboardFocus && time > resumeAt && loopWidth > 0;
    if (canAdvance) {
      if (autoPosition === null) autoPosition = styles.scrollLeft;
      autoPosition = loopWidth + ((autoPosition - loopWidth - elapsed * .042) % loopWidth + loopWidth) % loopWidth;
      styles.scrollLeft = autoPosition;
    } else autoPosition = null;
    if (!reduced.matches && carouselVisible && !document.hidden) frameId = requestAnimationFrame(galleryTick);
    else lastFrame = 0;
  };
  const startGallery = () => {
    if (frameId === null && !reduced.matches && carouselVisible && !document.hidden) frameId = requestAnimationFrame(galleryTick);
  };
  styles.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') carouselHover = true; });
  styles.addEventListener('pointerleave', event => {
    carouselHover = false;
    if (event.pointerType === 'mouse') { resumeAt = 0; startGallery(); }
  });
  styles.addEventListener('pointerdown', () => { carouselTouch = true; pauseStyles(); });
  const endGalleryTouch = () => { if (carouselTouch) { carouselTouch = false; pauseStyles(); } };
  window.addEventListener('pointerup', endGalleryTouch);
  window.addEventListener('pointercancel', endGalleryTouch);
  styles.addEventListener('wheel', pauseStyles, {passive: true});
  styles.addEventListener('keydown', event => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault(); pauseStyles();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const gap = parseFloat(getComputedStyle(styles).gap) || 0;
    styles.scrollBy({left: direction * (originalSlides[0].getBoundingClientRect().width + gap), behavior: reduced.matches ? 'auto' : 'smooth'});
  });
  styles.addEventListener('scroll', () => {
    if (!carouselTouch && loopWidth > 0) {
      if (styles.scrollLeft < loopWidth - 1) styles.scrollLeft += loopWidth;
      else if (styles.scrollLeft >= loopWidth * 2) styles.scrollLeft -= loopWidth;
    }
  }, {passive: true});
  if ('IntersectionObserver' in window) {
    const visibility = new IntersectionObserver(entries => { carouselVisible = entries[0].isIntersecting; startGallery(); }, {root: page, threshold: 0});
    visibility.observe(styles);
  }
  const resizeGallery = () => { measureStyles(); startGallery(); };
  window.addEventListener('resize', resizeGallery);
  mobile.addEventListener('change', resizeGallery);
  reduced.addEventListener('change', startGallery);
  document.addEventListener('visibilitychange', startGallery);
  measureStyles(); startGallery();

  // Avaliações: um avanço por vez, com tempo para leitura e bolinhas clicáveis.
  const reviews = document.querySelector('#avaliacoes-lista');
  const reviewCards = [...reviews.querySelectorAll('.review-card')];
  const reviewDots = [...document.querySelectorAll('.review-dot')];
  const dotGroup = document.querySelector('.review-dots');
  reviewCards.forEach(card => {
    const copy = card.cloneNode(true);
    copy.classList.remove('reveal', 'entering');
    copy.setAttribute('aria-hidden', 'true');
    copy.inert = true;
    reviews.append(copy);
  });
  let reviewIndex = 0;
  let reviewTimer = null;
  let reviewSettle = null;
  let reviewsVisible = false;
  let reviewsHovered = false;
  let reviewsTouched = false;
  const reviewStep = () => reviewCards[0].getBoundingClientRect().width + (parseFloat(getComputedStyle(reviews).gap) || 0);
  const updateReviewDots = index => {
    reviewIndex = ((index % reviewCards.length) + reviewCards.length) % reviewCards.length;
    reviewDots.forEach((dot, i) => {
      if (i === reviewIndex) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  };
  const stopReviewTimer = () => { clearTimeout(reviewTimer); reviewTimer = null; };
  const scheduleReview = () => {
    stopReviewTimer();
    const keyboardFocus = reviews.contains(document.activeElement) && document.activeElement.matches(':focus-visible');
    if (reduced.matches || !reviewsVisible || document.hidden || reviewsHovered || reviewsTouched || keyboardFocus || dotGroup.contains(document.activeElement)) return;
    reviewTimer = setTimeout(() => {
      reviews.scrollTo({left: (reviewIndex + 1) * reviewStep(), behavior: 'smooth'});
    }, 6500);
  };
  reviewDots.forEach((dot, i) => dot.addEventListener('click', () => {
    stopReviewTimer();
    reviews.scrollTo({left: i * reviewStep(), behavior: reduced.matches ? 'instant' : 'smooth'});
    updateReviewDots(i);
  }));
  reviews.addEventListener('scroll', () => {
    stopReviewTimer();
    clearTimeout(reviewSettle);
    const position = Math.round(reviews.scrollLeft / reviewStep());
    updateReviewDots(position);
    reviewSettle = setTimeout(() => {
      if (position >= reviewCards.length) reviews.scrollLeft = reviewIndex * reviewStep();
      scheduleReview();
    }, 150);
  }, {passive: true});
  reviews.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { reviewsHovered = true; stopReviewTimer(); } });
  reviews.addEventListener('pointerleave', () => { reviewsHovered = false; scheduleReview(); });
  reviews.addEventListener('pointerdown', () => { reviewsTouched = true; stopReviewTimer(); });
  const releaseReviews = () => { if (reviewsTouched) { reviewsTouched = false; scheduleReview(); } };
  window.addEventListener('pointerup', releaseReviews);
  window.addEventListener('pointercancel', releaseReviews);
  reviews.addEventListener('focusin', stopReviewTimer);
  reviews.addEventListener('focusout', () => setTimeout(scheduleReview, 0));
  dotGroup.addEventListener('focusin', stopReviewTimer);
  dotGroup.addEventListener('focusout', () => setTimeout(scheduleReview, 0));
  reviews.addEventListener('keydown', event => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const index = (reviewIndex + (event.key === 'ArrowRight' ? 1 : -1) + reviewCards.length) % reviewCards.length;
    reviews.scrollTo({left: index * reviewStep(), behavior: reduced.matches ? 'instant' : 'smooth'});
  });
  const reviewsObserver = new IntersectionObserver(entries => { reviewsVisible = entries[0].isIntersecting; scheduleReview(); }, {root: page, threshold: .1});
  reviewsObserver.observe(reviews);
  window.addEventListener('resize', () => { reviews.scrollLeft = reviewIndex * reviewStep(); scheduleReview(); });
  document.addEventListener('visibilitychange', scheduleReview);
  reduced.addEventListener('change', scheduleReview);

  document.querySelectorAll('a[href^="#"]').forEach(link => {
    if (link.classList.contains('map-link') || link.classList.contains('close-map')) return;
    link.addEventListener('click', event => {
      const id = link.hash.slice(1);
      if (!sections.some(s => s.id === id)) return;
      event.preventDefault();
      history.pushState(null, '', '#' + id);
      scrollToSection(id, true);
    });
  });
  window.addEventListener('popstate', () => scrollToSection(location.hash.slice(1) || 'inicio'));
  document.querySelectorAll('[data-wa]').forEach(link => {
    const message = config.messages[link.dataset.wa];
    link.href = config.destinations.whatsapp + '?text=' + encodeURIComponent(message);
  });
  document.querySelectorAll('[data-destination]').forEach(link => { link.href = config.destinations[link.dataset.destination]; });
  document.querySelector('#ano').textContent = new Date().getFullYear();
  document.querySelectorAll('.service-grid .card').forEach((card, i) => {
    const service = config.services[i];
    card.querySelector('h3').textContent = service.name;
    card.querySelector('.duration').firstChild.textContent = service.minutes + ' min ';
  });
  document.querySelectorAll('.complementary dl > div').forEach((row, i) => {
    row.querySelector('dt').textContent = config.complementary[i].name;
    row.querySelector('dd').textContent = config.complementary[i].minutes + ' min';
  });
  document.querySelectorAll('.products h3').forEach((heading, i) => { heading.textContent = config.products[i].name; });
  document.querySelectorAll('.units .card').forEach(card => {
    const unit = config.units[card.querySelector('.map-link').dataset.unit];
    const values = card.querySelectorAll('dd');
    values[0].textContent = unit.address || 'A confirmar com a equipe';
    values[1].textContent = unit.hours || 'Consulte com a equipe';
    if (unit.map) {
      const link = card.querySelector('.map-link');
      link.href = unit.map; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.querySelector('.control-note').textContent = 'Google Maps';
    }
  });
  // Clube: mesmos campos, mesma ordem, exemplos sem condições comerciais inventadas.
  document.querySelectorAll('input[name="modalidade"]').forEach(input => input.addEventListener('change', () => {
    const option = config.club[input.value];
    document.querySelectorAll('.plan').forEach(card => {
      card.querySelector('[data-field="modalidade"]').textContent = option.label;
      card.querySelector('[data-field="servico"]').textContent = option.service;
    });
    document.querySelector('#club-status').textContent = 'Comparativo demonstrativo atualizado: ' + option.label;
  }));
  // Entradas não escondem o conteúdo à espera de JavaScript.
  if ('IntersectionObserver' in window && !reduced.matches) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('entering'); observer.unobserve(entry.target);
    }), {root: page, threshold: .08});
    document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
  }
  // Carrossel manual com botões, teclado e rolagem nativa por toque.
  const carousel = document.querySelector('#equipe-lista');
  const prev = document.querySelector('#equipe-anterior');
  const next = document.querySelector('#equipe-proximo');
  const updateCarousel = () => {
    const overflow = carousel.scrollWidth > carousel.clientWidth + 2;
    prev.hidden = next.hidden = !overflow;
    prev.disabled = carousel.scrollLeft <= 2;
    next.disabled = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 2;
  };
  const moveCarousel = direction => {
    const card = carousel.querySelector('.team-card');
    carousel.scrollBy({left: direction * (card.getBoundingClientRect().width + 24), behavior: reduced.matches ? 'auto' : 'smooth'});
  };
  prev.addEventListener('click', () => moveCarousel(-1)); next.addEventListener('click', () => moveCarousel(1));
  carousel.addEventListener('scroll', updateCarousel, {passive: true});
  window.addEventListener('resize', updateCarousel);
  carousel.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); moveCarousel(event.key === 'ArrowRight' ? 1 : -1); }
  });
  // Mapas externos funcionam também sem JavaScript.
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && mobile.matches && menu.open) closeNavigation();
  });
  updateCarousel(); updateFromScroll();
  if (location.hash && sections.some(s => '#' + s.id === location.hash)) scrollToSection(location.hash.slice(1));
})();
