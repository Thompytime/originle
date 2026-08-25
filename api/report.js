const { redis, json, method, id, text, ip, hash, rateLimit, getListing, saveListing, removeFromBoards, notifyModeration } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  if (!(await rateLimit(req, 'report:day', 20, 86400))) return json(res, 429, { error: 'Too many reports from this connection today.' });
  const listingId = String(req.body?.listingId || '');
  const listing = await getListing(listingId);
  if (!listing) return json(res, 404, { error: 'Listing not found.' });
  const reportId = id('rep_');
  const reason = text(req.body?.reason, 160);
  const details = text(req.body?.details, 500);
  if (!reason) return json(res, 400, { error: 'Choose a report reason.' });
  const urgent = /didn't post|hasn't consented|under 18|illegal|threat/i.test(reason);
  const report = { id: reportId, listingId, reason, details, urgent, createdAt: Date.now(), reporter: hash(ip(req)) };
  await redis.set(`report:${reportId}`, report);
  await redis.zadd('reports:open', { score: report.createdAt, member: reportId });
  if (urgent && listing.status === 'live') {
    listing.status = 'review'; await saveListing(listing); await removeFromBoards(listing);
  }
  await notifyModeration(urgent ? 'Urgent Originle report awaiting review' : 'Originle report awaiting review');
  json(res, 200, { reference: reportId.toUpperCase(), removedPendingReview: urgent });
};
