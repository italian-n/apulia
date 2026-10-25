// GET   /api/admin-orders?state=PAID&limit=100   -> { orders: [...] }
// PATCH /api/admin-orders  { id, fulfillment?, note? }
// Bearer ADMIN_TOKEN, same guard as admin-payment.
const orders = require('../lib/orders');
const { authorize } = require('../lib/admin');

module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET' && req.method !== 'PATCH') { res.status(405).json({ error: 'Method not allowed' }); return; }
    if (!authorize(req, res)) return;
    if (!orders.isEnabled()) { res.status(503).json({ error: 'Order storage not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY)' }); return; }

    try {
        if (req.method === 'GET') {
            res.status(200).json({ orders: await orders.list(req.query || {}) });
            return;
        }
        let b = req.body;
        if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
        if (!b || !orders.validId(b.id)) { res.status(400).json({ error: 'Invalid id' }); return; }
        if (b.fulfillment !== undefined && !orders.FULFILLMENT.includes(b.fulfillment)) { res.status(400).json({ error: 'Invalid fulfillment' }); return; }
        const rows = await orders.updateAdmin(String(b.id), b);
        if (!rows.length) { res.status(404).json({ error: 'Order not found' }); return; }
        res.status(200).json({ order: rows[0] });
    } catch (err) {
        console.error('[admin-orders]', err.message || err);
        res.status(502).json({ error: 'Order storage failed', detail: String(err.message || err).slice(0, 200) }); // admin-only, helps diagnose setup
    }
};
