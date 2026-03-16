import { describe, it, expect, beforeAll } from 'vitest'
import { createServer } from '../server.js'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('server', () => {
  let url: string
  let tmpFile: string

  beforeAll(async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monkey-map-test-'))
    tmpFile = path.join(tmpDir, 'test.json')
    const result = await createServer({ port: 19741, file: tmpFile })
    url = result.url
  })

  it('GET /api/mindmap returns valid data', async () => {
    const res = await fetch(`${url}/api/mindmap`)
    const data = await res.json()
    expect(data).toHaveProperty('meta')
    expect(data).toHaveProperty('nodes')
    expect(data).toHaveProperty('edges')
    expect(Array.isArray(data.nodes)).toBe(true)
  })

  it('POST /api/mindmap persists data', async () => {
    const payload = {
      meta: { title: 'Test', created: new Date().toISOString(), viewport: { x: 0, y: 0, zoom: 1 } },
      nodes: [{ id: '1', type: 'mindmap', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      edges: [],
    }
    const postRes = await fetch(`${url}/api/mindmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(postRes.ok).toBe(true)

    const getRes = await fetch(`${url}/api/mindmap`)
    const data = await getRes.json()
    expect(data.meta.title).toBe('Test')
  })

  it('POST /api/mindmap rejects invalid data', async () => {
    const res = await fetch(`${url}/api/mindmap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invalid: true }),
    })
    expect(res.status).toBe(400)
  })

  it('GET /api/flows returns array', async () => {
    const res = await fetch(`${url}/api/flows`)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('POST /api/flows saves and DELETE removes', async () => {
    const postRes = await fetch(`${url}/api/flows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'test-flow',
        nodes: [{ id: '1', type: 'mindmap', position: { x: 0, y: 0 }, data: { label: 'A' } }],
        edges: [],
      }),
    })
    expect(postRes.ok).toBe(true)

    const listRes = await fetch(`${url}/api/flows`)
    const flows = await listRes.json()
    expect(flows.some((f: any) => f.name === 'test-flow')).toBe(true)

    const delRes = await fetch(`${url}/api/flows/test-flow`, { method: 'DELETE' })
    expect(delRes.ok).toBe(true)
  })

  it('POST /api/flows rejects invalid data', async () => {
    const res = await fetch(`${url}/api/flows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', nodes: 'invalid', edges: null }),
    })
    expect(res.status).toBe(400)
  })
})
