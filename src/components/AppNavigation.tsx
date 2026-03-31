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
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">产品入口</p>
          <h2>围绕终端工作流组织页面，而不是围绕聊天组织页面</h2>
        </div>
      </div>

      <div className="view-switcher">
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
