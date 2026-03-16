---
name: mind-map
description: Use when user asks to create, visualize, or update a mind map, architecture diagram, or relationship diagram for any project or topic.
user_invocable: true
---

# Mind Map

Generate `.{name}.monkeymap.json` (dotfile, name derived from topic) and open in Monkey Map. Examples: `.architecture.monkeymap.json`, `.pipeline.monkeymap.json`. Multiple maps per project are supported.

## Cardinal Rule

Nodes are short labels (3-6 words). All substance goes in `data.details` -- users click a node to read details in a side panel. A 1000-line doc should produce 15-25 nodes with rich details per node.

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

Every node can have `details` -- this is where the real content lives:

```json
{
  "id": "s2",
  "type": "shape",
  "position": { "x": 400, "y": 160 },
  "data": {
    "label": "Resolve PMIDs",
    "shape": "box",
    "color": "#dc2626",
    "details": "Map 18 trial names to PubMed IDs via E-utilities, CrossRef, OpenAlex.\n\nStatus: SKIPPED entirely. No trial names resolved.\n\nWhy it matters: Steps 3-4 need PMIDs to find and download trial papers. Without this, extraction reads from the MA paper itself (circular)."
  }
}
```

**Label:** 3-6 words, what the node IS.
**Details:** Multi-line, what the user needs to know. Use `\n` for line breaks. Can include status, context, gaps, links, decisions. No length limit but keep it focused.

## Colors

**Nodes:** green `#16a34a` = done, red `#dc2626` = failed/blocked, yellow `#ca8a04` = partial, indigo `#4f46e5` = structural, purple `#9333ea` = conceptual, cyan `#0891b2` = data, pink `#e11d48` = edge cases

**Notes:** `#fef9c3` = context, `#fecaca` = problem, `#dbeafe` = insight, `#dcfce7` = verified

## Edges

- Flow (step->step): `straight` with `markerEnd: { type: "arrowclosed", width: 16, height: 16 }`
- Hierarchy (parent->child): `default` with arrow
- Annotation (node->note): `default`, NO arrow

## Full File Structure

```json
{
  "meta": {
    "title": "Diagram Title",
    "created": "2026-03-16T00:00:00.000Z",
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  },
  "nodes": [
    {
      "id": "unique-id",
      "type": "mindmap | shape | note",
      "position": { "x": 0, "y": 0 },
      "data": {
        "label": "Short Label",
        "details": "Rich details shown in side panel",
        "color": "#hex",
        "shape": "box | diamond | ellipse | triangle",
        "bold": true,
        "fontSize": "small | normal"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-id",
      "source": "node-id",
      "target": "node-id",
      "type": "default | straight",
      "markerEnd": { "type": "arrowclosed", "width": 16, "height": 16 }
    }
  ]
}
```

## Writing the File

Use Bash heredoc (NOT Write tool):
```bash
cat > .topic-name.monkeymap.json << 'MONKEYMAP_EOF'
{ ... }
MONKEYMAP_EOF
```

For 40+ nodes, generate with `node -e` programmatically.

## Opening

```bash
open -a "Monkey Map" "$(pwd)/.topic-name.monkeymap.json"  # desktop app (macOS)
monkey-map --file .topic-name.monkeymap.json               # CLI fallback (any OS)
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

## Updating Existing Maps

Read first. Merge new nodes. Preserve user positions. Write back.
