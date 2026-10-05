// Server-side order e-mails via the EmailJS REST API.
//
// Why: if a customer pays but closes the tab before returning to the site,
// the browser never sends the order e-mails. GoPay's server-to-server
// notification does always arrive, so the e-mails are sent from here.
//
// Needs the env var EMAILJS_PRIVATE_KEY (EmailJS → Account → Security) and
// "Allow EmailJS API for non-browser applications" switched on there.
// Without the key this module is a no-op and the browser keeps sending the
// e-mails itself (see `isEnabled`).
const { DELIVERY } = require('./catalog');

const PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'XINpTJLqloU4ddBs_';
const SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_l7uo35p';
const SELLER_TEMPLATE = process.env.EMAILJS_TEMPLATE_ID || 'template_dtqe8tq';
const CUSTOMER_TEMPLATE = process.env.EMAILJS_CUSTOMER_TEMPLATE_ID || 'template_ov8nuha';
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || 'eddigood2020@gmail.com';

const isEnabled = () => !!process.env.EMAILJS_PRIVATE_KEY;

const COUNTRY_NAMES = { CZE: 'Czech Republic', SVK: 'Slovakia', DEU: 'Germany', POL: 'Poland', AUT: 'Austria', ITA: 'Italy', UKR: 'Ukraine' };
const countryName = (c) => COUNTRY_NAMES[c] || '';

const kc = (n) => `${Number(n).toLocaleString('cs-CZ')} Kč`;

async function send(templateId, params) {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            service_id: SERVICE_ID,
            template_id: templateId,
            user_id: PUBLIC_KEY,
            accessToken: process.env.EMAILJS_PRIVATE_KEY,
            template_params: params
        }),
        signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) throw new Error(`EmailJS ${templateId} failed (${res.status}): ${await res.text().catch(() => '')}`);
}

// Builds the order e-mails from a GoPay payment object (as returned by
// GET /payments/payment/{id}) and sends the seller + customer messages.
async function sendOrderEmails(payment) {
    const contact = (payment.payer && payment.payer.contact) || {};
    const extra = {};
    (payment.additional_params || []).forEach((p) => { extra[p.name] = p.value; });

    const items = payment.items || [];
    const lines = items.filter((i) => i.type !== 'DELIVERY')
        .map((i) => `${i.name} x${i.count} — ${kc((i.amount * i.count) / 100)}`).join('\n');
    const deliveryItem = items.find((i) => i.type === 'DELIVERY');
    const dlv = DELIVERY[extra.delivery];
    const deliveryLabel = deliveryItem
        ? `${deliveryItem.name} (${kc(deliveryItem.amount / 100)})`
        : (dlv ? `${dlv.name} (0 Kč)` : '—');
    const isBank = extra.method === 'bank';

    const params = {
        to_email: NOTIFY_EMAIL,
        customer_email: contact.email,
        order_text: lines,
        customer_name: `${contact.first_name || ''} ${contact.last_name && contact.last_name !== '-' ? contact.last_name : ''}`.trim(),
        customer_phone: contact.phone_number || '—',
        customer_address: [contact.street, [contact.postal_code, contact.city].filter(Boolean).join(' '), countryName(contact.country_code)].filter(Boolean).join(', ') || '—',
        delivery: deliveryLabel,
        payment: isBank ? 'Online převod (platební brána) — zaplaceno' : 'Platební karta (platební brána) — zaplaceno',
        total: kc(payment.amount / 100)
    };

    const results = await Promise.allSettled([
        send(SELLER_TEMPLATE, params),
        contact.email ? send(CUSTOMER_TEMPLATE, params) : Promise.resolve()
    ]);
    results.forEach((r) => { if (r.status === 'rejected') console.error('[email]', r.reason.message || r.reason); });
    return results.every((r) => r.status === 'fulfilled');
}

module.exports = { isEnabled, sendOrderEmails };
