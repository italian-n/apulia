// Order store on Supabase (PostgREST over fetch, service_role key, server-side only).
// Best effort: every caller catches, so a DB outage never blocks a payment.
const { getProduct, getDelivery } = require('./catalog');
const url = () => (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = () => process.env.SUPABASE_SERVICE_KEY || '';
const isEnabled = () => !!(url() && key());
const FULFILLMENT = ['new', 'packed', 'shipped', 'delivered', 'cancelled'];
const STATES = ['CREATED', 'PAID', 'CANCELED', 'TIMEOUTED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'AUTHORIZED'];
const validId = (id) => /^\d{1,20}$/.test(String(id));

async function rest(query, { method = 'GET', body, prefer } = {}) {
    const res = await fetch(`${url()}/rest/v1/shop_orders${query}`, {
        method,
        // new sb_secret_ keys go in `apikey` only; Bearer is for legacy JWT service_role keys
        headers: { apikey: key(), ...(key().startsWith('eyJ') ? { Authorization: `Bearer ${key()}` } : {}), 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) throw new Error(`orders ${method} ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    return res.status === 204 ? null : res.json();
}

const save = (row) => rest('?on_conflict=payment_id', { method: 'POST', body: row, prefer: 'resolution=merge-duplicates,return=minimal' });

// upsert (not patch): guarantees a row exists even if the save at payment creation failed,
// so claimEmail below can never miss a paid order
async function setState(payment) {
    const now = new Date().toISOString();
    const id = String(payment.id);
    await save({ payment_id: id, order_number: payment.order_number || null, state: payment.state, amount: payment.amount / 100, updated_at: now });
    if (payment.state === 'PAID') await rest(`?payment_id=eq.${id}&paid_at=is.null`, { method: 'PATCH', body: { paid_at: now }, prefer: 'return=minimal' });
}

// true only for the single caller that wins the race => exactly one order e-mail
async function claimEmail(paymentId) {
    const rows = await rest(`?payment_id=eq.${paymentId}&emailed_at=is.null`, { method: 'PATCH', body: { emailed_at: new Date().toISOString() }, prefer: 'return=representation' });
    return rows.length === 1;
}
const releaseEmail = (paymentId) => rest(`?payment_id=eq.${paymentId}`, { method: 'PATCH', body: { emailed_at: null }, prefer: 'return=minimal' });

function list({ state, limit } = {}) {
    const n = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 300);
    const f = STATES.includes(state) ? `&state=eq.${state}` : '';
    return rest(`?select=*&order=created_at.desc&limit=${n}${f}`);
}

function updateAdmin(paymentId, { fulfillment, note }) {
    const patch = { updated_at: new Date().toISOString() };
    if (fulfillment !== undefined) patch.fulfillment = fulfillment;
    if (note !== undefined) patch.note = String(note).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 500);
    return rest(`?payment_id=eq.${paymentId}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
}

// Rebuilds our order row from a GoPay payment (additional_params carry items/delivery/address)
function fromPayment(p) {
    const extra = {};
    (p.additional_params || []).forEach((x) => { extra[x.name] = x.value; });
    const c = (p.payer && p.payer.contact) || {};
    const items = String(extra.items || '').split(',').map((x) => x.split(':'))
        .filter(([id, q]) => getProduct(id) && Number(q) > 0)
        .map(([id, q]) => ({ name: getProduct(id).name, qty: Number(q), sum: getProduct(id).price * Number(q) }));
    const d = getDelivery(extra.delivery);
    let address = '';
    try { address = Buffer.from(String(extra.addr || ''), 'base64url').toString('utf8'); } catch (e) { /* keep empty */ }
    return {
        payment_id: String(p.id), order_number: p.order_number || null, state: p.state, amount: p.amount / 100, currency: p.currency,
        method: extra.method === 'bank' ? 'bank' : 'card',
        customer_name: [c.first_name, c.last_name].filter((v) => v && v !== '-').join(' '), email: c.email || null, phone: c.phone_number || null,
        address, delivery: d ? d.name : null, items
    };
}

module.exports = { fromPayment, isEnabled, save, setState, claimEmail, releaseEmail, list, updateAdmin, validId, FULFILLMENT, STATES };
