import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from '../useTheme'

const store: Record<string, string> = {}
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value }),
  removeItem: vi.fn((key: string) => { delete store[key] }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k] }),
  key: vi.fn((_: number) => null),
  length: 0,
}

vi.stubGlobal('localStorage', mockLocalStorage)

describe('useTheme', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k]
    vi.clearAllMocks()
  })

  it('defaults to light', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })

  it('toggle flips theme', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.toggle())
    expect(result.current.theme).toBe('dark')
    act(() => result.current.toggle())
    expect(result.current.theme).toBe('light')
  })

  it('persists to localStorage', () => {
    const { result } = renderHook(() => useTheme())
    act(() => result.current.toggle())
    expect(store['monkey-map-theme']).toBe('dark')
  })

  it('reads from localStorage', () => {
    store['monkey-map-theme'] = 'dark'
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('falls back to light on invalid localStorage value', () => {
    store['monkey-map-theme'] = 'invalid'
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
  })
})
