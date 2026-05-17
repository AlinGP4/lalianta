/* ============================================================
   LA LIANTA — Interactions
============================================================ */
(function () {
  // ---------- Age gate ----------
  const ageGate = document.querySelector('.age-gate');
  const ageEnter = document.querySelector('[data-age-enter]');
  const ageDecline = document.querySelector('[data-age-decline]');

  function dismissAgeGate() {
    ageGate.classList.add('is-hidden');
    document.body.style.overflow = '';
    try { sessionStorage.setItem('lalianta_age_ok', '1'); } catch (e) {}
  }

  try {
    if (sessionStorage.getItem('lalianta_age_ok') === '1') {
      ageGate.classList.add('is-hidden');
    } else {
      document.body.style.overflow = 'hidden';
    }
  } catch (e) {
    document.body.style.overflow = 'hidden';
  }

  ageEnter?.addEventListener('click', dismissAgeGate);
  ageDecline?.addEventListener('click', () => {
    ageGate.querySelector('.age-gate__inner').innerHTML =
      '<div class="age-gate__monogram">L</div>' +
      '<h2>Vuelve cuando estés listo.</h2>' +
      '<p>Este sitio es exclusivo para mayores de 18 años. Te esperamos.</p>';
  });

  // ---------- Sticky nav ----------
  const nav = document.querySelector('.nav');
  const onScroll = () => {
    if (window.scrollY > 24) nav.classList.add('is-scrolled');
    else nav.classList.remove('is-scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Mobile menu ----------
  const toggle = document.querySelector('.nav__toggle');
  toggle?.addEventListener('click', () => {
    document.body.classList.toggle('menu-open');
  });
  document.querySelectorAll('.nav__links a').forEach(a => {
    a.addEventListener('click', () => document.body.classList.remove('menu-open'));
  });

  // ---------- Reveal on scroll ----------
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // ---------- Parallax (hero mascot + floats) ----------
  const parallaxItems = document.querySelectorAll('[data-parallax]');
  let ticking = false;
  function applyParallax() {
    const y = window.scrollY;
    parallaxItems.forEach(el => {
      const speed = parseFloat(el.dataset.parallax) || 0.1;
      el.style.transform = `translate3d(0, ${y * speed}px, 0)`;
    });
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(applyParallax);
      ticking = true;
    }
  }, { passive: true });

  // ---------- Menu tabs ----------
  const tabs = document.querySelectorAll('.menu__tab');
  const panels = document.querySelectorAll('.menu__panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.toggle('is-active', t === tab));
      panels.forEach(p => p.classList.toggle('is-active', p.dataset.panel === target));
    });
  });

  // ---------- Year ----------
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
