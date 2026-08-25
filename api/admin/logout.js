const { json, method, clearAdminSession } = require('../_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  clearAdminSession(res); json(res, 200, { loggedOut: true });
};
