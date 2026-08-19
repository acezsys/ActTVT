# Order Management ERP — Arieckal Industries

## What this is
A custom web-based order management system covering Tender/Bid, Sales,
Purchase, Stores, Production, Quality, Dispatch/Accounts, and Management
modules — built to the requirements confirmed during scoping (see
`order_management_erp_architecture.md` for the full spec).

**This phase (v1a) delivers:** the database, authentication (login, captchas,
password reset), and Master Data (Clients, Vendors, Parts, Users) — the
foundation every other module builds on. Tender/Bid, Sales, Purchase,
Production, Stores, Dispatch/Accounts, and the Dashboard come next.

---

## Before you install: two accounts to set up (free, ~10 minutes total)

Because this needs to be reachable by 4 people from their phones/browsers,
it has to live on the internet somewhere — not just on one person's laptop.
These two free accounts are what make that possible at zero cost:

1. **A database host** — [supabase.com](https://supabase.com) → New Project (free tier).
   Once created, go to Project Settings → Database → Connection String, and
   copy the "URI" value. That's your `DATABASE_URL`.
2. **A hosting service for the app itself** — [render.com](https://render.com)
   (free tier) is the simplest: connect it to wherever this code is stored
   (e.g. a private GitHub repo) and it will run `node server.js`
   automatically. Render will give you a public URL like
   `https://arieckal-erp.onrender.com` — that's your `APP_BASE_URL`.
3. *(Optional, for real emails)* A free email-sending account, e.g.
   [resend.com](https://resend.com) free tier, gives you `SMTP_HOST` /
   `SMTP_USER` / `SMTP_PASS`. Until this is set up, the system still works —
   it just prints emails to the server log instead of sending them.

This is the one-time setup mentioned earlier — not something each of the
4 users does. Once it's live at its public URL, nobody else touches any of
this.

---

## Installing (the actual "one install package")

```
node scripts/install.js
```

This single script:
1. Asks for the `DATABASE_URL` (and email settings, optional) — the only
   information it needs that isn't already decided
2. Creates every database table
3. Creates the 4 confirmed user logins (Jacob, Gurunath, Prathmesh, Amita)
   with their module access already assigned
4. Builds the web app
5. Creates a desktop shortcut pointing at the live URL

Then start it with:
```
cd backend && node server.js
```

On Render (recommended, so it's always on without anyone's laptop running):
set the Start Command to `node backend/server.js`, the Build Command to
`npm install --prefix backend && npm install --prefix frontend && npm run build --prefix frontend`,
and paste in the environment variables from `backend/.env` under Render's
"Environment" tab.

---

## First login

Each of the 4 users goes to the app URL, clicks **Forgot password**, enters
their email, and sets their own password via the emailed link. (If email
isn't configured yet, temporary passwords are printed in the server log —
share those directly the first time.)

---

## Creator access (module on/off control)

The install script generates a private link, printed once at the end of
setup:

```
<your app URL>/creator-panel/<a long random key>
```

This link controls which of the 8 optional modules exist in the system —
independent of Superadmin, and not visible or reachable from Superadmin's
account by any path. **Save that link somewhere private when the installer
prints it — it cannot be recovered from within the app afterward.** If lost,
a new key can be set by editing `CREATOR_ACCESS_KEY` in the environment
variables (Render → Environment tab) and restarting the service.

---

## Project structure

```
database/schema.sql       — full database schema, all modules
backend/                  — Express API (Node.js)
frontend/                 — React web app
scripts/install.js        — the one-time setup script
order_management_erp_architecture.md — full requirements & design spec
```

## What's next
This system now covers all 9 planned modules: Master Data + Auth, Tender/Bid,
Sales/Work Order, Purchase, Stores/Inventory, Production, Quality,
Dispatch/Accounts, and Management/Dashboard — plus Creator-controlled module
toggling. From here, the natural next steps are: real deployment with your
actual data, the alert scheduler (cron jobs reading the already-seeded
`alert_settings` table), and any refinements based on how your team's daily
use surfaces edge cases.
