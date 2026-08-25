const { redis, json, method, admin, getListing } = require('../_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  if (!admin(req)) return json(res, 401, { error: 'Unauthorised' });
  const ids = await redis.zrange('reports:open', 0, 199);
  const reports = (await Promise.all(ids.map(id => redis.get(`report:${id}`)))).filter(Boolean);
  const listings = await Promise.all(reports.map(report => getListing(report.listingId)));
  json(res, 200, { reports: reports.map((report, i) => ({ ...report, listing: listings[i] ? {
    id: listings[i].id, name: listings[i].name, age: listings[i].age, area: listings[i].area,
    country: listings[i].country, pitch: listings[i].pitch, status: listings[i].status
  } : null })) });
};
