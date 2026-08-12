/* =============================================
   EMBASTEL EMBALAGENS — script.js
   ============================================= */

(function () {
  'use strict';

  // WhatsApp numbers
  const WHATSAPP_LOCAL  = '5549999930143'; // Xanxerê
  const WHATSAPP_REGION = '5549989133521'; // Outras cidades

  const DEFAULT_MESSAGE = 'Olá! Vim pelo site da Embastel e quero saber mais.';

  // Build wa.me link
  function buildWhatsappLink(number, message) {
    const text = encodeURIComponent(message || DEFAULT_MESSAGE);
    return `https://wa.me/${number}?text=${text}`;
  }

  // Open WhatsApp in a new tab
  function openWhatsapp(number, message) {
    const url = buildWhatsappLink(number, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // ==========================
  // 1) Modal: choose origin
  // ==========================
  const modal = document.getElementById('waModal');
  const stepChoice = modal.querySelector('.wa-modal__step--choice');
  const stepCity = modal.querySelector('.wa-modal__step--city');
  const cityInput = document.getElementById('waCityInput');
  let pendingMessage = DEFAULT_MESSAGE;

  function showStep(step) {
    const city = step === 'city';
    stepChoice.hidden = city;
    stepCity.hidden = !city;
    if (city) {
      cityInput.value = '';
      setTimeout(() => cityInput.focus(), 60);
    }
  }
  function openModal(message, step) {
    pendingMessage = message || DEFAULT_MESSAGE;
    showStep(step || 'choice');
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    modal.hidden = true;
    document.body.style.overflow = '';
  }

  // Send to region number including the city in the message
  function sendRegionWithCity() {
    const city = (cityInput.value || '').trim();
    const message = city
      ? `${pendingMessage} Sou de ${city}.`
      : pendingMessage;
    openWhatsapp(WHATSAPP_REGION, message);
    closeModal();
  }

  // Close handlers
  modal.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', closeModal);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });

  // Step 1: origin choice
  modal.querySelectorAll('[data-modal-choice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const choice = btn.getAttribute('data-modal-choice');
      if (choice === 'local') {
        openWhatsapp(WHATSAPP_LOCAL, pendingMessage);
        closeModal();
      } else {
        showStep('city'); // ask for the city
      }
    });
  });

  // Step 2: back + confirm city
  const backBtn = modal.querySelector('[data-modal-back]');
  if (backBtn) backBtn.addEventListener('click', () => showStep('choice'));
  const cityConfirm = modal.querySelector('[data-modal-city-confirm]');
  if (cityConfirm) cityConfirm.addEventListener('click', sendRegionWithCity);
  cityInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); sendRegionWithCity(); }
  });

  // ==========================
  // 2) WhatsApp routing
  // ==========================
  // [data-whatsapp]         → asks origin (modal)
  // [data-whatsapp-direct]  → "local" goes direct; "region" asks the city
  document.addEventListener('click', (e) => {
    const directEl = e.target.closest('[data-whatsapp-direct]');
    if (directEl) {
      e.preventDefault();
      const target = directEl.getAttribute('data-whatsapp-direct');
      const message = directEl.getAttribute('data-message') || DEFAULT_MESSAGE;
      if (target === 'local') {
        openWhatsapp(WHATSAPP_LOCAL, message);
      } else {
        openModal(message, 'city'); // region → pede a cidade
      }
      return;
    }

    const askEl = e.target.closest('[data-whatsapp]');
    if (askEl) {
      e.preventDefault();
      const message = askEl.getAttribute('data-message') || DEFAULT_MESSAGE;
      openModal(message);
    }
  });

  // ==========================
  // 3) Sticky header shadow
  // ==========================
  const header = document.getElementById('header');
  function onScroll() {
    if (window.scrollY > 8) header.classList.add('is-scrolled');
    else header.classList.remove('is-scrolled');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ==========================
  // 4) Mobile menu toggle
  // ==========================
  const menuToggle = document.getElementById('menuToggle');
  const nav = document.getElementById('nav');
  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      menuToggle.classList.toggle('is-active', isOpen);
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    });
    nav.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        nav.classList.remove('is-open');
        menuToggle.classList.remove('is-active');
        menuToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ==========================
  // 5) Reveal on scroll
  // ==========================
  const revealTargets = document.querySelectorAll(
    '.section__head, .cat-card, .benefit, .testimonial, .about__content, .about__visual, .contact__block, .contact__map, .faq__item, .stats__item'
  );
  revealTargets.forEach((el) => el.classList.add('reveal'));

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add('is-visible'));
  }

  // ==========================
  // 6) Footer year
  // ==========================
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ==========================
  // 7) Catalog tabs
  // ==========================
  const tabs = document.querySelectorAll('.catalog__tab');
  const panels = document.querySelectorAll('.catalog__panel');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-tab');
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', String(active));
      });
      panels.forEach((p) => {
        const match = p.getAttribute('data-panel') === target;
        p.classList.toggle('is-active', match);
        p.hidden = !match;
      });
    });
  });

})();
