// Central place that resolves and validates this backend's configuration.
//
// Why this file exists: a past incident showed that a wrong or missing
// BACKEND_URL env var on Vercel silently produced a broken
// notification_url (GoPay got 404s for days before anyone noticed).
// This module makes that class of bug impossible to ship quietly:
//   1. BACKEND_URL falls back to Vercel's own VERCEL_URL when unset, so
//      a fresh deploy is correct even before anyone touches env vars.
//   2. A value that still looks like the placeholder from .env.example
//      is rejected rather than silently used.
//   3. Required vars throw loudly (visible in Vercel logs / a failed
//      request) instead of quietly producing `undefined` deep in a
//      request payload.

const PLACEHOLDER_PATTERNS = [/your-project/i, /YOUR-PROJECT/, /example\.com/i];

function looksLikePlaceholder(value) {
    return PLACEHOLDER_PATTERNS.some((re) => re.test(value));
}

function requireEnv(name) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required env var: ${name}`);
    return v;
}

// Resolves this backend's own public URL.
//   1. BACKEND_URL, if explicitly set and not a leftover placeholder.
//   2. VERCEL_URL, which Vercel injects automatically for every
//      deployment (production and preview alike) — no manual step needed.
//   3. Throws, so the failure is visible in logs instead of producing a
//      silently broken notification_url.
function resolveBackendUrl() {
    const explicit = (process.env.BACKEND_URL || '').trim().replace(/\/$/, '');
    if (explicit) {
        if (looksLikePlaceholder(explicit)) {
            throw new Error(
                `BACKEND_URL is still set to a placeholder value (${explicit}). ` +
                `Set it to this deployment's real URL in Vercel → Settings → Environment Variables.`
            );
        }
        return explicit;
    }

    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) return `https://${vercelUrl}`;

    throw new Error('Could not resolve BACKEND_URL (not set, and VERCEL_URL is unavailable).');
}

function getConfig() {
    return {
        gopayEnv: process.env.GOPAY_ENV === 'production' ? 'production' : 'sandbox',
        goid: requireEnv('GOPAY_GOID'),
        clientId: requireEnv('GOPAY_CLIENT_ID'),
        // never returned/logged in full — see maskSecret below
        clientSecret: requireEnv('GOPAY_CLIENT_SECRET'),
        allowedOrigin: (process.env.ALLOWED_ORIGIN || 'https://apuliaoliveoil.cz').replace(/\/$/, ''),
        backendUrl: resolveBackendUrl(),
    };
}

function maskSecret(value) {
    if (!value) return null;
    return value.length <= 4 ? '****' : `${value.slice(0, 2)}****${value.slice(-2)}`;
}

module.exports = { getConfig, maskSecret, resolveBackendUrl, looksLikePlaceholder };
