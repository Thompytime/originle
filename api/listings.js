const { redis, json, method, getListing, publicListing, today } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  try {
    const sort = ['paid', 'today', 'mogs'].includes(req.query.sort) ? req.query.sort : 'paid';
    const key = sort === 'today' ? `board:today:${today()}` : `board:${sort}`;
    const ids = await redis.zrange(key, 0, 199, { rev: true });
    const items = (await Promise.all(ids.map(getListing))).filter(x => x && x.status === 'live').map(publicListing);
    json(res, 200, { listings: items });
  } catch (error) { json(res, 500, { error: 'Could not load listings.' }); }
};
