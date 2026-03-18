import { useState, useCallback, useRef, useEffect } from 'react'
import {
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type Viewport,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  MarkerType,
} from '@xyflow/react'
import type { MindMapData, MindMapMeta } from '../types'
import { readMindmap, writeMindmap, startWatching, stopWatching, addRecent, removeRecent, renameMindmap } from './useTauri'
import Dagre from '@dagrejs/dagre'

function getNodeDimensions(node: Node): { width: number; height: number } {
  const measured = (node as Node & { measured?: { width?: number; height?: number } }).measured
  if (measured?.width && measured?.height) return { width: measured.width, height: measured.height }
  const data = node.data as Record<string, unknown>
  if (node.type === 'note') return { width: (data.width as number) || 200, height: (data.height as number) || 150 }
  if (node.type === 'shape' && data.shape === 'circle') return { width: 100, height: 100 }
  if (node.type === 'shape' && data.shape === 'diamond') return { width: 110, height: 110 }
  return { width: 180, height: 44 }
}

function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes

  const g = new Dagre.graphlib.Graph({ compound: false, directed: true })
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100, marginx: 40, marginy: 40 })

  for (const node of nodes) {
    const dim = getNodeDimensions(node)
    g.setNode(node.id, { width: dim.width + 40, height: dim.height + 20 })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  Dagre.layout(g)

  return nodes.map((node) => {
    const pos = g.node(node.id)
    const dim = getNodeDimensions(node)
    return { ...node, position: { x: pos.x - dim.width / 2, y: pos.y - dim.height / 2 } }
  })
}

export function useMindMap(filePath: string | null, edgeStyle: string = 'smoothstep') {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [meta, setMeta] = useState<MindMapMeta | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })

  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const skipSave = useRef(false)
  const filePathRef = useRef(filePath)
  filePathRef.current = filePath
  const metaRef = useRef(meta)
  metaRef.current = meta
  const viewportRef = useRef(viewport)
  viewportRef.current = viewport

  // load initial data when filePath changes
  useEffect(() => {
    if (!filePath) return
    readMindmap(filePath).then((data: MindMapData) => {
      setNodes(data.nodes.map(n => ({ ...n, selected: false })))
      setEdges(data.edges.map(e => ({
        ...e,
        sourceHandle: e.sourceHandle || 'bottom',
        targetHandle: e.targetHandle || 'top',
        data: { ...((e.data as object) || {}), originalType: e.type || 'default' },
      })))
      setMeta(data.meta)
      if (data.meta?.viewport) setViewport(data.meta.viewport)
    }).catch((e) => { console.error('Failed to read mindmap', e) })
  }, [filePath])

  // only apply edge style when user explicitly changes it via toolbar (not on initial load)
  const edgeStyleInitialized = useRef(false)
  useEffect(() => {
    if (!edgeStyleInitialized.current) {
      edgeStyleInitialized.current = true
      return
    }
    setEdges((eds) => {
      const updated = eds.map((e) => ({ ...e, type: edgeStyle, data: { ...((e.data as object) || {}), originalType: edgeStyle } }))
      save(nodes, updated)
      return updated
    })
  }, [edgeStyle]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useCallback(
    (newNodes: Node[], newEdges: Edge[], newViewport?: Viewport) => {
      if (skipSave.current) {
        skipSave.current = false
        return
      }
      if (!filePathRef.current) return
      setSaveStatus('unsaved')
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        setSaveStatus('saving')
        const data: MindMapData = {
          meta: {
            ...(metaRef.current || { title: 'Untitled', created: new Date().toISOString() }),
            viewport: newViewport || viewportRef.current,
          },
          nodes: newNodes,
          edges: newEdges,
        }
        await writeMindmap(filePathRef.current!, data)
        setSaveStatus('saved')
      }, 300)
    },
    [],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => {
        const updated = applyNodeChanges(changes, nds)
        save(updated, edges)
        return updated
      })
    },
    [edges, save],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds)
        save(nodes, updated)
        return updated
      })
    },
    [nodes, save],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const updated = addEdge({
          ...connection,
          sourceHandle: connection.sourceHandle || 'bottom',
          targetHandle: connection.targetHandle || 'top',
          type: edgeStyle,
          data: { originalType: edgeStyle },
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        }, eds)
        save(nodes, updated)
        return updated
      })
    },
    [nodes, save, edgeStyle],
  )

  const addNode = useCallback(
    (x: number, y: number, type: string = 'mindmap', shape?: string) => {
      const id = crypto.randomUUID()
      const nodeType = shape === 'note' ? 'note' : type
      const data: Record<string, unknown> = { label: shape === 'note' ? '' : 'New node', color: undefined }
      if (shape && shape !== 'note') data.shape = shape
      const newNode: Node = { id, type: nodeType, position: { x, y }, data }
      setNodes((nds) => {
        const updated = [...nds, newNode]
        save(updated, edges)
        return updated
      })
    },
    [edges, save],
  )

  const updateNodeLabel = useCallback(
    (id: string, label: string) => {
      setNodes((nds) => {
        const updated = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n))
        save(updated, edges)
        return updated
      })
    },
    [edges, save],
  )

  const updateNodeColor = useCallback(
    (id: string, color: string | undefined) => {
      setNodes((nds) => {
        const updated = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, color } } : n))
        save(updated, edges)
        return updated
      })
    },
    [edges, save],
  )

  const onViewportChange = useCallback(
    (vp: Viewport) => {
      setViewport(vp)
    },
    [],
  )

  const applyExternal = useCallback((data: MindMapData) => {
    skipSave.current = true
    setNodes(data.nodes)
    setEdges(data.edges)
    setMeta(data.meta)
    setSaveStatus('saved')
  }, [])

  const applyFlow = useCallback(
    (templateNodes: Node[], templateEdges: Edge[]) => {
      const idMap = new Map<string, string>()
      const offsetX = viewport.x ? -viewport.x / viewport.zoom + 200 : 300
      const offsetY = viewport.y ? -viewport.y / viewport.zoom + 200 : 300

      const newNodes = templateNodes.map((n) => {
        const newId = crypto.randomUUID()
        idMap.set(n.id, newId)
        return {
          ...n,
          id: newId,
          position: { x: n.position.x + offsetX, y: n.position.y + offsetY },
        }
      })

      const newEdges = templateEdges.map((e) => ({
        ...e,
        id: crypto.randomUUID(),
        source: idMap.get(e.source) || e.source,
        target: idMap.get(e.target) || e.target,
      }))

      setNodes((nds) => {
        const updated = [...nds, ...newNodes]
        setEdges((eds) => {
          const updatedEdges = [...eds, ...newEdges]
          save(updated, updatedEdges)
          return updatedEdges
        })
        return updated
      })
    },
    [viewport, save],
  )

  const updateNodeStyle = useCallback(
    (id: string, style: Record<string, unknown>) => {
      setNodes((nds) => {
        const updated = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...style } } : n))
        save(updated, edges)
        return updated
      })
    },
    [edges, save],
  )

  const updateNodeDetails = useCallback(
    (id: string, details: string) => {
      setNodes((nds) => {
        const updated = nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, details } } : n))
        save(updated, edges)
        return updated
      })
    },
    [edges, save],
  )

  const updateEdge = useCallback(
    (id: string, updates: Partial<Edge>) => {
      setEdges((eds) => {
        const updated = eds.map((e) => (e.id === id ? { ...e, ...updates } : e))
        save(nodes, updated)
        return updated
      })
    },
    [nodes, save],
  )

  const saveEdges = useCallback(() => {
    setEdges((eds) => {
      setNodes((nds) => {
        save(nds, eds)
        return nds
      })
      return eds
    })
  }, [save])

  const renameProject = useCallback(async (name: string): Promise<string | null> => {
    setMeta((m) => m ? { ...m, title: name } : { title: name, created: new Date().toISOString() })
    if (!filePathRef.current) return null
    try {
      const oldPath = filePathRef.current
      await stopWatching()
      const newPath = await renameMindmap(oldPath, name)
      await removeRecent(oldPath)
      filePathRef.current = newPath
      // save with updated title
      setNodes((currentNodes) => {
        setEdges((currentEdges) => {
          const data: MindMapData = {
            meta: { ...(metaRef.current || { title: name, created: new Date().toISOString() }), title: name, viewport: viewportRef.current },
            nodes: currentNodes,
            edges: currentEdges,
          }
          writeMindmap(newPath, data)
          return currentEdges
        })
        return currentNodes
      })
      await startWatching(newPath)
      await addRecent(newPath, name)
      return newPath
    } catch (e) {
      console.error('Failed to rename mindmap file', e)
      return null
    }
  }, [])

  const autoLayout = useCallback(() => {
    setNodes((nds) => {
      setEdges((eds) => {
        const laid = layoutNodes(nds, eds)
        save(laid, eds)
        return eds
      })
      return layoutNodes(nds, edges)
    })
  }, [edges, save])

  const saveNow = useCallback(async () => {
    if (!filePathRef.current) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const data: MindMapData = {
      meta: {
        ...(meta || { title: 'Untitled', created: new Date().toISOString() }),
        viewport,
      },
      nodes,
      edges,
    }
    await writeMindmap(filePathRef.current, data)
    setSaveStatus('saved')
  }, [meta, viewport, nodes, edges])

  return {
    nodes,
    edges,
    meta,
    saveStatus,
    viewport,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNodeLabel,
    updateNodeColor,
    onViewportChange,
    applyExternal,
    applyFlow,
    autoLayout,
    saveNow,
    updateNodeStyle,
    updateNodeDetails,
    renameProject,
    updateEdge,
    saveEdges,
  }
}
