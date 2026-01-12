// Frontend script to load updates from data/updates.json and respond to site language
// Use the shared site language (exposed by js/i18n.js) and expose I18N mapping globally
// so js/i18n.js can apply translations to elements with data-i18n.

// Simple i18n strings for static UI (mara / en / my)
const I18N = {
  nav_updates: { mara: 'Thatih', en: 'Updates & News', my: 'အသစ်များ' },
  nav_updates_home: { mara: 'Thatih Home', en: 'Updates Home', my: 'အသစ်များ အိမ်' },
  nav_site_home: { mara: 'Site Home', en: 'Site Home', my: 'ဆိုက်ပင်မ' },
  loading: { mara: 'Loading updates…', en: 'Loading updates…', my: 'အသစ်များကို ဖတ်နေသည်…' },
  failed_load: { mara: 'Failed to load updates', en: 'Failed to load updates', my: 'အသစ်များ ဖတ်၍မရပါ' },
  latest_news_h2: { mara: 'Thatih', en: 'Latest News', my: 'နောက်ဆုံးသတင်းများ' },
  visit_full_feed: { mara: 'Visit the updates page for the full feed.', en: 'Visit the updates page for the full feed.', my: 'ပြည့်စုံသော သတင်းလွှာအတွက် update စာမျက်နှာသို့ သွားပါ။' },
  open_updates: { mara: 'Open Updates & News', en: 'Open Updates & News', my: 'အသစ်များ ဖွင့်မည်' }
};

// expose I18N for use by shared i18n applier
window.I18N = Object.assign(window.I18N || {}, I18N);
// Notify shared i18n that page-specific keys are registered
try{ window.dispatchEvent(new CustomEvent('site:i18nready')); }catch(e){}

function getSiteLang(){
  // prefer shared getter if available
  try{ if (window.tsdI18n && window.tsdI18n.getSiteLang) return window.tsdI18n.getSiteLang(); }catch(e){}
  return 'en';
}

async function loadUpdates() {
  const container = document.getElementById('updates-list');
  if (!container) return;
  const lang = getSiteLang();
  try {
    const res = await fetch('data/updates.json');
    const items = await res.json();
    if (!Array.isArray(items)) throw new Error('Invalid data');
    // timeline-style layout with expandable details
    container.innerHTML = '';
    items.forEach(it => {
      const title = (it.title && (it.title[lang] || it.title['en'])) || 'Untitled';
      const summary = (it.summary && (it.summary[lang] || it.summary['en'])) || '';
      const id = `u-${it.id}`;
      const el = document.createElement('article');
      el.className = 'timeline-item';
      el.innerHTML = `
        <header><h3>${escapeHtml(title)}</h3><time aria-label="date">${escapeHtml(it.date)}</time></header>
        <div class="summary">${escapeHtml(summary)}</div>
        <button class="btn-plain" aria-expanded="false" aria-controls="${id}">Read more</button>
        <div id="${id}" class="more" hidden>
          <p>${escapeHtml((it.body && it.body[lang]) || '')}</p>
        </div>
      `;
      container.appendChild(el);
    });
    // wire buttons
    container.querySelectorAll('button[aria-controls]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const target = document.getElementById(btn.getAttribute('aria-controls'));
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!expanded));
        if (target){
          target.hidden = expanded;
        }
      });
    });
  } catch (err) {
    const text = (I18N.failed_load[getSiteLang()] || I18N.failed_load.en) + ': ' + (err.message || '');
    container.innerHTML = `<p>${escapeHtml(text)}</p>`;
  }
}

function escapeHtml(str){
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" }[c]));
}

document.addEventListener('DOMContentLoaded', ()=>{
  // Initial load
  loadUpdates();
  // Re-load when site language changes
  window.addEventListener('site:langchange', ()=>{
    loadUpdates();
  });
});
