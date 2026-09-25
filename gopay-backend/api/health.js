const { withCors } = require('../lib/cors');
const { getConfig, maskSecret } = require('../lib/config');

// GET /api/health
//
// Quick way to confirm — after every deploy or env var change — that the
// backend's configuration is actually correct, without guessing by
// clicking through URLs by hand. Never returns full secrets.
//
// A healthy response looks like:
//   { "ok": true, "gopayEnv": "sandbox", "backendUrl": "https://...",
//     "notificationUrl": "https://.../api/gopay-notify", ... }
//
// If something's misconfigured (e.g. BACKEND_URL still a placeholder,
// or a required var missing), this returns ok:false with the reason
// instead of throwing somewhere deep inside a real payment request.
module.exports = async (req, res) => {
    if (withCors(req, res)) return;

    try {
        const config = getConfig();
        res.status(200).json({
            ok: true,
            gopayEnv: config.gopayEnv,
            goid: config.goid,
            clientId: config.clientId,
            clientSecret: maskSecret(config.clientSecret),
            allowedOrigin: config.allowedOrigin,
            backendUrl: config.backendUrl,
            notificationUrl: `${config.backendUrl}/api/gopay-notify`
        });
    } catch (err) {
        res.status(500).json({ ok: false, error: String(err.message || err) });
    }
};
