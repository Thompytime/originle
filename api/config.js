const { json, method, enabled, listingPrice } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['GET'])) return;
  json(res, 200, { launchDate: process.env.LAUNCH_DATE || '2026-08-25', listingPrice: listingPrice(),
    publicSubmissionsEnabled: enabled('PUBLIC_SUBMISSIONS_ENABLED'), paymentsEnabled: enabled('PAYMENTS_ENABLED') });
};
