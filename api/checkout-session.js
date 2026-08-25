const { redis, json, method } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  const sessionId = String(req.query.session_id || '');
  if (!/^cs_/.test(sessionId)) return json(res, 400, { error: 'Invalid session.' });
  const data = await redis.get(`checkout:${sessionId}`);
  if (!data) return json(res, 202, { pending: true });
  await redis.del(`checkout:${sessionId}`);
  json(res, 200, data);
};
