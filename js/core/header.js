/**
 * Header interactions: sticky behavior, shrink on scroll, mobile drawer toggle,
 * active link highlighting, and basic keyboard accessibility.
 * Lightweight, no dependencies.
 * 
 * USAGE: Call window.initHeader() after header HTML is loaded into the page.
 */
(function(){
  'use strict';

  // Module state
  let HEADER = null;
  let TOGGLE = null;
  let NAV = null;
  const SCROLL_THRESHOLD = 56;
  let initialized = false;

  function onScroll(){
    const y = window.scrollY || window.pageYOffset;
    if (!HEADER) return;
    if (y > SCROLL_THRESHOLD){
      HEADER.classList.add('scrolled');
      HEADER.classList.add('shrink');
    } else {
      HEADER.classList.remove('scrolled');
      HEADER.classList.remove('shrink');
    }
  }

  function toggleMenu(open){
    if (!HEADER || !NAV || !TOGGLE) return;
    const drawer = document.getElementById('mobile-drawer');
    const backdrop = document.querySelector('.drawer-backdrop');
    const isOpen = typeof open === 'boolean' ? open : !HEADER.classList.contains('menu-open');
    
    HEADER.classList.toggle('menu-open', isOpen);
    TOGGLE.classList.toggle('open', isOpen);
    NAV.setAttribute('aria-hidden', String(!isOpen));
    TOGGLE.setAttribute('aria-expanded', String(isOpen));
    
    // Also toggle the mobile drawer
    if (drawer) {
      drawer.classList.toggle('open', isOpen);
      drawer.setAttribute('aria-hidden', String(!isOpen));
    }
    if (backdrop) {
      backdrop.classList.toggle('active', isOpen);
    }
    // Lock/unlock body scroll
    document.body.classList.toggle('drawer-open', isOpen);
    
    if (isOpen){
      // focus first link in drawer or nav
      const drawerFirstLink = drawer && drawer.querySelector('a');
      const navFirstLink = NAV.querySelector('a');
      const first = drawerFirstLink || navFirstLink;
      if (first) first.focus();
    }
  }

  function onKey(e){
    if (!HEADER) return;
    // close menu with Escape
    if (e.key === 'Escape' && HEADER.classList.contains('menu-open')){
      toggleMenu(false);
      TOGGLE.focus();
    }
  }

  function highlightActive(){
    if (!NAV) return;
    const links = Array.from(NAV.querySelectorAll('a'));
    const path = location.pathname.split('/').pop() || 'index.html';
    // Helper to ignore query/hash and normalize file names
    const normalize = s => (s || '').split('#')[0].split('?')[0];
    links.forEach(a => {
      const href = a.getAttribute('href') || '';
      const name = normalize(href.split('/').pop());
      if (name === path){
        a.classList.add('active','is-current');
        a.setAttribute('aria-current','page');
        a.setAttribute('aria-disabled','true');
        a.setAttribute('tabindex','-1');
      } else {
        a.classList.remove('is-current');
        a.removeAttribute('aria-current');
        a.removeAttribute('aria-disabled');
        a.removeAttribute('tabindex');
      }
    });
    
    // Also highlight active links in drawer
    const drawer = document.getElementById('mobile-drawer');
    if (drawer) {
      const drawerLinks = Array.from(drawer.querySelectorAll('a'));
      drawerLinks.forEach(a => {
        const href = a.getAttribute('href') || '';
        const name = normalize(href.split('/').pop());
        if (name === path){
          a.classList.add('active','is-current');
          a.setAttribute('aria-current','page');
        } else {
          a.classList.remove('is-current');
          a.removeAttribute('aria-current');
        }
      });
    }
  }

  function closeAllDropdowns(){
    const DROPDOWNS = Array.from(document.querySelectorAll('.has-dropdown'));
    DROPDOWNS.forEach(d=>{
      d.classList.remove('open');
      const b = d.querySelector('.drop-toggle');
      if (b) b.setAttribute('aria-expanded','false');
    });
  }

  function initDropdowns(){
    const DROPDOWNS = Array.from(document.querySelectorAll('.has-dropdown'));
    
    DROPDOWNS.forEach(d=>{
      const btn = d.querySelector('.drop-toggle');
      const menu = d.querySelector('.dropdown');
      if (!btn || !menu) return;

      // update aria-expanded on hover so assistive tech sees current state
      d.addEventListener('mouseenter', ()=>{ d.classList.add('open'); btn.setAttribute('aria-expanded','true'); });
      d.addEventListener('mouseleave', ()=>{ if (!d.classList.contains('open')){ btn.setAttribute('aria-expanded','false'); } d.classList.remove('open'); });

      // click/tap toggles (useful for mobile and keyboard users)
      btn.addEventListener('click', (e)=>{
        const isOpen = d.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(isOpen));
      });

      // keyboard navigation: open with ArrowDown, close with Escape
      btn.addEventListener('keydown', (e)=>{
        if (e.key === 'ArrowDown'){
          e.preventDefault();
          d.classList.add('open');
          btn.setAttribute('aria-expanded','true');
          const first = menu.querySelector('a'); if (first) first.focus();
        } else if (e.key === 'Escape'){
          d.classList.remove('open');
          btn.setAttribute('aria-expanded','false');
          btn.focus();
        }
      });

      // close dropdown when focus leaves the region
      d.addEventListener('focusout', ()=>{
        setTimeout(()=>{
          if (!d.contains(document.activeElement)){
            d.classList.remove('open');
            btn.setAttribute('aria-expanded','false');
          }
        }, 10);
      });
    });
  }

  /* --- Custom header selectors: Language and Theme --- */
  function initHeaderSelectors(){
    // Feature flag: set to `true` to enable icon-trigger dropdowns (globe/sun)
    const ENABLE_ICON_DROPDOWNS = true;

    // If the feature is disabled, remove any prior enhancements and restore native selects
    function restoreNativeSelectors(){
      ['.lang-wrap','.theme-wrap'].forEach(sel=>{
        const wrap = document.querySelector(sel);
        if (!wrap) return;
        // remove injected custom UI elements if present
        Array.from(wrap.querySelectorAll('.select-toggle,.select-menu')).forEach(el=> el.remove());
        // remove enhancement markers
        if (wrap.classList.contains('enhanced')) wrap.classList.remove('enhanced');
        if (wrap.dataset.customInit) delete wrap.dataset.customInit;
        // restore native select inline styles (in case JS previously hid them)
        const select = wrap.querySelector('select');
        if (select){
          try{ select.style.pointerEvents = ''; select.style.opacity = ''; select.style.display = ''; select.removeAttribute('aria-hidden'); }catch(e){}
        }
      });
    }

    if (!ENABLE_ICON_DROPDOWNS){
      restoreNativeSelectors();
      return;
    }

    function createMenuFromSelect(wrapSelector, selectId, optionsMap){
      const wrap = document.querySelector(wrapSelector);
      if (!wrap) return;
      // If already initialized, skip
      if (wrap.dataset.customInit) return;
      
      const select = wrap.querySelector('#' + selectId);
      if (!select) return;

      // build toggle (icon-first compact button)
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'select-toggle';
      btn.setAttribute('aria-haspopup','menu');
      btn.setAttribute('aria-expanded','false');
      btn.id = selectId + '-toggle';

      // icon container (primary visible trigger)
      const iconSpan = document.createElement('span'); iconSpan.className = 'icon';
      // optional small label/meta next to icon (used for languages)
      const metaSpan = document.createElement('span'); metaSpan.className = 'meta';
      btn.appendChild(iconSpan);
      btn.appendChild(metaSpan);

      // default icon fallbacks
      const defaultLangIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z" fill="currentColor"/><path d="M2 12h20M12 2v20" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
      const defaultThemeIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>';
      iconSpan.innerHTML = (optionsMap && optionsMap[select.value] && optionsMap[select.value].icon) || (wrapSelector === '.lang-wrap' ? defaultLangIcon : defaultThemeIcon);

      wrap.classList.add('icon');
      if (wrapSelector === '.lang-wrap'){
        btn.classList.add('icon-with-label');
      }

      // build menu
      const menu = document.createElement('ul');
      menu.className = 'select-menu';
      if (wrapSelector === '.lang-wrap' || wrapSelector === '.theme-wrap'){
        menu.classList.add('brand-dropdown');
      }
      menu.setAttribute('role','menu');
      menu.setAttribute('tabindex','-1');
      menu.setAttribute('aria-labelledby', btn.id);

      // helper to update icon, optional label and selected state
      function updateSelected(val){
        const option = Array.from(select.options).find(o=>o.value===val) || select.options[0];
        if (optionsMap && optionsMap[val] && optionsMap[val].icon){ 
          iconSpan.innerHTML = optionsMap[val].icon; 
        } else { 
          iconSpan.innerHTML = (wrapSelector === '.lang-wrap' ? defaultLangIcon : defaultThemeIcon); 
        }
        metaSpan.textContent = (wrapSelector === '.lang-wrap' && option) ? (option.value || '').slice(0,2).toUpperCase() : '';
        btn.setAttribute('aria-label', (wrapSelector === '.lang-wrap') ? ('Language: ' + (option ? option.textContent : '')) : ('Theme: ' + (option ? option.textContent : '')));
        Array.from(menu.querySelectorAll('.item')).forEach(it=>{
          const v = it.dataset.value;
          it.setAttribute('aria-checked', String(v===val));
          const checkEl = it.querySelector('.check');
          if (checkEl) checkEl.innerHTML = (v===val? '&#10003;':'');
        });
      }

      // utility to close menus
      function closeMenus(){ 
        wrap.classList.remove('open'); 
        btn.setAttribute('aria-expanded','false'); 
      }

      // populate menu from select options
      Array.from(select.options).forEach(opt=>{
        const li = document.createElement('li');
        li.className = 'item';
        li.setAttribute('role','menuitemradio');
        li.setAttribute('tabindex','-1');
        li.dataset.value = opt.value;

        const icon = document.createElement('span'); icon.className = 'icon';
        if (optionsMap && optionsMap[opt.value] && optionsMap[opt.value].icon){
          icon.innerHTML = optionsMap[opt.value].icon;
        }

        const txt = document.createElement('span'); txt.className = 'text'; txt.textContent = opt.textContent;
        const check = document.createElement('span'); check.className = 'check'; check.innerHTML = (opt.value===select.value? '&#10003;':'');

        li.appendChild(icon);
        li.appendChild(txt);
        li.appendChild(check);

        li.addEventListener('click', ()=>{
          select.value = li.dataset.value;
          select.dispatchEvent(new Event('change', {bubbles:true}));
          updateSelected(select.value);
          closeMenus();
          btn.focus();
        });

        li.addEventListener('keydown', (e)=>{
          if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); li.click(); }
          if (e.key === 'ArrowDown'){ e.preventDefault(); const next = li.nextElementSibling || menu.querySelector('.item'); if (next) next.focus(); }
          if (e.key === 'ArrowUp'){ e.preventDefault(); const prev = li.previousElementSibling || menu.querySelector('.item:last-child'); if (prev) prev.focus(); }
          if (e.key === 'Escape'){ closeMenus(); btn.focus(); }
        });

        menu.appendChild(li);
      });

      btn.addEventListener('click', (e)=>{
        const open = wrap.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(open));
        if (open){
          const first = menu.querySelector('.item'); if (first) first.focus();
        }
      });

      btn.addEventListener('keydown', (e)=>{
        if (e.key === 'ArrowDown'){ e.preventDefault(); wrap.classList.add('open'); btn.setAttribute('aria-expanded','true'); const first = menu.querySelector('.item'); if (first) first.focus(); }
        if (e.key === 'Escape'){ closeMenus(); btn.focus(); }
      });

      document.addEventListener('click', (e)=>{
        if (!wrap.contains(e.target)) closeMenus();
      });

      btn.style.zIndex = 250;
      menu.style.zIndex = 260;
      wrap.appendChild(btn);
      wrap.appendChild(menu);
      wrap.dataset.customInit = '1';
      wrap.classList.add('enhanced');
      
      try{
        select.style.pointerEvents = 'none';
        select.style.opacity = '0';
        select.style.display = 'none';
        select.setAttribute('aria-hidden','true');
      }catch(e){}

      updateSelected(select.value);

      select.addEventListener('change', ()=>{
        updateSelected(select.value);
      });
    }

    // language map (globe icon optional)
    const langIcons = {
      mara: { icon: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm0 2c-1.1 0-2.1.3-3 .8 1.2.9 2.2 2.4 3 4.2 0-1.9.8-3.6 2.1-4.9C14.1 4.2 13.1 4 12 4z" fill="currentColor"/></svg>' },
      en: { icon: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm-1 3c-1.1 0-2.1.3-3 .8C9.2 7.7 10.2 9.2 11 11c0-1.9.8-3.6 2.1-4.9C13.1 5.2 12.1 5 11 5z" fill="currentColor"/></svg>' },
      my: { icon: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm-1 3c-1.1 0-2.1.3-3 .8C9.2 7.7 10.2 9.2 11 11c0-1.9.8-3.6 2.1-4.9C13.1 5.2 12.1 5 11 5z" fill="currentColor"/></svg>' }
    };

    // theme icons
    const themeIcons = {
      system: { icon: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' },
      light: { icon: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>' },
      dark: { icon: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="currentColor"/></svg>' }
    };

    createMenuFromSelect('.lang-wrap','site-lang-select', langIcons);
    createMenuFromSelect('.theme-wrap','site-theme-select', themeIcons);

    document.addEventListener('keydown', (e)=>{ 
      if (e.key === 'Escape'){
        document.querySelectorAll('.lang-wrap.open,.theme-wrap.open').forEach(w=>{ 
          w.classList.remove('open'); 
          const b = w.querySelector('.select-toggle'); 
          if (b) b.setAttribute('aria-expanded','false'); 
        });
      }
    });
  }

  // Drawer accordion functionality
  function initDrawerAccordions(){
    const accordions = document.querySelectorAll('.drawer-accordion');
    accordions.forEach(accordion => {
      const toggle = accordion.querySelector('.drawer-accordion-toggle');
      if (!toggle) return;
      
      toggle.addEventListener('click', () => {
        const isOpen = accordion.classList.contains('open');
        // Close all other accordions (optional: remove this for multi-open)
        accordions.forEach(a => {
          if (a !== accordion) a.classList.remove('open');
          const t = a.querySelector('.drawer-accordion-toggle');
          if (t && a !== accordion) t.setAttribute('aria-expanded', 'false');
        });
        // Toggle current
        accordion.classList.toggle('open', !isOpen);
        toggle.setAttribute('aria-expanded', String(!isOpen));
      });
    });
  }

  // Sync drawer language/theme selectors with header and localStorage
  function initDrawerSelectors(){
    const drawerLang = document.getElementById('drawer-lang-select');
    const drawerTheme = document.getElementById('drawer-theme-select');
    const headerLang = document.getElementById('site-lang-select');
    const headerTheme = document.getElementById('site-theme-select');

    // Sync drawer language selector
    if (drawerLang){
      const storedLang = localStorage.getItem('tsd_site_lang') || 'en';
      drawerLang.value = storedLang;
      
      drawerLang.addEventListener('change', (e) => {
        const val = e.target.value;
        localStorage.setItem('tsd_site_lang', val);
        if (headerLang) headerLang.value = val;
        window.dispatchEvent(new CustomEvent('site:langchange', { detail: { lang: val }}));
        if (window.tsdI18n && typeof window.tsdI18n.setLang === 'function'){
          window.tsdI18n.setLang(val);
        } else {
          location.reload();
        }
      });
    }

    // Sync drawer theme selector
    if (drawerTheme){
      const storedTheme = localStorage.getItem('tsd_theme') || 'system';
      drawerTheme.value = storedTheme;
      
      drawerTheme.addEventListener('change', (e) => {
        const val = e.target.value;
        if (window.tsdTheme && typeof window.tsdTheme.setTheme === 'function'){
          window.tsdTheme.setTheme(val);
        } else {
          localStorage.setItem('tsd_theme', val);
          const resolved = val === 'system' 
            ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') 
            : val;
          document.documentElement.setAttribute('data-theme', resolved);
        }
        if (headerTheme) headerTheme.value = val;
      });
    }
  }

  /**
   * Main initialization function - call this after header HTML is loaded
   */
  function initHeader(){
    // Prevent double initialization
    if (initialized) {
      console.warn('[Header] Already initialized');
      return;
    }

    // Query DOM elements (they should exist now after fetch)
    HEADER = document.querySelector('.site-header');
    TOGGLE = document.querySelector('.nav-toggle');
    NAV = document.getElementById('primary-nav');

    if (!HEADER) {
      console.warn('[Header] Header element not found');
      return;
    }

    console.debug('[Header] Initializing...');

    // Highlight current page link
    highlightActive();

    // Prevent navigation for menu links that point to the current page
    document.addEventListener('click', (e)=>{
      const a = e.target.closest('#primary-nav a.is-current, #mobile-drawer a.is-current');
      if (a) e.preventDefault();
    });
    
    document.addEventListener('keydown', (e)=>{
      if ((e.key === 'Enter' || e.key === ' ') && document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('is-current')){
        e.preventDefault();
      }
    });

    // Scroll behavior
    onScroll();
    window.addEventListener('scroll', onScroll, {passive:true});
    document.addEventListener('keydown', onKey);

    // Initialize dropdowns
    initDropdowns();

    // Initialize header selectors (language/theme)
    initHeaderSelectors();

    // Menu toggle button
    if (TOGGLE){
      TOGGLE.addEventListener('click', ()=> toggleMenu());
      TOGGLE.addEventListener('keydown', (e)=>{
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(); }
      });
    }

    // Drawer close button
    const drawerClose = document.querySelector('.drawer-close');
    if (drawerClose){
      drawerClose.addEventListener('click', ()=> toggleMenu(false));
    }

    // Backdrop click closes drawer
    const backdrop = document.querySelector('.drawer-backdrop');
    if (backdrop){
      backdrop.addEventListener('click', ()=> toggleMenu(false));
    }

    // Close menu and dropdowns when clicking outside
    document.addEventListener('click', (e)=>{
      if (HEADER.classList.contains('menu-open')){
        const drawer = document.getElementById('mobile-drawer');
        const isInsideHeader = HEADER.contains(e.target);
        const isInsideDrawer = drawer && drawer.contains(e.target);
        const isBackdrop = e.target.classList.contains('drawer-backdrop');
        if (!isInsideHeader && !isInsideDrawer && !isBackdrop) toggleMenu(false);
      }
      if (!e.target.closest('.has-dropdown')) closeAllDropdowns();
    });

    // Close any open dropdown on Escape globally
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape') closeAllDropdowns();
    });

    // Initialize drawer accordions
    initDrawerAccordions();
    
    // Initialize drawer selectors (language/theme sync)
    initDrawerSelectors();

    initialized = true;
    console.debug('[Header] Initialization complete');
  }

  // Expose initHeader globally so layout.js can call it
  window.initHeader = initHeader;

  // Also expose toggleMenu for debugging
  window.tsdHeader = { toggleMenu, initHeader };

})();
