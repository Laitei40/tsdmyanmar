/**
 * Header interactions:
 * - Sticky + shrink on scroll
 * - Mobile menu toggle
 * - Nav dropdowns (hover + keyboard)
 * - Icon-based Language & Theme selectors
 * Accessible, dependency-free, production-ready
 */
(function () {
  const HEADER = document.querySelector('.site-header');
  const TOGGLE = document.querySelector('.nav-toggle');
  const NAV = document.getElementById('primary-nav');
  const SCROLL_THRESHOLD = 56;

  if (!HEADER) return;

  /* ------------------ Scroll behavior ------------------ */
  function onScroll() {
    const y = window.scrollY || window.pageYOffset;
    HEADER.classList.toggle('scrolled', y > SCROLL_THRESHOLD);
    HEADER.classList.toggle('shrink', y > SCROLL_THRESHOLD);
  }

  /* ------------------ Mobile menu ------------------ */
  function toggleMenu(open) {
    if (!NAV || !TOGGLE) return;
    const isOpen =
      typeof open === 'boolean'
        ? open
        : !HEADER.classList.contains('menu-open');

    HEADER.classList.toggle('menu-open', isOpen);
    NAV.setAttribute('aria-hidden', String(!isOpen));
    TOGGLE.setAttribute('aria-expanded', String(isOpen));

    if (isOpen) {
      const first = NAV.querySelector('a');
      if (first) first.focus();
    }
  }

  /* ------------------ Active link ------------------ */
  function highlightActive() {
    if (!NAV) return;
    const path = location.pathname.split('/').pop() || 'index.html';

    NAV.querySelectorAll('a').forEach((a) => {
      const href = (a.getAttribute('href') || '').split(/[?#]/)[0];
      const name = href.split('/').pop();

      if (name === path) {
        a.classList.add('is-current');
        a.setAttribute('aria-current', 'page');
        a.setAttribute('tabindex', '-1');
      } else {
        a.classList.remove('is-current');
        a.removeAttribute('aria-current');
        a.removeAttribute('tabindex');
      }
    });
  }

  /* ------------------ Nav dropdowns ------------------ */
  const DROPDOWNS = Array.from(document.querySelectorAll('.has-dropdown'));

  function closeNavDropdowns() {
    DROPDOWNS.forEach((d) => {
      d.classList.remove('open');
      const b = d.querySelector('.drop-toggle');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }

  DROPDOWNS.forEach((d) => {
    const btn = d.querySelector('.drop-toggle');
    const menu = d.querySelector('.dropdown');
    if (!btn || !menu) return;

    d.addEventListener('mouseenter', () => {
      d.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    });

    d.addEventListener('mouseleave', () => {
      d.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const open = d.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });

    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        d.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        const first = menu.querySelector('a');
        if (first) first.focus();
      }
      if (e.key === 'Escape') {
        d.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      }
    });
  });

  /* ------------------ Icon Dropdowns (Lang / Theme) ------------------ */
  function initIconDropdown(wrapSelector, selectId, icons) {
    const wrap = document.querySelector(wrapSelector);
    if (!wrap || wrap.dataset.ready) return;

    const select = wrap.querySelector(`#${selectId}`);
    if (!select) return;

    wrap.dataset.ready = '1';
    wrap.classList.add('icon-dropdown');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'select-toggle';
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');

    const icon = document.createElement('span');
    icon.className = 'icon';
    const label = document.createElement('span');
    label.className = 'meta';

    btn.append(icon, label);

    const menu = document.createElement('ul');
    menu.className = 'select-menu';
    menu.setAttribute('role', 'menu');

    function update(val) {
      const opt = select.querySelector(`option[value="${val}"]`);
      icon.innerHTML = icons[val]?.icon || '';
      label.textContent = wrapSelector === '.lang-wrap'
        ? (val || '').toUpperCase()
        : '';
      btn.setAttribute(
        'aria-label',
        `${selectId.includes('lang') ? 'Language' : 'Theme'}: ${opt?.textContent}`
      );

      menu.querySelectorAll('.item').forEach((i) => {
        i.setAttribute('aria-checked', i.dataset.value === val);
      });
    }

    Array.from(select.options).forEach((opt) => {
      const li = document.createElement('li');
      li.className = 'item';
      li.setAttribute('role', 'menuitemradio');
      li.dataset.value = opt.value;
      li.tabIndex = -1;
      li.textContent = opt.textContent;

      li.addEventListener('click', () => {
        select.value = opt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        update(opt.value);
        wrap.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        btn.focus();
      });

      menu.appendChild(li);
    });

    btn.addEventListener('click', () => {
      const open = wrap.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      if (open) menu.querySelector('.item')?.focus();
    });

    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) {
        wrap.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });

    wrap.append(btn, menu);
    select.style.display = 'none';
    update(select.value);
  }

  /* ------------------ Init ------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    highlightActive();
    onScroll();

    window.addEventListener('scroll', onScroll, { passive: true });

    if (TOGGLE) {
      TOGGLE.addEventListener('click', () => toggleMenu());
      TOGGLE.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleMenu();
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        toggleMenu(false);
        closeNavDropdowns();
      }
    });

    document.addEventListener('click', (e) => {
      if (
        !e.target.closest('.has-dropdown') &&
        !e.target.closest('.lang-wrap') &&
        !e.target.closest('.theme-wrap')
      ) {
        closeNavDropdowns();
      }
    });

    initIconDropdown('.lang-wrap', 'site-lang-select', {
      en: { icon: '🌐' },
      mara: { icon: '🌐' },
      my: { icon: '🌐' },
    });

    initIconDropdown('.theme-wrap', 'site-theme-select', {
      light: { icon: '☀️' },
      dark: { icon: '🌙' },
      system: { icon: '💻' },
    });
  });

  window.tsdHeader = { toggleMenu };
})();


