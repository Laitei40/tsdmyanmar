import React, { useState, useEffect, useCallback } from 'react';
import type { NewsItem, Status, I18nField, Lang } from '../lib/types';
import { LANGS, CATEGORIES } from '../lib/types';

interface Props {
  initial?: Partial<NewsItem>;
  onSave: (payload: Partial<NewsItem>, etag?: string) => void;
  onCancel: () => void;
}

const STATUS_OPTIONS: Status[] = ['draft', 'published', 'archived'];

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

export const NewsForm: React.FC<Props> = ({ initial, onSave, onCancel }) => {
  const isNew = !initial?.id || initial.id === 0;

  // Metadata
  const [slug, setSlug] = useState(initial?.slug || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [tags, setTags] = useState((initial?.tags || []).join(', '));
  const [status, setStatus] = useState<Status>(initial?.status || 'draft');
  const [publishDate, setPublishDate] = useState(initial?.publish_date || new Date().toISOString().slice(0, 10));
  const [featuredImage, setFeaturedImage] = useState(initial?.featured_image || '');
  const [author, setAuthor] = useState(initial?.author || '');

  // i18n fields
  const [title, setTitle] = useState<I18nField>(initial?.title || {});
  const [summary, setSummary] = useState<I18nField>(initial?.summary || {});
  const [body, setBody] = useState<I18nField>(initial?.body || {});

  // UI state
  const [activeLang, setActiveLang] = useState<Lang>('en');
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [error, setError] = useState('');
  const [autoSlug, setAutoSlug] = useState(isNew);

  useEffect(() => { setError(''); }, [title, slug, body]);

  // Auto-generate slug from English title
  useEffect(() => {
    if (autoSlug && title.en) setSlug(slugify(title.en));
  }, [title.en, autoSlug]);

  const setI18n = useCallback((setter: React.Dispatch<React.SetStateAction<I18nField>>, lang: Lang, value: string) => {
    setter(prev => ({ ...prev, [lang]: value }));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.en?.trim()) { setError('English title is required.'); return; }
    if (!slug.trim()) { setError('Slug is required.'); return; }
    if (!author.trim()) { setError('Author is required.'); return; }
    if (!publishDate) { setError('Publish date is required.'); return; }
    if (!body.en?.trim()) { setError('English content is required.'); return; }

    const payload: Partial<NewsItem> = {
      title, summary, body, slug: slug.trim(),
      category: category.trim() || undefined,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      status, publish_date: publishDate,
      featured_image: featuredImage.trim() || undefined,
      author: author.trim(),
    };
    onSave(payload, initial?.etag);
  }

  return (
    <form className="news-form" onSubmit={handleSubmit}>
      {/* ── Header ── */}
      <div className="form-header">
        <h3>{isNew ? 'Create Article' : 'Edit Article'}</h3>
        <button type="button" className="btn-icon" onClick={onCancel} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* ── Language tabs ── */}
      <div className="lang-tabs">
        {LANGS.map(l => (
          <button key={l.code} type="button"
            className={`lang-tab ${activeLang === l.code ? 'active' : ''}`}
            onClick={() => setActiveLang(l.code)}>
            {l.label}
            {l.code !== 'en' && !title[l.code] && <span className="tab-dot" title="Not translated" />}
          </button>
        ))}
      </div>

      {/* ── Title ── */}
      <div className="field">
        <label>Title <span className="lang-badge">{activeLang.toUpperCase()}</span></label>
        <input
          value={title[activeLang] || ''}
          onChange={e => setI18n(setTitle, activeLang, e.target.value)}
          placeholder={activeLang === 'en' ? 'Article title (required)' : `Title in ${LANGS.find(l => l.code === activeLang)?.label || activeLang}`}
          required={activeLang === 'en'}
        />
      </div>

      {/* ── Summary ── */}
      <div className="field">
        <label>Summary <span className="lang-badge">{activeLang.toUpperCase()}</span></label>
        <textarea rows={2}
          value={summary[activeLang] || ''}
          onChange={e => setI18n(setSummary, activeLang, e.target.value)}
          placeholder="Short excerpt shown in cards"
        />
      </div>

      {/* ── Body (edit / preview) ── */}
      <div className="field">
        <div className="field-header">
          <label>Content <span className="lang-badge">{activeLang.toUpperCase()}</span></label>
          <div className="toggle-tabs">
            <button type="button" className={activeTab === 'edit' ? 'active' : ''} onClick={() => setActiveTab('edit')}>Edit</button>
            <button type="button" className={activeTab === 'preview' ? 'active' : ''} onClick={() => setActiveTab('preview')}>Preview</button>
          </div>
        </div>
        {activeTab === 'edit' ? (
          <textarea rows={12}
            value={body[activeLang] || ''}
            onChange={e => setI18n(setBody, activeLang, e.target.value)}
            placeholder="<p>Article body (HTML)</p>"
            required={activeLang === 'en'}
            className="code-textarea"
          />
        ) : (
          <div className="html-preview" dangerouslySetInnerHTML={{ __html: body[activeLang] || '<em>No content</em>' }} />
        )}
      </div>

      {/* ── Metadata grid ── */}
      <div className="form-grid">
        <div className="field">
          <label>Slug</label>
          <div className="input-group">
            <input value={slug} onChange={e => { setAutoSlug(false); setSlug(e.target.value); }} required placeholder="my-article" />
            {isNew && <button type="button" className="btn-mini" onClick={() => { setAutoSlug(true); if (title.en) setSlug(slugify(title.en)); }}>Auto</button>}
          </div>
        </div>
        <div className="field">
          <label>Author</label>
          <input value={author} onChange={e => setAuthor(e.target.value)} required placeholder="TSD Comms" />
        </div>
        <div className="field">
          <label>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as Status)}>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Publish Date</label>
          <input type="date" value={publishDate} onChange={e => setPublishDate(e.target.value)} required />
        </div>
        <div className="field">
          <label>Tags (comma separated)</label>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="health, outreach" />
        </div>
      </div>

      {/* ── Featured image ── */}
      <div className="field">
        <label>Featured Image URL</label>
        <input value={featuredImage} onChange={e => setFeaturedImage(e.target.value)} placeholder="https://…" />
        {featuredImage && (
          <div className="image-preview">
            <img src={featuredImage} alt="Preview" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
          </div>
        )}
      </div>

      {/* ── Error + Actions ── */}
      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary">
          {isNew ? 'Create' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};
