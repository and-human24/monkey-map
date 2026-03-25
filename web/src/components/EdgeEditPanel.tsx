import { useState, useEffect, useRef } from 'react'
import type { Edge } from '@xyflow/react'
import { useClickOutside } from '../hooks/useClickOutside'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useResizable } from '../hooks/useResizable'

const EDGE_COLORS = ['#d0d0d0', '#4f46e5', '#dc2626', '#16a34a', '#ca8a04', '#9333ea', '#0891b2', '#e11d48', '#000000']
const STROKE_WIDTHS = [1, 2, 3, 4, 6]
const EDGE_TYPES: { value: string; label: string }[] = [
  { value: 'default', label: 'Bezier' },
  { value: 'smoothstep', label: 'Step' },
  { value: 'straight', label: 'Straight' },
]

interface EdgeEditPanelProps {
  edge: Edge | null
  onClose: () => void
  onUpdate: (id: string, updates: Partial<Edge>) => void
  viewMode: 'edit' | 'read'
}

export default function EdgeEditPanel({ edge, onClose, onUpdate, viewMode }: EdgeEditPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState('')
  const [editingLabel, setEditingLabel] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { width, onPointerDown, onPointerMove, onPointerUp } = useResizable(300)

  useEffect(() => {
    setLabel((edge?.label as string) || '')
    setEditingLabel(false)
  }, [edge?.id])

  useEscapeKey(onClose, () => setEditingLabel(false), editingLabel)
  useClickOutside(panelRef, onClose, !!edge, '.react-flow__edge')

  if (!edge) return null

  const currentColor = (edge.style as Record<string, unknown>)?.stroke as string || '#d0d0d0'
  const currentWidth = (edge.style as Record<string, unknown>)?.strokeWidth as number || 2
  const currentType = edge.type || 'default'
  const isAnimated = edge.animated || false
  const isReadMode = viewMode === 'read'

  const commitLabel = () => {
    setEditingLabel(false)
    onUpdate(edge.id, { label: label.trim() || undefined })
  }

  return (
    <div ref={panelRef} className="edge-edit-panel" style={{ width }}>
      <div
        className="panel-resize-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      <div className="detail-panel-header">
        <h2 className="detail-panel-title">Edge</h2>
        <button className="detail-panel-close" onClick={onClose} title="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="detail-panel-divider" />

      <div className="edge-edit-content">
        {/* Label */}
        <div className="edge-edit-section">
          <span className="detail-panel-section-label">Label</span>
          {!isReadMode && editingLabel ? (
            <input
              ref={inputRef}
              className="edge-edit-input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLabel()
                if (e.key === 'Escape') setEditingLabel(false)
              }}
              maxLength={100}
              autoFocus
              placeholder="Add label..."
            />
          ) : (
            <div
              className="edge-edit-label-display"
              onClick={() => {
                if (isReadMode) return
                setEditingLabel(true)
                setLabel((edge.label as string) || '')
                setTimeout(() => inputRef.current?.focus(), 0)
              }}
            >
              {(edge.label as string) || <span className="detail-panel-empty">None</span>}
            </div>
          )}
        </div>

        {/* Type */}
        <div className="edge-edit-section">
          <span className="detail-panel-section-label">Type</span>
          <div className="edge-edit-types">
            {EDGE_TYPES.map((t) => (
              <button
                key={t.value}
                className={`edge-type-btn ${currentType === t.value ? 'active' : ''}`}
                disabled={isReadMode}
                onClick={() => onUpdate(edge.id, { type: t.value, data: { ...((edge.data as object) || {}), originalType: t.value } })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Color */}
        <div className="edge-edit-section">
          <span className="detail-panel-section-label">Color</span>
          <div className="edge-edit-colors">
            {EDGE_COLORS.map((color) => (
              <div
                key={color}
                className={`color-swatch ${currentColor === color ? 'active' : ''}`}
                style={{ background: color }}
                onClick={() => {
                  if (isReadMode) return
                  onUpdate(edge.id, { style: { ...((edge.style as object) || {}), stroke: color } })
                }}
              />
            ))}
          </div>
        </div>

        {/* Stroke Width */}
        <div className="edge-edit-section">
          <span className="detail-panel-section-label">Width</span>
          <div className="edge-edit-widths">
            {STROKE_WIDTHS.map((w) => (
              <button
                key={w}
                className={`edge-width-btn ${currentWidth === w ? 'active' : ''}`}
                disabled={isReadMode}
                onClick={() => onUpdate(edge.id, { style: { ...((edge.style as object) || {}), strokeWidth: w } })}
              >
                <svg width="24" height="12" viewBox="0 0 24 12">
                  <line x1="2" y1="6" x2="22" y2="6" stroke="currentColor" strokeWidth={w} strokeLinecap="round" />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Animated */}
        <div className="edge-edit-section edge-edit-row">
          <span className="detail-panel-section-label">Animated</span>
          <button
            className={`edge-toggle-btn ${isAnimated ? 'active' : ''}`}
            disabled={isReadMode}
            onClick={() => onUpdate(edge.id, { animated: !isAnimated })}
          >
            {isAnimated ? 'On' : 'Off'}
          </button>
        </div>
      </div>
    </div>
  )
}
