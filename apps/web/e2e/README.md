# Web e2e (Playwright)

Smoke suite for the web app against a fake Transmission daemon. Uses Playwright's own Chromium (`npx playwright install chromium` once); never the user's browser.

- Run: `npm run test:e2e`. It starts the fake daemon (port 19091) and `npm run dev:web` (port 3199) itself, with `SEEDORA_ALLOW_PRIVATE_HOSTS=true` and `SEEDORA_ALLOWED_HOSTS=127.0.0.1:19091` (the dev server is bound to loopback with `-H 127.0.0.1`). It is not part of `npm test`.
- Fake daemon alone, for manual verification: `node --no-warnings apps/web/e2e/fake-transmission.ts` (`FAKE_DAEMON_PORT` to change the port), then start the web app with the two env vars above and add a server `127.0.0.1:19091` (no auth). It serves two torrents and handles `session-get`, `torrent-get`, `torrent-add`, `torrent-remove`, `torrent-start`/`-stop`, `free-space`.
- Ports can be changed with `E2E_WEB_PORT` and `FAKE_DAEMON_PORT`.
