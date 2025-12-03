# Chrome DevTools MCP notes

- MCP server does not use `--port` for MCP; key flags are `--browserUrl`/`--wsEndpoint`, `--headless`, `--isolated`, `--logFile`, and optional `--chrome-arg`.
- Current working config (Codex `~/.codex/config.toml`): `command = "chrome-devtools-mcp"` with args `["--browserUrl", "http://127.0.0.1:9222", "--headless", "--isolated", "--logFile", "/tmp/chrome-mcp.log"]`. Add `--chrome-arg=--no-sandbox` and `--chrome-arg=--disable-setuid-sandbox` if sandbox issues appear.
- Start a debuggable Chromium instance before the MCP server: `chromium --headless=new --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-profile-stable` and verify with `curl http://127.0.0.1:9222/json/version`.
- The server tries to launch Chrome with profile `~/.cache/chrome-devtools-mcp/chrome-profile`; use `--isolated` to avoid profile-lock errors when another Chrome/Chromium is running.
- If Codex tool calls return “Transport closed,” restart the Codex session so it reloads the MCP args, then retry `chrome-devtools/list_pages`. Inspect `/tmp/chrome-mcp.log` for puppeteer launch errors.
- Manual sanity check: `chrome-devtools-mcp --browserUrl http://127.0.0.1:9222 --headless --isolated --logFile /tmp/chrome-mcp.log` should stay running (stdout shows “Chrome DevTools MCP Server connected”).
