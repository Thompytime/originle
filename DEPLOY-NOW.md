# Originle: do this next

## 1. GitHub

1. Download and unzip `originle-vercel-upstash-stripe.zip`.
2. Create a **private** GitHub repository named `originle`.
3. Upload the unzipped contents so `index.html`, `package.json`, `vercel.json` and the `api` folder are at the repository root.
4. Confirm `.env` and `.env.local` are not present.

## 2. Vercel

1. Choose **Add New → Project**.
2. Import the private GitHub `originle` repository.
3. Leave Root Directory as the repository root.
4. Deploy once. It will be preview-only because the production switches default to false.

## 3. Upstash

1. Create one Redis database in Upstash.
2. Use the Upstash Vercel integration or copy these into Vercel:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`

   The backend also accepts `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` if you use a direct Upstash connection instead.

## 4. Generate secrets

Use a password manager to generate three unrelated random strings of at least 32 characters:

- `ADMIN_TOKEN` — what you enter at `/admin`.
- `TOKEN_HASH_SECRET` — never entered into the website.
- `ADMIN_SESSION_SECRET` — never entered into the website.

## 5. Add all Vercel variables

Add these to Preview and Production:

- `KV_REST_API_URL` and `KV_REST_API_TOKEN` (created automatically by Vercel's Upstash integration), or the equivalent `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- `STRIPE_SECRET_KEY` — use a Stripe test key first.
- `STRIPE_WEBHOOK_SECRET` — use the test webhook signing secret first.
- `ADMIN_TOKEN`
- `TOKEN_HASH_SECRET`
- `ADMIN_SESSION_SECRET`
- `SITE_URL=https://www.originle.co.uk`
- `LAUNCH_DATE=2026-08-25`
- `PUBLIC_SUBMISSIONS_ENABLED=false`
- `PAYMENTS_ENABLED=false`

Optional email alerts:

- `RESEND_API_KEY`
- `MODERATION_EMAIL`
- `FROM_EMAIL=Originle <notifications@originle.co.uk>`

Redeploy after changing variables.

## 6. Stripe test mode

1. Activate/verify the Stripe account and disclose the dating/listing business model.
2. In test mode, create a webhook for `https://YOUR-VERCEL-PREVIEW-DOMAIN/api/webhook`.
3. Subscribe to `checkout.session.completed`.
4. Put that endpoint’s signing secret in `STRIPE_WEBHOOK_SECRET`.
5. Temporarily set both switches to `true` in the Preview environment only.
6. Redeploy the preview.

## 7. Test

1. Open `/api/health`; it must return `"ok": true`.
2. Submit and pay for one test listing.
3. Open `/admin`, enter `ADMIN_TOKEN`, and approve it.
4. Confirm it appears publicly.
5. Submit another and reject/refund it.
6. Mog a listing and confirm the number changes.
7. Boost a listing in Stripe test mode.
8. Report a listing as under 18; confirm it disappears immediately and appears under Open reports.
9. Restore or remove it from `/admin`.
10. Test deletion using the owner management token returned after payment.

## 8. Domain

1. Add `originle.co.uk` and `www.originle.co.uk` in Vercel Domains.
2. Add the exact DNS records Vercel gives you at your registrar.
3. Make `www.originle.co.uk` canonical.
4. After DNS works, create the production Stripe webhook at `https://www.originle.co.uk/api/webhook`.

## 9. Real launch

Only after Stripe approves live dating-service payments and the live-mode test succeeds:

1. Put the live Stripe secret and production webhook secret in Production.
2. Set `PUBLIC_SUBMISSIONS_ENABLED=true`.
3. Set `PAYMENTS_ENABLED=true`.
4. Redeploy Production.
5. Run one controlled live listing, approval, deletion and refund.
6. Bookmark `/admin` and keep `ADMIN_TOKEN` in your password manager.
