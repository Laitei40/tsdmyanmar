// Main UI interactions: entrance reveal, count-up, updates preview fetch
// Lightweight, accessible, no external libs

function revealOnScroll() {
  const observer = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  },{threshold:0.12});

  document.querySelectorAll('.reveal').forEach(el=>observer.observe(el));
}

function animateCountUps(){
  const elems = document.querySelectorAll('.num[data-count]');
  elems.forEach(el=>{
    const target = Number(el.getAttribute('data-count')) || 0;
    const duration = 1400;
    let start = null;
    const step = (ts)=>{
      if (!start) start = ts;
      const progress = Math.min((ts-start)/duration,1);
      el.textContent = Math.floor(progress*target).toLocaleString();
      if (progress<1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString();
    };
    // Only start when visible
    const io = new IntersectionObserver((entries)=>{
      if (entries[0].isIntersecting){
        requestAnimationFrame(step);
        io.disconnect();
      }
    },{threshold:0.4});
    io.observe(el);
  });
}

async function loadUpdatesPreview(){
  const container = document.getElementById('updates-preview-list');
  if (!container) return;
  try{
    const res = await fetch('updates/data/updates.json');
    const items = await res.json();
    const list = items.slice(0,3).map(it=>{
      const title = (it.title && it.title.en) || it.title || '';
      const date = it.date || '';
      const summary = (it.summary && it.summary.en) || it.summary || '';
      return `<article class="update-item"><h4>${escapeHtml(title)}</h4><time>${escapeHtml(date)}</time><p>${escapeHtml(summary)}</p></article>`;
    }).join('');
    container.innerHTML = list || '<p>No updates yet.</p>';
  }catch(err){
    container.innerHTML = `<p>Failed to load updates: ${escapeHtml(err.message)}</p>`;
  }
}

function escapeHtml(str){
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"']/g, (c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" }[c]));
}

document.addEventListener('DOMContentLoaded', ()=>{
  revealOnScroll();
  animateCountUps();
  loadUpdatesPreview();
});
// Main JS logic (placeholder)
document.addEventListener('DOMContentLoaded', ()=>{
  console.log('TSD Myanmar site loaded');
});
