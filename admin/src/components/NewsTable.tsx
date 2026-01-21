import React from 'react';
import type { NewsItem } from '../lib/types';

interface Props {
  items: NewsItem[];
  onEdit: (item: NewsItem) => void;
  onDelete: (item: NewsItem) => void;
}

export const NewsTable: React.FC<Props> = ({ items, onEdit, onDelete }) => {
  return (
    <div className="card">
      <table className="table" role="grid">
        <thead>
          <tr>
            <th>Title</th>
            <th>Category</th>
            <th>Status</th>
            <th>Publish Date</th>
            <th>Author</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.id}>
              <td>{it.title}</td>
              <td>{it.category || '—'}</td>
              <td><span className={`badge ${it.status}`}>{it.status}</span></td>
              <td>{it.publish_date}</td>
              <td>{it.author}</td>
              <td>
                <div className="flex">
                  <button className="ghost" onClick={()=>onEdit(it)}>Edit</button>
                  <button className="ghost" onClick={()=>onDelete(it)}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && <p className="small">No items found.</p>}
    </div>
  );
};
