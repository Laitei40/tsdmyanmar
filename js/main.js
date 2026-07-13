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

  function getLang(){
    try{ return (window.tsdI18n && window.tsdI18n.getSiteLang && window.tsdI18n.getSiteLang()) || 'en'; }
    catch(e){ return 'en'; }
  }

  // Pick the best available text from an i18n object or plain string
  function pickText(val, lang) {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      if (val[lang]) return val[lang];
      if (val.en) return val.en;
      for (var k in val) { if (val[k] && val[k].trim && val[k].trim()) return val[k]; }
    }
    return '';
  }

  function stripHtml(html){
    if (!html) return '';
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || tmp.innerText || '').trim();
  }

  function formatDate(iso){
    if (!iso) return '';
    try{ return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch(e){ return iso; }
  }

  function getItemImage(it){
    if (it.image) return it.image;
    if (it.thumbnail) return it.thumbnail;
    if (Array.isArray(it.images) && it.images.length) {
      var first = it.images[0];
      return (typeof first === 'string') ? first : (first.src || first.url || '');
    }
    return '';
  }

  function getCategory(it){
    if (it.category) return String(it.category).toLowerCase();
    if (Array.isArray(it.categories) && it.categories.length) return String(it.categories[0]).toLowerCase();
    return '';
  }

  var CAT_LABELS = { news: 'News', report: 'Report', announcement: 'Announcement', story: 'Story' };

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

  function buildFeatCard(it, lang){
    var title = pickText(it.title, lang) || 'Untitled';
    var summary = stripHtml(pickText(it.summary, lang)) || stripHtml(pickText(it.body, lang)).slice(0,180);
    var date = it.date || it.publish_date || '';
    var href = '/update.html?id=' + encodeURIComponent(it.id || '');
    var cat = getCategory(it);
    var catLabel = CAT_LABELS[cat] || (cat ? cat : 'Update');
    var img = getItemImage(it);

    var html = '<a class="news-feat" href="' + href + '">';
    html += '<div class="news-feat__img-wrap">' + (img ? '<img class="news-feat__img" src="' + escapeHtml(img) + '" alt="" loading="eager" decoding="async">' : '') + '</div>';
    html += '<div class="news-feat__body">';
    html += '<span class="news-tag" data-cat="' + escapeHtml(cat) + '">' + escapeHtml(catLabel) + '</span>';
    html += '<h3 class="news-feat__title">' + escapeHtml(title) + '</h3>';
    if (summary) html += '<p class="news-feat__excerpt">' + escapeHtml(summary) + '</p>';
    html += '<div class="news-meta"><time datetime="' + escapeHtml(date) + '">' + escapeHtml(formatDate(date)) + '</time></div>';
    html += '</div></a>';
    return html;
  }

  function buildCard(it, lang){
    var title = pickText(it.title, lang) || 'Untitled';
    var date = it.date || it.publish_date || '';
    var href = '/update.html?id=' + encodeURIComponent(it.id || '');
    var cat = getCategory(it);
    var catLabel = CAT_LABELS[cat] || (cat ? cat : 'Update');
    var img = getItemImage(it);

    var html = '<a class="news-card" href="' + href + '">';
    if (img) html += '<div class="news-card__img-wrap"><img class="news-card__img" src="' + escapeHtml(img) + '" alt="" loading="lazy" decoding="async"></div>';
    html += '<div class="news-card__body">';
    html += '<span class="news-tag" data-cat="' + escapeHtml(cat) + '">' + escapeHtml(catLabel) + '</span>';
    html += '<h4 class="news-card__title">' + escapeHtml(title) + '</h4>';
    html += '<div class="news-meta"><time datetime="' + escapeHtml(date) + '">' + escapeHtml(formatDate(date)) + '</time></div>';
    html += '</div></a>';
    return html;
  }

  var lang = getLang();

  fetchIndex().then(function(items){
    items = Array.isArray(items) ? items : (items && items.items) || [];
    items = items.slice().sort(function(a,b){ return new Date(b.date || b.publish_date) - new Date(a.date || a.publish_date); });

    if (!items.length){
      container.innerHTML = '<p class="news-empty" data-i18n="no_updates">No updates yet</p>';
      return;
    }

    var featured = items[0];
    var rest = items.slice(1, 4);
    var html = buildFeatCard(featured, lang);
    if (rest.length){
      html += '<div class="news-cards">' + rest.map(function(it){ return buildCard(it, lang); }).join('') + '</div>';
    }
    container.innerHTML = html;
  }).catch(function(err){
    console.error('updates preview load error', err);
    container.innerHTML = '<p class="news-empty" data-i18n="no_updates_body">Failed to load updates. Please try again later.</p>';
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

window.addEventListener('site:langchange', function(){ loadUpdatesPreview(); });




