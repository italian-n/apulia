// The site (apuliaoliveoil.cz) and this backend live on different
// domains, so every response needs CORS headers — and the browser will
// send an OPTIONS preflight before the real POST/GET.
function withCors(req, res) {
    const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://apuliaoliveoil.cz';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return true; // caller should stop
    }
    return false;
}

module.exports = { withCors };
