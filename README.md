# Prince Tattoos — Vercel project (5 files)

    index.html     public website (what customers see at /)
    admin.html     owner dashboard (opens at /admin)
    package.json   dependencies
    vercel.json    routing
    api/index.js   the whole backend (login, gallery, bookings, Skrill, uploads)

Every file has a different name on purpose. The only folder is `api` with one file inside.

## Put it on GitHub from a phone
1. New repository. Tap Add file → Upload files, choose `index.html`, `admin.html`, `package.json`, `vercel.json`, `robots.txt`. Commit.
2. Add file → Create new file. In the name box type `api/index.js` (typing the slash makes the folder). Paste the contents of api/index.js. Commit.
3. Vercel → Add New → Project → import the repo. Framework: Other. Leave Root Directory empty. Name it `princeoftats`.

## Storage (Project → Storage)
- Create a **Blob** store (photos and videos).
- Add **Upstash Redis** from the Marketplace (bookings, gallery, revenue).

## Environment variables (Settings → Environment Variables)
ADMIN_PASSWORD, SESSION_SECRET (long random string), SKRILL_EMAIL, SKRILL_SECRET_WORD, DEPOSIT (e.g. 50), CURRENCY (e.g. USD or GBP). Then Redeploy.

## Check it worked
- `/` must show the Prince Tattoos website.
- `/api/health` must show JSON like {"site":"ok","redis":true,...}. A `false` means that setting is missing.
- Owner: scroll to the bottom of `/` → "Owner login".

## Skrill
Enable Quick Checkout and set the same secret word as SKRILL_SECRET_WORD. Paid bookings are marked automatically and counted in Revenue.
