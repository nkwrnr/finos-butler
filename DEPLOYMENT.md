# FinOS Deployment Guide

## Architecture

| Environment | DATABASE_PATH | Database Location | Directory Creation |
|-------------|---------------|-------------------|-------------------|
| Local Dev | NOT SET | ./finance.db (project root) | NO - already exists |
| Production | /app/data/finance.db | Railway volume | YES - create if missing |

## Pre-Push Checklist

NEVER push to GitHub without completing ALL steps:

1. [ ] `rm -rf .next` - Clear build cache
2. [ ] `npm run dev` - Start local server
3. [ ] Open http://localhost:3000 - Verify dashboard loads with real data
4. [ ] Check: Checking Balance shows $17,601.29 (not $0)
5. [ ] Check: Savings Goals show House $7,047.78, Life $2,411.51
6. [ ] `npm run build` - Verify production build passes
7. [ ] Only then: `git add . && git commit && git push`

## After Push Checklist

1. [ ] Watch Railway dashboard for "Deployment successful"
2. [ ] Visit https://finos-butler-production.up.railway.app
3. [ ] Verify same data appears as local

## If Production Database Is Empty

Re-upload your database:
```bash
curl -X POST https://finos-butler-production.up.railway.app/api/admin/upload-database \
  -H "x-auth-pin: 0926" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @/Users/the_machine/app/finance/finance-app/finance.db
```

Then restart the Railway deployment.

## Critical Files - DO NOT MODIFY WITHOUT CARE

- `lib/db.ts` - Database connection. Changes here break everything.
- `middleware.ts` - Auth. Changes here lock you out.
- `.env.local` - Local secrets. Never commit.

## Environment Variables (Railway)

| Variable | Value |
|----------|-------|
| AUTH_PIN | 0926 |
| ANTHROPIC_API_KEY | (your key) |
| DATABASE_PATH | /app/data/finance.db |
