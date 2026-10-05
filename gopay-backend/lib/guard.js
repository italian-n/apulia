// Small abuse guards for the public endpoints (best effort: Vercel
// serverless instances are short-lived and not shared, so these limit
// bursts per instance, they are not a global firewall).
const hits = new Map();

function clientIp(req) {
    const xf = String((req.headers && req.headers['x-forwarded-for']) || '').split(',')[0].trim();
    return xf || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// true => allowed, false => over the limit
function rateLimit(req, key, max, windowMs) {
    const now = Date.now();
    const k = `${key}:${clientIp(req)}`;
    const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    hits.set(k, arr);
    if (hits.size > 5000) { for (const [kk, v] of hits) { if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(kk); } }
    return arr.length <= max;
}

// Strip control chars / angle brackets from free text that ends up in
// e-mails or the payment gateway, and cap its length.
function clean(v, max) {
    return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

module.exports = { rateLimit, clean, clientIp };
