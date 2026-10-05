const { createPayment } = require('../lib/gopay');
const { withCors } = require('../lib/cors');
const { getConfig } = require('../lib/config');
const { PRODUCTS, DELIVERY } = require('../lib/catalog');

// ISO 3166-1 alpha-3 codes GoPay expects for payer.contact.country_code
const COUNTRY_CODES = { 'Czech Republic': 'CZE', 'Czechia': 'CZE', 'Slovakia': 'SVK', 'Germany': 'DEU', 'Poland': 'POL', 'Austria': 'AUT', 'Italy': 'ITA', 'Ukraine': 'UKR' };

// POST /api/create-payment
//
// Body (all required unless noted):
//   orderNumber   string   unique id for this order (e.g. "APO-172..."))
//   items         [{id, qty}]  cart lines; prices come from lib/catalog.js
//   deliveryId    string   balikovna | balik_doruky | osobne
//   method        string   optional: 'card' (default) | 'bank'
//   customer      { name, email, phone (optional) }
//   returnPath    string   optional, defaults to "/" — path on the site to
//                          send the customer back to after paying
//
// Response: { gw_url, id, orderNumber }
module.exports = async (req, res) => {
    if (withCors(req, res)) return;

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const { orderNumber, items: cartItems, deliveryId, method, customer, returnPath, lang, address } = body;
        const addr = address && typeof address === 'object' ? address : {};

        const emailOk = customer && typeof customer.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) && customer.email.length <= 200;
        if (customer && !emailOk) {
            res.status(400).json({ error: 'Invalid customer.email' });
            return;
        }
        if (!orderNumber || !Array.isArray(cartItems) || !cartItems.length || !customer || !customer.email) {
            res.status(400).json({ error: 'Missing orderNumber, items or customer.email' });
            return;
        }

        const config = getConfig(); // throws loudly if BACKEND_URL is missing/placeholder — see lib/config.js
        const siteUrl = config.allowedOrigin;
        const backendUrl = config.backendUrl;

        // Build the basket from the server-side catalog (never trust prices
        // from the browser).
        const items = [];
        for (const ci of cartItems) {
            const product = PRODUCTS[ci && ci.id];
            const qty = Math.floor(Number(ci && ci.qty));
            if (!product || !(qty >= 1 && qty <= 100)) {
                res.status(400).json({ error: 'Unknown product or invalid quantity' });
                return;
            }
            items.push({ type: 'ITEM', name: product.name, amount: product.price * 100, count: qty, product_url: `${siteUrl}/#produkty` });
        }
        const delivery = DELIVERY[deliveryId];
        if (!delivery) {
            res.status(400).json({ error: 'Unknown delivery method' });
            return;
        }
        if (delivery.price > 0) {
            items.push({ type: 'DELIVERY', name: delivery.name, amount: delivery.price * 100, count: 1 });
        }
        const amountInHaliru = items.reduce((sum, i) => sum + i.amount * i.count, 0);

        const path = returnPath && returnPath.startsWith('/') ? returnPath : '/';

        // Logged on every payment so a wrong notification_url shows up in
        // Vercel logs immediately, instead of only surfacing days later as
        // a support email from GoPay about repeated 404s.
        console.log(`[create-payment] order=${orderNumber} notification_url=${backendUrl}/api/gopay-notify`);

        const payload = {
            target: { type: 'ACCOUNT', goid: config.goid },
            amount: amountInHaliru,
            currency: 'CZK',
            order_number: String(orderNumber),
            order_description: `Apulia Olive Oil – objednávka ${orderNumber}`,
            items,
            callback: {
                return_url: `${siteUrl}${path}?gopay_order=${encodeURIComponent(orderNumber)}`,
                notification_url: `${backendUrl}/api/gopay-notify`
            },
            payer: {
                // 'bank' opens the bank-transfer (PISP) flow directly, anything
                // else opens card payment — matches what the customer chose.
                default_payment_instrument: method === 'bank' ? 'BANK_ACCOUNT' : 'PAYMENT_CARD',
                allowed_payment_instruments: [method === 'bank' ? 'BANK_ACCOUNT' : 'PAYMENT_CARD'],
                contact: {
                    first_name: (customer.name || '').split(' ')[0] || customer.name || 'Zákazník',
                    last_name: (customer.name || '').split(' ').slice(1).join(' ') || '-',
                    email: customer.email,
                    phone_number: customer.phone || undefined,
                    street: String(addr.street || '').slice(0, 80) || undefined,
                    city: String(addr.city || '').slice(0, 60) || undefined,
                    postal_code: String(addr.postalCode || '').replace(/\s/g, '').slice(0, 12) || undefined,
                    country_code: COUNTRY_CODES[addr.country] || undefined
                }
            },
            // echoed back by GoPay, lets the server-side e-mail (see
            // lib/email.js) rebuild the full order without any database
            additional_params: [
                { name: 'delivery', value: String(deliveryId) },
                { name: 'method', value: method === 'bank' ? 'bank' : 'card' }
            ],
            lang: ['CS','EN','DE','SK','PL','UK','RU','IT'].includes(String(lang||'').toUpperCase()) ? String(lang).toUpperCase() : 'CS'
        };

        let result;
        try {
            result = await createPayment(payload);
        } catch (err) {
            // Optional extras (address, additional params) must never block a
            // payment: if GoPay rejects them, retry once with the bare minimum.
            if (!/\((400|409)\)/.test(String(err.message))) throw err;
            console.warn(`[create-payment] retrying without optional fields: ${String(err.message).slice(0, 300)}`);
            const c = payload.payer.contact;
            payload.payer.contact = { first_name: c.first_name, last_name: c.last_name, email: c.email, phone_number: c.phone_number };
            payload.additional_params = [];
            result = await createPayment(payload);
        }
        res.status(200).json({ gw_url: result.gw_url, id: result.id, orderNumber });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'GoPay payment creation failed', detail: String(err.message || err) });
    }
};
