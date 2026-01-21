export type Status = 'draft' | 'published' | 'archived';

export interface NewsItem {
  id: number;
  slug: string;
  title: string;
  category?: string;
  content_html: string;
  author: string;
  publish_date: string;
  status: Status;
  featured_image?: string;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
}
