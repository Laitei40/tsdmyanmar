document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.getElementById('testimonials-slider');
  if (!wrap) return;

  // Parse testimonials from data attribute (JSON) or use defaults
  let items = [];
  const raw = wrap.getAttribute('data-items') || '';
  if (raw) {
    try { items = JSON.parse(raw); } catch (e) { items = []; }
  }
  if (!items.length) {
    items = [
      { img: 'https://picsum.photos/id/1005/800/800', quote: '“Participating in this programme has been a turning point for me. It has given me new skills and hope for the future.”', author: 'Hraki, Food Security participant' },
      { img: 'https://picsum.photos/id/1011/800/800', quote: '“The training helped our village set up a small nursery and we now have seedlings for agroforestry.”', author: 'Aung, Farmer' },
      { img: 'https://picsum.photos/id/1027/800/800', quote: '“Local health workers trained through the programme have improved care for our children.”', author: 'Maya, Community member' }
    ];
  }

  const TRANS_MS = 600; // CSS fade duration ms
  const INTERVAL_MS = 10000; // 10s autoplay

  // Inject minimal styles scoped to the component
  const style = document.createElement('style');
    style.textContent = `
    /* Refined testimonial slider styles: wider card + glasslike controls */
    #testimonials-slider{position:relative;display:block;margin:18px 0;max-width:1300px}
    #testimonials-slider .slide{display:flex;align-items:center;justify-content:center;opacity:0;position:absolute;inset:0;padding:12px;box-sizing:border-box;transition:opacity ${TRANS_MS}ms ease}
    #testimonials-slider .slide.active{opacity:1;position:relative}

    /* Card containing image + text (wider) */
    #testimonials-slider .card{display:flex;align-items:center;gap:16px;background:var(--surface, var(--color-surface));color:var(--text);padding:18px;border-radius:10px;border:2px solid var(--color-accent);box-shadow:0 10px 30px rgba(2,6,12,0.08);width:95%;max-width:1150px}

    /* Image area slightly smaller to give text more room */
    #testimonials-slider .media{flex:0 0 22%;max-width:22%;min-width:140px}
    #testimonials-slider .media img{width:100%;height:140px;object-fit:cover;border-radius:8px}

    #testimonials-slider .content{flex:1 1 78%}
    #testimonials-slider .content p{margin:0 0 8px;font-size:1rem;line-height:1.5;color:var(--text)}
    #testimonials-slider .content cite{font-size:0.9rem;color:var(--muted)}

    /* Glasslike prev/next controls centered vertically */
    #testimonials-slider .controls{position:absolute;top:50%;left:0;right:0;display:flex;justify-content:space-between;pointer-events:none;padding:0 6px}
    #testimonials-slider .controls button{pointer-events:auto;background:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.08);padding:8px 12px;border-radius:10px;margin:0 8px;cursor:pointer;color:var(--text);backdrop-filter:blur(4px);transition:transform 180ms ease,box-shadow 180ms ease,background 180ms ease}
    #testimonials-slider .controls button:hover{transform:translateY(-3px);box-shadow:0 8px 20px rgba(2,6,12,0.12);background:rgba(255,255,255,0.85)}
    #testimonials-slider .controls button:focus{outline:2px solid var(--color-accent)}

    /* Dark theme adjustments */
    [data-theme="dark"] #testimonials-slider .controls button{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);color:var(--text)}
    [data-theme="dark"] #testimonials-slider .controls button:hover{background:rgba(255,255,255,0.06)}
    `;
  document.head.appendChild(style);

  // Build slides
  const slides = items.map((it, i) => {
    const s = document.createElement('div');
    s.className = 'slide' + (i === 0 ? ' active' : '');
    s.setAttribute('role', 'group');
    s.setAttribute('aria-roledescription', 'testimonial');
    function esc(str){ return String(str||'').replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||''; }); }
    var card = document.createElement('div'); card.className = 'card';
    var media = document.createElement('div'); media.className = 'media';
    var img = document.createElement('img'); img.src = it.img || ''; img.alt = 'testimonial image ' + (i+1); img.loading = 'lazy';
    media.appendChild(img);
    var content = document.createElement('div'); content.className = 'content';
    var p = document.createElement('p'); p.textContent = it.quote || '';
    var cite = document.createElement('cite'); cite.textContent = it.author || '';
    content.appendChild(p); content.appendChild(cite);
    card.appendChild(media); card.appendChild(content);
    s.appendChild(card);
    wrap.appendChild(s);
    return s;
  });

  // Controls
  const controls = document.createElement('div');
  controls.className = 'controls';
  const prev = document.createElement('button'); prev.type = 'button'; prev.innerText = '← Prev'; prev.setAttribute('aria-label','Previous testimonial');
  const next = document.createElement('button'); next.type = 'button'; next.innerText = 'Next →'; next.setAttribute('aria-label','Next testimonial');
  controls.appendChild(prev); controls.appendChild(next);
  wrap.appendChild(controls);

  let index = 0;
  let timer = null;
  const count = slides.length;

  function show(i) {
    slides[index].classList.remove('active');
    index = (i + count) % count;
    slides[index].classList.add('active');
  }

  function nextSlide() { show(index + 1); }
  function prevSlide() { show(index - 1); }

  prev.addEventListener('click', () => { prevSlide(); resetTimer(); });
  next.addEventListener('click', () => { nextSlide(); resetTimer(); });

  // Autoplay with pause on pointer/focus
  function startTimer() {
    if (timer) return;
    timer = setInterval(nextSlide, INTERVAL_MS);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function resetTimer() { stopTimer(); startTimer(); }

  wrap.addEventListener('pointerenter', stopTimer);
  wrap.addEventListener('pointerleave', startTimer);
  wrap.addEventListener('focusin', stopTimer);
  wrap.addEventListener('focusout', startTimer);

  // Start autoplay
  if (count > 1) startTimer();
});
