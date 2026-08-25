const { redis, json, method } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  const required = ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','ADMIN_TOKEN','TOKEN_HASH_SECRET','ADMIN_SESSION_SECRET','SITE_URL','LAUNCH_DATE'];
  const missing = required.filter(name => !process.env[name]);
  if (!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)) missing.push('UPSTASH_REDIS_REST_URL or KV_REST_API_URL');
  if (!(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)) missing.push('UPSTASH_REDIS_REST_TOKEN or KV_REST_API_TOKEN');
  let redisOk = false; try { redisOk = (await redis.ping()) === 'PONG'; } catch (_) {}
  json(res, missing.length || !redisOk ? 503 : 200, { ok: !missing.length && redisOk, redis: redisOk, missing });
};
