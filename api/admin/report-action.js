const { redis, json, method, admin, getListing, saveListing, addToBoards, removeFromBoards } = require('../_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  if (!admin(req)) return json(res, 401, { error: 'Unauthorised' });
  const reportId = String(req.body?.reportId || '');
  const action = req.body?.action;
  const report = await redis.get(`report:${reportId}`);
  if (!report) return json(res, 404, { error: 'Open report not found.' });
  const listing = await getListing(report.listingId);
  if (action === 'restore') {
    if (listing && listing.status === 'review') { listing.status = 'live'; await saveListing(listing); await addToBoards(listing); }
  } else if (action === 'remove') {
    if (listing) { listing.status = 'removed'; listing.removedAt = Date.now(); await saveListing(listing); await removeFromBoards(listing); }
  } else if (action !== 'close') return json(res, 400, { error: 'Unknown report action.' });
  report.status = action; report.closedAt = Date.now(); await redis.set(`report:${reportId}`, report); await redis.zrem('reports:open', reportId);
  json(res, 200, { closed: true, action });
};
