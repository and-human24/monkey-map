import { useState, useCallback } from 'react'
import { ReactFlowProvider, type NodeChange, type EdgeChange } from '@xyflow/react'
import Canvas from './components/Canvas'
import Toolbar, { type EdgeStyle, type ViewMode } from './components/Toolbar'
import Launcher from './components/Launcher'
import FlowPicker from './components/FlowPicker'
import DetailPanel from './components/DetailPanel'
import EdgeEditPanel from './components/EdgeEditPanel'
import { useTheme } from './hooks/useTheme'
import { useMindMap } from './hooks/useMindMap'
import { useFileWatcher } from './hooks/useFileWatcher'
import { stopWatching } from './hooks/useTauri'

export default function App() {
  const { theme, toggle } = useTheme()
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>('smoothstep')
  const [fitViewFlag, setFitViewFlag] = useState(0)
  const [showFlows, setShowFlows] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('edit')
  const mindMap = useMindMap(projectPath, edgeStyle)

  useFileWatcher(mindMap.applyExternal)

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
    setProjectPath(null)
    setActiveTool(null)
  }

  const projectTitle = mindMap.meta?.title || projectPath?.split(/[/\\]/).slice(-2, -1)[0] || 'Untitled'

  return (
    <div className={`theme-${theme}`} style={{ height: '100vh' }}>
      {projectPath ? (
        <ReactFlowProvider>
          <Toolbar
            theme={theme}
            onToggleTheme={toggle}
            saveStatus={mindMap.saveStatus}
            projectTitle={projectTitle}
            onRenameProject={async (name: string) => {
              const newPath = await mindMap.renameProject(name)
              if (newPath) setProjectPath(newPath)
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
      ) : (
        <Launcher
          onOpenProject={setProjectPath}
          theme={theme}
          onToggleTheme={toggle}
        />
      )}
    </div>
  )
}
