# Security policy

## Supported versions

Only the latest release receives security fixes. The latest published version is listed on the [releases page](https://github.com/CorentinGC/transmission-seedora/releases); the code is on the `main` branch. Older releases are not patched. The hosted web app at [seedora.app](https://www.seedora.app/) always runs the current code.

## Reporting a vulnerability

Report privately. **Do not open a public issue, pull request or discussion for a vulnerability.**

1. Open the [Security tab](https://github.com/CorentinGC/transmission-seedora/security) of the repository and choose **Report a vulnerability** (GitHub private vulnerability reporting).
2. Describe the problem, the affected component (Electron app, web app, which file or feature), the steps to reproduce, and the impact you expect. Do not include real credentials or the address of a daemon you do not own.

This is a volunteer-maintained project. You can expect an acknowledgement, but no guaranteed response time. Please allow time for a fix before disclosing publicly.

If the Security tab does not offer private reporting, open a public issue that says only that you need a private channel to report a security problem, with no details, and a maintainer will respond.

## Scope

In scope:

- The desktop app (`src/`), the web app (`apps/web`) and the shared UI (`packages/shared`).
- The hosted web app at seedora.app.
- The release workflow and published installers.

Out of scope:

- Vulnerabilities in Transmission itself: report them to the [Transmission project](https://github.com/transmission/transmission).
- Findings that need an attacker who already controls the user's machine or the user's Transmission daemon.
- The `script-torrent-*` daemon options exposed in the settings UI: this is by design, because anyone with a server's credentials can already set them through Transmission's RPC.
- The localhost development certificate that was committed earlier to the repository history: it protects nothing but local development.

## Known gaps

Some weaknesses are already known, confirmed and scheduled for fixing, so a report that only restates one of them adds little. They are listed in [docs/security.md](docs/security.md) under "Known gaps", with the intended fix for each. Progress is tracked in the beads backlog (`.beads/issues.jsonl`). Other known limitations: desktop builds are unsigned and not notarized, and there is no auto-update.

Because some of these gaps affect the hosted web app, avoid entering credentials of a daemon exposed to the internet that you cannot afford to have compromised until they are fixed.

## Security model

Trust boundaries and the rules every change must follow are in [docs/security.md](docs/security.md).
