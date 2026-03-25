import { useState, useEffect, useRef, useCallback } from 'react'
import type { Node } from '@xyflow/react'
import { NODE_COLORS } from '../constants'
import { useClickOutside } from '../hooks/useClickOutside'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useResizable } from '../hooks/useResizable'

interface DetailPanelProps {
  node: Node | null
  onClose: () => void
  viewMode: 'edit' | 'read'
}

const FONT_SIZES = [12, 13, 14, 16, 18, 20, 24]

export default function DetailPanel({ node, onClose, viewMode }: DetailPanelProps) {
  const [editing, setEditing] = useState(false)
  const [detailsValue, setDetailsValue] = useState('')
  const [detailsFontSize, setDetailsFontSize] = useState(14)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { width, onPointerDown, onPointerMove, onPointerUp } = useResizable(350)

  const data = node?.data as Record<string, unknown> | undefined
  const label = (data?.label as string) || ''
  const details = (data?.details as string) || ''
  const color = data?.color as string | undefined
  const nodeType = node?.type || 'mindmap'

  useEffect(() => {
    setDetailsValue(details)
    setEditing(false)
  }, [details, node?.id])

  const commitDetails = useCallback(() => {
    setEditing(false)
    if (node && detailsValue !== details) {
      window.dispatchEvent(new CustomEvent('node-details-update', { detail: { id: node.id, details: detailsValue } }))
    }
  }, [node, detailsValue, details])

  useEscapeKey(onClose, () => setEditing(false), editing)
  useClickOutside(panelRef, onClose, !!node, '.react-flow__node')

  const typeLabel = nodeType === 'mindmap' ? 'Mind Map Node' : nodeType === 'shape' ? 'Shape' : nodeType === 'note' ? 'Note' : nodeType

  return (
    <div ref={panelRef} className={`detail-panel ${node ? 'detail-panel-visible' : ''}`} style={{ width }}>
      <div
        className="panel-resize-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      {node && (
        <>
          <div className="detail-panel-header">
            <h2 className="detail-panel-title">{label || 'Untitled'}</h2>
            <button className="detail-panel-close" onClick={onClose} title="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="detail-panel-meta">
            <span className="detail-panel-type">{typeLabel}</span>
            {color && <span className="detail-panel-color" style={{ background: color }} />}
          </div>
          {viewMode === 'edit' && (
            <div className="detail-panel-formatting">
              <div className="detail-panel-color-row">
                <span className="detail-panel-section-label">Color</span>
                <div className="detail-panel-colors">
                  <div
                    className={`detail-color-swatch ${!color ? 'active' : ''}`}
                    style={{ background: '#999' }}
                    title="Default"
                    onClick={() => window.dispatchEvent(new CustomEvent('node-color-update', { detail: { id: node!.id, color: undefined } }))}
                  />
                  {NODE_COLORS.map((c) => (
                    <div
                      key={c}
                      className={`detail-color-swatch ${color === c ? 'active' : ''}`}
                      style={{ background: c }}
                      onClick={() => window.dispatchEvent(new CustomEvent('node-color-update', { detail: { id: node!.id, color: c } }))}
                    />
                  ))}
                </div>
              </div>
              <div className="detail-panel-style-row">
                <span className="detail-panel-section-label">Style</span>
                <div className="detail-panel-style-controls">
                  <button
                    className={`detail-style-btn ${data?.bold ? 'active' : ''}`}
                    onClick={() => window.dispatchEvent(new CustomEvent('node-style-update', { detail: { id: node!.id, bold: !data?.bold } }))}
                  >
                    B
                  </button>
                  <button
                    className={`detail-style-btn ${data?.strikethrough ? 'active' : ''}`}
                    style={{ textDecoration: 'line-through' }}
                    onClick={() => window.dispatchEvent(new CustomEvent('node-style-update', { detail: { id: node!.id, strikethrough: !data?.strikethrough } }))}
                  >
                    S
                  </button>
                  <select
                    className="detail-style-select"
                    value={(data?.fontSize as string) || 'medium'}
                    onChange={(e) => window.dispatchEvent(new CustomEvent('node-style-update', { detail: { id: node!.id, fontSize: e.target.value } }))}
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          <div className="detail-panel-divider" />
          <div className="detail-panel-content">
            <div className="detail-panel-section-header">
              <span className="detail-panel-section-label">Details</span>
              <div className="detail-panel-section-actions">
                <div className="detail-font-controls">
                  <button
                    className="detail-font-btn"
                    disabled={detailsFontSize <= FONT_SIZES[0]}
                    onClick={() => setDetailsFontSize(s => FONT_SIZES[FONT_SIZES.indexOf(s) - 1] || s)}
                    title="Decrease font size"
                  >
                    A-
                  </button>
                  <span className="detail-font-size">{detailsFontSize}</span>
                  <button
                    className="detail-font-btn"
                    disabled={detailsFontSize >= FONT_SIZES[FONT_SIZES.length - 1]}
                    onClick={() => setDetailsFontSize(s => FONT_SIZES[FONT_SIZES.indexOf(s) + 1] || s)}
                    title="Increase font size"
                  >
                    A+
                  </button>
                </div>
                {!editing && viewMode === 'edit' && (
                  <button
                    className="detail-panel-edit-btn"
                    onClick={() => {
                      setEditing(true)
                      setDetailsValue(details)
                      setTimeout(() => textareaRef.current?.focus(), 0)
                    }}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>
            {editing ? (
              <textarea
                ref={textareaRef}
                className="detail-panel-textarea"
                value={detailsValue}
                onChange={(e) => setDetailsValue(e.target.value)}
                onBlur={commitDetails}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { setEditing(false); return }
                  if (e.key === 'Enter' && e.metaKey) { commitDetails(); return }
                }}
                placeholder="Add details about this node..."
                maxLength={5000}
                style={{ fontSize: detailsFontSize }}
              />
            ) : (
              <div className="detail-panel-details" style={{ fontSize: detailsFontSize }}>
                {details || <span className="detail-panel-empty">No details yet</span>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
