import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  type Viewport,
  type NodeTypes,
  type EdgeTypes,
  type NodeProps,
  Handle,
  Position,
  useReactFlow,
  ConnectionMode,
  SelectionMode,
  MarkerType,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { ShapeType } from '../types'
import DraggableEdge from './DraggableEdge'
import { NODE_COLORS } from '../constants'

const safeColor = (c?: string) => c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : undefined

interface MindMapNodeData extends Record<string, unknown> {
  label: string
  color?: string
  bold?: boolean
  strikethrough?: boolean
  fontSize?: string
  details?: string
}

interface ShapeNodeData extends Record<string, unknown> {
  label: string
  color?: string
  shape: ShapeType
  bold?: boolean
  strikethrough?: boolean
  fontSize?: string
  details?: string
}

function FormatToolbar({ id, data }: { id: string; data: { bold?: boolean; strikethrough?: boolean; fontSize?: string } }) {
  return (
    <div className="format-toolbar">
      <button
        className={`format-btn ${data.bold ? 'active' : ''}`}
        onMouseDown={(e) => {
          e.stopPropagation()
          window.dispatchEvent(new CustomEvent('node-style-update', { detail: { id, bold: !data.bold } }))
        }}
      >
        B
      </button>
      <button
        className={`format-btn ${data.strikethrough ? 'active' : ''}`}
        onMouseDown={(e) => {
          e.stopPropagation()
          window.dispatchEvent(new CustomEvent('node-style-update', { detail: { id, strikethrough: !data.strikethrough } }))
        }}
        style={{ textDecoration: 'line-through' }}
      >
        S
      </button>
      <span className="format-sep" />
      <select
        className="format-select"
        value={data.fontSize || 'medium'}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          window.dispatchEvent(new CustomEvent('node-style-update', { detail: { id, fontSize: e.target.value } }))
        }}
      >
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
      </select>
    </div>
  )
}

function getLabelStyle(data: { bold?: boolean; strikethrough?: boolean; fontSize?: string }): React.CSSProperties {
  return {
    fontWeight: data.bold ? 700 : 400,
    textDecoration: data.strikethrough ? 'line-through' : 'none',
    fontSize: data.fontSize === 'small' ? 12 : data.fontSize === 'large' ? 20 : 14,
  }
}

function MindMapNode({ id, data }: NodeProps<Node<MindMapNodeData>>) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(data.label)
  const inputRef = useRef<HTMLInputElement>(null)

  const style = safeColor(data.color) ? { borderLeftColor: safeColor(data.color), borderLeftWidth: 3 } : undefined
  const labelStyle = getLabelStyle(data)

  const handleDoubleClick = () => {
    setEditing(true)
    setValue(data.label)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commit = () => {
    setEditing(false)
    if (value.trim() && value !== data.label) {
      window.dispatchEvent(new CustomEvent('node-label-update', { detail: { id, label: value.trim() } }))
    }
  }

  return (
    <div className="node-editor" style={style}>
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Left} id="left" />
      {editing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          maxLength={500}
          style={labelStyle}
          autoFocus
        />
      ) : (
        <div className="node-label" onDoubleClick={handleDoubleClick} style={labelStyle}>
          {data.label}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="target" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="target" position={Position.Right} id="right" />
    </div>
  )
}

function ShapeNode({ id, data }: NodeProps<Node<ShapeNodeData>>) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(data.label)
  const inputRef = useRef<HTMLInputElement>(null)
  const shape = data.shape || 'box'
  const labelStyle = getLabelStyle(data)

  const handleDoubleClick = () => {
    setEditing(true)
    setValue(data.label)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const commit = () => {
    setEditing(false)
    if (value.trim() && value !== data.label) {
      window.dispatchEvent(new CustomEvent('node-label-update', { detail: { id, label: value.trim() } }))
    }
  }

  const colorStyle = safeColor(data.color) ? { borderColor: safeColor(data.color) } : {}

  const className = `shape-node shape-${shape}`

  return (
    <div className={className} style={colorStyle}>
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Left} id="left" />
      {editing ? (
        <input
          ref={inputRef}
          className="shape-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          maxLength={500}
          style={labelStyle}
          autoFocus
        />
      ) : (
        <div className="shape-label" onDoubleClick={handleDoubleClick} style={labelStyle}>
          {data.label}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="target" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="target" position={Position.Right} id="right" />
    </div>
  )
}

function ColorPicker({ nodeId, currentColor }: { nodeId: string; currentColor?: string }) {
  return (
    <div
      className="color-picker"
      style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8 }}
    >
      <div
        className={`color-swatch ${!currentColor ? 'active' : ''}`}
        style={{ background: '#999' }}
        title="Default"
        onClick={() => window.dispatchEvent(new CustomEvent('node-color-update', { detail: { id: nodeId, color: undefined } }))}
      />
      {NODE_COLORS.map((color) => (
        <div
          key={color}
          className={`color-swatch ${currentColor === color ? 'active' : ''}`}
          style={{ background: color }}
          onClick={() => window.dispatchEvent(new CustomEvent('node-color-update', { detail: { id: nodeId, color } }))}
        />
      ))}
    </div>
  )
}

interface NoteNodeData extends Record<string, unknown> {
  label: string
  color?: string
  width?: number
  height?: number
  bold?: boolean
  strikethrough?: boolean
  fontSize?: string
  details?: string
}

function NoteNode({ id, data }: NodeProps<Node<NoteNodeData>>) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(data.label)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const nodeRef = useRef<HTMLDivElement>(null)

  const handleDoubleClick = () => {
    setEditing(true)
    setValue(data.label)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const commit = () => {
    setEditing(false)
    if (value !== data.label) {
      window.dispatchEvent(new CustomEvent('node-label-update', { detail: { id, label: value } }))
    }
  }

  const bgColor = safeColor(data.color) || '#fef9c3'
  const labelStyle = getLabelStyle(data)

  return (
    <div
      ref={nodeRef}
      className="note-node"
      style={{
        backgroundColor: bgColor,
        width: data.width || 200,
        minHeight: data.height || 150,
      }}
    >
      <Handle type="source" position={Position.Top} id="top" />
      <Handle type="target" position={Position.Top} id="top" />
      <Handle type="source" position={Position.Left} id="left" />
      <Handle type="target" position={Position.Left} id="left" />
      {editing ? (
        <textarea
          ref={textareaRef}
          className="note-textarea nodrag nowheel"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setEditing(false); return }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          maxLength={2000}
          style={labelStyle}
          autoFocus
        />
      ) : (
        <div className="note-content" onDoubleClick={handleDoubleClick} style={labelStyle}>
          {data.label || 'Double-click to edit...'}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="target" position={Position.Bottom} id="bottom" />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="target" position={Position.Right} id="right" />
    </div>
  )
}

const nodeTypes: NodeTypes = {
  mindmap: MindMapNode,
  shape: ShapeNode,
  note: NoteNode,
}

const edgeTypes: EdgeTypes = {
  straight: DraggableEdge,
  default: DraggableEdge,
  smoothstep: DraggableEdge,
}

interface CanvasProps {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  onAddNode: (x: number, y: number, type?: string, shape?: string) => void
  onUpdateNodeLabel: (id: string, label: string) => void
  onUpdateNodeColor: (id: string, color: string | undefined) => void
  onUpdateNodeStyle: (id: string, style: Record<string, unknown>) => void
  onUpdateNodeDetails: (id: string, details: string) => void
  onSaveEdges: () => void
  viewport: Viewport
  onViewportChange: (viewport: Viewport) => void
  activeTool: string | null
  onToolUsed: () => void
  edgeStyle: string
  fitViewFlag: number
  viewMode: 'edit' | 'read'
}

export default function Canvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onAddNode,
  onUpdateNodeLabel,
  onUpdateNodeColor,
  onUpdateNodeStyle,
  onUpdateNodeDetails,
  onSaveEdges,
  viewport,
  onViewportChange,
  activeTool,
  onToolUsed,
  edgeStyle,
  fitViewFlag,
  viewMode,
}: CanvasProps) {
  const reactFlow = useReactFlow()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (fitViewFlag > 0) {
      setTimeout(() => reactFlow.fitView({ padding: 0.2, duration: 300 }), 50)
    }
  }, [fitViewFlag, reactFlow])

  // Replace CSS transform scale() with CSS zoom for crisp rendering at all zoom levels.
  // CSS transform: scale() rasterizes content at 1x then scales the bitmap (blurry).
  // CSS zoom re-renders content at the target size (crisp text/borders).
  //
  // Original: translate(tx, ty) scale(z) → point (fx,fy) at (fx*z+tx, fy*z+ty)
  // With zoom: translate(tx/z, ty/z) scale(1) + zoom:z → same visual position
  // The translate must be divided by z to compensate for zoom scaling it back up.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const vp = container.querySelector('.react-flow__viewport') as HTMLElement
    if (!vp) return

    let applying = false
    const observer = new MutationObserver(() => {
      if (applying) return
      const t = vp.style.transform
      const scaleMatch = t.match(/scale\(([^)]+)\)/)
      if (!scaleMatch) return
      const z = parseFloat(scaleMatch[1])
      if (isNaN(z) || z === 0) return

      const translateMatch = t.match(/translate\(([^,]+),\s*([^)]+)\)/)
      if (!translateMatch) return
      const tx = parseFloat(translateMatch[1])
      const ty = parseFloat(translateMatch[2])
      if (isNaN(tx) || isNaN(ty)) return

      // Skip if already at scale(1) — avoid infinite loop
      if (Math.abs(z - 1) < 0.0001) {
        // Still maintain zoom from previous state if needed
        return
      }

      applying = true
      vp.style.transform = `translate(${tx / z}px, ${ty / z}px) scale(1)`
      vp.style.zoom = String(z)
      applying = false
    })

    observer.observe(vp, { attributes: true, attributeFilter: ['style'] })
    return () => observer.disconnect()
  }, [])

  // listen for custom events from nodes
  const handleLabelUpdate = useCallback(
    (e: Event) => {
      const { id, label } = (e as CustomEvent).detail
      onUpdateNodeLabel(id, label)
    },
    [onUpdateNodeLabel],
  )

  const handleColorUpdate = useCallback(
    (e: Event) => {
      const { id, color } = (e as CustomEvent).detail
      onUpdateNodeColor(id, color)
    },
    [onUpdateNodeColor],
  )

  const handleStyleUpdate = useCallback(
    (e: Event) => {
      const { id, ...style } = (e as CustomEvent).detail
      onUpdateNodeStyle(id, style)
    },
    [onUpdateNodeStyle],
  )

  const handleDetailsUpdate = useCallback(
    (e: Event) => {
      const { id, details } = (e as CustomEvent).detail
      onUpdateNodeDetails(id, details)
    },
    [onUpdateNodeDetails],
  )

  const handleEdgeBendCommit = useCallback(() => {
    onSaveEdges()
  }, [onSaveEdges])

  useEffect(() => {
    window.addEventListener('node-label-update', handleLabelUpdate)
    window.addEventListener('node-color-update', handleColorUpdate)
    window.addEventListener('node-style-update', handleStyleUpdate)
    window.addEventListener('node-details-update', handleDetailsUpdate)
    window.addEventListener('edge-bend-commit', handleEdgeBendCommit)
    return () => {
      window.removeEventListener('node-label-update', handleLabelUpdate)
      window.removeEventListener('node-color-update', handleColorUpdate)
      window.removeEventListener('node-style-update', handleStyleUpdate)
      window.removeEventListener('node-details-update', handleDetailsUpdate)
      window.removeEventListener('edge-bend-commit', handleEdgeBendCommit)
    }
  }, [handleLabelUpdate, handleColorUpdate, handleStyleUpdate, handleDetailsUpdate, handleEdgeBendCommit])

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      const bounds = (event.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect()
      if (!bounds) return
      const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY })

      if (activeTool) {
        // place shape node
        onAddNode(position.x, position.y, 'shape', activeTool)
        onToolUsed()
        return
      }

      // default: double-click to add mindmap node
      if (event.detail === 2) {
        onAddNode(position.x, position.y)
      }
    },
    [reactFlow, onAddNode, activeTool, onToolUsed],
  )

  const selectedKey = nodes.filter(n => n.selected).map(n => n.id).sort().join(',')
  const highlightedEdges = useMemo(() => {
    const selected = new Set(selectedKey.split(',').filter(Boolean))
    return edges.map(e => {
      const connected = selected.has(e.source) || selected.has(e.target)
      if (!connected) return e
      return { ...e, data: { ...((e.data as object) || {}), highlighted: true } }
    })
  }, [edges, selectedKey])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={highlightedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={viewMode === 'read' ? undefined : onEdgesChange}
        onConnect={viewMode === 'read' ? undefined : onConnect}
        onPaneClick={viewMode === 'read' ? undefined : onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={viewport}
        onMoveEnd={(_, vp) => onViewportChange(vp)}
        fitView={!viewport.zoom || viewport.zoom === 1}
        deleteKeyCode={viewMode === 'read' ? null : 'Backspace'}
        connectionMode={ConnectionMode.Loose}
        panOnDrag
        nodesDraggable={viewMode === 'edit'}
        nodesConnectable={viewMode === 'edit'}
        elementsSelectable
        selectionMode={SelectionMode.Partial}
        snapToGrid={viewMode === 'edit'}
        snapGrid={[20, 20]}
        minZoom={0.1}
        edgesFocusable
        proOptions={{ hideAttribution: true }}
        connectionLineStyle={{ stroke: 'var(--accent)', strokeWidth: 2 }}
        defaultEdgeOptions={{ type: edgeStyle, markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 } }}
      >
        <Background variant={BackgroundVariant.Lines} gap={20} color="var(--grid)" lineWidth={1} />
        <Controls />
      </ReactFlow>
    </div>
  )
}
