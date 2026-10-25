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
const orders = require('../lib/orders');

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
    // cheap flood guard per id; exactly-once mailing is the DB claim below
    if (paymentId && !rateLimit(req, `gopay-notify:${paymentId}`, 5, 600000)) {
        res.status(200).send('OK');
        return;
    }
    if (paymentId && /^\d{1,20}$/.test(String(paymentId))) {
        try {
            const data = await getPaymentStatus(paymentId);
            console.log(`[gopay-notify] payment=${paymentId} state=${data.state} order=${data.order_number || ''}`);
            // The order e-mails go out from here, so they are sent even if
            // the customer never returns to the site after paying.
            const id = String(paymentId);
            if (orders.isEnabled()) {
                try { await orders.setState({ ...data, id }); } catch (e) { console.error('[orders] setState failed:', e.message || e); }
            }
            if (data.state === 'PAID' && isEnabled()) {
                // one winner per payment: DB claim when storage is on, per-instance Set otherwise
                let claimed;
                let viaDb = false;
                try {
                    if (!orders.isEnabled()) throw new Error('no store');
                    claimed = await orders.claimEmail(id);
                    viaDb = true;
                } catch (e) {
                    claimed = !mailed.has(id);
                    if (claimed) mailed.add(id);
                }
                if (claimed) {
                    const ok = await sendOrderEmails(data);
                    if (!ok) { mailed.delete(id); if (viaDb) await orders.releaseEmail(id).catch(() => {}); }
                    console.log(`[gopay-notify] order e-mails ${ok ? 'sent' : 'FAILED'} for order=${data.order_number}`);
                }
            }
        } catch (err) {
            console.error(`[gopay-notify] failed to fetch status for payment=${paymentId}:`, err.message || err);
        }
    } else {
        console.warn('[gopay-notify] received notification without a payment id in the query string');
    }
    res.status(200).send('OK');
};
