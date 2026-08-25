const required = ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','ADMIN_TOKEN','TOKEN_HASH_SECRET','ADMIN_SESSION_SECRET','SITE_URL','LAUNCH_DATE','PUBLIC_SUBMISSIONS_ENABLED','PAYMENTS_ENABLED'];
const missing = required.filter(name => !process.env[name]);
if (!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL)) missing.push('UPSTASH_REDIS_REST_URL or KV_REST_API_URL');
if (!(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)) missing.push('UPSTASH_REDIS_REST_TOKEN or KV_REST_API_TOKEN');
if (missing.length) { console.error(`Missing environment variables: ${missing.join(', ')}`); process.exit(1); }
for (const name of ['ADMIN_TOKEN','TOKEN_HASH_SECRET','ADMIN_SESSION_SECRET']) {
  if (process.env[name].length < 32) { console.error(`${name} must contain at least 32 characters.`); process.exit(1); }
}
console.log('Required environment variables are present and secret lengths are acceptable.');
