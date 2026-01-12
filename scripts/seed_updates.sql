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
(1, '2026-01-10', '{"mrh":"Mara: TSD hla pauh a um chungtel project","en":"TSD launches new community project","my":"TSD သည် အသိုင်းအဝိုင်း ပရောဂျက် အသစ် မိတ်ဆက်သည်"}', '{"mrh":"Mara: Chungtel project nih a ruat lo chungtel khual.","en":"A short summary about the new community project launch.","my":"အသိုင်းအဝိုင်း ပရောဂျက် စတင်ခြင်း အကျဉ်းချုပ်။"}', NULL),
(2, '2026-01-05', '{"mrh":"Mara: Volunteer hriatna — March 2026","en":"Volunteer call — March 2026","my":"Volunteer ခေါ်ယူခြင်း — ၂၀၂၆ မတ်"}', '{"mrh":"Mara: Outreach program ah volunteer ngaihna nih.","en":"Seeking volunteers for upcoming outreach programs.","my":"လာမည့် outreach အစီအစဉ်များအတွက် volunteer များကို ရှာနေပါသည်။"}', NULL),
(3, '2025-12-15', '{"mrh":"Community water system handover","en":"Community water system handover","my":"ရွာသို့ ရေထောက်ပံ့ရေး စနစ် ပေးအပ်ပွဲ"}', '{"mrh":"Hniangpu paa...","en":"Local stakeholders and water committee participated in the handover.","my":"ဒေသခံတို့နှင့် ရေကော်မတီတို့ပါဝင်သော ပေးအပ်ပွဲ။"}', NULL),
(4, '2025-10-30', '{"mrh":"Rice distribution — relief","en":"Rice distribution — relief","my":"ထောက်ပံ့ရေး သန့်ရှင်းစက်မှု"}', '{"mrh":"Tla...","en":"Emergency rice distribution in response to floods.","my":"နွေဦး ရာသီမိုးရေကြောင့် ကူညီထောက်ပံ့မှု"}', NULL),
(5, '2024-08-01', '{"mrh":"Teacher training cohort 2","en":"Teacher training cohort 2","my":"ဆရာ/ဆရာမများ လေ့ကျင့်ရေး"}', '{"mrh":"Khai...","en":"Second cohort graduated from our teacher training program.","my":"ဒုတိယလစာကို သင်တန်းပြီးစီးခဲ့သည်။"}', NULL),
(6, '2023-05-18', '{"mrh":"Health outreach summary","en":"Health outreach summary","my":"ကျန်းမာရေး အက်ဖ်ဂ်"}', '{"mrh":"Su...","en":"Summary of community health outreach and referrals.","my":"ကျန်းမာရေး အစီရင်ခံစာအကျဉ်း"}', NULL);

-- You can add more INSERT statements from your `assets/documents/reports/updates.json` as needed
