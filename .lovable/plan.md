# Why the heartbeat didn't keep your Supabase project awake

## What the heartbeat is
- A database-internal scheduled job (`pg_cron`) named `daily-heartbeat`, running every day at 04:00 UTC.
- It updates one row in a private `system_heartbeat` table. No edge function, no external HTTP call.

## What I checked
- The job lives in this app's **Lovable Cloud backend** (project `xwnqyavfcyfnlnmhivdn`), not in project `lnsrquawtuswkxxyvskw`.
- It is active and has succeeded every day; the latest run was 2026-10-14 04:00 UTC.

## Cause
1. **Wrong project.** This app runs on Lovable Cloud. Your separately connected Supabase project (`lnsrquawtuswkxxyvskw`) has never had a heartbeat, so nothing ever touched it. That alone explains the pause.
2. **Internal jobs may not count anyway.** Supabase's free-tier inactivity check looks at activity from outside the database (API/REST requests). A `pg_cron` job runs inside Postgres, so even in the right project it may not reset the inactivity timer.

## Fix plan
1. Confirm which project should stay awake. This app doesn't use `lnsrquawtuswkxxyvskw` at all. If nothing needs it, it can stay paused. If you use it elsewhere, it needs its own ping.
2. Ping it from outside, once a day, with a real read through its REST API. For example:
   `GET https://lnsrquawtuswkxxyvskw.supabase.co/rest/v1/product_catalog?select=id&limit=1` with that project's publishable (anon) key. This needs a table there that anon users can read.
3. Where the ping runs, pick one:
   - **A.** A daily scheduled job inside this app's Lovable Cloud backend (`pg_cron` + `pg_net`) that sends the HTTP read above to the other project. No new code in the app.
   - **B.** A free external scheduler (GitHub Actions or cron-job.org) calling the same URL.
4. Optionally, make this app's own backend heartbeat a real read too (select one row from `product_catalog`), replacing the current internal row update.
5. Verify: check that the ping returns 200 and that the other project's API request logs show the daily hit.

## Needed from you
- Whether project `lnsrquawtuswkxxyvskw` is really something you use, and what it's for.
- Its publishable (anon) key, and the name of a table there that anon users can read.
