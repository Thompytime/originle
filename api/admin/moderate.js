const Stripe = require('stripe');
const { redis, json, method, admin, lineHash, getListing, saveListing, addToBoards } = require('../_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  if (!admin(req)) return json(res, 401, { error: 'Unauthorised' });
  const listingId = String(req.body?.listingId || '');
  const action = req.body?.action;
  const listing = await getListing(listingId);
  if (!listing || listing.status !== 'pending') return json(res, 404, { error: 'Pending listing not found.' });
  if (action === 'approve') {
    const uniqueKey = `line:${lineHash(listing.pitch)}`;
    const reserved = await redis.set(uniqueKey, listing.id, { nx: true });
    if (!reserved) return json(res, 409, { error: 'That line has already been published.' });
    listing.status = 'live'; listing.approvedAt = Date.now();
    await saveListing(listing); await addToBoards(listing); await redis.zrem('moderation:pending', listing.id);
    return json(res, 200, { approved: true });
  }
  if (action === 'reject') {
    if (listing.paymentIntent) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      await stripe.refunds.create({ payment_intent: listing.paymentIntent, metadata: { listingId } });
    }
    listing.status = 'rejected'; listing.rejectedAt = Date.now(); listing.rejectionReason = String(req.body?.reason || '').slice(0, 300);
    await saveListing(listing); await redis.zrem('moderation:pending', listing.id);
    return json(res, 200, { rejected: true, refunded: !!listing.paymentIntent });
  }
  json(res, 400, { error: 'Unknown moderation action.' });
};
