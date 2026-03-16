import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFileWatcher } from '../useFileWatcher'

vi.mock('../useTauri', () => ({
  onFileChanged: vi.fn((cb: Function) => {
    (globalThis as any).__fileChangedCb = cb
    return Promise.resolve(() => {})
  }),
}))

describe('useFileWatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets up listener on mount', async () => {
    const { onFileChanged } = await import('../useTauri')
    const callback = vi.fn()
    renderHook(() => useFileWatcher(callback))
    expect(onFileChanged).toHaveBeenCalledOnce()
  })

  it('callback fires on file-changed event', async () => {
    const callback = vi.fn()
    renderHook(() => useFileWatcher(callback))
    const data = { meta: { title: 'Test', created: '', viewport: { x: 0, y: 0, zoom: 1 } }, nodes: [], edges: [] };
    (globalThis as any).__fileChangedCb(data)
    expect(callback).toHaveBeenCalledWith(data)
  })
})
