# Mobile app verification

Codex, 2026-11-28.

The installed app opens at `/`. Install and daily reminder controls appear below the learning content at `/learning`. Reminders default to off, use the device's local clock, skip completed daily goals (one interview or three reviews), and deliver at most once per local day. Changing the time or toggling off/on preserves the daily delivery marker. A 30-second timer and focus/visibility/storage events check whether a reminder is due. Browsers may suspend timers; reopening after the chosen time catches up. There is no closed-app scheduling or push service. Notification permission alone does not opt a learner in.

Production HTTPS or localhost is required. Service-worker registration is disabled during `next dev` to avoid caching development bundles. Install UI uses `beforeinstallprompt` only when supplied by the browser; browser-menu installation instructions cover other browsers, including iPhone's Add to Home Screen. Notification support and permissions vary by browser; verify on the target phone.

## Cache boundary

`public/sw.js` precaches a self-contained offline shell, the manifest and app icons. Only same-origin `/_next/static/` JavaScript, CSS, fonts and image files are added at runtime, with an 80-asset limit. API routes, non-GET requests, cross-origin calls, audio/video, range requests, query strings, RSC responses and live page HTML are excluded. Navigation tries the network and falls back to `/offline.html` on network failure. This offline screen explains that voice, text interviews, creation and feedback require a connection. Saved progress remains local but its normal page requires reconnection. Cache versions are owned by medBot; activation removes only older medBot caches. Updates wait for the previous worker's tabs to close, preserving active interviews.

## Layout review

CSS reasoning completed for **375×812** and **390×844**, portrait, with no screenshot claim. Browser automation is forbidden in this managed sandbox.

| Check | 375×812 | 390×844 |
| --- | --- | --- |
| Four bottom links | (375 − 16 padding − 12 gaps) / 4 = 86.75 px wide | (390 − 16 − 12) / 4 = 90.5 px wide |
| Bottom targets | 52 px tall; 12 px labels fit | Same |
| Home-indicator clearance | Nav height 52 + 8 + max(8, safe inset); body reserves 84 + safe inset | Same |
| Header | Desktop links hidden below 640 px; logo and level chip fit or wrap | Same |
| Main flow | Interview single column below 700 px; case grid and sidebar single column below 460 px | Same |
| Learning and review | Single-column learning grid; review ratings use two columns; new settings wrap | Same |
| New settings card | 343 px outer width; 309 px inner width | 358 px outer; 324 px inner |
| Touch controls | Mobile button/link minimum dimensions 44×44; form controls minimum height 44 | Same |

Evidence tables retain their own horizontal scrolling region. New fixed navigation has no fixed content height dependency and follows bottom/left/right safe-area insets. The existing sticky header follows the top inset. Dark browser chrome follows the existing background token; manifest launch colours use the light background and accent tokens. Zoom remains enabled.

## Browser acceptance (outside the sandbox)

Validation in this workspace: `npm run check` passed (21 test files, strict typecheck and production build); `git diff --check` and screenshot-script shell syntax passed. The build reports two existing dynamic-filesystem tracing warnings in `lib/server/leaderboard.ts`. The generated 180/192/512 px PNG sizes were checked and the maskable icon visually inspected. An HTTP smoke attempt was blocked before server startup by `listen EPERM` on localhost. No browser was launched and no screenshots were generated in the sandbox.

After `npm run check`, start `npm start`, then run:

```sh
node scripts/smoke-pwa.ts http://localhost:3000
MEDBOT_BROWSER_BIN=chromium bash scripts/capture-mobile-layouts.sh
```

Expected paths: `docs/review/mobile/{interview,learning,review,evidence,offline}-{375x812,390x844}.png`. These screenshots have **not** been generated here. Review the full scroll length manually, including the bottom settings panel and final interview controls. The script uses an isolated browser profile; it does not initiate interviews or call OpenAI.

On a real mobile browser:

1. Open `/learning`, install through the offered button or browser menu, then launch the installed app. Check icon, standalone display, colours and all four bottom links. Check the leaderboard remains accessible from Learning.
2. Wait for service-worker activation. In browser developer tools, go offline and reload `/`, `/learning` and `/learning/review`. Expect the offline explanation. Confirm no API/audio entries in Cache Storage. Reconnect and follow Try medBot again.
3. Enable the reminder explicitly. Set a time just before now with an unfinished daily goal; expect one notification within 30 seconds. Reopen and change the time: no second notification that day. Tap the notification to open Learning.
4. Turn reminders off and check no notification. With a completed interview or three reviews today, check reminders are suppressed. Deny notification permission and confirm the explanation remains usable. Check storage-blocked browsers show the storage message.
5. Try unsupported installation/notification browsers: no inert install button, instructions remain visible, and no automatic permission prompt. Confirm the app explicitly explains closed-app reminders are unavailable.

## Files by implementation unit

- Metadata and icons: `app/manifest.ts`, `app/layout.tsx`, `scripts/generate-pwa-icons.ts`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable.png`, `public/icons/apple-touch-icon.png`.
- Mobile navigation and touch sizing: `components/MobileNav.tsx`, `components/MobileNav.module.css`, `components/SiteHeader.module.css`, `app/globals.css` (mounted in `app/layout.tsx`).
- Installation, registration and reminders: `components/PwaClient.tsx`, `components/PwaClient.module.css`, `components/pwa-reminder.ts` (mounted in `app/layout.tsx`).
- Offline shell and cache: `public/sw.js`, `public/offline.html`.
- Verification: `tests/pwa-reminder.test.ts`, `tests/pwa-worker.test.ts`, `scripts/capture-mobile-layouts.sh`, `docs/mobile-pwa.md`.
- HTTP acceptance: `scripts/smoke-pwa.ts`.

No dependency, prompt, case, voice-agent file or shared contract changes are part of this unit. No commit or push.
