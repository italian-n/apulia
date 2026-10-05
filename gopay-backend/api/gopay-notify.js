// GET/POST /api/gopay-notify
//
// GoPay calls this server-to-server after a payment's state changes
// (paid, canceled, timed out...). Per GoPay's integration rules, the
// notification itself carries no trusted data: on every notification we
// query the payment's real state via the REST API, and always answer 200
// so GoPay does not retry it as failed.
const { withCors } = require('../lib/cors');
const { getPaymentStatus } = require('../lib/gopay');

module.exports = async (req, res) => {
    if (withCors(req, res)) return;

    const paymentId = req.query && req.query.id;
    if (paymentId) {
        try {
            const data = await getPaymentStatus(paymentId);
            console.log(`[gopay-notify] payment=${paymentId} state=${data.state} order=${data.order_number || ''}`);
        } catch (err) {
            console.error(`[gopay-notify] failed to fetch status for payment=${paymentId}:`, err.message || err);
        }
    } else {
        console.warn('[gopay-notify] received notification without a payment id in the query string');
    }
    res.status(200).send('OK');
};
