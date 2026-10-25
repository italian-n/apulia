// GET /api/admin-payment?id=<gopay payment id>   (Authorization: Bearer ADMIN_TOKEN)
// Read-only payment lookup for the shop owner. No refunds here on purpose.
const { getPaymentStatus } = require('../lib/gopay');
const { fromPayment } = require('../lib/orders');
const { authorize } = require('../lib/admin');

module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }
    if (!authorize(req, res)) return;

    const id = req.query && req.query.id;
    if (!id || !/^\d{1,20}$/.test(String(id))) { res.status(400).json({ error: 'Invalid id' }); return; }

    try {
        const p = await getPaymentStatus(id);
        res.status(200).json({ ...fromPayment(p), sub_state: p.sub_state });
    } catch (err) {
        console.error('[admin-payment]', err.message || err);
        res.status(502).json({ error: 'GoPay lookup failed' });
    }
};
