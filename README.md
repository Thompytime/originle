# Originle deployment

This is a Vercel static frontend plus Node.js serverless API. It uses **Upstash Redis**, not Supabase, and Stripe Checkout for listing and boost payments.

## Required Vercel environment variables

Copy the names from `.env.example` into Vercel Project Settings → Environment Variables. Generate long, unrelated random values for `ADMIN_TOKEN`, `TOKEN_HASH_SECRET` and `ADMIN_SESSION_SECRET`. Never expose these values in frontend code.

Keep `PUBLIC_SUBMISSIONS_ENABLED=false` and `PAYMENTS_ENABLED=false` for the preview deployment. Turn them on only after test-mode approval and payment flows pass. `/api/config` supplies the public switches and current server-enforced price; `/api/health` reports missing server configuration without exposing values.

## Stripe

1. Create a webhook endpoint pointing to `https://www.originle.co.uk/api/webhook`.
2. Subscribe it to `checkout.session.completed`.
3. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Use Stripe test keys first. Complete a listing payment, approve it at `/admin`, boost it, report it, and delete it before switching to live keys.

## Upstash

Create one Redis database and copy its REST URL and REST token into the matching Vercel variables. The API stores pending/live listings, ranking sorted sets, vote limits, reports, checkout drafts and Stripe idempotency keys.

## Moderation

Visit `/admin`, enter `ADMIN_TOKEN`, then approve or reject. Rejection automatically requests a Stripe refund. The moderation queue is not embedded in the public page.

The same page displays open reports. Urgent reports automatically hide the listing while you review it. You can restore the listing, remove it, or close the report without changing the listing. Admin sign-in creates a 12-hour secure, HTTP-only cookie.

Optional generic email alerts use Resend. Verify `originle.co.uk` in Resend, then set `RESEND_API_KEY`, `MODERATION_EMAIL` and `FROM_EMAIL`. Alerts contain no listing or report details; they only link you to `/admin`. If these variables are absent, queues still work and email is skipped.

## Deploy

Import this folder into Vercel, add all environment variables, deploy, attach `originle.co.uk`, redirect the apex domain to `www`, then register the production Stripe webhook.

## Pre-launch checks

- Test listing checkout and cancellation.
- Confirm a paid listing is pending and not public.
- Approve it and confirm all boards update.
- Reject a second listing and confirm the Stripe refund.
- Test five mogs per visitor per day and duplicate-vote blocking.
- Test boosts, urgent reports, normal reports and deletion.
- Replace Stripe test keys with live keys only after every check passes.
- Visit `/api/health` and require `{"ok":true}` before enabling submissions.
- Run `npm run check` and `npm test`; the same checks run automatically in GitHub Actions.
