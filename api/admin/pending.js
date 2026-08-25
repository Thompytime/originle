const { redis, json, method, admin, getListing } = require('../_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  if (!admin(req)) return json(res, 401, { error: 'Unauthorised' });
  const ids = await redis.zrange('moderation:pending', 0, 199);
  const listings = (await Promise.all(ids.map(getListing))).filter(Boolean).map(item => {
    const { manageTokenHash, ...safe } = item; return safe;
  });
  json(res, 200, { listings });
};
