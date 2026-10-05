// Server-side price list. The browser only sends product/delivery ids and
// quantities; every amount sent to GoPay is computed here, so a customer
// can't tamper with prices in their browser. Keep in sync with index.html.
const PRODUCTS = {
    'extra-virgin-5l': { name: 'Extra Panenský Olivový Olej 5 L', price: 1290 },
    'vergine-10l': { name: 'Olivový Olej Vergine 10 L', price: 1690 },
    'smazeni-10l': { name: 'Olivový Olej na Smažení 10 L', price: 1490 }
};
const DELIVERY = {
    zasilkovna: { name: 'Doprava – Zásilkovna (výdejní místo / Z-BOX)', price: 89 },
    balik_doruky: { name: 'Doprava – Balík do ruky (Česká pošta)', price: 129 },
    osobne: { name: 'Osobní odběr (Brno)', price: 0 }
};
module.exports = { PRODUCTS, DELIVERY };
