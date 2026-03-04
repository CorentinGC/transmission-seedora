After any UI change (component, style, layout modification), you MUST verify the result visually using the Chrome DevTools MCP:

1. Take a screenshot with `mcp__chrome-devtools__take_screenshot` to verify the visual result
2. If a modal/dialog/dropdown was modified, open it first by clicking the relevant button with `mcp__chrome-devtools__click`, then screenshot
3. If there are console errors, check with `mcp__chrome-devtools__list_console_messages`
4. If something looks wrong, investigate with `mcp__chrome-devtools__evaluate_script` or `mcp__chrome-devtools__take_snapshot`

The app runs on `http://localhost:5173/` via Electron with `--remote-debugging-port=9222`.

Always report what you see in the screenshot to the user.
