#!/usr/bin/env node
/**
 * ONE-TIME SETUP SCRIPT
 * ----------------------------------------------------------------------------
 * This is the entire "install package" for Arieckal Industries' Order
 * Management ERP. Run it ONCE, on the machine/hosting account that will
 * run the system permanently. It will:
 *
 *   1. Ask a few unavoidable one-time questions (database + email connection)
 *   2. Create every table (from database/schema.sql)
 *   3. Create the 4 confirmed logins with temporary passwords
 *   4. Build the web app
 *   5. Create a desktop shortcut that opens the system in a browser
 *
 * After this finishes, nobody needs to run an installer again — every user
 * just opens the web link (or the desktop shortcut) and logs in.
 *
 * Usage:  node scripts/install.js
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');
const ENV_PATH = path.join(BACKEND, '.env');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q, def) => new Promise((resolve) => {
  rl.question(def ? `${q} [${def}]: ` : `${q}: `, (answer) => resolve(answer.trim() || def || ''));
});

// The roster confirmed for this deployment. Superadmin manages this list going
// forward via the User Management screen — this seed only runs once.
const CONFIRMED_USERS = [
  { name: 'Jacob Kuriakose', email: 'arieckal.industries@gmail.com', role: 'superadmin', job_title: 'Proprietor', modules: 'ALL' },
  { name: 'Gurunath Mumbaikar', email: 'mumbaikar@arieckalindustries.com', role: 'module_admin', job_title: 'Head Production', modules: ['production', 'stores'] },
  { name: 'Prathmesh M', email: 'design2@arieckalindustries.com', role: 'module_admin', job_title: 'Design Engineer', modules: ['production'] },
  { name: 'Amita', email: 'accounts@arieckalindustries.com', role: 'module_admin', job_title: 'Accounts & Purchase', modules: ['purchase', 'dispatch_accounts'] },
];

async function main() {
  console.log('\n=== Order Management ERP — One-Time Setup ===\n');

  let env = {};
  if (fs.existsSync(ENV_PATH)) {
    console.log('Existing .env found — reusing it. Delete backend/.env to start fresh.\n');
    env = Object.fromEntries(
      fs.readFileSync(ENV_PATH, 'utf8').split('\n').filter(Boolean).map((l) => l.split('=').map((s) => s.trim()))
    );
  } else {
    console.log("A few one-time questions (get these from your free Postgres/email provider):\n");
    env.DATABASE_URL = await ask('Database connection URL (e.g. from Supabase)');
    env.SMTP_HOST = await ask('SMTP host for sending emails (leave blank to skip email for now)', '');
    env.SMTP_PORT = await ask('SMTP port', '587');
    env.SMTP_USER = await ask('SMTP username', '');
    env.SMTP_PASS = await ask('SMTP password', '');
    env.ALERT_FROM_EMAIL = await ask('"From" address for alert emails', env.SMTP_USER);
    env.APP_BASE_URL = await ask('Public web address this system will run at', 'http://localhost:4000');
    env.PORT = '4000';
    env.JWT_SECRET = crypto.randomBytes(32).toString('hex'); // generated automatically, never asked
    env.CREATOR_ACCESS_KEY = crypto.randomBytes(24).toString('base64url'); // the Creator's private key — generated once, never asked, never shown to Superadmin
    env.NODE_ENV = 'production';

    const envContent = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n');
    fs.writeFileSync(ENV_PATH, envContent + '\n');
    console.log('\nSaved backend/.env — this is the only configuration file in the system.\n');
  }
  rl.close();

  console.log('Installing backend dependencies...');
  execSync('npm install --loglevel=error', { cwd: BACKEND, stdio: 'inherit' });

  console.log('\nInstalling frontend dependencies and building...');
  execSync('npm install --loglevel=error', { cwd: FRONTEND, stdio: 'inherit' });
  execSync('npm run build', { cwd: FRONTEND, stdio: 'inherit' });

  console.log('\nCreating database tables...');
  execSync(`psql "${env.DATABASE_URL}" -f "${path.join(ROOT, 'database/schema.sql')}"`, { stdio: 'inherit' });

  console.log('\nCreating the confirmed user logins...');
  await seedUsers(env);

  console.log('\nCreating a desktop shortcut...');
  createDesktopShortcut(env.APP_BASE_URL);

  console.log(`
=== Setup complete ===

Start the system with:
  cd backend && node server.js

Then open: ${env.APP_BASE_URL}

Each of the 4 confirmed users has an account. They should each click
"Forgot password" on the login screen (using their own email above) to
set their own password the first time.

A desktop shortcut has been created — double-click it any time to open
the system in your browser.

--------------------------------------------------------------------
CREATOR ACCESS (save this somewhere private — it is shown ONLY once
and cannot be recovered from within the app; Superadmin cannot see it):

  ${env.APP_BASE_URL}/creator-panel/${env.CREATOR_ACCESS_KEY}

This link controls which modules exist in the system, independent of
any Superadmin or Module Admin account.
--------------------------------------------------------------------
`);
}

async function seedUsers(env) {
  // Uses the backend's own db module so the connection logic (SSL handling etc.) stays in one place.
  process.env.DATABASE_URL = env.DATABASE_URL;
  const pool = require(path.join(BACKEND, 'src/db.js'));
  const bcrypt = require(path.join(BACKEND, 'node_modules/bcrypt'));

  const ALL_MODULES = ['tender_bid', 'sales', 'purchase', 'stores', 'production', 'quality', 'dispatch_accounts', 'management'];

  for (const u of CONFIRMED_USERS) {
    const tempPassword = crypto.randomBytes(9).toString('base64url');
    const hash = await bcrypt.hash(tempPassword, 12);

    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, job_title)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [u.name, u.email.toLowerCase(), hash, u.role, u.job_title]
    );
    if (rows.length === 0) {
      console.log(`  - ${u.email} already exists, skipped.`);
      continue;
    }
    const userId = rows[0].id;
    const modules = u.modules === 'ALL' ? ALL_MODULES : u.modules;
    for (const m of modules) {
      await pool.query(
        `INSERT INTO user_module_access (user_id, module) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [userId, m]
      );
    }
    console.log(`  - Created ${u.name} (${u.email}) as ${u.role}`);
  }
  await pool.end();
}

function createDesktopShortcut(url) {
  const desktop = path.join(require('os').homedir(), 'Desktop');
  try {
    if (!fs.existsSync(desktop)) return;
    if (process.platform === 'win32') {
      fs.writeFileSync(path.join(desktop, 'Order Management ERP.url'), `[InternetShortcut]\nURL=${url}\n`);
    } else if (process.platform === 'darwin') {
      fs.writeFileSync(path.join(desktop, 'Order Management ERP.webloc'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>URL</key><string>${url}</string></dict></plist>`);
    } else {
      fs.writeFileSync(path.join(desktop, 'order-management-erp.desktop'),
        `[Desktop Entry]\nType=Link\nName=Order Management ERP\nURL=${url}\nIcon=text-html\n`, { mode: 0o755 });
    }
    console.log('  Desktop shortcut created.');
  } catch {
    console.log('  (Could not auto-create a desktop shortcut — just bookmark the URL instead.)');
  }
}

main().catch((err) => {
  console.error('\nSetup failed:', err.message);
  process.exit(1);
});
