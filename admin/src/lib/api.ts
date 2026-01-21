import type { NewsItem } from './types';

const BASE = '/admin/api/news';

function headers(etag?: string) {
  const h: Record<string,string> = { 'Content-Type': 'application/json' };
  if (etag) h['If-Match'] = etag;
  return h;
}

export async function listNews(params: { search?: string; status?: string; category?: string; tag?: string; offset?: number; limit?: number; }): Promise<{ items: NewsItem[]; total: number; }> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k,v])=>{ if (v !== undefined && v !== null && v !== '') qs.set(k, String(v)); });
  const res = await fetch(`${BASE}?${qs.toString()}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  return res.json();
}

export async function getNews(id: number | string): Promise<NewsItem & { etag: string }> {
  const res = await fetch(`${BASE}/${encodeURIComponent(String(id))}`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Get failed: ${res.status}`);
  const etag = res.headers.get('etag') || '';
  const body = await res.json();
  return { ...body, etag };
}

export async function createNews(payload: Partial<NewsItem>) {
  const res = await fetch(BASE, { method:'POST', credentials:'include', headers: headers(), body: JSON.stringify(payload) });
  if (res.status === 422) throw await res.json();
  if (!res.ok) throw new Error(`Create failed: ${res.status}`);
  return res.json();
}

export async function updateNews(id: number | string, etag: string, payload: Partial<NewsItem>) {
  const res = await fetch(`${BASE}/${encodeURIComponent(String(id))}`, { method:'PUT', credentials:'include', headers: headers(etag), body: JSON.stringify(payload) });
  if (res.status === 422) throw await res.json();
  if (res.status === 409) throw new Error('etag-conflict');
  if (!res.ok) throw new Error(`Update failed: ${res.status}`);
  return res.json();
}

export async function deleteNews(id: number | string, etag: string) {
  const res = await fetch(`${BASE}/${encodeURIComponent(String(id))}`, { method:'DELETE', credentials:'include', headers: headers(etag) });
  if (res.status === 409) throw new Error('etag-conflict');
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  return res.json();
}
