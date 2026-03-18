import { useState, useCallback, useEffect } from 'react'
import { ReactFlowProvider, type NodeChange, type EdgeChange } from '@xyflow/react'
import Canvas from './Canvas'
import Toolbar, { type EdgeStyle, type ViewMode } from './Toolbar'
import FlowPicker from './FlowPicker'
import DetailPanel from './DetailPanel'
import EdgeEditPanel from './EdgeEditPanel'
import { useMindMap } from '../hooks/useMindMap'
import { useFileWatcher } from '../hooks/useFileWatcher'
import { startWatching, stopWatching } from '../hooks/useTauri'
import type { MindMapData } from '../types'

interface EditorTabProps {
  projectPath: string
  isActive: boolean
  onTitleChange: (title: string) => void
  onPathChange: (path: string) => void
  onBack: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export default function EditorTab({ projectPath, isActive, onTitleChange, onPathChange, onBack, theme, onToggleTheme }: EditorTabProps) {
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>('smoothstep')
  const [fitViewFlag, setFitViewFlag] = useState(0)
  const [showFlows, setShowFlows] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('edit')
  const mindMap = useMindMap(projectPath, edgeStyle)

  const noop = useCallback((_data: MindMapData) => {}, [])
  useFileWatcher(isActive ? mindMap.applyExternal : noop)

  // manage watcher based on active state
  useEffect(() => {
    if (isActive) {
      startWatching(projectPath).catch((e) => { console.error('Failed to start file watcher', e) })
    }
  }, [isActive, projectPath])

  // save on unmount (tab close)
  useEffect(() => {
    return () => { mindMap.saveNow() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // sync title to parent
  useEffect(() => {
    const title = mindMap.meta?.title || projectPath.split(/[/\\]/).slice(-2, -1)[0] || 'Untitled'
    onTitleChange(title)
  }, [mindMap.meta?.title, projectPath]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    mindMap.onNodesChange(changes)
    for (const change of changes) {
      if (change.type === 'select' && change.selected) {
        setSelectedNodeId(change.id)
        setSelectedEdgeId(null)
        return
      }
    }
    const hasDeselect = changes.some(c => c.type === 'select' && !c.selected)
    const hasSelect = changes.some(c => c.type === 'select' && c.selected)
    if (hasDeselect && !hasSelect) setSelectedNodeId(null)
  }, [mindMap])

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    mindMap.onEdgesChange(changes)
    for (const change of changes) {
      if (change.type === 'select' && change.selected) {
        setSelectedEdgeId(change.id)
        setSelectedNodeId(null)
        return
      }
    }
    const hasDeselect = changes.some(c => c.type === 'select' && !c.selected)
    const hasSelect = changes.some(c => c.type === 'select' && c.selected)
    if (hasDeselect && !hasSelect) setSelectedEdgeId(null)
  }, [mindMap])

  const selectedNode = selectedNodeId ? mindMap.nodes.find(n => n.id === selectedNodeId) || null : null
  const selectedEdge = selectedEdgeId ? mindMap.edges.find(e => e.id === selectedEdgeId) || null : null

  const handleBack = async () => {
    await mindMap.saveNow()
    await stopWatching()
    onBack()
  }

  const projectTitle = mindMap.meta?.title || projectPath.split(/[/\\]/).slice(-2, -1)[0] || 'Untitled'

  return (
    <div style={{ display: isActive ? 'block' : 'none', height: '100%' }}>
      <ReactFlowProvider>
        <Toolbar
          theme={theme}
          onToggleTheme={onToggleTheme}
          saveStatus={mindMap.saveStatus}
          projectTitle={projectTitle}
          onRenameProject={async (name: string) => {
            const newPath = await mindMap.renameProject(name)
            if (newPath) onPathChange(newPath)
          }}
          onBack={handleBack}
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          onAutoLayout={() => { mindMap.autoLayout(); setFitViewFlag(f => f + 1) }}
          edgeStyle={edgeStyle}
          onEdgeStyleChange={setEdgeStyle}
          onShowFlows={() => setShowFlows(true)}
          viewMode={viewMode}
          onToggleViewMode={() => setViewMode(m => m === 'edit' ? 'read' : 'edit')}
        />
        <Canvas
          nodes={mindMap.nodes}
          edges={mindMap.edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={mindMap.onConnect}
          onAddNode={mindMap.addNode}
          onUpdateNodeLabel={mindMap.updateNodeLabel}
          onUpdateNodeColor={mindMap.updateNodeColor}
          onUpdateNodeStyle={mindMap.updateNodeStyle}
          onUpdateNodeDetails={mindMap.updateNodeDetails}
          onSaveEdges={mindMap.saveEdges}
          viewport={mindMap.viewport}
          onViewportChange={mindMap.onViewportChange}
          activeTool={activeTool}
          onToolUsed={() => setActiveTool(null)}
          edgeStyle={edgeStyle}
          fitViewFlag={fitViewFlag}
          viewMode={viewMode}
        />
        <DetailPanel
          node={selectedNode}
          onClose={() => setSelectedNodeId(null)}
          viewMode={viewMode}
        />
        <EdgeEditPanel
          edge={selectedEdge}
          onClose={() => setSelectedEdgeId(null)}
          onUpdate={mindMap.updateEdge}
          viewMode={viewMode}
        />
        {showFlows && (
          <FlowPicker
            currentNodes={mindMap.nodes}
            currentEdges={mindMap.edges}
            onApply={mindMap.applyFlow}
            onClose={() => setShowFlows(false)}
          />
        )}
      </ReactFlowProvider>
    </div>
  )
}
