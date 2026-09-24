const { getPaymentStatus } = require('../lib/gopay');
const { withCors } = require('../lib/cors');

// GET /api/payment-status?id=<gopay payment id>
//
// The site calls this when the customer is redirected back from GoPay, to
// verify — server-side, never trusting the URL alone — whether the
// payment actually went through before showing a success message or
// sending the order notification email.
//
// Response: { state: 'PAID' | 'CREATED' | 'CANCELED' | 'TIMEOUTED' | 'FAILED' | ... }
module.exports = async (req, res) => {
    if (withCors(req, res)) return;

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const id = req.query && req.query.id;
    if (!id) {
        res.status(400).json({ error: 'Missing id' });
        return;
    }

    try {
        const data = await getPaymentStatus(id);
        res.status(200).json({ state: data.state, order_number: data.order_number });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Could not fetch payment status', detail: String(err.message || err) });
    }
};
