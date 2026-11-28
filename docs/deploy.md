# Private Vercel demo

Codex, 2026-11-28. For a small invited group testing **synthetic cases only**.
Helmut deploys with his own account after the coordinator reviews and commits the changes.

## Import and configure

1. Run `npm ci` with Node 26 and `npm run check` on the reviewed branch. Keep real environment files out of Git. Commit/push through the coordinator's normal review flow before importing.
2. In Vercel, choose **Add New → Project → Import Git Repository**, connect GitHub and select this repository. Use the repository root and the **Next.js** framework preset. Keep Production on reviewed `main`; test `feat/Helmut` through its Preview deployment with the same protection enabled.
3. Select **Node.js 26.x** in **Settings → Build and Deployment → Node.js Version**. The package's `>=24` range permits 26.x. Install command: `npm ci`. Build command: `npm run build`. Leave Output Directory at the Next.js default; do not use a static export. [Vercel Node.js settings](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
4. Functions use **Frankfurt (`fra1`)**, configured by `vercel.json`. Verify **Settings → Functions → Function Regions**. This does not make OpenAI processing EU-only. [Region configuration](https://vercel.com/docs/functions/configuring-functions/region), [region list](https://vercel.com/docs/regions).
5. **Before clicking Deploy**, add these variables for **both Production and Preview**. Use separate preview credentials/API projects if needed. Never prefix secrets with `NEXT_PUBLIC_`.

| Variable | Value / purpose |
| --- | --- |
| `OPENAI_API_KEY` | Required funded, restricted OpenAI project key; retain provider-side budget controls/alerts. |
| `MEDBOT_HOSTED` | Required `1`: access gate, rate limits and estimated spend cutoff. |
| `MEDBOT_ACCESS_CODE` | Required shared invitation passcode, at least 12 random characters. |
| `MEDBOT_COOKIE_SECRET` | Required independent random secret, at least 32 characters; signs httpOnly HMAC-SHA256 cookies with Web Crypto. |
| `MEDBOT_ADMIN_CODE` | Separate random code, at least 12 characters; only for the host's feedback review. |
| `MEDBOT_DAILY_USD_CAP` | Required positive USD amount, e.g. `5`; estimated spend per UTC day, across clients **within each instance**. Invalid/missing values block paid requests. |
| `OPENAI_REALTIME_MODEL` | Optional; default `gpt-realtime`. |
| `OPENAI_TEXT_MODEL` | Optional; empty uses the engine default `gpt-5-mini`. |
| `OPENAI_PATIENT_MODEL` | Optional; empty uses `gpt-5-mini`. |
| `OPENAI_TRANSCRIBE_MODEL` | Optional; default `gpt-4o-mini-transcribe`. |
| `OPENAI_TURN_DETECTION` | Optional; default `semantic_high`; also `semantic_medium` or `server_400`. |
| `MEDBOT_STORAGE_DIR` | Optional; leave empty for `/tmp/medbot`. Hosted overrides must resolve inside `/tmp/`; other paths fall back to the default. |
| `MEDBOT_TRACE_DIR`, `LEADERBOARD_FILE` | Local-only overrides; omit on Vercel. Hosted traces stay inside the storage directory; the hosted leaderboard is disabled. |

Generate codes/secrets independently with a password manager (e.g. 32 random bytes encoded as hex).
Never put credentials in URLs, issues or feedback. Missing/short access credentials fail closed with 503; the access screen remains reachable to show the setup error.

6. Deploy in the dashboard. Inspect build/function logs for failures. Environment changes require a **new deployment**. Share only the verified URL and send the access code separately. Remove/protect old deployments when rotating access: they may retain old environment values.

## Verify before inviting friends

- In a private browser window, `/`, `/privacy`, `/usage`, `/feedback` and other pages redirect to `/access`. `/api/health`, `/api/session`, `/api/hint` and `/api/viva` return JSON 401 without a cookie. Static assets, icons, manifest, service worker and offline shell remain public.
- Wrong passcodes fail. Correct login sets an httpOnly, SameSite=Strict, Secure cookie lasting 12 hours. No passcode is stored in localStorage or sent in a URL.
- Try a brief synthetic text interview, then voice over HTTPS; check UI errors and `/usage`. A browser, microphone and funded key are needed for this manual check. Offline tests do not verify live OpenAI/WebRTC.
- Submit feedback at `/feedback`. Entries require the **admin** code to view. Check function logs for `medbot_feedback` as well.
- `/leaderboard` explains that the shared hosted board is unavailable. Browser-local learning still works. Generate a synthetic patient and use it immediately; it may disappear when the instance changes.
- Run `npm run check` after changes. Offline tests cover cookies/rotation, gate decisions, rate limits, cap enforcement, write failures and admin isolation.

## Limits and costs

Proxy protects **every** route, including future APIs; dots in page/API paths do not bypass the gate. Non-read API routes default to the text bucket unless explicitly classified. Both IP and signed random cookie ID have independent buckets: refreshing a cookie or switching IP alone does not reset the limit. Vercel's `x-vercel-forwarded-for` is used on Vercel; other reverse proxies must sanitize forwarding headers. Our limiter does not persist addresses.

| Class (shared across routes in that class) | Per IP and per signed cookie |
| --- | --- |
| Access/admin login attempts | 5 / 10 minutes |
| Realtime credentials | 6 / 10 minutes |
| Text/write calls, including hint/viva/generation | 60 / 10 minutes |
| Browser usage traces | 300 / minute |
| Feedback submissions | 5 / 10 minutes |
| API reads | 120 / minute |

429 responses include `Retry-After` and an `error.message`. The cap returns JSON 503 with `daily_budget_exceeded`; invalid/unreadable budget state blocks paid requests too. Trace uploads and feedback remain available after cutoff. The JSON-body boundary checks its own instance ledger in addition to Proxy, since they may execute separately.

The cutoff sums committed metadata-only trace cost estimates for the **UTC** day, across all clients and trace sources, excluding timing-only records. Failed trace writes retain costs in memory. Checks occur before paid requests; concurrent/in-flight calls can overshoot. This is **not a billing guarantee**: instances/deployments do not share memory or `/tmp`, cold starts reset state, unknown models estimate $0, missing usage undercounts, and browser voice reports can be lost or withheld. Issued Realtime credentials/sessions cannot be revoked by a later app cutoff; direct browser voice traffic continues until session end. Proxy may not see route-instance files. A deployment-wide hard cap requires a durable shared ledger/reservations and server-controlled voice sessions, beyond this small-cohort implementation.

Watch the OpenAI project billing dashboard and existing capped key, plus Vercel usage. Confirm what the provider actually enforces; an alert need not be a hard stop. `/usage` estimates only the instance serving it. Prefer models priced in `lib/engine/pricing.ts`.

Using that file's checked standard rates, 10,000 uncached input text tokens + 2,000 output tokens on `gpt-5-mini` estimate **$0.0065**. On `gpt-realtime`, 1,000 uncached input audio tokens + 1,000 output audio tokens estimate **$0.096**, plus text/transcription. Audio tokens are not minutes. Vercel compute/traffic costs are additional and plan-dependent. [OpenAI pricing](https://developers.openai.com/api/docs/pricing), [Vercel pricing](https://vercel.com/pricing).

## Storage and retention

Hosted mode (or `VERCEL=1`) writes only under `/tmp/medbot` by default:

- `traces/llm.jsonl`: usage metadata, without prompts, transcripts, keys or audio.
- `feedback.jsonl`: random ID, timestamp, rating, optional text. Each hosted submission also emits JSON to the server console even if disk fails. The latest 1,000 failed JSONL appends per file stay in instance memory; failed trace costs are accounted separately without that row limit.
- `cases/generated/*.json`: synthetic generated cases, also kept in process memory when disk fails. Built-in cases ship read-only with the app.

Files/memory are ephemeral and **not shared across serverless instances**. Admin feedback reads may show only a subset or nothing. Use Vercel logs for cohort feedback and export manually if needed; review log retention/access in the account. Neither logs nor `/tmp` are a durable database. Restrict account access and remove feedback/logs when no longer needed. Rotating codes does not delete them. The hosted leaderboard returns a clear disabled message instead of an instance-specific ranking.

We do not store audio recordings or server-side interview transcripts. Learning stays in the browser and can be removed by clearing site data. OpenAI handles audio/text under the host's API settings; no zero-retention or EU-only promise is made. `/privacy` explains processing; `/access` includes a notice before unlocking. Feedback asks for no name/contact details and warns against patient/personal data. [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

## Rotate or close access

Change `MEDBOT_ACCESS_CODE` in Production and Preview and redeploy. The signature includes the passcode, so previous cookies fail **on the new deployment**. Rotate `MEDBOT_COOKIE_SECRET` to revoke both access/admin cookies, or `MEDBOT_ADMIN_CODE` to revoke admin only. Notify invitees privately. Existing browser-to-OpenAI sessions can continue; revoke/rotate the API key if urgent provider access must stop. Remove/protect old deployments and aliases carrying former credentials. To stop new paid requests without opening access, remove the API key or set the cap to zero/invalid and redeploy; do not disable hosted mode.
