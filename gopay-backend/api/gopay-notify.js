// GET/POST /api/gopay-notify
//
// GoPay calls this server-to-server after a payment's state changes
// (paid, canceled, timed out...). Per GoPay's integration rules, the
// notification itself carries no trusted data: on every notification we
// query the payment's real state via the REST API, and always answer 200
// so GoPay does not retry it as failed.
const { withCors } = require('../lib/cors');
const { getPaymentStatus } = require('../lib/gopay');
const { isEnabled, sendOrderEmails } = require('../lib/email');
const { rateLimit } = require('../lib/guard');

// GoPay may repeat a notification; don't mail the same paid order twice
// (best effort, per warm instance).
const mailed = new Set();

module.exports = async (req, res) => {
    if (withCors(req, res)) return;

    if (!rateLimit(req, 'gopay-notify', 60, 60000)) {
        res.status(429).send('Too many requests');
        return;
    }

    const paymentId = req.query && req.query.id;
    if (paymentId && /^\d{1,20}$/.test(String(paymentId))) {
        try {
            const data = await getPaymentStatus(paymentId);
            console.log(`[gopay-notify] payment=${paymentId} state=${data.state} order=${data.order_number || ''}`);
            // The order e-mails go out from here, so they are sent even if
            // the customer never returns to the site after paying.
            if (data.state === 'PAID' && isEnabled() && !mailed.has(String(paymentId))) {
                mailed.add(String(paymentId));
                const ok = await sendOrderEmails(data);
                if (!ok) mailed.delete(String(paymentId));
                console.log(`[gopay-notify] order e-mails ${ok ? 'sent' : 'FAILED'} for order=${data.order_number}`);
            }
        } catch (err) {
            console.error(`[gopay-notify] failed to fetch status for payment=${paymentId}:`, err.message || err);
        }
    } else {
        console.warn('[gopay-notify] received notification without a payment id in the query string');
    }
    res.status(200).send('OK');
};
