# Prince Tattoos — deploy guide (Vercel)

Public site: /            Admin: /admin (sign in from the "Owner login" link at the bottom of the home page)

## 1. Deploy
1. Put this folder in a GitHub repo, then Vercel → Add New → Project → import it.
2. Name the project `princeoftats` to get princeoftats.vercel.app (if the name is free).
   Framework preset: Other. No build command.

## 2. Add storage (Project → Storage)
- Create a **Blob** store  → adds BLOB_READ_WRITE_TOKEN automatically (photos + videos).
- Add **Upstash Redis** from the Marketplace → adds KV_REST_API_URL / KV_REST_API_TOKEN (bookings, gallery, revenue).

## 3. Environment variables (Project → Settings → Environment Variables)
| Name | Value |
|---|---|
| ADMIN_PASSWORD | your admin password (choose a strong one) |
| SESSION_SECRET | a long random string, 32+ characters |
| SKRILL_EMAIL | your Skrill merchant email |
| SKRILL_SECRET_WORD | secret word set in Skrill merchant settings (used to verify payments) |
| DEPOSIT | deposit per session, e.g. 50 |
| CURRENCY | e.g. USD or GBP (must be a currency your Skrill account accepts) |

Then Redeploy.

## 4. Skrill
In your Skrill merchant account, enable Quick Checkout and set the same secret word as SKRILL_SECRET_WORD.
Each payment sends a confirmation to /api/skrill, which marks the booking Paid and adds it to Revenue.
Without SKRILL_EMAIL the site still saves bookings and offers WhatsApp instead.

## What each part does
- Gallery: admin uploads from the phone/computer (image or video, up to 300 MB), adds price + description.
- Bookings: every request is saved with name, phone/email, placement, style, dates, notes.
- Revenue: totals from paid bookings (Skrill or marked paid by hand).

## Troubleshooting
- Open `https://YOUR-SITE/api/health` — it must show JSON like `{"site":"ok","redis":true,...}`.
  - **404** = the `api` folder was not deployed. `api/`, `lib/`, `package.json` and `index.html` must sit at the ROOT of the repo (not inside another folder), and Vercel → Settings → General → Root Directory must be empty.
  - Any value showing `false` = that setting is missing; add it and redeploy.
- Owner login: scroll to the bottom of the home page → "Owner login". There is no separate login page.
- Bookings are saved automatically from the booking form. New ones show on the Bookings tab within 20 seconds.
