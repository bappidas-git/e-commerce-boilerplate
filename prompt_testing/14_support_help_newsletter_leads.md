# Prompt 14 — Support / Contact, Help Center, Newsletter → Leads

**Objective:** Make the lead-capture surfaces work end-to-end: the contact form and newsletter must create records that show up in **Admin → Leads** and in `db.json`. Polish the Help Center FAQ.

## Scope / files
- `src/pages/Support/Support.js`, `src/pages/HelpCenter/HelpCenter.js` (+ `.module.css`)
- `src/components/Newsletter/Newsletter.js`, `src/components/Footer/Footer.js` (newsletter), `src/components/FAQ/FAQ.js`
- Data: `apiService.leads.createContact()`, `apiService.leads.createNewsletter()`

## Test checklist (UI + functionality)
**Support / Contact**
- [ ] Contact cards (email/phone/live chat) + quick links render; links resolve.
- [ ] Form: name, email, phone, order number, category (General/Order/Shipping/Returns/Product/Payment/Account/Other), subject, message.
- [ ] Validation: name/email/subject/message required; message min length; email format checked.
- [ ] Submit creates a **contact lead** → success state ("Message Sent"). **Verify it appears in Admin → Leads** (type=contact) and in `db.json`.

**Help Center**
- [ ] Topic cards link to the right pages (all destinations exist).
- [ ] FAQ search filters by question/answer; the accordion opens/closes (one at a time) smoothly.
- [ ] Contact banner (hours/email/phone) links to the support form.

**Newsletter (component + Footer)**
- [ ] Valid email subscribes → success message; creates a **newsletter lead** → **verify in Admin → Leads** (type=newsletter) and `db.json`.
- [ ] Invalid email shows a real validation error.

## Suspected issues to verify and fix if present
- **Silent "always success":** the Footer/Newsletter currently swallow errors and show success regardless ("to prevent email enumeration"). That hides genuine failures. Show success only when the lead is actually created (or surface a real error), while still avoiding leaking whether an email already exists. Confirm a created newsletter lead truly lands in `db.json`.
- The `Newsletter` component disables the input after success with no reset — allow subscribing again (e.g., reset after a few seconds like the Footer does).
- FAQ has no open/close animation or `aria-expanded` — add a smooth transition and basic a11y.
- Pre-fill the contact email for logged-in users (nice-to-have) and validate the phone field.

## Definition of Done — Verification & Sign-off (MANDATORY)
1. **Functional pass:** contact + newsletter create leads that **show in Admin and `db.json`**; FAQ search/accordion work; console clean.
2. **Production build:** `npm run build` clean; re-test on served build.
3. **Screenshots (all devices + both themes):** contact form + success state, Help Center (FAQ open + search), newsletter success/error — full device matrix, Light **and** Dark. Save to `prompt_testing/screenshots/14_support_leads/`.
4. **Visual review:** form layout, success cards, FAQ spacing, footer newsletter, no overflow.
5. **Fix loop:** fix and repeat 2–4 until flawless.
6. **Commit & PR:** commit, push to `claude/eloquent-cray-S3yht`, open/update the **draft PR** with notes + screenshots.

> Keep both API branches in `src/services/api.js` in sync if you touch any data call.
