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
          <p className="eyebrow">任务类型入口</p>
          <h2>先选工作流，再输入问题</h2>
        </div>
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
