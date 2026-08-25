const { json, method, hash, getListing, saveListing, removeFromBoards } = require('./_lib');

module.exports = async function handler(req, res) {
  if (!method(req, res, ['DELETE'])) return;
  const listingId = String(req.body?.listingId || '');
  const manageToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const listing = await getListing(listingId);
  if (!listing || !manageToken || hash(manageToken) !== listing.manageTokenHash) return json(res, 403, { error: 'Invalid management link.' });
  listing.status = 'deleted'; listing.pitch = ''; listing.handle = ''; listing.link = ''; listing.deletedAt = Date.now();
  await saveListing(listing); await removeFromBoards(listing);
  json(res, 200, { deleted: true });
};
