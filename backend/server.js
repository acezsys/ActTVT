require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const { requireAuth, requireModuleEnabled } = require('./src/middleware/auth');

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/enabled-modules', require('./src/routes/enabledModules')); // public, no auth
app.use('/api/creator', require('./src/routes/creator')); // gated by its own key, not by login

// Master Data + Users are foundational — not toggleable by the Creator.
app.use('/api/clients', requireAuth, require('./src/routes/clients'));
app.use('/api/vendors', requireAuth, require('./src/routes/vendors'));
app.use('/api/parts', requireAuth, require('./src/routes/parts'));
app.use('/api/users', requireAuth, require('./src/routes/users'));

// The 8 optional modules — each gated by requireModuleEnabled, so the Creator
// switching one off makes it disappear even for Superadmin.
app.use('/api/tenders', requireAuth, requireModuleEnabled('tender_bid'), require('./src/routes/tenders'));
app.use('/api/work-orders', requireAuth, requireModuleEnabled('sales'), require('./src/routes/workOrders'));
app.use('/api/vendor-pos', requireAuth, requireModuleEnabled('purchase'), require('./src/routes/vendorPOs'));
app.use('/api/stock', requireAuth, requireModuleEnabled('stores'), require('./src/routes/stock'));
app.use('/api/production', requireAuth, requireModuleEnabled('production'), require('./src/routes/production'));
app.use('/api/quality', requireAuth, requireModuleEnabled('quality'), require('./src/routes/quality'));
app.use('/api/dispatch-accounts', requireAuth, requireModuleEnabled('dispatch_accounts'), require('./src/routes/dispatchAccounts'));
app.use('/api/management', requireAuth, requireModuleEnabled('management'), require('./src/routes/management'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Serve the built frontend (so the whole app is one deployable unit — no separate frontend hosting needed)
const path = require('path');
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`ERP server running on port ${PORT}`));
