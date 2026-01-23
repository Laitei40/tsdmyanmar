const apps = [
  {
    id: 'pdfchhiana',
    title: 'PDFChhiana',
    desc: 'PDFChhiana (where Chhiana means "Forge" in the Mara language) is a free and open-source Windows desktop application designed to forge PDFs into clean, consistent, and professional documents. It allows users to merge PDFs, edit pages, and normalize page sizes for printing or sharing — all while working fully offline.',
    tags: ['desktop', 'pdf', 'tools'],
    version: '1.0.0',
    icon: 'assets/PDFChhiana.svg',
    downloadUrl: 'PDFChhiana.Installer_1.0.25.0_x64.msixbundle'
  }
];

const appsRoot = document.querySelector('#apps .apps-grid');
const search = document.getElementById('search');
const filter = document.getElementById('filter');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const modalClose = document.getElementById('modalClose');
const heroBrowse = document.getElementById('heroBrowse');
const heroDownload = document.getElementById('heroDownload');
const featuredDownload = document.getElementById('featuredDownload');
const featuredLearn = document.getElementById('featuredLearn');
const metricApps = document.getElementById('metricApps');

function uniqueTags(list){
  const s = new Set();
  list.forEach(a=>a.tags.forEach(t=>s.add(t)));
  return Array.from(s).sort();
}

function buildFilters(){
  const tags = uniqueTags(apps);
  tags.forEach(t=>{
    const opt = document.createElement('option');opt.value=t;opt.textContent = t;filter.appendChild(opt);
  });
}

function svgIcon(app){
  // prefer an explicit icon path
  if(app && app.icon){
    return `<div class="app-icon" aria-hidden="true"><img src="${app.icon}" alt="" style="width:36px;height:36px;border-radius:8px;object-fit:cover;"></div>`;
  }
  const text = app && app.title ? app.title : (app || '');
  return `<div class="app-icon" aria-hidden="true">${text[0] ? text[0].toUpperCase() : '?'}</div>`;
} 

function renderApps(q='',cat='all'){
  appsRoot.innerHTML = '';
  const filtered = apps.filter(a=>{
    const matchQ = a.title.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q) || a.tags.join(' ').includes(q);
    const matchC = (cat === 'all') ? true : a.tags.includes(cat);
    return matchQ && matchC;
  });

  if(filtered.length === 0){
    appsRoot.innerHTML = `<p style="color:var(--muted);">No apps found.</p>`;
    return;
  }

  filtered.forEach(a=>{
    const card = document.createElement('article');card.className='card';
    card.innerHTML = `
      <div class="card-head">
        ${svgIcon(a)}
        <div>
          <h3>${a.title}</h3>
          <p>${a.desc}</p>
        </div>
      </div>
      <div class="tags">${a.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>
      <div class="card-footer">
        <small>Version ${a.version}</small>
        <div>
          <button class="btn" data-id="${a.id}" data-action="preview" aria-label="Preview ${a.title}">Preview</button>
          <button class="btn primary" data-id="${a.id}" data-action="download" aria-label="Download ${a.title}">Download</button>
        </div>
      </div>
    `;

    appsRoot.appendChild(card);
  });

  // attach actions
  document.querySelectorAll('#apps .card .btn').forEach(b=>{
    b.onclick = (e)=>{
      const id = e.currentTarget.dataset.id;
      const action = e.currentTarget.dataset.action;
      if(action === 'download'){
        handleDownload(id);
      }else{
        openModal(id);
      }
    };
  });
}

function openModal(id){
  const a = apps.find(x=>x.id===id);
  if(!a) return;
  modalContent.innerHTML = `
    <h3 style="margin-top:0">${a.title}</h3>
    <p style="color:var(--muted)">${a.desc}</p>
    <div style="margin-top:12px"><strong>Tags</strong>: ${a.tags.join(', ')}</div>
    <div style="margin-top:16px"><button class="btn primary" data-modal-download="${a.id}">Download</button></div>
  `;
  modal.setAttribute('aria-hidden','false');
  modal.focus();

  const modalBtn = modalContent.querySelector('[data-modal-download]');
  if(modalBtn){
    modalBtn.onclick = ()=> handleDownload(id);
  }
}

function handleDownload(id){
  const app = apps.find(x=>x.id===id);
  if(!app) return;
  if(app.downloadUrl){
    window.location.href = app.downloadUrl;
  }
}

function openScreenshot(src, alt){
  if(!src) return;
  modalContent.innerHTML = `
    <figure style="margin:0">
      <img src="${src}" alt="${alt || ''}" style="max-width:100%;max-height:70vh;border-radius:12px;display:block;margin:0 auto;" />
      ${alt ? `<figcaption style="margin-top:8px;color:var(--muted);font-size:13px;text-align:center;">${alt}</figcaption>` : ''}
    </figure>
  `;
  modal.setAttribute('aria-hidden','false');
  modal.focus();
}

modalClose.onclick = ()=>{ modal.setAttribute('aria-hidden','true'); };
modal.onclick = (e)=>{ if(e.target === modal) modal.setAttribute('aria-hidden','true'); };
window.addEventListener('keydown', e=>{ if(e.key === 'Escape') modal.setAttribute('aria-hidden','true'); });

if(heroBrowse){
  heroBrowse.onclick = ()=>{
    document.getElementById('apps')?.scrollIntoView({behavior:'smooth'});
  };
}

if(heroDownload){
  heroDownload.onclick = ()=> handleDownload('pdfchhiana');
}

if(featuredDownload){
  featuredDownload.onclick = ()=> handleDownload('pdfchhiana');
}

if(featuredLearn){
  featuredLearn.onclick = ()=> openModal('pdfchhiana');
}

// screenshot lightbox
document.querySelectorAll('.screenshots img').forEach(img=>{
  img.addEventListener('click', ()=>{
    openScreenshot(img.getAttribute('src'), img.getAttribute('alt'));
  });
});

search.addEventListener('input', e=>{
  const q = e.target.value.trim().toLowerCase();
  renderApps(q, filter.value);
});

filter.addEventListener('change', e=>{
  const cat = e.target.value;
  renderApps(search.value.trim().toLowerCase(), cat);
});

// init
buildFilters();
renderApps();

if(metricApps){
  metricApps.textContent = apps.length === 1 ? '1 app' : `${apps.length}+`;
}