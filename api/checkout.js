const Stripe = require('stripe');
const { redis, SITE_URL, json, method, enabled, id, token, hash, moneyInt, listingPrice, rateLimit, validateListing, getListing } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  try {
    if (!enabled('PAYMENTS_ENABLED')) return json(res, 503, { error: 'Payments are not enabled yet.' });
    if (!(await rateLimit(req, 'checkout:hour', 20, 3600))) return json(res, 429, { error: 'Too many checkout attempts. Try again later.' });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const kind = req.body?.kind;
    const amount = moneyInt(req.body?.amount);
    if (!amount) return json(res, 400, { error: 'Invalid payment amount.' });
    const draftId = id('draft_');
    let draft;
    let description;
    if (kind === 'listing') {
      if (!enabled('PUBLIC_SUBMISSIONS_ENABLED')) return json(res, 503, { error: 'Public submissions are not enabled yet.' });
      if (amount < listingPrice()) return json(res, 400, { error: 'The listing price has changed. Refresh the page and try again.' });
      const listing = validateListing(req.body.listing || {});
      const manageToken = token();
      draft = { id: draftId, kind, amount, listing, manageTokenHash: hash(manageToken), manageToken, createdAt: Date.now() };
      description = `Originle listing — £${(amount / 100).toFixed(2)}`;
    } else if (kind === 'boost') {
      const listingId = String(req.body?.listingId || '');
      const listing = await getListing(listingId);
      if (!listing || listing.status !== 'live') return json(res, 404, { error: 'Listing not found.' });
      draft = { id: draftId, kind, amount, listingId, createdAt: Date.now() };
      description = `Boost ${listing.name} on Originle`;
    } else return json(res, 400, { error: 'Unknown checkout type.' });

    await redis.set(`draft:${draftId}`, draft, { ex: 86400 });
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'gbp', unit_amount: amount, product_data: { name: description } }, quantity: 1 }],
      metadata: { kind, draftId },
      success_url: `${SITE_URL}/?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/?cancelled=1`
    });
    json(res, 200, { checkoutUrl: session.url });
  } catch (error) { json(res, 400, { error: error.message || 'Checkout could not be created.' }); }
};
