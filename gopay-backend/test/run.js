// node test/run.js — security regression checks (no network)
const assert = require('assert');
const { getProduct, getDelivery } = require('../lib/catalog');
for (const k of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 42, null, undefined, {}]) {
    assert.strictEqual(getDelivery(k), undefined, `delivery ${String(k)}`);
    assert.strictEqual(getProduct(k), undefined, `product ${String(k)}`);
}
assert.ok(getDelivery('zasilkovna') && getProduct('vergine-10l'));

const mock = () => { const r = { code: 200, h: {} }; r.setHeader = (k, v) => { r.h[k] = v; }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.send = (b) => { r.body = b; return r; }; r.end = () => r; return r; };
const call = async (mod, req) => { const res = mock(); await require(mod)({ headers: {}, query: {}, method: 'GET', socket: { remoteAddress: '1.1.1.1' }, ...req }, res); return res; };

(async () => {
    delete process.env.ADMIN_TOKEN;
    assert.strictEqual((await call('../api/admin-payment', { query: { id: '1' } })).code, 503, 'disabled without token');
    process.env.ADMIN_TOKEN = 'x'.repeat(30);
    assert.strictEqual((await call('../api/admin-payment', { query: { id: '1' } })).code, 401, 'no bearer');
    assert.strictEqual((await call('../api/admin-payment', { query: { id: '1' }, headers: { authorization: 'Bearer nope' } })).code, 401, 'wrong bearer');
    assert.strictEqual((await call('../api/admin-payment', { query: { id: 'abc' }, headers: { authorization: 'Bearer ' + 'x'.repeat(30) } })).code, 400, 'bad id');
    const A = { authorization: 'Bearer ' + 'x'.repeat(30) };
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY;
    assert.strictEqual((await call('../api/admin-orders', { headers: A })).code, 503, 'orders need storage');
    process.env.SUPABASE_URL = 'http://127.0.0.1:9'; process.env.SUPABASE_SERVICE_KEY = 'k';
    assert.strictEqual((await call('../api/admin-orders', { method: 'PATCH', headers: A, body: { id: '1; drop', fulfillment: 'new' } })).code, 400, 'bad id');
    assert.strictEqual((await call('../api/admin-orders', { method: 'PATCH', headers: A, body: { id: '1', fulfillment: 'hacked' } })).code, 400, 'bad fulfillment');
    assert.strictEqual((await call('../api/admin-orders', { method: 'PATCH', body: { id: '1' } })).code, 401, 'orders need auth');
    delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_KEY;
    const page = await call('../api/admin', {});
    assert.ok(/<title>Objednávky/.test(page.body) && /frame-ancestors 'none'/.test(page.h['Content-Security-Policy']));
    // delivery bypass is rejected before any GoPay call
    process.env.BACKEND_URL = 'https://t.vercel.app'; process.env.GOPAY_GOID = '1'; process.env.GOPAY_CLIENT_ID = '1'; process.env.GOPAY_CLIENT_SECRET = '1';
    const r = await call('../api/create-payment', { method: 'POST', headers: { origin: 'https://apuliaoliveoil.cz' }, body: { orderNumber: 'APO-12345', items: [{ id: 'vergine-10l', qty: 1 }], deliveryId: 'constructor', customer: { name: 'A B', email: 'a@b.cz' } } });
    assert.strictEqual(r.code, 400); assert.strictEqual(r.body.error, 'Unknown delivery method');
    console.log('all security checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
