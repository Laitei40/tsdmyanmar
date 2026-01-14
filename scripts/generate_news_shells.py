#!/usr/bin/env python3
"""
generate_news_shells.py

Generate minimal per-article HTML shells from JSON files under `news/{lang}/*.json`.

Behavior:
- For each JSON article (except index.json) produce `news/{lang}/{slug}/index.html`.
- Include <title>, meta description, Open Graph tags, JSON-LD Article, canonical, hreflang alternates.
- Keep body lightweight and include a small inline hydration script that calls `window.tsdNews.fetchNewsJson(articleId)`
  (the project already includes `js/core/news.js`).

This script is intended to run in CI (GitHub Actions) and commit generated files back to the repo.
"""
import json
import os
from pathlib import Path
import html
import sys


ROOT = Path(__file__).resolve().parent.parent
NEWS_DIR = ROOT / 'news'
SITE_NAME = 'TSD Myanmar'


def list_languages():
    if not NEWS_DIR.exists():
        return []
    return sorted([p.name for p in NEWS_DIR.iterdir() if p.is_dir()])


def read_json(p: Path):
    try:
        return json.loads(p.read_text(encoding='utf-8'))
    except Exception:
        return None


def build_alternates(slug, languages):
    parts = []
    for l in languages:
        href = f"/news/{l}/{slug}/"
        parts.append(f'<link rel="alternate" hreflang="{html.escape(l)}" href="{html.escape(href)}" />')
    return '\n    '.join(parts)


def build_json_ld(title, summary, date, url):
    ld = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": title,
        "datePublished": date,
        "description": summary,
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": url
        }
    }
    return json.dumps(ld, ensure_ascii=False)


def generate_shell(lang, article_path, languages):
    data = read_json(article_path)
    if not data:
        return None

    slug = data.get('slug') or article_path.stem
    title = data.get('title') or ''
    summary = data.get('summary') or ''
    date = data.get('date') or ''
    article_id = article_path.stem

    url_path = f"/news/{lang}/{slug}/"
    alternates = build_alternates(slug, languages)
    json_ld = build_json_ld(title, summary, date, url_path)

    meta_desc = html.escape(summary[:160])
    esc_title = html.escape(title)

    # Build optional static hero HTML (useful for SEO and first paint)
    hero_html = ''
    try:
      imgs = data.get('images') or []
      if isinstance(imgs, list) and len(imgs) > 0:
        first = imgs[0]
        src = html.escape(first.get('src',''))
        alt = html.escape(first.get('alt',''))
        cap = html.escape(first.get('caption',''))
        if src:
          hero_html = f"<figure class=\"article-hero\"><img class=\"hero-image\" src=\"{src}\" alt=\"{alt}\" loading=\"lazy\" decoding=\"async\">"
          if cap:
            hero_html += f"<figcaption class=\"hero-caption\">{cap}</figcaption>"
          hero_html += "</figure>"
    except Exception:
      hero_html = ''

    # Minimal HTML shell using safe placeholders to avoid accidental f-string braces
    template = """<!doctype html>
<html lang="{LANG}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{TITLE} — {SITE_NAME}</title>
  <meta name="description" content="{META_DESC}">
  <meta property="og:title" content="{TITLE}" />
  <meta property="og:description" content="{META_DESC}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="{URL_PATH}" />
  <meta property="og:site_name" content="{SITE_NAME}" />
  {ALTERNATES}
  <link rel="canonical" href="{URL_PATH}" />
  <script type="application/ld+json">{JSON_LD}</script>
  <link rel="stylesheet" href="/css/main.css">
</head>
<body class="article-page">
  <main class="page">
    <article id="article-shell" class="article" role="article">
      <header class="article-header">
        <div class="article-header-inner">
          <h1 id="article-title" class="article-title">{TITLE}</h1>
          <div class="article-meta">
            <time id="article-date" class="article-date" datetime="{DATE}">{DATE}</time>
          </div>
          <p id="article-summary" class="article-summary">{SUMMARY}</p>
        </div>
      </header>

      {HERO_HTML}

      <section id="article-body" class="article-content" aria-live="polite">Loading article…</section>
    </article>
  </main>

  <script src="/js/core/i18n.js"></script>
  <script src="/js/core/news.js"></script>
  <script>
    (function(){
      try{
        var articleId = '{ARTICLE_ID}';
        if (window.tsdNews && window.tsdNews.fetchNewsJson){
          window.tsdNews.fetchNewsJson(articleId).then(function(data){
            if (!data) return;
            var body = document.getElementById('article-body');
            var title = document.getElementById('article-title');
            var dateEl = document.getElementById('article-date');
            var summaryEl = document.getElementById('article-summary');
            if (data.title) title.textContent = data.title;
            if (data.date) dateEl.textContent = data.date;
            if (data.summary && !summaryEl.textContent) summaryEl.textContent = data.summary;
            // Prefer structured renderer if available
            if (window.tsdNews && window.tsdNews.renderArticle){
              try{ window.tsdNews.renderArticle(data, body); }
              catch(e){ if (data.body_html) body.innerHTML = data.body_html; else if (data.body) body.textContent = data.body; }
            } else {
              if (data.body_html) body.innerHTML = data.body_html;
              else if (data.body) body.textContent = data.body;
            }
            try{ document.title = (data.title ? data.title + ' — ' : '') + '{SITE_NAME}'; }catch(e){}
          }).catch(function(){/* ignore */});
        }
      }catch(e){/* ignore */}
    })();
  </script>
</body>
</html>
"""

    content = (template
               .replace('{LANG}', html.escape(lang))
               .replace('{TITLE}', esc_title)
               .replace('{SITE_NAME}', html.escape(SITE_NAME))
               .replace('{META_DESC}', meta_desc)
               .replace('{ALTERNATES}', alternates)
               .replace('{JSON_LD}', json_ld)
               .replace('{URL_PATH}', html.escape(url_path))
               .replace('{ARTICLE_ID}', html.escape(article_id))
               .replace('{DATE}', html.escape(date))
               .replace('{SUMMARY}', html.escape(summary)))

    return slug, content


def main():
    languages = list_languages()
    if not languages:
        print('No languages found under news/ - nothing to generate.')
        return 0

    generated = 0
    for lang in languages:
        lang_dir = NEWS_DIR / lang
        for p in sorted(lang_dir.glob('*.json')):
            if p.name == 'index.json':
                continue
            res = generate_shell(lang, p, languages)
            if not res:
                continue
            slug, content = res
            out_dir = NEWS_DIR / lang / slug
            out_dir.mkdir(parents=True, exist_ok=True)
            out_file = out_dir / 'index.html'
            out_file.write_text(content, encoding='utf-8')
            generated += 1

    print(f'Generated {generated} article shells for languages: {", ".join(languages)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
