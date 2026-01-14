// JSON-backed i18n loader & data-i18n applier
// Requirements: use /i18n/en/common.json and /i18n/mrh/common.json, use ISO 'mrh' for Mara
const TSD_LANG_KEY = 'tsd_site_lang';
const DEFAULT_LANG = 'en';
const SUPPORTED_LANGS = ['en','mrh','my'];

function normalizeLang(l){
  if (!l) return DEFAULT_LANG;
  // support legacy 'mara' token by migrating to 'mrh'
  if (l === 'mara') l = 'mrh';
  if (SUPPORTED_LANGS.indexOf(l) === -1) return DEFAULT_LANG;
  return l;
}

function getSiteLang(){
  const raw = localStorage.getItem(TSD_LANG_KEY);
  return normalizeLang(raw || DEFAULT_LANG);
}

function setSiteLang(l){
  const lang = normalizeLang(l);
  localStorage.setItem(TSD_LANG_KEY, lang);
  // set html lang attribute (best-effort)
  try{ document.documentElement.lang = lang; }catch(e){}
  // load translations and apply immediately
  loadTranslations(lang).then(()=>{
    applySiteTranslations();
    window.dispatchEvent(new CustomEvent('site:langchange',{detail:{lang}}));
  }).catch(()=>{});
}

// Build list of candidate translation URLs for a given normalized lang
function getTranslationUrlsFor(lang){
  lang = normalizeLang(lang);
  // Preferred order:
  // 1. /i18n/{lang}/common.json
  // 2. /i18n/{baseLang}/common.json (if lang includes region variant)
  // 3. fallback to English
  const urls = [];
  urls.push('/i18n/' + lang + '/common.json');
  const base = (lang || '').split(/[-_]/)[0];
  if (base && base !== lang){ urls.push('/i18n/' + base + '/common.json'); }
  if (lang !== 'en') urls.push('/i18n/en/common.json');
  return urls;
}

async function loadTranslations(lang){
  lang = normalizeLang(lang);
  const candidates = getTranslationUrlsFor(lang);
  for (let i = 0; i < candidates.length; i++){
    const url = candidates[i];
    try{
      const res = await fetch(url, {cache: 'no-cache'});
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      // window.I18N should be a simple key->string map
      window.I18N = Object.assign({}, data);
      return window.I18N;
    }catch(err){
      console.warn('i18n: failed to load', url, '- trying next fallback');
    }
  }
  // final fallback to English
  if (lang !== 'en') return loadTranslations('en');
  return window.I18N || {};
}

function applySiteTranslations(){
  try{
    const lang = getSiteLang();
    // Apply data-i18n attributes
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      let text = '';
      const val = (window.I18N && window.I18N[key]);
      if (typeof val === 'string') text = val;
      else if (val && typeof val === 'object') text = val[lang] || val.en || '';
      else text = '';

      if (text !== undefined){
        // If there is a child .brand-text, only update that node
        const child = el.querySelector && el.querySelector('.brand-text');
        if (child) child.textContent = text; else el.textContent = text;
      }
    });

    // Fallback: translate nav anchors and drop buttons when data-i18n not present (backwards compatible)
    if (window.I18N){
      document.querySelectorAll('#primary-nav a').forEach(a => {
        if (a.hasAttribute('data-i18n')) return;
        const href = a.getAttribute('href') || '';
        const name = href.split('/').pop().split('#')[0].split('?')[0].replace(/\.[a-z]+$/i,'');
        if (!name) return;
        const key = ('nav_' + name.replace(/[^a-z0-9]+/gi,'_').toLowerCase());
        if (window.I18N[key]) a.textContent = (typeof window.I18N[key] === 'string') ? window.I18N[key] : (window.I18N[key][lang] || window.I18N[key].en || a.textContent);
      });

      document.querySelectorAll('#primary-nav .drop-toggle').forEach(btn => {
        if (btn.hasAttribute('data-i18n')) return;
        const text = (btn.textContent || '').replace(/\+/g,'').trim();
        if (!text) return;
        const slug = text.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
        const key = 'header_' + slug;
        if (window.I18N[key]){
          const span = btn.querySelector('span');
          const newText = (typeof window.I18N[key] === 'string') ? window.I18N[key] : (window.I18N[key][lang] || window.I18N[key].en || text);
          if (btn.firstChild && btn.firstChild.nodeType === Node.TEXT_NODE){ btn.firstChild.textContent = newText + ' '; } else { btn.insertBefore(document.createTextNode(newText + ' '), span || null); }
        }
      });

      // support data-i18n-placeholder and ARIA labels
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (!key) return;
        const val = window.I18N[key];
        if (typeof val === 'string') el.setAttribute('placeholder', val); else if (val && typeof val === 'object') el.setAttribute('placeholder', val[lang] || val.en || '');
      });

      document.querySelectorAll('[data-i18n-aria]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria');
        if (!key) return;
        const val = window.I18N[key];
        if (typeof val === 'string') el.setAttribute('aria-label', val); else if (val && typeof val === 'object') el.setAttribute('aria-label', val[lang] || val.en || '');
      });
    }

    // Update logos / favicons and document title
    try{ updateLogos(); }catch(e){}

    try{
      const siteTitle = (window.I18N && window.I18N.site_title) || 'TSD Myanmar';
      if (document.title && document.title.includes('—')){
        const parts = document.title.split('—');
        document.title = siteTitle + ' — ' + parts.slice(1).join('—').trim();
      } else {
        document.title = siteTitle + (document.title ? ' — ' + document.title : '');
      }
    }catch(e){}

    console.debug('i18n: applied translations for', getSiteLang());
  }catch(e){ console.error('i18n apply error', e); }
}

function ensureLangSelector(){
  const sels = document.querySelectorAll('#site-lang-select');
  if (!sels || sels.length === 0) return;
  sels.forEach(sel=>{
    try{
      if (!sel.dataset.i18nAttached){
        // ensure options exist (safe, idempotent)
        sel.innerHTML = '<option value="en">English</option><option value="mrh">Mara</option><option value="my">Burmese</option>';
        sel.value = getSiteLang();

        const handler = (e)=>{
          const v = sel.value;
          setSiteLang(v);
        };
        sel.addEventListener('change', handler);
        sel.addEventListener('input', handler);
        sel.addEventListener('mousedown', e=>e.stopPropagation());
        sel.dataset.i18nAttached = '1';
      } else {
        sel.value = getSiteLang();
      }
    }catch(e){ console.error('i18n: init selector failed', e); }
  });
}

function updateLogos(){
  const lang = getSiteLang();
  const theme = (document.documentElement && (document.documentElement.getAttribute('data-theme') || window.__TSD_THEME)) || 'light';
  const logoFolder = 'assets/images/logo/';
  const base = (lang === 'mrh') ? 'logo-dark' : 'logo-light';
  // Build a robust candidate list covering possible filename conventions present in assets
  const names = [
    base + '_' + theme + '.svg',
    base + '.svg',
    'logo-' + theme + '.svg',
    'logo-' + theme + '_' + theme + '.svg'
  ];
  const candidates = [];
  names.forEach(n=>{ candidates.push(logoFolder + n); candidates.push('./' + logoFolder + n); candidates.push('../' + logoFolder + n); candidates.push('/' + logoFolder + n); });

  document.querySelectorAll('.brand-logo').forEach(img=>{
    try{
      img.setAttribute('alt', (window.I18N && window.I18N.site_title) || 'TSD Myanmar');
      (function tryNext(i){ if (i>=candidates.length) return; const src = candidates[i]; const t = new Image(); t.onload = function(){ img.src = src; }; t.onerror = function(){ tryNext(i+1); }; t.src = src; })(0);
    }catch(e){ console.error('i18n updateLogos err', e); }
  });
  try{ updateFavicons(); }catch(e){}
}

function updateFavicons(){
  const lang = getSiteLang();
  const theme = (document.documentElement && (document.documentElement.getAttribute('data-theme') || window.__TSD_THEME)) || 'light';
  const logoFolder = 'assets/images/logo/';
  const base = (lang === 'mrh') ? 'logo-dark' : 'logo-light';
  const names = [
    base + '_' + theme + '.svg',
    base + '.svg',
    'logo-' + theme + '.svg'
  ];
  const candidates = [];
  names.forEach(n=>{ candidates.push(logoFolder + n); candidates.push('./' + logoFolder + n); candidates.push('../' + logoFolder + n); candidates.push('/' + logoFolder + n); });

  let link = document.getElementById('site-favicon') || document.querySelector("link[rel~='icon']");
  if (!link){ link = document.createElement('link'); link.id = 'site-favicon'; link.rel = 'icon'; document.head.appendChild(link); }
  link.type = 'image/svg+xml';
  try{ const siteTitle = (window.I18N && window.I18N.site_title) || 'TSD Myanmar'; link.title = siteTitle; link.setAttribute('title', siteTitle); link.setAttribute('aria-label', siteTitle); }catch(e){}

  (function tryNext(i){ if (i>=candidates.length) return; const src = candidates[i]; const t = new Image(); t.onload = function(){ try{ link.href = src; }catch(e){} }; t.onerror = function(){ tryNext(i+1); }; t.src = src; })(0);
}

// Initialize
document.addEventListener('DOMContentLoaded', ()=>{
  try{
    // migrate any legacy key value
    const raw = localStorage.getItem(TSD_LANG_KEY);
    if (raw === 'mara'){ localStorage.setItem(TSD_LANG_KEY, 'mrh'); }

    const lang = getSiteLang();
    ensureLangSelector();
    loadTranslations(lang).then(()=>{ applySiteTranslations(); });

    // reapply briefly for dynamic keys
    setTimeout(()=>{ try{ applySiteTranslations(); }catch(e){} }, 150);

    const observer = new MutationObserver(()=>{ if (document.querySelector('#site-lang-select')) ensureLangSelector(); });
    observer.observe(document.body, { childList:true, subtree:true });

    window.addEventListener('site:i18nready', ()=>{ loadTranslations(getSiteLang()).then(()=>applySiteTranslations()); });

  }catch(e){ console.error('i18n init', e); }
});

// public API
window.tsdI18n = { getSiteLang, setSiteLang, loadTranslations, applySiteTranslations };


