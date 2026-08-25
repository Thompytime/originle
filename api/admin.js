const Stripe = require('stripe');
const {
  redis, json, method, equal, rateLimit, createAdminSession, clearAdminSession,
  admin, lineHash, getListing, saveListing, addToBoards, removeFromBoards
} = require('./_lib');

module.exports = async function handler(req, res) {
  const action = String(req.query?.action || '');

  if (action === 'login') {
    if (!method(req, res, ['POST'])) return;
    if (!(await rateLimit(req, 'admin-login:hour', 10, 3600))) return json(res, 429, { error: 'Too many login attempts. Try again later.' });
    if (!equal(req.body?.token, process.env.ADMIN_TOKEN)) return json(res, 401, { error: 'Incorrect admin token.' });
    createAdminSession(res);
    return json(res, 200, { authenticated: true });
  }

  if (action === 'logout') {
    if (!method(req, res, ['POST'])) return;
    clearAdminSession(res);
    return json(res, 200, { loggedOut: true });
  }

  if (!admin(req)) return json(res, 401, { error: 'Unauthorised' });

  if (action === 'pending') {
    if (!method(req, res, ['GET'])) return;
    const ids = await redis.zrange('moderation:pending', 0, 199);
    const listings = (await Promise.all(ids.map(getListing))).filter(Boolean).map(item => {
      const { manageTokenHash, ...safe } = item;
      return safe;
    });
    return json(res, 200, { listings });
  }

  if (action === 'reports') {
    if (!method(req, res, ['GET'])) return;
    const ids = await redis.zrange('reports:open', 0, 199);
    const reports = (await Promise.all(ids.map(id => redis.get(`report:${id}`)))).filter(Boolean);
    const listings = await Promise.all(reports.map(report => getListing(report.listingId)));
    return json(res, 200, { reports: reports.map((report, i) => ({ ...report, listing: listings[i] ? {
      id: listings[i].id, name: listings[i].name, age: listings[i].age, area: listings[i].area,
      country: listings[i].country, pitch: listings[i].pitch, status: listings[i].status
    } : null })) });
  }

  if (action === 'moderate') {
    if (!method(req, res, ['POST'])) return;
    const listingId = String(req.body?.listingId || '');
    const moderationAction = req.body?.action;
    const listing = await getListing(listingId);
    if (!listing || listing.status !== 'pending') return json(res, 404, { error: 'Pending listing not found.' });
    if (moderationAction === 'approve') {
      const uniqueKey = `line:${lineHash(listing.pitch)}`;
      const reserved = await redis.set(uniqueKey, listing.id, { nx: true });
      if (!reserved) return json(res, 409, { error: 'That line has already been published.' });
      listing.status = 'live'; listing.approvedAt = Date.now();
      await saveListing(listing); await addToBoards(listing); await redis.zrem('moderation:pending', listing.id);
      return json(res, 200, { approved: true });
    }
    if (moderationAction === 'reject') {
      if (listing.paymentIntent) {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
        await stripe.refunds.create({ payment_intent: listing.paymentIntent, metadata: { listingId } });
      }
      listing.status = 'rejected'; listing.rejectedAt = Date.now(); listing.rejectionReason = String(req.body?.reason || '').slice(0, 300);
      await saveListing(listing); await redis.zrem('moderation:pending', listing.id);
      return json(res, 200, { rejected: true, refunded: !!listing.paymentIntent });
    }
    return json(res, 400, { error: 'Unknown moderation action.' });
  }

  if (action === 'report-action') {
    if (!method(req, res, ['POST'])) return;
    const reportId = String(req.body?.reportId || '');
    const reportAction = req.body?.action;
    const report = await redis.get(`report:${reportId}`);
    if (!report) return json(res, 404, { error: 'Open report not found.' });
    const listing = await getListing(report.listingId);
    if (reportAction === 'restore') {
      if (listing && listing.status === 'review') { listing.status = 'live'; await saveListing(listing); await addToBoards(listing); }
    } else if (reportAction === 'remove') {
      if (listing) { listing.status = 'removed'; listing.removedAt = Date.now(); await saveListing(listing); await removeFromBoards(listing); }
    } else if (reportAction !== 'close') return json(res, 400, { error: 'Unknown report action.' });
    report.status = reportAction; report.closedAt = Date.now(); await redis.set(`report:${reportId}`, report); await redis.zrem('reports:open', reportId);
    return json(res, 200, { closed: true, action: reportAction });
  }

  return json(res, 404, { error: 'Unknown admin action.' });
};
