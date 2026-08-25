const { json, method, equal, rateLimit, createAdminSession } = require('../_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  if (!(await rateLimit(req, 'admin-login:hour', 10, 3600))) return json(res, 429, { error: 'Too many login attempts. Try again later.' });
  if (!equal(req.body?.token, process.env.ADMIN_TOKEN)) return json(res, 401, { error: 'Incorrect admin token.' });
  createAdminSession(res);
  json(res, 200, { authenticated: true });
};
