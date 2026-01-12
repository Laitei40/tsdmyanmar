-- D1-compatible SQL to create and seed `updates` table
-- Run via Wrangler D1 CLI or the D1 admin UI

CREATE TABLE IF NOT EXISTS updates (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  body TEXT
);

-- Seed entries (encoded JSON for title/summary/body)
INSERT OR REPLACE INTO updates (id, date, title, summary, body) VALUES
(1, '2026-01-10', '{"mara":"Mara: TSD hla pauh a um chungtel project","en":"TSD launches new community project","my":"TSD သည် အသိုင်းအဝိုင်း ပရောဂျက် အသစ် မိတ်ဆက်သည်"}', '{"mara":"Mara: Chungtel project nih a ruat lo chungtel khual.","en":"A short summary about the new community project launch.","my":"အသိုင်းအဝိုင်း ပရောဂျက် စတင်ခြင်း အကျဉ်းချုပ်။"}', NULL),
(2, '2026-01-05', '{"mara":"Mara: Volunteer hriatna — March 2026","en":"Volunteer call — March 2026","my":"Volunteer ခေါ်ယူခြင်း — ၂၀၂၆ မတ်"}', '{"mara":"Mara: Outreach program ah volunteer ngaihna nih.","en":"Seeking volunteers for upcoming outreach programs.","my":"လာမည့် outreach အစီအစဉ်များအတွက် volunteer များကို ရှာနေပါသည်။"}', NULL);

-- You can add more INSERT statements from your `assets/documents/reports/updates.json` as needed
