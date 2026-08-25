const Stripe = require('stripe');
const { redis, json, id, today, getListing, saveListing, addToBoards, notifyModeration } = require('./_lib');

module.exports.config = { api: { bodyParser: false } };

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event;
  try {
    event = stripe.webhooks.constructEvent(await rawBody(req), req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) { return json(res, 400, { error: 'Invalid webhook signature.' }); }

  try {
    const first = await redis.set(`stripe:event:${event.id}`, 'processing', { nx: true, ex: 604800 });
    if (!first) return json(res, 200, { received: true, duplicate: true });
    if (event.type === 'checkout.session.completed' && event.data.object.payment_status === 'paid') {
      const session = event.data.object;
      const draft = await redis.get(`draft:${session.metadata.draftId}`);
      if (!draft) throw new Error('Checkout draft expired or missing');
      if (draft.kind === 'listing') {
        const listing = {
          ...draft.listing, id: id('lst_'), status: 'pending', pence: draft.amount, todayPence: draft.amount,
          fancies: 0, createdAt: Date.now(), paidDate: today(), paymentIntent: session.payment_intent,
          stripeSessionId: session.id, manageTokenHash: draft.manageTokenHash
        };
        await saveListing(listing);
        await redis.zadd('moderation:pending', { score: listing.createdAt, member: listing.id });
        await redis.set(`checkout:${session.id}`, { listingId: listing.id, manageToken: draft.manageToken }, { ex: 86400 });
        await notifyModeration('Originle listing awaiting approval');
      } else if (draft.kind === 'boost') {
        const listing = await getListing(draft.listingId);
        if (listing && listing.status === 'live') {
          listing.pence = (listing.pence || 0) + draft.amount;
          listing.todayPence = listing.paidDate === today() ? (listing.todayPence || 0) + draft.amount : draft.amount;
          listing.paidDate = today();
          await saveListing(listing);
          await addToBoards(listing);
        }
      }
      await redis.del(`draft:${session.metadata.draftId}`);
    }
    await redis.set(`stripe:event:${event.id}`, 'done', { ex: 604800 });
    json(res, 200, { received: true });
  } catch (error) {
    await redis.del(`stripe:event:${event.id}`);
    json(res, 500, { error: 'Webhook processing failed.' });
  }
};
