# Together for Sustainable Development (TSD Myanmar)

**Together for Sustainable Development (TSD)** is a registered **Non-Governmental Organization (NGO)** in Myanmar, based in **Lailenpi Town**, in the Mara region of **Southern Chin State**.  
TSD serves **Mara communities and beyond**, working to build **resilient, inclusive, and sustainable rural communities**.

This repository contains digital resources, code, documentation, or related materials that support TSD’s mission and programmes.

---

## 🌱 Our Mission

TSD is committed to promoting **sustainable development in rural communities**, with a strong belief that **education is foundational to all progress**.

We empower people with:
- Knowledge  
- Skills  
- Practical tools  

so they can actively participate in building stronger and more resilient communities.

---

## 🎯 Programme Areas

TSD focuses on four main programme areas:

- **📚 Education**  
  Promoting sustainable and inclusive education as a core pillar of development.

- **🌾 Food Security**  
  Strengthening livelihoods and sustainable food systems in rural areas.

- **♿ Inclusion**  
  Ensuring participation and representation of marginalized groups, including women and people with disabilities.

- **🚨 Disaster Risk Reduction & Relief**  
  Supporting preparedness, response, and recovery during emergencies and disasters.

> Education is integrated across all programme areas, not treated as a standalone activity.

---

## 👥 Our Team

- All TSD staff are **local residents from communities across the Mara Region**.  
- We aim for **gender balance** and **inclusive representation**, including people with disabilities.  
- Our team is guided by a **faith-based foundation**, a strong sense of **self-reliance**, and a shared commitment to serving the most vulnerable.

TSD invests in **capacity building**, strengthening:
- Local knowledge  
- Community mobilisation skills  
- Leadership and technical capacity  

This approach enables meaningful, community-led impact.

---

## 🤝 About This Repository

This repository may include:
- Website or web application code  
- Documentation and reports  
- Open-source tools and digital resources  
- Technical work supporting TSD programmes  

It exists to promote **transparency**, **collaboration**, and **sustainability** in TSD’s digital initiatives.

---

## 📄 License

Unless stated otherwise, the contents of this repository are intended for **non-profit, educational, and community development purposes**.

---

## 📬 Learn More

For more information about Together for Sustainable Development (TSD Myanmar) and our work, please visit our official website or contact us through our recognized communication channels.

> *Together, we build resilient, inclusive, and sustainable communities.*

---

**News localization (build-time)**

- **Source news content:** `news-content/source/en/*.json` (one file per article)
- **Translated files (produced by Crowdin):** `news-content/translations/{lang}/*.json`
- **Build script:** run `npm run build` to generate localized static pages under the `news/` folder.

Local preview (Cloudflare Pages emulator):

```powershell
cd C:\Users\laite\Documents\TSD
npm install
npm run dev
# Optional: pick a port
npm run dev -- --port 8788
```

Cloudflare Pages (recommended):

- Run locally with `npm run dev`, which wraps `wrangler pages dev .`.
- Configure Pages to publish from the repo root (static assets live in this directory; `news/` must be included).
- Add your `account_id` or other settings in `wrangler.toml` when deploying.

Crowdin configuration is updated to treat `news-content/source/en/*.json` as sources and to export translations into `news-content/translations/%locale%/` so Crowdin can commit translations back to GitHub automatically.
