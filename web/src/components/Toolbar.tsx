import { useState } from 'react'

export type EdgeStyle = 'smoothstep' | 'default' | 'straight'

export type ViewMode = 'edit' | 'read'

interface ToolbarProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  saveStatus: 'saved' | 'saving' | 'unsaved'
  projectTitle: string
  onRenameProject: (name: string) => void
  onBack: () => void
  activeTool: string | null
  onSelectTool: (tool: string | null) => void
  onAutoLayout: () => void
  edgeStyle: EdgeStyle
  onEdgeStyleChange: (style: EdgeStyle) => void
  onShowFlows: () => void
  viewMode: ViewMode
  onToggleViewMode: () => void
}

const tools: { key: string; title: string; icon: string }[] = [
  { key: 'text', title: 'Text', icon: 'T' },
  { key: 'box', title: 'Rectangle', icon: '\u25AD' },
  { key: 'diamond', title: 'Diamond', icon: '\u25C7' },
  { key: 'circle', title: 'Circle', icon: '\u25CB' },
  { key: 'triangle', title: 'Triangle', icon: '\u25B3' },
  { key: 'note', title: 'Note', icon: '\u2263' },
]

export default function Toolbar({
  theme,
  onToggleTheme,
  saveStatus,
  projectTitle,
  onRenameProject,
  onBack,
  activeTool,
  onSelectTool,
  onAutoLayout,
  edgeStyle,
  onEdgeStyleChange,
  onShowFlows,
  viewMode,
  onToggleViewMode,
}: ToolbarProps) {
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(projectTitle)

  const statusDot = saveStatus === 'saved' ? 'dot-saved' : saveStatus === 'saving' ? 'dot-saving' : 'dot-unsaved'

  const commitName = () => {
    setEditingName(false)
    if (nameValue.trim() && nameValue !== projectTitle) {
      onRenameProject(nameValue.trim())
    }
  }

  return (
    <>
      <div className="toolbar-left">
        <button className="back-btn" onClick={onBack} title="Back to projects">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {editingName ? (
          <input
            className="project-name-input"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            maxLength={100}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false) }}
            autoFocus
          />
        ) : (
          <span className="project-name" onClick={() => { setNameValue(projectTitle); setEditingName(true) }}>
            {projectTitle}
          </span>
        )}
        <span className={`save-dot ${statusDot}`} title={saveStatus} />
      </div>

      <div className="toolbar-center">
        {viewMode === 'edit' ? (
        <div className="tool-group">
          {tools.map((t) => (
            <button
              key={t.key}
              className={`tool-btn ${activeTool === t.key ? 'active' : ''}`}
              onClick={() => onSelectTool(activeTool === t.key ? null : t.key)}
              title={t.title}
            >
              {t.icon}
            </button>
          ))}
          <span className="tool-sep" />
          <button className="tool-btn" onClick={onAutoLayout} title="Auto-layout">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="9" y="1" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
              <rect x="5" y="9" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M3 5V7H7M11 5V7H7M7 7V9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
          <button
            className="tool-btn"
            onClick={() => {
              const next: EdgeStyle = edgeStyle === 'smoothstep' ? 'default' : edgeStyle === 'default' ? 'straight' : 'smoothstep'
              onEdgeStyleChange(next)
            }}
            title={`Edge: ${edgeStyle === 'default' ? 'curve' : edgeStyle}`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              {edgeStyle === 'straight' ? (
                <line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              ) : edgeStyle === 'default' ? (
                <path d="M2 12C2 6 12 8 12 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              ) : (
                <path d="M2 12V7H12V2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              )}
            </svg>
          </button>
        </div>
        ) : (
          <span className="toolbar-mode-label">Read Mode — click nodes to view details</span>
        )}
      </div>

      <div className="toolbar-right">
        <button
          className={`action-btn ${viewMode === 'read' ? 'active' : ''}`}
          onClick={onToggleViewMode}
          title={viewMode === 'edit' ? 'Switch to Read mode' : 'Switch to Edit mode'}
        >
          {viewMode === 'edit' ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M17 3l4 4L7 21H3v-4L17 3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        <button className="action-btn" onClick={onShowFlows} title="Flow Templates">Flows</button>
        <button className="action-btn icon-btn" onClick={onToggleTheme} title={theme === 'light' ? 'Dark mode' : 'Light mode'}>
          {theme === 'light' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

    </>
  )
}
