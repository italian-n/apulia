// Bearer-token guard for the admin endpoints. ADMIN_TOKEN is set in Vercel;
// without a strong token the admin API stays disabled (503), never open.
const crypto = require('crypto');
const { rateLimit } = require('./guard');

function authorize(req, res) {
    const token = process.env.ADMIN_TOKEN || '';
    if (token.length < 24) { res.status(503).json({ error: 'Admin disabled: set ADMIN_TOKEN (min 24 chars)' }); return false; }
    // counted before the check, so wrong guesses burn the same budget
    if (!rateLimit(req, 'admin', 20, 60000)) { res.status(429).json({ error: 'Too many requests' }); return false; }
    const given = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const a = crypto.createHash('sha256').update(given).digest();
    const b = crypto.createHash('sha256').update(token).digest();
    if (!crypto.timingSafeEqual(a, b)) { res.status(401).json({ error: 'Unauthorized' }); return false; }
    return true;
}

module.exports = { authorize };
