import React, { useState, useEffect } from 'react';
import type { NewsItem, Status } from '../lib/types';

interface Props {
  initial?: Partial<NewsItem> & { etag?: string };
  onSave: (payload: Partial<NewsItem>, etag?: string) => void;
  onCancel: () => void;
}

const statusOptions: Status[] = ['draft','published','archived'];
const categoryOptions = [
  { value: '', label: 'Select category' },
  { value: 'news', label: 'News' },
  { value: 'report', label: 'Report' },
  { value: 'announcement', label: 'Announcement' },
];

export const NewsForm: React.FC<Props> = ({ initial, onSave, onCancel }) => {
  const [title, setTitle] = useState(initial?.title || '');
  const [slug, setSlug] = useState(initial?.slug || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [tags, setTags] = useState((initial?.tags || []).join(', '));
  const [status, setStatus] = useState<Status>(initial?.status || 'draft');
  const [publishDate, setPublishDate] = useState(initial?.publish_date || '');
  const [featuredImage, setFeaturedImage] = useState(initial?.featured_image || '');
  const [author, setAuthor] = useState(initial?.author || '');
  const [content, setContent] = useState(initial?.content_html || '');
  const [error, setError] = useState<string>('');

  useEffect(()=>{ setError(''); }, [title, slug, content]);

  function handleSubmit(e: React.FormEvent){
    e.preventDefault();
    const payload: Partial<NewsItem> = {
      title: title.trim(),
      slug: slug.trim(),
      category: category.trim() || undefined,
      tags: tags ? tags.split(',').map(t=>t.trim()).filter(Boolean) : [],
      status,
      publish_date: publishDate,
      featured_image: featuredImage.trim() || undefined,
      author: author.trim(),
      content_html: content
    };
    if (!payload.title || !payload.slug || !payload.author || !payload.publish_date || !payload.content_html){
      setError('Please fill required fields.');
      return;
    }
    onSave(payload, initial?.etag);
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="flex" style={{justifyContent:'space-between'}}>
        <h3>{initial?.id ? 'Edit article' : 'New article'}</h3>
        <button type="button" className="ghost" onClick={onCancel}>Close</button>
      </div>
      <div className="form-grid mt-2">
        <div>
          <label>Title</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} required />
        </div>
        <div>
          <label>Slug</label>
          <input value={slug} onChange={e=>setSlug(e.target.value)} required placeholder="my-article" />
        </div>
        <div>
          <label>Author</label>
          <input value={author} onChange={e=>setAuthor(e.target.value)} required />
        </div>
        <div>
          <label>Category</label>
          <select value={category} onChange={e=>setCategory(e.target.value)}>
            {categoryOptions.map(c=> <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label>Tags (comma separated)</label>
          <input value={tags} onChange={e=>setTags(e.target.value)} />
        </div>
        <div>
          <label>Status</label>
          <select value={status} onChange={e=>setStatus(e.target.value as Status)}>
            {statusOptions.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label>Publish date</label>
          <input type="date" value={publishDate} onChange={e=>setPublishDate(e.target.value)} required />
        </div>
        <div>
          <label>Featured image URL</label>
          <input value={featuredImage} onChange={e=>setFeaturedImage(e.target.value)} placeholder="https://" />
        </div>
      </div>

      <div className="mt-3">
        <label>Content (HTML)</label>
        <textarea rows={10} value={content} onChange={e=>setContent(e.target.value)} placeholder="<p>Body</p>" />
        <p className="small">HTML will be sanitized server-side.</p>
      </div>

      {error && <p style={{color:'#fca5a5'}}>{error}</p>}

      <div className="flex mt-3" style={{justifyContent:'flex-end'}}>
        <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="primary">Save</button>
      </div>
    </form>
  );
};
