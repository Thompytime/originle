const { redis, json, method, ip, hash, today, getListing, saveListing } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  const listingId = String(req.body?.listingId || '');
  const listing = await getListing(listingId);
  if (!listing || listing.status !== 'live') return json(res, 404, { error: 'Listing not found.' });
  const voter = hash(`${ip(req)}:${today()}`);
  const voteKey = `vote:${today()}:${voter}:${listingId}`;
  const countKey = `votes:${today()}:${voter}`;
  if (await redis.exists(voteKey)) return json(res, 409, { error: 'You already mogged this line today.' });
  const used = Number(await redis.get(countKey) || 0);
  if (used >= 5) return json(res, 429, { error: 'You have used all five mogs today.' });
  await redis.set(voteKey, 1, { ex: 172800 });
  await redis.incr(countKey); await redis.expire(countKey, 172800);
  listing.fancies = (listing.fancies || 0) + 1;
  await saveListing(listing);
  await redis.zadd('board:mogs', { score: listing.fancies, member: listing.id });
  json(res, 200, { mogs: listing.fancies, remaining: 4 - used });
};
