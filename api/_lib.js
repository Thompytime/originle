const crypto = require('crypto');
const { Redis } = require('@upstash/redis');

// Vercel's Upstash marketplace integration normally creates KV_REST_API_*
// variables. Direct Upstash setups normally create UPSTASH_REDIS_REST_*.
// Accept both so the same deployment works with either setup.
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
if (!process.env.UPSTASH_REDIS_REST_URL && redisUrl) process.env.UPSTASH_REDIS_REST_URL = redisUrl;
if (!process.env.UPSTASH_REDIS_REST_TOKEN && redisToken) process.env.UPSTASH_REDIS_REST_TOKEN = redisToken;
const redis = Redis.fromEnv();
const SITE_URL = (process.env.SITE_URL || 'https://www.originle.co.uk').replace(/\/$/, '');

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
function enabled(name, fallback = false) {
  const value = process.env[name];
  return value == null ? fallback : /^(1|true|yes|on)$/i.test(value);
}

function method(req, res, allowed) {
  if (allowed.includes(req.method)) return true;
  res.setHeader('Allow', allowed.join(', '));
  json(res, 405, { error: 'Method not allowed' });
  return false;
}

function text(value, max) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function moneyInt(value, min = 100, max = 1000000) {
  const amount = Number(value);
  return Number.isInteger(amount) && amount >= min && amount <= max ? amount : null;
}

function id(prefix = '') { return prefix + crypto.randomBytes(12).toString('hex'); }
function token() { return crypto.randomBytes(32).toString('base64url'); }
function hash(value) {
  if (!process.env.TOKEN_HASH_SECRET) throw new Error('TOKEN_HASH_SECRET is not configured');
  return crypto.createHmac('sha256', process.env.TOKEN_HASH_SECRET)
    .update(String(value)).digest('hex');
}
function lineHash(value) { return crypto.createHash('sha256').update(text(value, 500).toLowerCase()).digest('hex'); }
function today() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = type => parts.find(x => x.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function ip(req) { return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim(); }
function listingPrice() {
  const launch = new Date(`${process.env.LAUNCH_DATE || '2026-08-25'}T00:00:00Z`);
  const current = new Date(`${today()}T00:00:00Z`);
  return Math.max(100, (Math.floor((current - launch) / 86400000) + 1) * 100);
}
async function rateLimit(req, bucket, max, seconds) {
  const key = `rate:${bucket}:${hash(ip(req))}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, seconds);
  return count <= max;
}

function validateListing(raw) {
  const item = {
    name: text(raw.name, 30), age: Number(raw.age), area: text(raw.area, 60), country: text(raw.country, 60),
    gender: ['w', 'm', 'nb'].includes(raw.gender) ? raw.gender : '',
    seek: ['w', 'm', 'any'].includes(raw.seek) ? raw.seek : '',
    pitch: text(raw.pitch, 500), plat: text(raw.plat, 20), handle: text(raw.handle, 60), link: text(raw.link, 200),
    explicitConsent: raw.explicitConsent === true, selfDeclaration: raw.selfDeclaration === true
  };
  if (!item.name || !Number.isInteger(item.age) || item.age < 18 || item.age > 99 || !item.area || !item.country || !item.gender || !item.seek || !item.pitch) {
    throw new Error('Please complete every required listing field.');
  }
  if (!item.handle && !item.link) throw new Error('Add a public handle or profile link.');
  if (!item.explicitConsent || !item.selfDeclaration) throw new Error('Explicit consent and confirmation that the listing is about you are required.');
  if (/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i.test(item.pitch + ' ' + item.handle + ' ' + item.link)) throw new Error('Email addresses are not allowed.');
  if (/(?:\+?\d[\s().-]?){9,}/.test(item.pitch)) throw new Error('Phone numbers are not allowed.');
  if (item.link) {
    let url; try { url = new URL(/^https:\/\//i.test(item.link) ? item.link : `https://${item.link}`); } catch (_) { throw new Error('Enter a valid HTTPS profile link.'); }
    if (url.protocol !== 'https:' || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) throw new Error('Enter a valid HTTPS profile link.');
  }
  item.consentVersion = '2026-08-25'; item.consentAt = Date.now();
  return item;
}

async function getListing(listingId) { return redis.get(`listing:${listingId}`); }
async function saveListing(item) { await redis.set(`listing:${item.id}`, item); }
async function removeFromBoards(item) {
  await Promise.all([
    redis.zrem('board:paid', item.id), redis.zrem(`board:today:${today()}`, item.id), redis.zrem('board:mogs', item.id)
  ]);
}
async function addToBoards(item) {
  await Promise.all([
    redis.zadd('board:paid', { score: item.pence || 0, member: item.id }),
    redis.zadd(`board:today:${today()}`, { score: item.todayPence || 0, member: item.id }),
    redis.zadd('board:mogs', { score: item.fancies || 0, member: item.id })
  ]);
}
function publicListing(item) {
  const { manageTokenHash, paymentIntent, stripeSessionId, explicitConsent, selfDeclaration, consentVersion, consentAt, ...safe } = item;
  if (safe.paidDate !== today()) safe.todayPence = 0;
  return safe;
}
function equal(a, b) {
  a = String(a || ''); b = String(b || '');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
function cookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map(x => x.trim().split('=').map(decodeURIComponent)).filter(x => x.length === 2));
}
function signSession(payload) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not configured');
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}
function createAdminSession(res) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 12 * 3600000 })).toString('base64url');
  res.setHeader('Set-Cookie', `originle_admin=${payload}.${signSession(payload)}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Strict`);
}
function clearAdminSession(res) { res.setHeader('Set-Cookie', 'originle_admin=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict'); }
function admin(req) {
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (equal(bearer, process.env.ADMIN_TOKEN)) return true;
  const value = cookies(req).originle_admin || '';
  const [payload, signature] = value.split('.');
  if (!payload || !signature || !equal(signature, signSession(payload))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); } catch (_) { return false; }
}
async function notifyModeration(subject) {
  if (!process.env.RESEND_API_KEY || !process.env.MODERATION_EMAIL || !process.env.FROM_EMAIL) return;
  try {
    await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.FROM_EMAIL, to: [process.env.MODERATION_EMAIL], subject, text: `A private moderation item is waiting. Open ${SITE_URL}/admin. No listing details are included in this email.` }) });
  } catch (_) { /* Notifications must never break payments, reports or moderation. */ }
}

module.exports = { redis, SITE_URL, json, method, enabled, text, moneyInt, id, token, hash, lineHash, today, ip, listingPrice, rateLimit,
  validateListing, getListing, saveListing, removeFromBoards, addToBoards, publicListing, admin, equal, createAdminSession, clearAdminSession, notifyModeration };
