// GET /api/admin-payment?id=<gopay payment id>   (Authorization: Bearer ADMIN_TOKEN)
// Read-only payment lookup for the shop owner. No refunds here on purpose.
const { getPaymentStatus } = require('../lib/gopay');
const { getProduct, getDelivery } = require('../lib/catalog');
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
        const extra = {};
        (p.additional_params || []).forEach((x) => { extra[x.name] = x.value; });
        const c = (p.payer && p.payer.contact) || {};
        const items = String(extra.items || '').split(',').map((x) => x.split(':'))
            .filter(([pid, q]) => getProduct(pid) && Number(q) > 0)
            .map(([pid, q]) => ({ name: getProduct(pid).name, qty: Number(q), sum: getProduct(pid).price * Number(q) }));
        const d = getDelivery(extra.delivery);
        let address = '';
        try { address = Buffer.from(String(extra.addr || ''), 'base64url').toString('utf8'); } catch (e) { /* keep empty */ }
        res.status(200).json({
            id: p.id, state: p.state, sub_state: p.sub_state, order_number: p.order_number,
            amount: p.amount / 100, currency: p.currency,
            method: extra.method === 'bank' ? 'bank' : 'card',
            customer: { name: [c.first_name, c.last_name].filter((v) => v && v !== '-').join(' '), email: c.email, phone: c.phone_number },
            address, items, delivery: d ? { name: d.name, price: d.price } : null
        });
    } catch (err) {
        console.error('[admin-payment]', err.message || err);
        res.status(502).json({ error: 'GoPay lookup failed' });
    }
};
