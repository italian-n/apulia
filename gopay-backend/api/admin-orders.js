// GET   /api/admin-orders?state=PAID&limit=100   -> { orders: [...] }
// PATCH /api/admin-orders  { id, fulfillment?, note? }
// POST  /api/admin-orders  { import: <gopay payment id> }  -> adds an existing payment to the list (marked as already e-mailed)
// Bearer ADMIN_TOKEN, same guard as admin-payment.
const orders = require('../lib/orders');
const { authorize } = require('../lib/admin');
const { getPaymentStatus } = require('../lib/gopay');

module.exports = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'PATCH', 'POST'].includes(req.method)) { res.status(405).json({ error: 'Method not allowed' }); return; }
    if (!authorize(req, res)) return;
    if (!orders.isEnabled()) { res.status(503).json({ error: 'Order storage not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY)' }); return; }

    try {
        if (req.method === 'GET') {
            const list = await orders.list(req.query || {});
            // self-heal: a missed GoPay notification must not leave a paid order stuck on CREATED
            const stale = list.filter((o) => o.state === 'CREATED' && Date.now() - new Date(o.created_at) < 7 * 864e5).slice(0, 10);
            await Promise.all(stale.map(async (o) => {
                try {
                    const p = await getPaymentStatus(o.payment_id);
                    if (p.state !== o.state) { await orders.setState({ ...p, id: o.payment_id }); o.state = p.state; }
                } catch (e) { console.error('[admin-orders] refresh', o.payment_id, e.message || e); }
            }));
            res.status(200).json({ orders: list });
            return;
        }
        let b = req.body;
        if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
        if (req.method === 'POST') {
            if (!b || !orders.validId(b.import)) { res.status(400).json({ error: 'Invalid id' }); return; }
            const row = orders.fromPayment(await getPaymentStatus(b.import));
            const now = new Date().toISOString();
            await orders.save({ ...row, emailed_at: now, ...(row.state === 'PAID' ? { paid_at: now } : {}) });
            res.status(200).json({ order: row });
            return;
        }
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
