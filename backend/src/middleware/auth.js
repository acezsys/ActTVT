const jwt = require('jsonwebtoken');
const pool = require('../db');

// Verifies the login token on every protected request.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not logged in.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, name, email, role, is_active, password_set_at FROM users WHERE id = $1',
      [payload.userId]
    );
    const user = rows[0];
    if (!user || !user.is_active) return res.status(401).json({ error: 'Account not found or disabled.' });

    // Enforce the 180-day password reset rule.
    const passwordAgeDays = (Date.now() - new Date(user.password_set_at).getTime()) / (1000 * 60 * 60 * 24);
    if (passwordAgeDays > 180) {
      return res.status(403).json({ error: 'password_expired', message: 'Your password is over 180 days old. Please reset it.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
  }
}

// Restrict to specific roles, e.g. requireRole('superadmin')
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do this.' });
    }
    next();
  };
}

// Restrict to users who have been granted access to a given module.
// Superadmin always passes.
function requireModuleAccess(moduleName) {
  return async (req, res, next) => {
    if (req.user.role === 'superadmin') return next();
    const { rows } = await pool.query(
      'SELECT 1 FROM user_module_access WHERE user_id = $1 AND module = $2',
      [req.user.id, moduleName]
    );
    if (rows.length === 0) {
      return res.status(403).json({ error: `You do not have access to the ${moduleName} module.` });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, requireModuleAccess };
