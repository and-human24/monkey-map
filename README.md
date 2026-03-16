# Monkey Map

A FigJam-inspired mind-mapping tool that runs as a CLI server in the browser or as a native Tauri desktop app. Built for both human use and AI agent integration -- agents can programmatically generate mind maps using the included Claude Code skill.

## Features

- Three node types: mind map, shapes (box/diamond/ellipse/circle/triangle), sticky notes
- Bendable edges with bezier, smoothstep, and straight styles
- Edge labels, colors, stroke widths, and animation
- Detail panel -- click any node to view/edit rich details in a side drawer
- Node formatting: colors, bold, strikethrough, font size
- Auto-layout (Dagre), flow templates, edit/read modes
- Auto-save with live file watching for external edits
- Light/dark theme, recent projects, project rename

## Quick Start

### CLI Mode

```bash
pnpm install && pnpm build
monkey-map -f my-project.json
```

Opens `http://localhost:3141`. Flags: `-p <port>`, `--no-open`.

### Desktop App

```bash
cd web && pnpm install && pnpm tauri build
```

Output in `web/src-tauri/target/release/bundle/`.

### Development

```bash
pnpm dev -- -f test.json          # CLI with hot reload
cd web && pnpm tauri dev           # Desktop dev mode
pnpm test:all                      # All tests
```

## AI Agent Integration

Monkey Map includes a [Claude Code](https://claude.ai/claude-code) skill that lets AI agents generate mind maps from natural language. The skill handles file format, node layout, color semantics, and opening the result.

Install it:

```bash
cp -r skills/mind-map ~/.claude/skills/mind-map
```

Then use `/mind-map` in Claude Code:

```
> /mind-map Show me the architecture of this project
> /mind-map Create a pipeline diagram for our CI/CD flow
> /mind-map Audit this codebase and visualize the findings
```

See `skills/mind-map/SKILL.md` for the full file format spec, node types, color palette, and design guidelines.

### REST API (CLI mode)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/mindmap` | Read mindmap |
| `POST` | `/api/mindmap` | Write mindmap (full replace) |
| `GET/POST/DELETE` | `/api/flows[/:name]` | Flow template CRUD |

WebSocket on the same port broadcasts file change events.

## Architecture

```
src/              CLI server (Express + WebSocket + Commander)
web/src/          React frontend (Canvas, Toolbar, DetailPanel, DraggableEdge, FlowPicker)
web/src-tauri/    Tauri desktop backend (Rust: file I/O, path validation, file watcher)
skills/mind-map/  Claude Code skill for AI-generated mind maps
```

Both modes share the same React frontend. CLI serves it via Express with WebSocket sync. Tauri uses Rust commands and native file watchers.

## Security

- Path validation rejects traversal (`..`) and restricts to home directory
- CSP: `script-src 'self'` in both Tauri config and Express headers
- CORS + WebSocket origin restricted to localhost
- Zero `unsafe` Rust, scoped FS permissions, input validation on all endpoints
- Error messages never leak internal paths or stack traces

## Tech Stack

React 19, TypeScript 5.8, React Flow 12.6, Dagre 2.0 | Express 5, WebSocket, Chokidar | Tauri 2.10 (Rust) | Vite 6.3, tsup, pnpm | Vitest 3.1

## License

MIT
