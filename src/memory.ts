import fs from 'fs'
import path from 'path'
import os from 'os'

const MEMORY_DIR = path.join(os.homedir(), '.monkey-map')
const FLOWS_FILE = path.join(MEMORY_DIR, 'flows.json')

interface FlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  [key: string]: unknown
}

interface FlowEdge {
  id: string
  source: string
  target: string
  [key: string]: unknown
}

interface FlowTemplate {
  name: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  created: string
}

export class FlowMemory {
  private flows: FlowTemplate[] = []

  constructor() {
    if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true })
    if (fs.existsSync(FLOWS_FILE)) {
      try { this.flows = JSON.parse(fs.readFileSync(FLOWS_FILE, 'utf-8')) } catch { this.flows = [] }
    }
  }

  private persist() {
    fs.writeFileSync(FLOWS_FILE, JSON.stringify(this.flows, null, 2))
  }

  list(): FlowTemplate[] {
    return this.flows
  }

  save(name: string, nodes: FlowNode[], edges: FlowEdge[]) {
    // relativize positions
    const minX = Math.min(...nodes.map((n) => n.position.x))
    const minY = Math.min(...nodes.map((n) => n.position.y))
    const relNodes = nodes.map((n) => ({
      ...n,
      position: { x: n.position.x - minX, y: n.position.y - minY },
    }))

    this.flows = this.flows.filter((f) => f.name !== name)
    this.flows.push({ name, nodes: relNodes, edges, created: new Date().toISOString() })
    this.persist()
  }

  remove(name: string) {
    this.flows = this.flows.filter((f) => f.name !== name)
    this.persist()
  }

  get(name: string): FlowTemplate | undefined {
    return this.flows.find((f) => f.name === name)
  }
}
