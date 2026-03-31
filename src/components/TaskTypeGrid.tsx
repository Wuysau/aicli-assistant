import type { TaskType, TaskTypeOption } from '../types'

interface TaskTypeGridProps {
  options: TaskTypeOption[]
  activeTask: TaskType
  onSelect: (taskType: TaskType) => void
}

export function TaskTypeGrid({
  options,
  activeTask,
  onSelect,
}: TaskTypeGridProps) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">任务入口</p>
          <h2>先选要解决的问题，再输入具体任务</h2>
        </div>
        <span className="panel-badge">{options.length} 个入口</span>
      </div>

      <div className="task-grid">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`task-card${option.id === activeTask ? ' is-active' : ''}`}
            onClick={() => onSelect(option.id)}
          >
            <strong>{option.title}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
