// Accessible collapsible footer navigation for small screens
(function(){
  function init(){
    var cols = document.querySelectorAll('.footer-col');
    if(!cols || cols.length === 0) return;

    function applyMobileState(){
      var isMobile = window.matchMedia('(max-width:479px)').matches;
      cols.forEach(function(col){
        var btn = col.querySelector('.col-toggle');
        var list = col.querySelector('.col-list');
        if(!btn || !list) return;
        if(isMobile){
          // ensure collapsed by default
          btn.setAttribute('aria-expanded', 'false');
          list.setAttribute('aria-hidden', 'true');
          col.classList.remove('open');
          // attach click if not attached
          if(!btn.dataset.listenerAttached){
            btn.addEventListener('click', function(){
              var expanded = btn.getAttribute('aria-expanded') === 'true';
              btn.setAttribute('aria-expanded', expanded ? 'false' : 'true');
              list.setAttribute('aria-hidden', expanded ? 'true' : 'false');
              col.classList.toggle('open');
            });
            btn.dataset.listenerAttached = '1';
          }
        } else {
          // desktop/tablet: ensure lists are visible and toggles reflect state
          btn.setAttribute('aria-expanded', 'true');
          list.setAttribute('aria-hidden', 'false');
          col.classList.remove('open');
        }
      });
    }

    applyMobileState();
    // re-evaluate on resize
    window.addEventListener('resize', function(){ applyMobileState(); });
    // Also ensure collapse/expand when language or dynamic content updates (defensive)
    window.addEventListener('site:langchange', function(){ applyMobileState(); });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
