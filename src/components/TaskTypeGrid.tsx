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
    <section className="panel task-switch-panel">
      <div className="panel-heading compact-panel-heading">
        <div>
          <p className="eyebrow">任务类型</p>
          <h2>先选任务，再给出输入</h2>
        </div>
      </div>

      <div className="task-grid compact-task-grid">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`task-card compact-task-card${option.id === activeTask ? ' is-active' : ''}`}
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
