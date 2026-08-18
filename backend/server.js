require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const { requireAuth } = require('./src/middleware/auth');

app.use('/api/auth', require('./src/routes/auth'));

// Everything below requires a valid login.
app.use('/api/clients', requireAuth, require('./src/routes/clients'));
app.use('/api/vendors', requireAuth, require('./src/routes/vendors'));
app.use('/api/parts', requireAuth, require('./src/routes/parts'));
app.use('/api/users', requireAuth, require('./src/routes/users'));

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
