import { useState, useEffect } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { FlowTemplate } from '../types'
import { listFlows, saveFlow, deleteFlow } from '../hooks/useTauri'

interface FlowPickerProps {
  currentNodes: Node[]
  currentEdges: Edge[]
  onApply: (nodes: Node[], edges: Edge[]) => void
  onClose: () => void
}

export default function FlowPicker({ currentNodes, currentEdges, onApply, onClose }: FlowPickerProps) {
  const [flows, setFlows] = useState<FlowTemplate[]>([])
  const [saveName, setSaveName] = useState('')
  const [mode, setMode] = useState<'list' | 'save'>('list')

  const loadFlows = () => {
    listFlows().then(setFlows).catch(() => setFlows([]))
  }

  useEffect(() => { loadFlows() }, [])

  const handleSave = async () => {
    if (!saveName.trim()) return
    await saveFlow(saveName.trim(), currentNodes, currentEdges)
    setSaveName('')
    setMode('list')
    loadFlows()
  }

  const handleDelete = async (name: string) => {
    await deleteFlow(name)
    loadFlows()
  }

  const handleApply = (flow: FlowTemplate) => {
    onApply(flow.nodes, flow.edges)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>Flow Templates</h2>

        {mode === 'list' ? (
          <>
            {flows.length === 0 ? (
              <div className="empty-state">No saved flows yet. Save your current canvas as a template.</div>
            ) : (
              <ul className="flow-list">
                {flows.map((flow) => (
                  <li key={flow.name} className="flow-item">
                    <div>
                      <div className="flow-item-name">{flow.name}</div>
                      <div className="flow-item-date">
                        {flow.nodes.length} nodes, {flow.edges.length} edges
                      </div>
                    </div>
                    <div className="flow-item-actions">
                      <button onClick={() => handleApply(flow)}>Apply</button>
                      <button className="delete" onClick={() => handleDelete(flow.name)}>X</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="modal-actions">
              <button onClick={onClose}>Close</button>
              <button className="primary" onClick={() => setMode('save')}>
                Save Current
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              type="text"
              placeholder="Template name..."
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              maxLength={100}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Saving {currentNodes.length} nodes and {currentEdges.length} edges as a reusable template.
            </div>
            <div className="modal-actions">
              <button onClick={() => setMode('list')}>Back</button>
              <button className="primary" onClick={handleSave}>Save</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
