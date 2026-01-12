/**
 * Header interactions: sticky behavior, shrink on scroll, mobile menu toggle,
 * active link highlighting, and basic keyboard accessibility.
 * Lightweight, no dependencies.
 */
(function(){ try{ if (window && window.console && window.console.debug) console.debug('header: script loaded'); window.addEventListener('error', (e)=>{ try{ console.error('header: window.error', e.error || e.message || e); }catch(_){} }); window.addEventListener('unhandledrejection', (e)=>{ try{ console.error('header: unhandledrejection', e.reason || e); }catch(_){} });
  const HEADER = document.querySelector('.site-header');
  const TOGGLE = document.querySelector('.nav-toggle');
  const NAV = document.getElementById('primary-nav');
  const SCROLL_THRESHOLD = 56;

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
    const isOpen = typeof open === 'boolean' ? open : !HEADER.classList.contains('menu-open');
    HEADER.classList.toggle('menu-open', isOpen);
    NAV.setAttribute('aria-hidden', String(!isOpen));
    TOGGLE.setAttribute('aria-expanded', String(isOpen));
    if (isOpen){
      // focus first link
      const first = NAV.querySelector('a');
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
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    if (!HEADER) return;
    highlightActive();

    // Prevent navigation for menu links that point to the current page
    document.addEventListener('click', (e)=>{
      const a = e.target.closest('#primary-nav a.is-current');
      if (a) e.preventDefault();
    });
    document.addEventListener('keydown', (e)=>{
      if ((e.key === 'Enter' || e.key === ' ') && document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('is-current')){
        e.preventDefault();
      }
    });

    onScroll();
    window.addEventListener('scroll', onScroll, {passive:true});
    document.addEventListener('keydown', onKey);

    // Dropdown behaviour (hover on desktop via CSS; JS adds keyboard + tap support)
    const DROPDOWNS = Array.from(document.querySelectorAll('.has-dropdown'));
    function closeAllDropdowns(){
      DROPDOWNS.forEach(d=>{
        d.classList.remove('open');
        const b = d.querySelector('.drop-toggle');
        if (b) b.setAttribute('aria-expanded','false');
      });
    }
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

    /* --- Custom header selectors: Language and Theme --- */
    function initHeaderSelectors(){
      // Feature flag: set to `true` to enable icon-trigger dropdowns (globe/sun)
      const ENABLE_ICON_DROPDOWNS = true;
      try{ if (window.console && window.console.debug) console.debug('header:initHeaderSelectors', { ENABLE_ICON_DROPDOWNS, langWrap: !!document.querySelector('.lang-wrap'), themeWrap: !!document.querySelector('.theme-wrap') }); }catch(e){}

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
        // restore native behavior immediately and skip custom UI initialization
        restoreNativeSelectors();
        return;
      }
      function createMenuFromSelect(wrapSelector, selectId, optionsMap){
        const wrap = document.querySelector(wrapSelector);
        if (!wrap) return;
        // If it already appears enhanced, try to refresh the compact label/icon if possible.
        if (wrap.dataset.customInit){
          const existingBtn = wrap.querySelector('.select-toggle');
          const existingMenu = wrap.querySelector('.select-menu');
          const select = wrap.querySelector('#' + selectId);
          if (existingBtn && existingMenu && select){
            try{
              const meta = existingBtn.querySelector('.meta');
              if (meta && wrapSelector === '.lang-wrap') meta.textContent = (select.value || '').slice(0,2).toUpperCase();
            }catch(e){}
            return;
          } else {
            // stale marker without UI present — clear it and continue initialization
            delete wrap.dataset.customInit;
          }
        }
        const select = wrap.querySelector('#' + selectId);
        if (!select) return;

        // build toggle (icon-first compact button)
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'select-toggle';
        btn.setAttribute('aria-haspopup','menu');
        btn.setAttribute('aria-expanded','false');

        // ensure each toggle has an id for aria associations
        btn.id = selectId + '-toggle';

        // icon container (primary visible trigger)
        const iconSpan = document.createElement('span'); iconSpan.className = 'icon';
        // optional small label/meta next to icon (used for languages)
        const metaSpan = document.createElement('span'); metaSpan.className = 'meta';
        btn.appendChild(iconSpan);
        btn.appendChild(metaSpan);
        // default icon fallbacks so the toggle never appears blank
        const defaultLangIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20z" fill="currentColor"/><path d="M2 12h20M12 2v20" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
        const defaultThemeIcon = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="currentColor"/></svg>';
        // set an initial icon immediately (will be updated by updateSelected)
        iconSpan.innerHTML = (optionsMap && optionsMap[select.value] && optionsMap[select.value].icon) || (wrapSelector === '.lang-wrap' ? defaultLangIcon : defaultThemeIcon);

        // mark the wrapper as icon-based so CSS centers the menu
        wrap.classList.add('icon');
        // for languages, include a compact label next to icon
        if (wrapSelector === '.lang-wrap'){
          btn.classList.add('icon-with-label');
        } else {
          btn.classList.remove('icon-with-label');
        }

        // build menu
        const menu = document.createElement('ul');
        menu.className = 'select-menu';
        // For header-level icon popovers (language/theme) use brand-style dropdown
        if (wrapSelector === '.lang-wrap' || wrapSelector === '.theme-wrap'){
          menu.classList.add('brand-dropdown');
        }
        // tie menu to the button for accessibility
        menu.setAttribute('role','menu');
        menu.setAttribute('tabindex','-1');
        menu.setAttribute('aria-labelledby', btn.id);

        // helper to update icon, optional label and selected state
        function updateSelected(val){
          const option = Array.from(select.options).find(o=>o.value===val) || select.options[0];
          // set icon on the toggle if we have an icon mapping, otherwise use a sensible default
          if (optionsMap && optionsMap[val] && optionsMap[val].icon){ iconSpan.innerHTML = optionsMap[val].icon; } else { iconSpan.innerHTML = (wrapSelector === '.lang-wrap' ? defaultLangIcon : defaultThemeIcon); }
          // set compact label for language selector (e.g., "EN") if present — use option.value as short code
          metaSpan.textContent = (wrapSelector === '.lang-wrap' && option) ? (option.value || '').slice(0,2).toUpperCase() : '';
          // update aria-label to reflect current selection
          btn.setAttribute('aria-label', (wrapSelector === '.lang-wrap') ? ('Language: ' + (option ? option.textContent : '')) : ('Theme: ' + (option ? option.textContent : '')));
          // mark selected on menu items and aria-checked
          Array.from(menu.querySelectorAll('.item')).forEach(it=>{
            const v = it.dataset.value;
            it.setAttribute('aria-checked', String(v===val));
            const checkEl = it.querySelector('.check');
            if (checkEl) checkEl.innerHTML = (v===val? '&#10003;':'');
          });
        }

        // populate menu from select options
        Array.from(select.options).forEach(opt=>{
          const li = document.createElement('li');
          li.className = 'item';
          li.setAttribute('role','menuitemradio');
          li.setAttribute('tabindex','-1');
          li.dataset.value = opt.value;

          const icon = document.createElement('span'); icon.className = 'icon';
          // optional small icons supplied by optionsMap
          if (optionsMap && optionsMap[opt.value] && optionsMap[opt.value].icon){
            icon.innerHTML = optionsMap[opt.value].icon;
          }

          const txt = document.createElement('span'); txt.className = 'text'; txt.textContent = opt.textContent;
          const check = document.createElement('span'); check.className = 'check'; check.innerHTML = (opt.value===select.value? '&#10003;':'');

          li.appendChild(icon);
          li.appendChild(txt);
          li.appendChild(check);

          li.addEventListener('click', ()=>{
            // sync select and trigger change
            select.value = li.dataset.value;
            select.dispatchEvent(new Event('change', {bubbles:true}));
            // update visuals and close
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

        // wrapper mouse/keyboard behavior
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

        // utility to close menus
        function closeMenus(){ wrap.classList.remove('open'); btn.setAttribute('aria-expanded','false'); }

        // click outside to close
        document.addEventListener('click', (e)=>{
          if (!wrap.contains(e.target)) closeMenus();
        });

        // add to DOM
        // set explicit z-index to keep toggle and menu above other header elements
        btn.style.zIndex = 250;
        menu.style.zIndex = 260;
        wrap.appendChild(btn);
        wrap.appendChild(menu);
        // mark as initialized and hide native select to avoid double-focus/clicks
        wrap.dataset.customInit = '1';
        wrap.classList.add('enhanced');
        // Hide native select via inline styles as a robust fallback (covers cached CSS or slow loading)
        try{
          select.style.pointerEvents = 'none';
          select.style.opacity = '0';
          select.style.display = 'none';
          select.setAttribute('aria-hidden','true');
        }catch(e){}
        // Helpful debug trace if the console is open — harmless in production
        try{ if (window.console && window.console.debug) console.debug('header: enhanced', wrapSelector, selectId); }catch(e){}


        // initial update
        updateSelected(select.value);

        // keep custom UI in sync if select.value changes elsewhere
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

      // Initialize language menu (first .lang-wrap found)
      createMenuFromSelect('.lang-wrap','site-lang-select', langIcons);
      // Initialize theme menu
      createMenuFromSelect('.theme-wrap','site-theme-select', themeIcons);

      // keyboard: close menus with Escape globally
      document.addEventListener('keydown', (e)=>{ if (e.key === 'Escape'){
        document.querySelectorAll('.lang-wrap.open,.theme-wrap.open').forEach(w=>{ w.classList.remove('open'); const b = w.querySelector('.select-toggle'); if (b) b.setAttribute('aria-expanded','false'); });
      }});
    }

    // Run the init in a way that works even when this script is included after DOMContentLoaded
    function runInit(){
      if (!HEADER) return;
      // small debug hint
      try{ if (window.console && window.console.debug) console.debug('header: runInit — readyState=', document.readyState); }catch(e){}

      // call our setup routines
      initHeaderSelectors();

      if (TOGGLE){
        TOGGLE.addEventListener('click', ()=> toggleMenu());
        // allow Enter/Space on toggle
        TOGGLE.addEventListener('keydown', (e)=>{
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleMenu(); }
        });
      }

      // close menu and dropdowns when clicking outside
      document.addEventListener('click', (e)=>{
        if (HEADER.classList.contains('menu-open')){
          if (!HEADER.contains(e.target)) toggleMenu(false);
        }
        if (!e.target.closest('.has-dropdown')) closeAllDropdowns();
      });

      // Close any open dropdown on Escape globally
      document.addEventListener('keydown', (e)=>{
        if (e.key === 'Escape') closeAllDropdowns();
      });
    }

    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', runInit);
    } else {
      runInit();
    }

  // Expose for debugging/testing
  window.tsdHeader = { toggleMenu }
  }catch(e){ try{ console.error('header: fatal error', e); }catch(_){} }
})();
