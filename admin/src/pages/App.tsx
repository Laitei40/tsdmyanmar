import React, { useEffect, useState, useCallback, useRef } from 'react';
import { listNews, getNews, createNews, updateNews, deleteNews, getStats } from '../lib/api';
import type { NewsItem } from '../lib/types';
import { CATEGORIES } from '../lib/types';
import { NewsTable } from '../components/NewsTable';
import { NewsForm } from '../components/NewsForm';

/* ── Toast system ── */
type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; text: string; type: ToastType }

let toastId = 0;

function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => onDismiss(t.id)}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ── Stats card ── */
interface Stats { total: number; published: number; draft: number; archived: number }

function StatCards({ stats }: { stats: Stats }) {
  const cards = [
    { label: 'Total', value: stats.total, color: '#60a5fa' },
    { label: 'Published', value: stats.published, color: '#22c55e' },
    { label: 'Drafts', value: stats.draft, color: '#f59e0b' },
    { label: 'Archived', value: stats.archived, color: '#6b7280' },
  ];
  return (
    <div className="stat-cards">
      {cards.map(c => (
        <div key={c.label} className="stat-card" style={{ borderTopColor: c.color }}>
          <span className="stat-value">{c.value}</span>
          <span className="stat-label">{c.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Main App ── */
export const App: React.FC = () => {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [loading, setLoading] = useState(false);
  const [modalItem, setModalItem] = useState<(Partial<NewsItem> & { etag?: string }) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, published: 0, draft: 0, archived: 0 });
  const searchRef = useRef<HTMLInputElement>(null);

  const toast = useCallback((text: string, type: ToastType = 'info') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const p = reset ? 0 : page;
      if (reset) setPage(0);
      const data = await listNews({
        search, status: statusFilter, category: categoryFilter,
        offset: p * pageSize, limit: pageSize,
      });
      setItems(data.items);
      setTotal(data.total || data.items.length);
    } catch (e) {
      toast('Failed to load articles', 'error');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter, page, pageSize, toast]);

  const loadStats = useCallback(async () => {
    try {
      const s = await getStats();
      setStats(s);
    } catch { /* stats are optional */ }
  }, []);

  useEffect(() => { load(true); loadStats(); }, []);

  /* ── Handlers ── */
  function onCreate() {
    setModalItem({ id: 0, title: {}, summary: {}, body: {}, tags: [], status: 'draft', author: '', slug: '', publish_date: new Date().toISOString().slice(0, 10) });
  }

  async function onEdit(item: NewsItem) {
    try {
      const full = await getNews(item.id);
      setModalItem(full);
    } catch {
      toast('Failed to load article details', 'error');
    }
  }

  async function onDelete(item: NewsItem) {
    if (!confirm(`Delete "${item.title?.en || 'this article'}"?`)) return;
    try {
      const full = await getNews(item.id);
      await deleteNews(item.id, full.etag);
      toast('Article deleted', 'success');
      load(true);
      loadStats();
    } catch (e) {
      toast(e instanceof Error && e.message === 'etag-conflict'
        ? 'Version conflict — someone else edited this. Refresh and try again.'
        : 'Delete failed', 'error');
    }
  }

  async function handleSave(payload: Partial<NewsItem>, etag?: string) {
    try {
      if (modalItem?.id && modalItem.id !== 0) {
        await updateNews(modalItem.id, etag || '', payload);
        toast('Article updated', 'success');
      } else {
        await createNews(payload);
        toast('Article created', 'success');
      }
      setModalItem(null);
      load(true);
      loadStats();
    } catch (e) {
      if (e instanceof Error && e.message === 'etag-conflict') {
        toast('Version conflict — reload the article and try again.', 'error');
      } else {
        toast('Save failed. Check required fields.', 'error');
      }
    }
  }

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    load(true);
  }

  function handleReset() {
    setSearch(''); setStatusFilter(''); setCategoryFilter('');
    // Load after state resets on next tick
    setTimeout(() => load(true), 0);
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="app-shell">
      <Toasts toasts={toasts} onDismiss={dismissToast} />

      {/* ── Header ── */}
      <header className="app-header">
        <div>
          <h1>News Dashboard</h1>
          <p className="muted">Manage articles across 3 languages — Protected by Cloudflare Access</p>
        </div>
        <button className="primary" onClick={onCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Article
        </button>
      </header>

      {/* ── Stats ── */}
      <StatCards stats={stats} />

      {/* ── Filters ── */}
      <form className="filter-bar card" onSubmit={handleFilterSubmit}>
        <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title or content…" className="filter-search" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.filter(c => c.value).map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <button type="submit" className="primary compact">Filter</button>
        <button type="button" className="ghost compact" onClick={handleReset}>Reset</button>
      </form>

      {/* ── Table ── */}
      {loading ? (
        <div className="loading-state"><div className="spinner" /><span>Loading…</span></div>
      ) : (
        <NewsTable items={items} onEdit={onEdit} onDelete={onDelete} />
      )}

      {/* ── Pagination ── */}
      {total > pageSize && (
        <div className="pagination">
          <span className="muted">{total} article{total !== 1 ? 's' : ''} — Page {page + 1} of {pages}</span>
          <div className="page-btns">
            <button className="ghost compact" disabled={page === 0} onClick={() => { setPage(p => Math.max(0, p - 1)); setTimeout(() => load(), 0); }}>← Prev</button>
            <button className="ghost compact" disabled={(page + 1) >= pages} onClick={() => { setPage(p => p + 1); setTimeout(() => load(), 0); }}>Next →</button>
          </div>
        </div>
      )}

      {/* ── Modal ── */}
      {modalItem && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) setModalItem(null); }}>
          <div className="modal">
            <NewsForm initial={modalItem} onSave={handleSave} onCancel={() => setModalItem(null)} />
          </div>
        </div>
      )}
    </div>
  );
};
