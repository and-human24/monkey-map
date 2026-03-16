import { useCallback, useRef } from 'react'
import { BaseEdge, EdgeLabelRenderer, type EdgeProps, useReactFlow } from '@xyflow/react'

interface BendPoint { x: number; y: number }

function getPath(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  bend?: BendPoint,
  edgeType?: string,
): string {
  if (!bend) {
    if (edgeType === 'straight') return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
    if (edgeType === 'smoothstep') {
      const my = (sourceY + targetY) / 2
      return `M ${sourceX} ${sourceY} C ${sourceX} ${my}, ${targetX} ${my}, ${targetX} ${targetY}`
    }
    const cy = (sourceY + targetY) / 2
    return `M ${sourceX} ${sourceY} C ${sourceX} ${cy}, ${targetX} ${cy}, ${targetX} ${targetY}`
  }
  return `M ${sourceX} ${sourceY} Q ${bend.x} ${bend.y}, ${targetX} ${targetY}`
}

function getMidpoint(
  sourceX: number, sourceY: number,
  targetX: number, targetY: number,
  bend?: BendPoint,
): { x: number; y: number } {
  if (bend) return bend
  return { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 }
}

export default function DraggableEdge({
  id, sourceX, sourceY, targetX, targetY,
  selected, style, markerEnd, data, label, animated,
}: EdgeProps) {
  const { setEdges, screenToFlowPosition } = useReactFlow()
  const dragging = useRef(false)
  const edgeData = (data || {}) as Record<string, unknown>
  const edgeType = edgeData.originalType as string | undefined
  const bend = edgeData.bend as BendPoint | undefined
  const highlighted = edgeData.highlighted as boolean | undefined

  const path = getPath(sourceX, sourceY, targetX, targetY, bend, edgeType)
  const mid = getMidpoint(sourceX, sourceY, targetX, targetY, bend)

  const edgeStyle = highlighted
    ? { ...(style as React.CSSProperties), stroke: 'var(--accent)', strokeOpacity: 0.8, filter: 'drop-shadow(0 0 3px var(--accent))' }
    : style as React.CSSProperties

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragging.current = true
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    e.stopPropagation()
    e.preventDefault()
    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setEdges((eds) => eds.map((edge) => {
      if (edge.id !== id) return edge
      return { ...edge, data: { ...((edge.data as object) || {}), bend: { x: pos.x, y: pos.y } } }
    }))
  }, [id, setEdges, screenToFlowPosition])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    window.dispatchEvent(new CustomEvent('edge-bend-commit', { detail: { id } }))
  }, [id])

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setEdges((eds) => eds.map((edge) => {
      if (edge.id !== id) return edge
      const d = { ...((edge.data as object) || {}) } as Record<string, unknown>
      delete d.bend
      return { ...edge, data: d }
    }))
    window.dispatchEvent(new CustomEvent('edge-bend-commit', { detail: { id } }))
  }, [id, setEdges])

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={edgeStyle}
        markerEnd={markerEnd}
        interactionWidth={20}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${mid.x}px,${mid.y - 14}px)`,
              fontSize: 12,
              color: 'var(--text-secondary)',
              background: 'var(--bg)',
              padding: '1px 6px',
              borderRadius: 4,
              pointerEvents: 'none',
            }}
            className="nodrag nopan"
          >
            {String(label)}
          </div>
        </EdgeLabelRenderer>
      )}
      {selected && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${mid.x}px,${mid.y}px)`,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'var(--accent)',
              border: '2px solid white',
              cursor: 'grab',
              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              zIndex: 50,
              pointerEvents: 'all',
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDoubleClick={onDoubleClick}
            title="Drag to bend edge. Double-click to reset."
          />
        </EdgeLabelRenderer>
      )}
      {animated && (
        <circle r={3} fill="var(--accent)">
          <animateMotion dur="2s" repeatCount="indefinite" path={path} />
        </circle>
      )}
    </>
  )
}
