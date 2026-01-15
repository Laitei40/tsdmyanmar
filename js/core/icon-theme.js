// Theme-aware program icon swapping
// - Expects program icons to have class `prog-icon` and optional `data-icon` base (e.g., "education")
// - Naming convention: assets/icons/<base>_dark.svg (white-filled for light-theme),
//   assets/icons/<base>_light.svg (dark-filled for dark-theme), assets/icons/<base>_nobg.svg as neutral fallback
(function(){
  function baseFromSrc(src){
    if (!src) return '';
    const parts = src.split('/').pop().split('.').shift();
    // strip known suffixes
    return parts.replace(/(_dark|_light|_nobg)$/i,'');
  }

  function setIconForElement(img, theme){
    const base = img.getAttribute('data-icon') || baseFromSrc(img.getAttribute('src'));
    if (!base) return;
    const basePath = img.getAttribute('data-icon-path') || 'assets/icons/';
    let desired = null;
    // load the matching variant for the current theme:
    // - when document/theme is 'dark' use the *_dark.svg (white-filled for dark backgrounds)
    // - otherwise use the *_light.svg (dark-filled for light backgrounds)
    if (theme === 'dark') desired = `${basePath}${base}_dark.svg`;
    else desired = `${basePath}${base}_light.svg`;
    // try desired first, then nobg, then fallback to original
    // We simply set desired and let browser fetch; to avoid broken images, we can test by preloading
    const test = new Image();
    test.onload = function(){ img.src = desired; };
    test.onerror = function(){
      // try nobg
      const nobg = `${basePath}${base}_nobg.svg`;
      const tryN = new Image();
      tryN.onload = function(){ img.src = nobg; };
      tryN.onerror = function(){ /* leave as-is */ };
      tryN.src = nobg;
    };
    test.src = desired;
  }

  function updateAllIcons(theme){
    const imgs = Array.from(document.querySelectorAll('img.prog-icon'));
    imgs.forEach(img => setIconForElement(img, theme));
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    // ensure images have data-icon attribute for robustness
    document.querySelectorAll('img.prog-icon').forEach(img => {
      if (!img.getAttribute('data-icon')){
        img.setAttribute('data-icon', baseFromSrc(img.getAttribute('src')));
      }
    });

    const initial = document.documentElement.getAttribute('data-theme') || 'light';
    updateAllIcons(initial);

    window.addEventListener('tsd:theme-changed', (e)=>{
      const theme = (e && e.detail) ? e.detail : (document.documentElement.getAttribute('data-theme') || 'light');
      updateAllIcons(theme);
    });
  });
})();