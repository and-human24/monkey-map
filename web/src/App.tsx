import { useState, useCallback } from 'react'
import Launcher from './components/Launcher'
import TabBar from './components/TabBar'
import EditorTab from './components/EditorTab'
import { useTheme } from './hooks/useTheme'
import type { Tab } from './types'

export default function App() {
  const { theme, toggle } = useTheme()
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [showLauncher, setShowLauncher] = useState(true)

  const openProject = useCallback((path: string) => {
    const existing = tabs.find(t => t.projectPath === path)
    if (existing) {
      setActiveTabId(existing.id)
      setShowLauncher(false)
      return
    }
    const id = crypto.randomUUID()
    const title = path.split(/[/\\]/).slice(-2, -1)[0] || 'Untitled'
    setTabs(prev => [...prev, { id, projectPath: path, title }])
    setActiveTabId(id)
    setShowLauncher(false)
  }, [tabs])

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id)
      const next = prev.filter(t => t.id !== id)
      if (next.length === 0) {
        setActiveTabId(null)
        setShowLauncher(true)
      } else if (activeTabId === id) {
        const newIdx = Math.min(idx, next.length - 1)
        setActiveTabId(next[newIdx].id)
      }
      return next
    })
  }, [activeTabId])

  const selectTab = useCallback((id: string) => {
    setActiveTabId(id)
    setShowLauncher(false)
  }, [])

  const handleNewTab = useCallback(() => {
    setShowLauncher(true)
    setActiveTabId(null)
  }, [])

  const handleBack = useCallback(() => {
    setShowLauncher(true)
    setActiveTabId(null)
  }, [])

  const updateTabTitle = useCallback((id: string, title: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, title } : t))
  }, [])

  const updateTabPath = useCallback((id: string, path: string) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, projectPath: path } : t))
  }, [])

  const hasTabs = tabs.length > 0

  return (
    <div className={`theme-${theme}${hasTabs ? ' has-tabs' : ''}`} style={{ height: '100vh' }}>
      {hasTabs && (
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={selectTab}
          onCloseTab={closeTab}
          onNewTab={handleNewTab}
        />
      )}
      {showLauncher && (
        <Launcher
          onOpenProject={openProject}
          theme={theme}
          onToggleTheme={toggle}
        />
      )}
      {tabs.map(tab => (
        <EditorTab
          key={tab.id}
          projectPath={tab.projectPath}
          isActive={tab.id === activeTabId && !showLauncher}
          onTitleChange={(title) => updateTabTitle(tab.id, title)}
          onPathChange={(path) => updateTabPath(tab.id, path)}
          onBack={handleBack}
          theme={theme}
          onToggleTheme={toggle}
        />
      ))}
    </div>
  )
}
