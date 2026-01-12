(function(){
  const API_PATH = '/api/updates';
  const ROOT = document.getElementById('update-detail-root');
  const TITLE = document.getElementById('update-title');
  const DATE = document.getElementById('update-date');
  const BODY = document.getElementById('update-body');
  const CRUMB = document.getElementById('crumb-title');
  const BADGE = document.getElementById('update-badge');

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

  function showMessage(msg){ TITLE.textContent = ''; DATE.textContent=''; BODY.textContent = msg; CRUMB.textContent = ''; BADGE.textContent = ''; }

  async function load(id){
    if (!id){ showMessage('No article id provided'); return; }
    const lang = getSiteLang() || 'en';
    const loadingLabel = (window.I18N && window.I18N.loading) || 'Loading…';
    TITLE.textContent = loadingLabel; BODY.textContent = '';

    try{
      const params = new URLSearchParams(); params.set('id', String(id)); params.set('lang', lang);
      const res = await fetch('/api/update' + '?' + params.toString(), {cache:'no-cache'});
      if (!res.ok){
        // try to surface any JSON error message from the API
        let msg = 'HTTP ' + res.status;
        try{ const j = await res.json(); msg += ' - ' + (j && (j.error || j.message) ? (j.error || j.message) : JSON.stringify(j)); }catch(e){ try{ const t = await res.text(); if (t) msg += ' - ' + t; }catch(e){} }
        console.error('update detail fetch non-ok', res.status, msg);
        // Attempt fallback to static JSON when the API fails
        try{
          const fb = await fetch('/assets/documents/reports/updates.json', {cache:'no-cache'});
          if (fb.ok){ const arr = await fb.json(); const found = arr.find(it => String(it.id) === String(id)); if (found){ normalizeItemLangKeys(found); renderFound(found); return; } }
        }catch(e){ /* ignore fallback errors */ }
        showMessage((window.I18N && window.I18N.no_updates_body) ? (window.I18N.no_updates_body + '\n' + msg) : ('Unable to load the article at this time. ' + msg));
        return;
      }
      const data = await res.json();

      // helper to render a found item from fallback
      function renderFound(item){
        const title = (typeof item.title === 'string') ? item.title : pickLangField(item.title, lang) || 'Untitled';
        const body = (typeof item.body === 'string') ? item.body : pickLangField(item.body, lang) || '';
        const date = item.date || '';
        TITLE.textContent = title;
        if (date) DATE.textContent = formatDate(date);
        CRUMB.textContent = title;
        BADGE.textContent = item.isLatest ? ((window.I18N && window.I18N.latest_badge) || 'Latest') : '';
        BODY.innerHTML = body || ((window.I18N && window.I18N.no_updates_body) || 'No content available.');
        try{ document.title = title + ' — ' + ((window.I18N && window.I18N.site_title) || document.title); }catch(e){}
        TITLE.setAttribute('tabindex','-1'); TITLE.focus();
      }

      // API may return {item: {...}} or {items:[...]} or the item object directly
      let item = null;
      if (data == null) item = null;
      else if (Array.isArray(data)) item = data[0];
      else if (data.item) item = data.item;
      else if (data.items && data.items.length) item = data.items[0];
      else if (data.id || data.title) item = data;

      if (!item){ showMessage((window.I18N && window.I18N.no_updates) || 'Article not found'); return; }

      normalizeItemLangKeys(item);

      const title = (typeof item.title === 'string') ? item.title : pickLangField(item.title, lang) || 'Untitled';
      const body = (typeof item.body === 'string') ? item.body : pickLangField(item.body, lang) || '';
      const date = item.date || '';

      TITLE.textContent = title;
      if (date) DATE.textContent = formatDate(date);
      CRUMB.textContent = title;
      BADGE.textContent = item.isLatest ? ((window.I18N && window.I18N.latest_badge) || 'Latest') : '';

      // Body may contain HTML; assume server provides safe HTML
      BODY.innerHTML = body || ((window.I18N && window.I18N.no_updates_body) || 'No content available.');

      // Update document title
      try{ document.title = title + ' — ' + ((window.I18N && window.I18N.site_title) || document.title); }catch(e){}

      // Move focus to title for accessibility
      TITLE.setAttribute('tabindex','-1'); TITLE.focus();

    }catch(err){
      console.error('update detail load error', err);
      // try static fallback when API can't be reached
      try{
        const fb = await fetch('/assets/documents/reports/updates.json', {cache:'no-cache'});
        if (fb.ok){ const arr = await fb.json(); const found = arr.find(it => String(it.id) === String(id)); if (found){ normalizeItemLangKeys(found); renderFound(found); return; } }
      }catch(e){ /* ignore fallback errors */ }
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