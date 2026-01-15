document.addEventListener('DOMContentLoaded', function () {
  const container = document.getElementById('hero-slider');
  if (!container) return;

  // Read URLs from data-urls attribute. Accept JSON array or pipe-separated list.
  let urls = [];
  const raw = container.getAttribute('data-urls') || '';
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) urls = parsed.filter(Boolean);
    } catch (e) {
      urls = raw.split('|').map(s => s.trim()).filter(Boolean);
    }
  }

  // Fallback to single hero image if none provided
  if (!urls.length) urls = ['/assets/images/hero.jpeg'];
  urls = urls.slice(0, 7);

  // Minimal styles for the slider (keeps site look intact)
  const style = document.createElement('style');
  style.textContent = `
    #hero-slider{position:relative;width:100%;height:100%;min-height:220px}
    #hero-slider .slide{position:absolute;inset:0;opacity:0;transition:opacity 4s ease;display:flex;align-items:center;justify-content:center}
    #hero-slider .slide img{width:100%;height:100%;object-fit:cover;display:block}
    #hero-slider .slide.active{opacity:1;z-index:2}
  `;
  document.head.appendChild(style);

  // Build slides
  urls.forEach((u, i) => {
    const slide = document.createElement('div');
    slide.className = 'slide' + (i === 0 ? ' active' : '');
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = container.getAttribute('data-alt') || 'Hero image';
    img.src = u;
    slide.appendChild(img);
    container.appendChild(slide);
  });

  // Auto-advance every 2 seconds (2000ms)
  let idx = 0;
  const slides = container.querySelectorAll('.slide');
  if (slides.length > 1) {
    setInterval(() => {
      slides[idx].classList.remove('active');
      idx = (idx + 1) % slides.length;
      slides[idx].classList.add('active');
    }, 2000);
  }
});
