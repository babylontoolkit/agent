# Babylon Toolkit Image And Video MCP Servers

* When asked to create or install `Babylon Toolkit MCP Servers` or `KIE MCP Servers` or `Image MCP Servers` or something like that, create or append to `.mcp.json` the following `KIE MCP Servers`: 
```
{
  "mcpServers": {
    "kie-image": {
      "command": "kie-image-mcp",
      "args": ["image"]
    },
    "kie-video": {
      "command": "kie-image-mcp",
      "args": ["video"]
    },
    "kie-google": {
      "command": "kie-image-mcp",
      "args": ["google"]
    }
  }
}
```

## Node Package Dependencies 

Make sure the `kie-image-mcp` node package is installed:
```
npm install -g kie-image-mcp@latest
```

# kie-image-mcp

Tiny, **zero-runtime-dependency** [MCP](https://modelcontextprotocol.io) servers for
[kie.ai](https://kie.ai) generation — **one npm package, three servers**, selected by a
subcommand:

| Subcommand | Server | Tool | Models |
|---|---|---|---|
| `image` (default) | kie-image | `generate_image` | Nano Banana 2, Imagen 4, Seedream, Flux-2, Qwen, … |
| `video` | kie-video | `generate_video` | Kling, Bytedance Seedance, Grok Imagine |
| `google` | kie-google | `generate_google_video` | Google Veo 3.1 (`veo3` / `veo3_fast` / `veo3_lite`) |

Because MCP is an open protocol, the same package works from **Claude Code, GitHub
Copilot Chat (VS Code), Cursor, Windsurf, Zed**, and any other MCP client — one package,
every AI. Built with only Node built-ins (`fetch`, `fs`, `readline`), so it pulls no
transitive packages. Requires **Node 18+**.

The command takes one subcommand to pick the server (defaults to `image`):
```
kie-image-mcp image     # or: video | google   (no arg = image)
```

## Get an API key
Set your kie.ai key as `KIE_KEY` (or `KIE_AI_API_KEY`), or put `KIE_KEY=...` in a `.env`
file in your working directory. See `.env.example`. All three servers share the one key.

## Install (global)
Install once so the `kie-image-mcp` command is on your PATH:
```
npm install -g kie-image-mcp            # from npm once published
# or, from a local clone (the prepare script builds it for you):
cd kie-image-mcp && npm install -g .
```
Verify and update:
```
which kie-image-mcp                     # confirm it's on PATH
npm install -g kie-image-mcp@latest     # update to a newer version
```

> **nvm users:** the global bin is tied to the active Node version (e.g.
> `~/.nvm/versions/node/vXX/bin/kie-image-mcp`). If you switch Node versions, reinstall
> for that version. If your MCP client is a GUI app that doesn't inherit your shell PATH,
> use the absolute bin path (from `which kie-image-mcp`) in the config.

## Configure (any MCP client)

Register one entry per server you want; the subcommand goes in `args`. `KIE_KEY` is read
from your environment or a `.env` file (add `"env": { "KIE_KEY": "..." }` to an entry to
set it inline).

### Claude Code
Add to your project `.mcp.json` (or user `~/.claude.json`):
```json
{
  "mcpServers": {
    "kie-image":  { "command": "kie-image-mcp", "args": ["image"] },
    "kie-video":  { "command": "kie-image-mcp", "args": ["video"] },
    "kie-google": { "command": "kie-image-mcp", "args": ["google"] }
  }
}
```
GUI-PATH fallback — use the absolute bin path from `which kie-image-mcp`:
```json
{ "mcpServers": { "kie-image": { "command": "/Users/you/.nvm/versions/node/v24.11.0/bin/kie-image-mcp", "args": ["image"] } } }
```

### GitHub Copilot Chat (VS Code)
`.vscode/mcp.json`:
```json
{
  "servers": {
    "kie-image":  { "command": "kie-image-mcp", "args": ["image"] },
    "kie-video":  { "command": "kie-image-mcp", "args": ["video"] },
    "kie-google": { "command": "kie-image-mcp", "args": ["google"] }
  }
}
```

### Cursor / Windsurf / Zed / generic
Same shape under the client's `mcpServers` key, using the `kie-image-mcp` command.
