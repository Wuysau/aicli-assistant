import type { AppView, AppViewOption } from '../types'

interface AppNavigationProps {
  options: AppViewOption[]
  activeView: AppView
  onSelect: (view: AppView) => void
}

export function AppNavigation({
  options,
  activeView,
  onSelect,
}: AppNavigationProps) {
  return (
    <section className="panel compact-nav-panel">
      <div className="compact-nav-header">
        <div>
          <p className="eyebrow">入口切换</p>
          <h2>主面板优先，其他功能放到次级入口</h2>
        </div>
      </div>

      <div className="view-switcher compact-view-switcher">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`view-card${option.id === activeView ? ' is-active' : ''}`}
            onClick={() => onSelect(option.id)}
          >
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
