import { describe, it, expect, afterEach } from 'vitest'
import { FlowMemory } from '../memory.js'

describe('FlowMemory', () => {
  const testName = `__test_flow_${Date.now()}`

  afterEach(() => {
    const mem = new FlowMemory()
    mem.remove(testName)
  })

  it('list returns array', () => {
    const mem = new FlowMemory()
    expect(Array.isArray(mem.list())).toBe(true)
  })

  it('save and list round-trip', () => {
    const mem = new FlowMemory()
    const nodes = [{ id: '1', type: 'mindmap', position: { x: 100, y: 200 }, data: { label: 'A' } }]
    const edges: never[] = []
    mem.save(testName, nodes, edges)
    const found = mem.list().find(f => f.name === testName)
    expect(found).toBeDefined()
    expect(found!.nodes).toHaveLength(1)
  })

  it('save relativizes positions', () => {
    const mem = new FlowMemory()
    const nodes = [
      { id: '1', type: 'mindmap', position: { x: 100, y: 200 }, data: { label: 'A' } },
      { id: '2', type: 'mindmap', position: { x: 300, y: 400 }, data: { label: 'B' } },
    ]
    mem.save(testName, nodes, [])
    const found = mem.list().find(f => f.name === testName)!
    expect(found.nodes[0].position).toEqual({ x: 0, y: 0 })
    expect(found.nodes[1].position).toEqual({ x: 200, y: 200 })
  })

  it('remove deletes flow', () => {
    const mem = new FlowMemory()
    mem.save(testName, [], [])
    mem.remove(testName)
    expect(mem.list().find(f => f.name === testName)).toBeUndefined()
  })

  it('get finds by name', () => {
    const mem = new FlowMemory()
    mem.save(testName, [], [])
    expect(mem.get(testName)).toBeDefined()
    expect(mem.get('nonexistent__xyz')).toBeUndefined()
  })
})
