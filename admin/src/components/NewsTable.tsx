import React from 'react';
import type { NewsItem } from '../lib/types';

interface Props {
  items: NewsItem[];
  onEdit: (item: NewsItem) => void;
  onDelete: (item: NewsItem) => void;
}

function statusColor(status: string) {
  switch (status) {
    case 'published': return '#22c55e';
    case 'draft': return '#f59e0b';
    case 'archived': return '#6b7280';
    default: return '#94a3b8';
  }
}

function langIndicators(item: NewsItem) {
  const langs = ['en', 'mrh', 'my'] as const;
  return langs.map(l => (
    <span key={l} className={`lang-dot ${item.title?.[l] ? 'filled' : ''}`} title={`${l.toUpperCase()}: ${item.title?.[l] ? '✓' : '—'}`}>
      {l.toUpperCase()}
    </span>
  ));
}

export const NewsTable: React.FC<Props> = ({ items, onEdit, onDelete }) => {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        <p>No articles yet</p>
        <p className="muted">Click "+ New Article" to get started.</p>
      </div>
    );
  }

  return (
    <div className="news-table-wrap">
      <table className="news-table">
        <thead>
          <tr>
            <th className="col-img"></th>
            <th>Title</th>
            <th>Langs</th>
            <th>Category</th>
            <th>Status</th>
            <th>Date</th>
            <th className="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              {/* Thumbnail */}
              <td className="col-img">
                {item.featured_image ? (
                  <img src={item.featured_image} alt="" className="thumb" />
                ) : (
                  <div className="thumb thumb-placeholder" />
                )}
              </td>

              {/* Title + slug */}
              <td>
                <span className="item-title">{item.title?.en || '(untitled)'}</span>
                <span className="item-slug">/{item.slug}</span>
              </td>

              {/* Language indicators */}
              <td className="cell-langs">{langIndicators(item)}</td>

              {/* Category */}
              <td>
                {item.category ? (
                  <span className="badge badge-cat">{item.category}</span>
                ) : <span className="muted">—</span>}
              </td>

              {/* Status */}
              <td>
                <span className="badge" style={{ backgroundColor: statusColor(item.status) + '22', color: statusColor(item.status), borderColor: statusColor(item.status) }}>
                  {item.status}
                </span>
              </td>

              {/* Date */}
              <td className="cell-date">{item.publish_date?.slice(0, 10) || '—'}</td>

              {/* Actions */}
              <td className="col-actions">
                <button className="btn-icon" title="Edit" onClick={() => onEdit(item)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button className="btn-icon danger" title="Delete" onClick={() => onDelete(item)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
