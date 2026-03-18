import type { Tab } from '../types'

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string | null
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  onNewTab: () => void
}

export default function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab, onNewTab }: TabBarProps) {
  if (tabs.length === 0) return null

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab-item${tab.id === activeTabId ? ' active' : ''}`}
          onClick={() => onSelectTab(tab.id)}
        >
          <span className="tab-title">{tab.title}</span>
          <button
            className="tab-close"
            onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id) }}
          >
            x
          </button>
        </div>
      ))}
      <button className="tab-new" onClick={onNewTab}>+</button>
    </div>
  )
}
