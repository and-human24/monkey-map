import express from 'express'
import { createServer as createHttpServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { watch } from 'chokidar'
import { FlowMemory } from './memory.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface MindMapNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
  [key: string]: unknown
}

interface MindMapEdge {
  id: string
  source: string
  target: string
  [key: string]: unknown
}

interface MindMapData {
  meta: { title: string; created: string; viewport: { x: number; y: number; zoom: number } }
  nodes: MindMapNode[]
  edges: MindMapEdge[]
}

function defaultMindMap(): MindMapData {
  return {
    meta: { title: 'Untitled', created: new Date().toISOString(), viewport: { x: 0, y: 0, zoom: 1 } },
    nodes: [{ id: '1', type: 'mindmap', position: { x: 250, y: 250 }, data: { label: 'Start here' } }],
    edges: [],
  }
}

export async function createServer(opts: { port: number; file: string }) {
  const filePath = path.resolve(opts.file)
  const app = express()
  const server = createHttpServer(app)
  const wss = new WebSocketServer({
    server,
    verifyClient: (info) => {
      const origin = info.origin || info.req.headers.origin || ''
      return !origin || /^https?:\/\/localhost(:\d+)?$/.test(origin)
    },
  })
  const flows = new FlowMemory()

  // ensure file exists
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultMindMap(), null, 2))
  }

  app.use(express.json({ limit: '5mb' }))

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self' ws://localhost:* http://localhost:*")
    res.setHeader('X-XSS-Protection', '1; mode=block')
    res.setHeader('Referrer-Policy', 'no-referrer')

    // CORS: only allow localhost origins
    const origin = req.headers.origin
    if (origin && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin)
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    }
    if (req.method === 'OPTIONS') { res.status(204).end(); return }

    next()
  })

  // serve frontend
  const webDir = path.join(__dirname, 'web')
  app.use(express.static(webDir))

  // self-write suppression
  let lastWriteTime = 0

  app.get('/api/mindmap', (_req, res) => {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      res.json(data)
    } catch {
      const data = defaultMindMap()
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
      res.json(data)
    }
  })

  app.post('/api/mindmap', (req, res) => {
    const body = req.body
    if (!body || typeof body !== 'object' || !body.meta || !Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
      res.status(400).json({ error: 'Invalid mindmap data' })
      return
    }
    lastWriteTime = Date.now()
    fs.writeFileSync(filePath, JSON.stringify(body, null, 2))
    res.json({ ok: true })
  })

  app.get('/api/flows', (_req, res) => {
    res.json(flows.list())
  })

  app.post('/api/flows', (req, res) => {
    const { name, nodes, edges } = req.body
    if (!name || typeof name !== 'string' || name.length > 100 || !Array.isArray(nodes) || !Array.isArray(edges)) {
      res.status(400).json({ error: 'Invalid flow data' })
      return
    }
    flows.save(name, nodes, edges)
    res.json({ ok: true })
  })

  app.delete('/api/flows/:name', (req, res) => {
    flows.remove(req.params.name)
    res.json({ ok: true })
  })

  // fallback to index.html for SPA
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(webDir, 'index.html'))
  })

  // websocket broadcast on file change
  const broadcast = (data: string) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(data)
    })
  }

  const watcher = watch(filePath, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 100 } })
  let watchTimeout: ReturnType<typeof setTimeout> | null = null
  watcher.on('change', () => {
    if (watchTimeout) clearTimeout(watchTimeout)
    watchTimeout = setTimeout(() => {
      if (Date.now() - lastWriteTime < 200) return
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        JSON.parse(content)
        broadcast(content)
      } catch (e) { console.error('File watcher parse error', e) }
    }, 100)
  })

  return new Promise<{ url: string }>((resolve) => {
    server.listen(opts.port, () => {
      resolve({ url: `http://localhost:${opts.port}` })
    })
  })
}
