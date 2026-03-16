import { useState, useEffect } from 'react'
import type { RecentProject } from '../types'
import { listRecent, removeRecent, pickFile, addRecent, readMindmap } from '../hooks/useTauri'
import { invoke } from '@tauri-apps/api/core'

interface LauncherProps {
  onOpenProject: (path: string) => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export default function Launcher({ onOpenProject, theme, onToggleTheme }: LauncherProps) {
  const [recents, setRecents] = useState<RecentProject[]>([])
  const [showNamePrompt, setShowNamePrompt] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [pendingDir, setPendingDir] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadRecents = () => {
    listRecent().then(setRecents).catch(() => setRecents([]))
  }

  useEffect(() => { loadRecents() }, [])

  const handleNew = async () => {
    try {
      const dir = await invoke<string | null>('pick_directory')
      if (!dir) return
      setPendingDir(dir)
      setProjectName('')
      setError('')
      setShowNamePrompt(true)
    } catch (e) { console.error('Failed to pick directory', e) }
  }

  const handleCreateConfirm = async () => {
    if (!pendingDir || !projectName.trim()) return
    try {
      const name = projectName.trim()
      const path = await invoke<string>('create_project', { dir: pendingDir, name })
      await addRecent(path, name)
      setShowNamePrompt(false)
      onOpenProject(path)
    } catch (e) {
      setError(String(e))
    }
  }

  const handleOpen = async () => {
    try {
      const path = await pickFile()
      if (!path) return
      const data = await readMindmap(path).catch(() => null)
      const title = data?.meta?.title || path.split(/[/\\]/).slice(-2, -1)[0] || 'Project'
      await addRecent(path, title)
      onOpenProject(path)
    } catch (e) { console.error('Failed to open project', e) }
  }

  const handleRemove = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await removeRecent(path)
    loadRecents()
  }

  const handleOpenRecent = async (project: RecentProject) => {
    await addRecent(project.path, project.title)
    onOpenProject(project.path)
  }

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch (e) { console.error('Failed to format date', e); return '' }
  }

  return (
    <div className="launcher">
      {showNamePrompt && (
        <div className="name-prompt-overlay">
          <div className="name-prompt">
            <h3 className="name-prompt-title">Name your mind map</h3>
            <input
              className="name-prompt-input"
              value={projectName}
              onChange={(e) => { setProjectName(e.target.value); setError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreateConfirm(); if (e.key === 'Escape') setShowNamePrompt(false) }}
              placeholder="e.g. architecture, pipeline, roadmap"
              autoFocus
              maxLength={100}
            />
            {error && <div className="name-prompt-error">{error}</div>}
            <div className="name-prompt-actions">
              <button className="launcher-btn" onClick={() => setShowNamePrompt(false)}>Cancel</button>
              <button className="launcher-btn primary" onClick={handleCreateConfirm} disabled={!projectName.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}
      <div className="launcher-header">
        <button className="theme-toggle-btn" onClick={onToggleTheme}>
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </div>
      <div className="launcher-content">
        <h1 className="launcher-title">Monkey Map</h1>
        <div className="launcher-actions">
          <button className="launcher-btn primary" onClick={handleNew}>New Project</button>
          <button className="launcher-btn" onClick={handleOpen}>Open Existing</button>
        </div>
        {recents.length > 0 && (
          <div className="recent-section">
            <h3 className="recent-heading">Recent Projects</h3>
            <ul className="recent-list">
              {recents.map((project) => (
                <li
                  key={project.path}
                  className="recent-item"
                  onClick={() => handleOpenRecent(project)}
                >
                  <div className="recent-info">
                    <div className="recent-title">{project.title}</div>
                    <div className="recent-path">{project.path}</div>
                    <div className="recent-date">{formatDate(project.lastOpened)}</div>
                  </div>
                  <button
                    className="recent-delete"
                    onClick={(e) => handleRemove(project.path, e)}
                    title="Remove from recents"
                  >
                    X
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
