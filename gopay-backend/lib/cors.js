// The site (apuliaoliveoil.cz) and this backend live on different
// domains, so every response needs CORS headers — and the browser will
// send an OPTIONS preflight before the real POST/GET.
function allowedOrigins() {
    const main = (process.env.ALLOWED_ORIGIN || 'https://apuliaoliveoil.cz').replace(/\/$/, '');
    const list = [main];
    // accept the www / non-www twin of the main origin, so the site works
    // whichever way the customer reached it
    const m = main.match(/^(https?:\/\/)(www\.)?(.+)$/);
    if (m) list.push(m[1] + (m[2] ? '' : 'www.') + m[3]);
    return list;
}

function withCors(req, res) {
    const allowed = allowedOrigins();
    const origin = req.headers && req.headers.origin;
    res.setHeader('Access-Control-Allow-Origin', allowed.includes(origin) ? origin : allowed[0]);
    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return true; // caller should stop
    }
    return false;
}

// true if the request carries an Origin header that is not our site
function foreignOrigin(req) {
    const origin = req.headers && req.headers.origin;
    return !!origin && !allowedOrigins().includes(origin);
}

module.exports = { withCors, foreignOrigin };
