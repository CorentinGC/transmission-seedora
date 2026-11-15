---
name: verify-ui
description: Visually verify a UI change in the running app. Use after ANY change to a component, style, layout, dialog, menu or theme token in packages/shared, src/renderer or apps/web — before reporting the change as done.
---

# UI verification

A UI change is not done until it has been seen in the running app. Type-checks and tests do not prove a dialog renders.

## Running the apps

The main session starts the servers in the background and stops them afterwards. A subagent never starts them: if the one you need is not running, report it to the main session. Commands:

| App | User runs | MCP server to use | URL |
|-----|-----------|-------------------|-----|
| Electron | `npm run start:debug` | `chrome-devtools` (attaches to `127.0.0.1:9222`) | renderer at `http://localhost:5173/` |
| Web | `npm run dev:web` (or `dev:web:https`) | `chrome-devtools-web` (isolated browser, accepts self-signed certs) | the URL printed by Next, usually `http://localhost:3000/` |

The UI is shared (`packages/shared`), so a change there must be checked in **both** apps unless it is behind a platform capability only one of them has.

## Steps

1. `list_pages` / `select_page` to target the right window, or `navigate_page` on the web server.
2. Reach the state you changed: for a dialog, dropdown, context menu or popover, trigger it first (`click`, right-click via `evaluate_script` if needed).
3. `take_screenshot` and look at it. Describe what you actually see.
4. `list_console_messages` — no new errors or warnings.
5. Check both themes (light and dark) when colours, borders or shadows are involved.
6. Keyboard pass for anything interactive: Tab order, focus visible, Enter/Space activate, Escape closes, focus returns to the trigger.
7. Web only: `resize_page` to 375, 768 and 1440 px wide.
8. If something looks off, inspect with `take_snapshot` (accessibility tree) or `evaluate_script` (computed styles, DOM).

## Report

State what was checked (app, theme, viewport), what you saw, and anything that does not match the intent. If you could not verify because a server was not running, say so explicitly — do not present the change as verified.
