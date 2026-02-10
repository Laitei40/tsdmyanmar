// Main UI interactions: entrance reveal, count-up, updates preview fetch
// ES5-friendly implementation (avoid arrow functions and template literals)

function revealOnScroll() {
  var observer = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  var reveals = document.querySelectorAll('.reveal');
  for (var i = 0; i < reveals.length; i++) { observer.observe(reveals[i]); }
}

function animateCountUps(){
  var elems = document.querySelectorAll('.num[data-count]');
  for (var i = 0; i < elems.length; i++){
    (function(el){
      var target = Number(el.getAttribute('data-count')) || 0;
      var duration = 1400;
      var start = null;
      function step(ts){
        if (!start) start = ts;
        var progress = Math.min((ts - start) / duration, 1);
        el.textContent = Math.floor(progress * target).toLocaleString();
        if (progress < 1) requestAnimationFrame(step); else el.textContent = target.toLocaleString();
      }
      var io = new IntersectionObserver(function(entries){
        if (entries[0].isIntersecting){ requestAnimationFrame(step); io.disconnect(); }
      }, { threshold: 0.4 });
      io.observe(el);
    })(elems[i]);
  }
}

function loadUpdatesPreview(){
  var container = document.getElementById('updates-preview-list');
  if (!container) return;

  // Use promise flow to stay ES5-friendly
  var fetchIndex = function(){
    if (window.tsdNews && window.tsdNews.fetchNewsIndex){
      return window.tsdNews.fetchNewsIndex().catch(function(){
        return fetch('/news/en/index.json').then(function(r){ return r.json(); });
      });
    }
    return fetch('/news/en/index.json').then(function(r){ return r.json(); });
  };

  fetchIndex().then(function(items){
    items = Array.isArray(items) ? items : [];
    var slice = items.slice(0,3);
    var parts = [];
    for (var i = 0; i < slice.length; i++){
      var it = slice[i];
      var title = (it && it.title && it.title.en) || (it && it.title) || '';
      var date = (it && it.date) || '';
      var summary = (it && it.summary && it.summary.en) || (it && it.summary) || '';
      parts.push('<article class="update-item"><h4>' + escapeHtml(title) + '</h4><time>' + escapeHtml(date) + '</time><p>' + escapeHtml(summary) + '</p></article>');
    }
    container.innerHTML = parts.join('') || '<p>No updates yet.</p>';
  }).catch(function(err){
    try{ container.innerHTML = '<p>Failed to load updates: ' + escapeHtml((err && err.message) || String(err)) + '</p>'; }catch(e){ container.innerHTML = '<p>Failed to load updates</p>'; }
  });
}

function escapeHtml(str){
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, function(c){
    var m = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" };
    return m[c] || '';
  });
}

document.addEventListener('DOMContentLoaded', function(){
  revealOnScroll();
  animateCountUps();
  loadUpdatesPreview();
});




