import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { MindMapData, RecentProject, FlowTemplate } from '../types'

// Mindmap
export async function readMindmap(path: string): Promise<MindMapData> {
  const raw = await invoke<string>('read_mindmap', { path })
  return JSON.parse(raw)
}

export async function writeMindmap(path: string, data: MindMapData): Promise<void> {
  await invoke('write_mindmap', { path, data: JSON.stringify(data) })
}

// Recent projects
export async function listRecent(): Promise<RecentProject[]> {
  const raw = await invoke<string>('list_recent')
  return JSON.parse(raw)
}

export async function addRecent(path: string, title: string): Promise<void> {
  await invoke('add_recent', { path, title })
}

export async function removeRecent(path: string): Promise<void> {
  await invoke('remove_recent', { path })
}

// Flow templates
export async function listFlows(): Promise<FlowTemplate[]> {
  const raw = await invoke<string>('list_flows')
  return JSON.parse(raw)
}

export async function saveFlow(name: string, nodes: unknown, edges: unknown): Promise<void> {
  await invoke('save_flow', { name, data: JSON.stringify({ nodes, edges }) })
}

export async function deleteFlow(name: string): Promise<void> {
  await invoke('delete_flow', { name })
}

// File watcher
export async function startWatching(path: string): Promise<void> {
  await invoke('start_watching', { path })
}

export async function stopWatching(): Promise<void> {
  await invoke('stop_watching')
}

// File picker
export async function pickFile(): Promise<string | null> {
  const result = await invoke<string | null>('pick_file')
  return result
}

export async function renameMindmap(path: string, newName: string): Promise<string> {
  return await invoke<string>('rename_mindmap', { path, newName })
}

// Listen for file changes
export function onFileChanged(callback: (data: MindMapData) => void): Promise<() => void> {
  return listen<string>('file-changed', (event) => {
    try {
      const data = JSON.parse(event.payload)
      callback(data)
    } catch (e) { console.error('Failed to parse file change event', e) }
  })
}
