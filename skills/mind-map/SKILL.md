---
name: mind-map
description: Use when user asks to create, visualize, or update a mind map, architecture diagram, or relationship diagram for any project or topic.
user_invocable: true
---

# Mind Map

Generate `.{name}.monkeymap/` folder (dotfile, name derived from topic) and open in Monkey Map. Examples: `.architecture.monkeymap/`, `.pipeline.monkeymap/`. Multiple maps per project are supported.

## Cardinal Rule

Nodes are short labels (3-6 words). All substance goes in node detail files (`nodes/{id}.md`) -- users click a node to read details in a side panel. A 1000-line doc should produce 15-25 nodes with rich details per node.

## Before You Start

Read the source. Identify the dominant pattern:

| Pattern | Spine | Edge style |
|---------|-------|------------|
| Process flow (pipeline, workflow) | Linear chain: step->step | `straight` |
| Hierarchy (tree, taxonomy, features) | Root fans out to children | `default` (bezier) |
| Dashboard (status, audit, tracking) | Grouped regions side by side | `default` |

Pipeline steps chain sequentially -- do NOT connect all steps back to a hub.

## Node Types

| Use | Type | Config |
|-----|------|--------|
| Process step | `shape` | `shape: "box"` |
| Section header | `mindmap` | `bold: true` |
| Leaf/data point | `mindmap` | `fontSize: "small"` |
| Key metric | `shape` | `shape: "ellipse"` |
| Decision point | `shape` | `shape: "diamond"` |
| Annotation (max 3-4 per map) | `note` | 1 sentence, use sparingly |

## Node Data

In the manifest, nodes have `hasDetails: true` instead of inline details. Details live in `nodes/{id}.md`.

**Label:** 3-6 words, what the node IS.
**Details (in .md file):** Multi-line markdown. Can include status, context, gaps, links, decisions. No length limit but keep it focused.

## Colors

**Nodes:** green `#16a34a` = done, red `#dc2626` = failed/blocked, yellow `#ca8a04` = partial, indigo `#4f46e5` = structural, purple `#9333ea` = conceptual, cyan `#0891b2` = data, pink `#e11d48` = edge cases

**Notes:** `#fef9c3` = context, `#fecaca` = problem, `#dbeafe` = insight, `#dcfce7` = verified

## Edges

- Flow (step->step): `straight` with `markerEnd: { type: "arrowclosed", width: 16, height: 16 }`
- Hierarchy (parent->child): `default` with arrow
- Annotation (node->note): `default`, NO arrow

## Edge Handle Semantics

- sourceHandle/targetHandle: "top" | "bottom" | "left" | "right"
- Vertical (top/bottom handles) = hierarchy (parent-child)
- Horizontal (left/right handles) = association (peer/lateral)
- Default: sourceHandle="bottom", targetHandle="top" (parent->child)

## Folder Structure (v2)

```
.topic-name.monkeymap/
  manifest.json     # app-facing: meta + nodes (no details) + edges
  map.md            # agent-facing: text tree of mind map structure
  nodes/
    {uuid}.md       # plain markdown details (only for nodes with content)
```

## Writing a New Map

```bash
# Create project folder
mkdir -p .topic-name.monkeymap/nodes

# Write manifest (nodes WITHOUT details, hasDetails flag instead)
cat > .topic-name.monkeymap/manifest.json << 'MANIFEST_EOF'
{
  "version": 2,
  "meta": {
    "title": "Diagram Title",
    "created": "2026-03-16T00:00:00.000Z",
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  },
  "nodes": [
    {
      "id": "uuid1",
      "type": "mindmap",
      "position": { "x": 250, "y": 250 },
      "data": { "label": "Root Topic", "color": "#4f46e5", "hasDetails": true }
    }
  ],
  "edges": []
}
MANIFEST_EOF

# Write node details as individual markdown files
cat > .topic-name.monkeymap/nodes/uuid1.md << 'EOF'
Details content here in plain markdown.

Can include multiple paragraphs, lists, code blocks, etc.
EOF

# Generate map.md (text tree for navigation)
cat > .topic-name.monkeymap/map.md << 'EOF'
# Diagram Title

- Root Topic [uuid1]
  - Child Node [uuid2]
  ~ Associated Node [uuid3]
EOF
```

For 40+ nodes, generate with `node -e` programmatically.

## map.md Format

Auto-generated tree showing hierarchy and associations:
- Indented `-` items = children (vertical connections)
- `~` items = associations (horizontal connections)
- `[uuid]` after label = node ID, matches filename in `nodes/`
- Disconnected nodes listed under "Unlinked" section

## Reading an Existing Map

1. Read `map.md` to understand structure and find target nodes
2. Read specific `nodes/{id}.md` for details
3. Never need to parse `manifest.json` (that's for the app)

## Updating Existing Maps

1. Read `map.md` to understand current structure
2. To update node details: edit `nodes/{id}.md` directly
3. To add/remove/reposition nodes: read `manifest.json`, modify, write back
4. After structural changes: regenerate `map.md`
5. Preserve user positions in manifest when adding nodes

## Opening

```bash
open -a "Monkey Map" "$(pwd)/.topic-name.monkeymap"  # desktop app (macOS)
monkey-map --file .topic-name.monkeymap               # CLI fallback (any OS)
```

## Flow Templates

Save reusable node/edge arrangements as flow templates:

```bash
# Via CLI API
curl -X POST http://localhost:3141/api/flows \
  -H "Content-Type: application/json" \
  -d '{"name": "My Template", "nodes": [...], "edges": [...]}'

# List saved flows
curl http://localhost:3141/api/flows
```

In the desktop app, select nodes and use the Flow Picker to save/load templates.
