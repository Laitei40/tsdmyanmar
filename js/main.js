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
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          // Use translated final value if available, otherwise default formatted number
          var i18nFinal = el.getAttribute('data-i18n-final');
          el.textContent = i18nFinal || target.toLocaleString();
          el.classList.add('counted');
        }
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

  // Pick the best available text from an i18n object or plain string
  function pickText(val) {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return val.en || val.mrh || val.my || Object.values(val).find(function(v){ return v && v.trim(); }) || '';
    return '';
  }

  // Use the D1 API via news.js helper, with inline API fallback
  var fetchIndex = function(){
    if (window.tsdNews && window.tsdNews.fetchNewsIndex){
      return window.tsdNews.fetchNewsIndex();
    }
    // Direct API call as fallback
    return fetch('/api/news?limit=6', {cache:'no-cache'}).then(function(r){
      if (!r.ok) throw new Error('API failed: ' + r.status);
      return r.json();
    }).then(function(data){ return data.items || []; });
  };

  fetchIndex().then(function(items){
    items = Array.isArray(items) ? items : [];
    var slice = items.slice(0,3);
    var parts = [];
    for (var i = 0; i < slice.length; i++){
      var it = slice[i];
      var title = pickText(it && it.title);
      var date = (it && (it.date || it.publish_date)) || '';
      var summary = pickText(it && it.summary);
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




