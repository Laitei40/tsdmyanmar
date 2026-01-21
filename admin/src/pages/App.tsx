import React, { useEffect, useState } from 'react';
import { listNews, getNews, createNews, updateNews, deleteNews } from '../lib/api';
import type { NewsItem } from '../lib/types';
import { NewsTable } from '../components/NewsTable';
import { NewsForm } from '../components/NewsForm';

export const App: React.FC = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [modalItem, setModalItem] = useState<(NewsItem & { etag?: string }) | null>(null);
  const [message, setMessage] = useState('');

  async function load(reset=false){
    setLoading(true);
    try{
      if (reset) setPage(0);
      const data = await listNews({ search, status, category, offset: (reset?0:page*pageSize), limit: pageSize });
      setItems(data.items);
      setTotal(data.total || data.items.length);
    }catch(e){ setMessage('Failed to load'); console.error(e); }
    finally{ setLoading(false); }
  }

  useEffect(()=>{ load(true); }, []);

  function onCreate(){ setModalItem({ id: 0 }); }

  async function onEdit(item: NewsItem){
    try{
      const full = await getNews(item.id);
      setModalItem(full);
    }catch(e){ setMessage('Failed to load item'); }
  }

  async function onDelete(item: NewsItem){
    if (!confirm('Delete this article?')) return;
    try{
      const full = await getNews(item.id);
      await deleteNews(item.id, full.etag);
      setMessage('Deleted');
      load(true);
    }catch(e){ setMessage(e instanceof Error && e.message === 'etag-conflict' ? 'Outdated version. Refresh.' : 'Delete failed'); }
  }

  async function handleSave(payload: Partial<NewsItem>, etag?: string){
    try{
      if (modalItem?.id && modalItem.id !== 0){
        await updateNews(modalItem.id, etag || '', payload);
        setMessage('Updated');
      } else {
        await createNews(payload);
        setMessage('Created');
      }
      setModalItem(null);
      load(true);
    }catch(e){
      if (e instanceof Error && e.message === 'etag-conflict') setMessage('Version conflict. Refresh.');
      else if (typeof e === 'object') setMessage('Validation failed');
      else setMessage('Save failed');
    }
  }

  const pages = Math.ceil(total / pageSize);

  return (
    <div className="app-shell">
      <div className="header">
        <div>
          <h2>Admin News Dashboard</h2>
          <p className="small">Protected by Cloudflare Access. All actions audited.</p>
        </div>
        <div className="flex">
          <button className="primary" onClick={onCreate}>New Article</button>
        </div>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div className="form-grid">
          <div>
            <label>Search</label>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Title, content" />
          </div>
          <div>
            <label>Status</label>
            <select value={status} onChange={e=>setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label>Category</label>
            <input value={category} onChange={e=>setCategory(e.target.value)} placeholder="Education" />
          </div>
          <div style={{display:'flex', alignItems:'flex-end', gap:8}}>
            <button className="primary" onClick={()=>load(true)}>Filter</button>
            <button className="ghost" onClick={()=>{ setSearch(''); setStatus(''); setCategory(''); load(true); }}>Reset</button>
          </div>
        </div>
      </div>

      {message && <p className="small">{message}</p>}

      {loading ? <p>Loading…</p> : <NewsTable items={items} onEdit={onEdit} onDelete={onDelete} />}

      <div className="flex mt-3">
        <span className="small">Page {page+1} of {pages || 1}</span>
        <div className="flex">
          <button className="ghost" disabled={page===0} onClick={()=>{ setPage(p=>Math.max(0,p-1)); load(); }}>Prev</button>
          <button className="ghost" disabled={(page+1)>=pages} onClick={()=>{ setPage(p=>p+1); load(); }}>Next</button>
        </div>
      </div>

      {modalItem && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <NewsForm initial={modalItem} onSave={handleSave} onCancel={()=>setModalItem(null)} />
          </div>
        </div>
      )}
    </div>
  );
};
