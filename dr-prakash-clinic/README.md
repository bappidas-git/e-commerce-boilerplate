# Dr Prakash's Bone & Joint Care Clinic — Website

A modern, futuristic, single-page website for **Dr Prakash Kumar**, Consultant Orthopaedic
& Joint Replacement Surgeon, Ranchi. Built as a self-contained `index.html` (Tailwind CDN +
GSAP + Three.js) — just open the file or host it anywhere static.

## Business details used
- **Clinic:** Dr Prakash's Bone & Joint Care Clinic
- **Doctor:** Dr Prakash Kumar — MBBS (LTM Medical College, Mumbai), DNB Orthopedics, Fellowship in Arthroplasty & Arthroscopy
- **Experience:** 13+ years
- **Address:** House No. 48, Near Adarsh Bal Niketan School, Old A.G. Colony, Kadru, Ranchi, Jharkhand 834002
- **Map coords:** 23.3491923, 85.3170091
- **Rating:** 4.9 ★ (Google / Justdial)
- **Source:** Google Maps listing + Practo, Justdial, DocIndia public profiles

## ⚠️ Before going live — replace these placeholders
1. **Phone / WhatsApp number** — search the file for `XXXXXXXXXX` / `XXXXX XXXXX`
   and the `WHATSAPP_NUMBER` constant in the `<script>` block.
2. **Reviews** — sample testimonials reflect genuine patient-feedback *themes* found in
   public reviews. For live, verifiable ratings, wire up the Google Places API
   (see the `#reviews` section note).
3. **Images** — currently use royalty-free Unsplash photos. Swap in real clinic/doctor
   photos for stronger trust and SEO.
4. **Canonical / OG URL** — update `https://drprakashorthoclinic.com/` if the domain differs.

## Features
- SEO-optimised: meta tags, geo tags, Open Graph, Twitter cards, JSON-LD
  (`Physician` + `MedicalClinic`, `FAQPage`, `AggregateRating`).
- Rich, keyword-dense content: treatments, conditions treated, why-choose, patient journey, FAQ.
- Contact/appointment form that composes a WhatsApp enquiry (no backend required); the
  `action="send-enquiry.php"` is kept for an optional server handler.
- Animated 3D background, scroll reveals, count-ups, glassmorphism UI, floating WhatsApp button.
- Fully responsive.
