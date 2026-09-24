// POST /api/gopay-notify
//
// GoPay calls this server-to-server after a payment's state changes
// (paid, canceled, timed out...). We don't keep a database, so this
// endpoint doesn't need to do anything with the payload — the site itself
// verifies payment status via /api/payment-status when the customer's
// browser returns. This endpoint only needs to exist and answer 200, so
// GoPay doesn't retry it as failed.
const { withCors } = require('../lib/cors');

module.exports = async (req, res) => {
    if (withCors(req, res)) return;
    res.status(200).send('OK');
};
