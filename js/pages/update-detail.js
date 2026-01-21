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
    ['title','summary','body'].forEach(field=>{
      const obj = item[field]; if (!obj || typeof obj !== 'object') return;
      if (obj.mara && !obj.mrh) obj.mrh = obj.mara;
      Object.keys(obj).forEach(k=>{ const m = k.match(/^([a-z]{2,3})(?:[-_].+)$/i); if (m){ const base = m[1].toLowerCase(); if (!obj[base]) obj[base] = obj[k]; } });
    });
  }

  function getSiteLang(){ try{ if (window.tsdI18n && window.tsdI18n.getSiteLang) return window.tsdI18n.getSiteLang(); }catch(e){} return (navigator.language||'en').split('-')[0]; }

  function showMessage(msg){ TITLE.textContent = ''; DATE.textContent=''; BODY.innerHTML = '<p class="small-muted">'+msg+'</p>'; CRUMB.textContent = ''; BADGE.textContent = ''; if (LEAD) LEAD.textContent=''; }

  function showSkeleton(){
    updateBodyInnerHTML('<div class="skeleton skel-title"></div><div class="skeleton skel-meta"></div><div class="skeleton skel-para"></div><div class="skeleton skel-para"></div><div class="skeleton skel-para" style="width:80%"></div>');
    if (LEAD) LEAD.textContent = '';
  }

  function updateBodyInnerHTML(html){ BODY.innerHTML = html; }

  function wrapMediaAndSetup(root){
    // Wrap iframes for responsive video
    root.querySelectorAll('iframe').forEach(ifr => {
      const wrap = document.createElement('div'); wrap.className = 'video-wrapper';
      ifr.parentNode.replaceChild(wrap, ifr); wrap.appendChild(ifr);
    });
    // Image fallback and styling
    root.querySelectorAll('img').forEach(img => {
      img.style.maxWidth = '100%'; img.style.height = 'auto'; img.style.borderRadius = '8px';
      img.addEventListener('error', ()=>{
        const ph = document.createElement('div'); ph.className='img-fallback center'; ph.textContent = (window.I18N && window.I18N.image_unavailable) || 'Image not available';
        img.parentNode.replaceChild(ph, img);
      });
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

      // If there's a top-level featured image, render it as a hero in the header
      try{
        const headerEl = document.querySelector('.update-header');
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