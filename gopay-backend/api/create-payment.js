const { createPayment } = require('../lib/gopay');
const { withCors } = require('../lib/cors');
const { getConfig } = require('../lib/config');

// POST /api/create-payment
//
// Body (all required unless noted):
//   orderNumber   string   unique id for this order (e.g. "APO-172..."))
//   amountCzk     number   total order amount in CZK (whole crowns, may have decimals)
//   description   string   short order description shown on the payment page
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
        const { orderNumber, amountCzk, description, customer, returnPath } = body;

        if (!orderNumber || !amountCzk || !customer || !customer.email) {
            res.status(400).json({ error: 'Missing orderNumber, amountCzk or customer.email' });
            return;
        }

        const config = getConfig(); // throws loudly if BACKEND_URL is missing/placeholder — see lib/config.js
        const siteUrl = config.allowedOrigin;
        const backendUrl = config.backendUrl;
        const path = returnPath && returnPath.startsWith('/') ? returnPath : '/';

        // GoPay wants the amount in the currency's smallest unit's *100
        // form it calls "amount" — i.e. hundredths of a crown (halíře).
        const amountInHaliru = Math.round(Number(amountCzk) * 100);

        // Logged on every payment so a wrong notification_url shows up in
        // Vercel logs immediately, instead of only surfacing days later as
        // a support email from GoPay about repeated 404s.
        console.log(`[create-payment] order=${orderNumber} notification_url=${backendUrl}/api/gopay-notify`);

        const payload = {
            target: { type: 'ACCOUNT', goid: config.goid },
            amount: amountInHaliru,
            currency: 'CZK',
            order_number: String(orderNumber),
            order_description: (description || 'Objednávka Apulia Olive Oil').slice(0, 255),
            items: [
                { name: description || 'Objednávka', amount: amountInHaliru, count: 1 }
            ],
            callback: {
                return_url: `${siteUrl}${path}?gopay_order=${encodeURIComponent(orderNumber)}`,
                notification_url: `${backendUrl}/api/gopay-notify`
            },
            payer: {
                default_payment_instrument: 'PAYMENT_CARD',
                allowed_payment_instruments: ['PAYMENT_CARD', 'BANK_ACCOUNT'],
                contact: {
                    first_name: (customer.name || '').split(' ')[0] || customer.name || 'Zákazník',
                    last_name: (customer.name || '').split(' ').slice(1).join(' ') || '-',
                    email: customer.email,
                    phone_number: customer.phone || undefined
                }
            },
            lang: 'CS'
        };

        const result = await createPayment(payload);
        res.status(200).json({ gw_url: result.gw_url, id: result.id, orderNumber });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'GoPay payment creation failed', detail: String(err.message || err) });
    }
};
