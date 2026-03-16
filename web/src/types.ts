import type { Node, Edge } from '@xyflow/react'

export interface MindMapMeta {
  title: string
  created: string
  viewport: { x: number; y: number; zoom: number }
}

export interface MindMapData {
  meta: MindMapMeta
  nodes: Node[]
  edges: Edge[]
}

export interface FlowTemplate {
  name: string
  nodes: Node[]
  edges: Edge[]
  created: string
}

export interface RecentProject {
  path: string
  title: string
  lastOpened: string
}

export type ShapeType = 'box' | 'circle' | 'text' | 'diamond' | 'triangle' | 'triangle-down' | 'ellipse' | 'note'
