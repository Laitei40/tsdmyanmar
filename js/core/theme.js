/*
 * Lightweight theme switcher for TSD site.
 * - Supports 'light', 'dark', and 'system' modes
 * - Persists choice in localStorage ('tsd_theme')
 * - Applies theme by setting `data-theme` on <html>
 * - Minimal, accessible (uses <select>), zero-deps
 */
(function(){
  const STORAGE_KEY = 'tsd_theme';
  const ATTR = 'data-theme';
  const SELECTOR = '#site-theme-select';

  function getStored(){
    try{ return localStorage.getItem(STORAGE_KEY); }catch(e){ return null; }
  }

  function setStored(v){
    try{ if (v) localStorage.setItem(STORAGE_KEY,v); else localStorage.removeItem(STORAGE_KEY); }catch(e){}
  }

  function prefersDark(){
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function applyThemeValue(val){
    // val is 'light' or 'dark'
    document.documentElement.setAttribute(ATTR, val);
    // expose for debugging
    window.__TSD_THEME = val;
    return val;
  }

  function resolveTheme(pref){
    if (!pref || pref === 'system') return prefersDark() ? 'dark':'light';
    return pref === 'dark' ? 'dark' : 'light';
  }

  function setTheme(pref){
    const resolved = resolveTheme(pref);
    applyThemeValue(resolved);
    if (pref === 'system') setStored('system'); else setStored(pref);
  }

  // Listen for OS changes when in system mode
  function listenSystem(prefStored){
    if (!window.matchMedia) return;
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    function onChange(){
      if (getStored() === 'system') applyThemeValue(m.matches ? 'dark':'light');
    }
    m.addEventListener ? m.addEventListener('change', onChange) : m.addListener(onChange);
  }

  function init(){
    const stored = getStored() || 'system';
    setTheme(stored);
    listenSystem(stored);

    // Wire up all selects with id site-theme-select (there may be duplicates)
    document.addEventListener('DOMContentLoaded', ()=>{
      const selects = Array.from(document.querySelectorAll(SELECTOR));
      selects.forEach(s => {
        // set initial value
        s.value = getStored() || 'system';
        s.addEventListener('change', (e)=>{
          const v = e.target.value || 'system';
          setTheme(v);
        });
      });
    });
  }

  // Expose API
  window.tsdTheme = { init, setTheme, getStored };

  // Auto-init
  init();
})();


