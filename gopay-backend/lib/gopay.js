// Small helper around the GoPay REST API (v3).
//
// GoPay requires a server (Client Secret must never be exposed to the
// browser), which is why this lives in its own tiny backend deployed
// separately from the static apuliaoliveoil.cz site.
//
// Docs: https://doc.gopay.com/

// Production gateway for Czech merchants is gate.gopay.cz (per GoPay docs);
// override with GOPAY_API_URL if GoPay ever tells you otherwise.
const GOPAY_BASE = process.env.GOPAY_API_URL
    || (process.env.GOPAY_ENV === 'production'
        ? 'https://gate.gopay.cz/api'
        : 'https://gw.sandbox.gopay.com/api');

// fetch with a hard timeout, so a slow GoPay never leaves a customer
// waiting on a hung request until Vercel kills the function.
async function fetchT(url, opts = {}, ms = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
        return await fetch(url, { ...opts, signal: ctrl.signal });
    } catch (err) {
        if (err && err.name === 'AbortError') throw new Error(`GoPay request timed out after ${ms} ms`);
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

let cachedToken = null; // { value, expires }

function requireEnv(name) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required env var: ${name}`);
    return v;
}

// Gets an OAuth2 access token using Client Credentials (Client ID + Secret).
// Scope "payment-create" is enough to create and inspect payments.
async function getAccessToken() {
    if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.value;
    const clientId = requireEnv('GOPAY_CLIENT_ID');
    const clientSecret = requireEnv('GOPAY_CLIENT_SECRET');
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await fetchT(`${GOPAY_BASE}/oauth2/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basicAuth}`,
            'Accept': 'application/json'
        },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            scope: 'payment-create'
        })
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`GoPay OAuth failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    if (!data.access_token) throw new Error('GoPay OAuth returned no access_token');
    // GoPay tokens live 30 min; reuse for 20 to save a round trip per call
    cachedToken = { value: data.access_token, expires: Date.now() + 20 * 60 * 1000 };
    return data.access_token;
}

// Creates a payment and returns GoPay's response, including gw_url — the
// URL the customer's browser must be redirected to in order to pay.
async function createPayment(payload) {
    const token = await getAccessToken();
    const res = await fetchT(`${GOPAY_BASE}/payments/payment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`GoPay create payment failed (${res.status}): ${JSON.stringify(data)}`);
    }
    return data;
}

// Fetches the current state of a payment by its GoPay payment id.
async function getPaymentStatus(paymentId) {
    const token = await getAccessToken();
    const res = await fetchT(`${GOPAY_BASE}/payments/payment/${encodeURIComponent(paymentId)}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`GoPay get payment failed (${res.status}): ${JSON.stringify(data)}`);
    }
    return data;
}

module.exports = { getAccessToken, createPayment, getPaymentStatus, GOPAY_BASE };
