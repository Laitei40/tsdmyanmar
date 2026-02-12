(function(){
  const ROOT = document.getElementById('update-detail-root');
  const TITLE = document.getElementById('update-title');
  const DATE = document.getElementById('update-date');
  const BODY = document.getElementById('update-body');
  const CRUMB = document.getElementById('crumb-title');
  const BADGE = document.getElementById('update-badge');
  const LEAD = document.getElementById('update-summary');

  function formatDate(iso){ try{ const d=new Date(iso); return d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); }catch(e){ return iso } }

  function pickLangField(obj, lang){
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    const candidates = (lang === 'mrh') ? ['mrh','mara','en'] : [lang,'en'];
    for (let i=0;i<candidates.length;i++){ const k=candidates[i]; if (obj[k]) return obj[k]; }
    // fallback to first available
    const keys = Object.keys(obj||{}); return keys.length? obj[keys[0]]: '';
  }

  function normalizeItemLangKeys(item){
    if (!item || typeof item !== 'object') return;
    // Ensure .date is always set (admin responses use publish_date)
    if (!item.date && item.publish_date) item.date = item.publish_date;
    ['title','summary','body'].forEach(field=>{
      const obj = item[field]; if (!obj || typeof obj !== 'object') return;
      if (obj.mara && !obj.mrh) obj.mrh = obj.mara;
      Object.keys(obj).forEach(k=>{ const m = k.match(/^([a-z]{2,3})(?:[-_].+)$/i); if (m){ const base = m[1].toLowerCase(); if (!obj[base]) obj[base] = obj[k]; } });
    });
  }

  function getSiteLang(){ try{ if (window.tsdI18n && window.tsdI18n.getSiteLang) return window.tsdI18n.getSiteLang(); }catch(e){} return (navigator.language||'en').split('-')[0]; }

  function escapeHtml(str){ return String(str||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||''; }); }
  function showMessage(msg){ TITLE.textContent = ''; DATE.textContent=''; BODY.innerHTML = '<p class="small-muted">'+escapeHtml(msg)+'</p>'; CRUMB.textContent = ''; BADGE.textContent = ''; if (LEAD) LEAD.textContent=''; }

  function showSkeleton(){
    updateBodyInnerHTML('<div class="skeleton skel-title"></div><div class="skeleton skel-meta"></div><div class="skeleton skel-para"></div><div class="skeleton skel-para"></div><div class="skeleton skel-para" style="width:80%"></div>');
    if (LEAD) LEAD.textContent = '';
  }

  function updateBodyInnerHTML(html){ BODY.innerHTML = html; }

  function wrapMediaAndSetup(root){
    // ── YouTube iframes: wrap bare iframes in responsive wrapper ──
    root.querySelectorAll('iframe').forEach(ifr => {
      if (ifr.parentNode.classList?.contains('video-wrapper')) return; // already wrapped by Quill
      const wrap = document.createElement('div'); wrap.className = 'video-wrapper';
      ifr.parentNode.replaceChild(wrap, ifr); wrap.appendChild(ifr);
    });

    // ── Images: size, border, caption, fallback ──
    root.querySelectorAll('img').forEach(img => {
      // Responsive: ensure max-width: 100% but respect authored width
      const inlineWidth = img.style.width;
      if (inlineWidth && inlineWidth !== '100%') {
        // Keep authored width but cap at viewport
        img.style.maxWidth = '100%';
      } else {
        img.style.maxWidth = '100%';
        img.style.width = '';
      }
      img.style.height = 'auto';

      // Wrap captioned images in <figure>
      const caption = img.getAttribute('data-caption');
      if (caption) {
        const fig = document.createElement('figure');
        fig.className = 'img-captioned';
        // Inherit width from the image for sized + captioned images
        if (inlineWidth && inlineWidth !== '100%') {
          fig.style.width = inlineWidth;
          fig.style.maxWidth = '100%';
        }
        const figcap = document.createElement('figcaption');
        figcap.textContent = caption;
        img.parentNode.replaceChild(fig, img);
        fig.appendChild(img);
        fig.appendChild(figcap);
      }

      // Error fallback
      img.addEventListener('error', ()=>{
        const ph = document.createElement('div'); ph.className='img-fallback center'; ph.textContent = (window.I18N && window.I18N.image_unavailable) || 'Image not available';
        (img.closest('figure') || img).parentNode.replaceChild(ph, img.closest('figure') || img);
      });
    });

    // ── Poem blocks: ensure line breaks are preserved ──
    root.querySelectorAll('.poem-block').forEach(el => {
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', 'Poem');
    });

    // ── Song blocks: ensure line breaks are preserved ──
    root.querySelectorAll('.song-block').forEach(el => {
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', 'Song / Lyrics');
    });
  }

  function extractDownloads(root){
    // Move PDF links to the aside CTAs and style them as buttons
    const ctas = document.getElementById('update-ctas'); ctas.innerHTML = '';
    root.querySelectorAll('a[href$=".pdf"]').forEach(a=>{
      const href = a.getAttribute('href'); const label = a.textContent.trim() || 'Download (PDF)';
      const btn = document.createElement('a'); btn.className='btn-download'; btn.href = href; btn.target = '_blank'; btn.rel='noopener noreferrer';
      btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#fff" d="M5 20h14v-2H5v2zm7-18v10l4-4 1.4 1.4L12 16 6.6 9.4 8 8l4 4V2h0z"/></svg>' + label;
      ctas.appendChild(btn);
      // remove original link from content
      try{ a.parentNode.removeChild(a); }catch(e){}
    });
  }

  // ---- Share bar ----
  function populateShareBar(title) {
    const bar = document.getElementById('share-bar');
    if (!bar) return;
    const url = encodeURIComponent(window.location.href);
    const t   = encodeURIComponent(title);

    bar.innerHTML = '<span class="share-label">' + ((window.I18N && window.I18N.share) || 'Share') + '</span>';

    // Twitter / X
    const tw = document.createElement('a');
    tw.className = 'share-btn'; tw.target = '_blank'; tw.rel = 'noopener noreferrer';
    tw.href = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + t;
    tw.setAttribute('aria-label', 'Share on X');
    tw.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
    bar.appendChild(tw);

    // Facebook
    const fb = document.createElement('a');
    fb.className = 'share-btn'; fb.target = '_blank'; fb.rel = 'noopener noreferrer';
    fb.href = 'https://www.facebook.com/sharer/sharer.php?u=' + url;
    fb.setAttribute('aria-label', 'Share on Facebook');
    fb.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>';
    bar.appendChild(fb);

    // Copy link
    const cp = document.createElement('button');
    cp.className = 'share-btn'; cp.type = 'button';
    cp.setAttribute('aria-label', 'Copy link');
    cp.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
    cp.addEventListener('click', function () {
      navigator.clipboard.writeText(window.location.href).then(function () {
        cp.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        setTimeout(function () {
          cp.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
        }, 2000);
      });
    });
    bar.appendChild(cp);

    bar.style.display = '';
  }

  // ---- Related posts ----
  async function populateRelatedPosts(currentItem, lang) {
    const section = document.getElementById('related-section');
    const grid    = document.getElementById('related-grid');
    if (!section || !grid) return;

    let items = [];
    try {
      const data = await (window.tsdNews && window.tsdNews.fetchNewsIndex
        ? window.tsdNews.fetchNewsIndex()
        : Promise.reject(new Error('news helper missing')));
      items = Array.isArray(data) ? data : (data.items || []);
    } catch (e) { return; }

    // Filter out current article and sort by date descending
    items = items
      .filter(function (it) { return it.id !== currentItem.id; })
      .sort(function (a, b) { return new Date(b.date) - new Date(a.date); })
      .slice(0, 3);

    if (!items.length) return;

    grid.innerHTML = '';
    items.forEach(function (it) {
      const title = (typeof it.title === 'string') ? it.title : pickLangField(it.title, lang) || 'Untitled';
      const href  = '/update.html?id=' + encodeURIComponent(it.id || '');
      const imgUrl = (it.image || it.thumbnail || '');

      const card = document.createElement('a');
      card.className = 'related-card';
      card.href = href;

      var html = '';
      if (imgUrl) {
        html += '<img class="related-thumb" src="' + escapeHtml(imgUrl) + '" alt="" loading="lazy" decoding="async">';
      }
      html += '<span class="related-date">' + formatDate(it.date) + '</span>';
      html += '<span class="related-title">' + escapeHtml(title) + '</span>';
      card.innerHTML = html;
      grid.appendChild(card);
    });

    section.style.display = '';
  }

  async function load(id){
    if (!id){ showMessage('No article id provided'); return; }
    const lang = getSiteLang() || 'en';
    const loadingLabel = (window.I18N && window.I18N.loading) || 'Loading…';
    TITLE.textContent = loadingLabel; showSkeleton();
    try{
      // Prefer the static news pipeline helper which implements per-article fallback to English
      let data = null;
      if (window.tsdNews && window.tsdNews.fetchNewsJson){
        data = await window.tsdNews.fetchNewsJson(id);
      } else {
        // Fallback: attempt direct fetch from /news/{lang}/{id}.json with English fallback
        const tryFetch = async (l) => {
          const url = '/news/' + encodeURIComponent(l) + '/' + encodeURIComponent(id) + '.json';
          const r = await fetch(url, {cache:'no-cache'});
          if (!r.ok) throw r;
          return r.json();
        };
        try{
          data = await tryFetch(lang);
        }catch(e){
          if (lang !== 'en') data = await tryFetch('en');
          else throw e;
        }
      }

      if (!data){ showMessage((window.I18N && window.I18N.no_updates) || 'Article not found'); return; }

      // data is expected to be the article object
      const item = data;
      normalizeItemLangKeys(item);

      const titleStr = (typeof item.title === 'string') ? item.title : pickLangField(item.title, lang) || 'Untitled';
      const bodyStr = (typeof item.body === 'string') ? item.body : pickLangField(item.body, lang) || '';
      const summaryStr = (typeof item.summary === 'string') ? item.summary : pickLangField(item.summary, lang) || '';
      const dateStr = item.date || '';

      TITLE.textContent = titleStr;
      if (LEAD) LEAD.textContent = summaryStr;
      if (dateStr) DATE.textContent = formatDate(dateStr);
      CRUMB.textContent = titleStr;
      BADGE.textContent = item.isLatest ? ((window.I18N && window.I18N.latest_badge) || 'Latest') : '';

      // Hide badge pill when empty
      if (BADGE && !BADGE.textContent.trim()) BADGE.style.display = 'none';
      else if (BADGE) BADGE.style.display = '';

      // If there's a top-level featured image, render it as a hero in the header
      try{
        const headerEl = document.querySelector('.update-hero');
        if (headerEl && Array.isArray(item.images) && item.images.length){
          const heroImg = item.images[0];
          const heroWrap = document.createElement('div'); heroWrap.className = 'article-hero';
          const heroFigure = document.createElement('figure'); heroFigure.className = 'hero-figure';
          const img = document.createElement('img'); img.src = heroImg.src; img.alt = heroImg.alt || '';
          img.loading = 'lazy'; img.decoding = 'async'; img.className = 'hero-image';
          heroFigure.appendChild(img);
          if (heroImg.caption){ const c = document.createElement('figcaption'); c.className='hero-caption'; c.textContent = heroImg.caption; heroFigure.appendChild(c); }
          heroWrap.appendChild(heroFigure);
          // Insert hero after title within header
          headerEl.appendChild(heroWrap);
          // Remove the hero image from the images array so renderer doesn't duplicate it
          item.images = item.images.slice(1);
        }
      }catch(e){ console.error('hero render error', e); }

      // Ensure body_html is set for the renderer when body contains HTML from Quill editor
      if (!item.body_html && typeof bodyStr === 'string' && /<[a-z][\s\S]*>/i.test(bodyStr)) {
        item.body_html = bodyStr;
      }

      // Render the article body and media using the news renderer (preserves backward compatibility)
      if (window.tsdNews && window.tsdNews.renderArticle){
        try{ window.tsdNews.renderArticle(item, BODY); }catch(e){ updateBodyInnerHTML(item.body_html || bodyStr || ((window.I18N && window.I18N.no_updates_body) || '<p>No content available.</p>')); }
      } else {
        const htmlContent = item.body_html || bodyStr || ((window.I18N && window.I18N.no_updates_body) || '<p>No content available.</p>');
        updateBodyInnerHTML(htmlContent);
      }
      // Post-process media and downloads (ensure images/videos are wrapped and downloads extracted)
      wrapMediaAndSetup(BODY);
      extractDownloads(BODY);

      // Update document title
      try{ document.title = titleStr + ' — ' + ((window.I18N && window.I18N.site_title) || document.title); }catch(e){}

      // ---- Share bar ----
      try { populateShareBar(titleStr); } catch (e) { console.error('share bar error', e); }

      // ---- Related posts ----
      try { await populateRelatedPosts(item, lang); } catch (e) { console.error('related posts error', e); }

      // Move focus to title for accessibility
      TITLE.setAttribute('tabindex','-1'); TITLE.focus();

    }catch(err){
      console.error('update detail load error', err);
      const em = err && err.message ? (': ' + err.message) : '';
      showMessage(((window.I18N && window.I18N.no_updates_body) || 'Unable to load the article at this time.') + em);
    }
  }

  function parseIdFromLocation(){
    const p = new URLSearchParams(window.location.search); if (p.get('id')) return p.get('id');
    // fallback: /updates/123.html or /updates/123
    const m = window.location.pathname.match(/\/updates\/(?:update(?:\.html)?|)?([^\/]+?)(?:\.html)?$/i);
    if (m && m[1]) return m[1];
    return null;
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const id = parseIdFromLocation(); load(id);

    // Reload when user changes site language
    window.addEventListener('site:langchange', ()=>{ const id2 = parseIdFromLocation(); load(id2); });
  });
})();