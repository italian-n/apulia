// Small helper around the GoPay REST API (v3).
//
// GoPay requires a server (Client Secret must never be exposed to the
// browser), which is why this lives in its own tiny backend deployed
// separately from the static apuliaoliveoil.cz site.
//
// Docs: https://doc.gopay.com/

const GOPAY_BASE = process.env.GOPAY_ENV === 'production'
    ? 'https://gate.gopay.com/api'
    : 'https://gw.sandbox.gopay.com/api';

function requireEnv(name) {
    const v = process.env[name];
    if (!v) throw new Error(`Missing required env var: ${name}`);
    return v;
}

// Gets an OAuth2 access token using Client Credentials (Client ID + Secret).
// Scope "payment-create" is enough to create and inspect payments.
async function getAccessToken() {
    const clientId = requireEnv('GOPAY_CLIENT_ID');
    const clientSecret = requireEnv('GOPAY_CLIENT_SECRET');
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await fetch(`${GOPAY_BASE}/oauth2/token`, {
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
    return data.access_token;
}

// Creates a payment and returns GoPay's response, including gw_url — the
// URL the customer's browser must be redirected to in order to pay.
async function createPayment(payload) {
    const token = await getAccessToken();
    const res = await fetch(`${GOPAY_BASE}/payments/payment`, {
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
    const res = await fetch(`${GOPAY_BASE}/payments/payment/${encodeURIComponent(paymentId)}`, {
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
