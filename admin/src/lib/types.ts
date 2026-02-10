export type Status = 'draft' | 'published' | 'archived';
export type Lang = 'en' | 'mrh' | 'my';

/** Multilingual field stored as JSON in D1 */
export interface I18nField {
  en?: string;
  mrh?: string;
  my?: string;
}

export interface NewsItem {
  id: number;
  slug: string;
  title: I18nField;
  summary: I18nField;
  body: I18nField;
  category?: string;
  author: string;
  publish_date: string;
  status: Status;
  featured_image?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  etag?: string;
}

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en',  label: 'English' },
  { code: 'mrh', label: 'Mara' },
  { code: 'my',  label: 'Burmese' },
];

export const CATEGORIES = [
  { value: '',             label: 'Select category' },
  { value: 'news',         label: 'News' },
  { value: 'report',       label: 'Report' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'health',       label: 'Health' },
  { value: 'education',    label: 'Education' },
  { value: 'water',        label: 'Water & Sanitation' },
  { value: 'volunteer',    label: 'Volunteers' },
];
