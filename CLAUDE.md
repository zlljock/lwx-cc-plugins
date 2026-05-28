# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Claude Code plugin marketplace repository (`zlljock-lwx-cc-plugins`) containing MCP (Model Context Protocol) server plugins. Plugins are registered in `marketplace.json` at the repo root and each lives under `plugins/<name>/`.

## Architecture

- **`marketplace.json`** — Plugin registry. Each entry has `name`, `description`, and `path` pointing to a plugin directory.
- **`plugins/<name>/`** — Each plugin is a standalone Node.js MCP server with:
  - `plugin.json` — Plugin metadata and MCP launch config (`command` + `args`)
  - `package.json` — npm dependencies (ES modules via `"type": "module"`)
  - `server.js` — MCP server implementation using `@modelcontextprotocol/sdk`

## Commands

```bash
# Install dependencies for a plugin
cd plugins/<name> && npm install

# Run a plugin server directly (uses stdio transport)
cd plugins/<name> && node server.js
```

## Plugin Development

Plugins use `@modelcontextprotocol/sdk` with `StdioServerTransport`. A plugin registers tools via `tools/list` and handles invocations via `tools/call`. Environment variables are used for connection config (e.g., `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` for the mysql-reader plugin).

When adding a new plugin:
1. Create `plugins/<name>/` with `server.js`, `plugin.json`, and `package.json`
2. Register it in `marketplace.json`
