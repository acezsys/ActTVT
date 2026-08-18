const pool = require('../db');

// Generates the next ID like 'VN-0001' using a dedicated Postgres sequence,
// so IDs are safe under concurrent requests from multiple users at once.
async function nextFormattedId(prefix, sequenceName) {
  const { rows } = await pool.query(`SELECT nextval($1) AS n`, [sequenceName]);
  const n = String(rows[0].n).padStart(4, '0');
  return `${prefix}-${n}`;
}

// 6-letter alphanumeric client ID, e.g. 'CL4X9A' — generated client-side (no shared sequence needed)
// then checked for collision before insert (collisions are astronomically rare at this scale).
function randomClientId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous O/0/I/1
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

module.exports = { nextFormattedId, randomClientId };
