import { environmentOptions } from '../data/environmentOptions'
import type {
  EnvironmentType,
  ScenarioId,
  ShellType,
  TaskTypeOption,
  WorkflowTemplate,
} from '../types'

interface ControlPanelProps {
  activeTask: TaskTypeOption
  input: string
  preferredShell: ShellType
  environment: EnvironmentType
  selectedTemplateId?: ScenarioId
  templates: WorkflowTemplate[]
  loading: boolean
  onInputChange: (value: string) => void
  onShellChange: (value: ShellType) => void
  onEnvironmentChange: (value: EnvironmentType) => void
  onTemplateChange: (value: ScenarioId) => void
  onSubmit: () => void
}

const shellOptions: ShellType[] = ['powershell', 'cmd', 'wsl', 'bash']

export function ControlPanel({
  activeTask,
  input,
  preferredShell,
  environment,
  selectedTemplateId,
  templates,
  loading,
  onInputChange,
  onShellChange,
  onEnvironmentChange,
  onTemplateChange,
  onSubmit,
}: ControlPanelProps) {
  return (
    <section className="panel control-panel compact-control-panel">
      <div className="panel-heading compact-panel-heading">
        <div>
          <p className="eyebrow">当前任务</p>
          <h2>{activeTask.title}</h2>
        </div>
        <span className="panel-badge">规则优先</span>
      </div>

      <label className="field-label" htmlFor="main-input">
        {activeTask.inputLabel}
      </label>
      <textarea
        id="main-input"
        className="prompt-input compact-prompt-input"
        rows={6}
        value={input}
        placeholder={activeTask.placeholder}
        onChange={(event) => onInputChange(event.target.value)}
      />

      <div className="selection-grid compact-selection-grid">
        <div className="selection-panel compact-selection-panel">
          <p className="field-label">Shell</p>
          <div className="chip-row">
            {shellOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`choice-chip${preferredShell === option ? ' is-active' : ''}`}
                onClick={() => onShellChange(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="selection-panel compact-selection-panel">
          <p className="field-label">环境</p>
          <div className="environment-list compact-environment-list">
            {environmentOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`environment-card compact-environment-card${environment === option.id ? ' is-active' : ''}`}
                onClick={() => onEnvironmentChange(option.id)}
              >
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTask.id === 'use-template' ? (
        <label className="template-picker">
          <span className="field-label">指定模板</span>
          <select
            value={selectedTemplateId}
            onChange={(event) => onTemplateChange(event.target.value as ScenarioId)}
          >
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="panel-actions compact-panel-actions">
        <button type="button" className="primary-button compact-submit-button" onClick={onSubmit}>
          {loading ? '分析中...' : '开始分析'}
        </button>
        <p className="helper-text compact-helper-text">
          先走本地模板、匹配和风险规则；只有必要时才补充 AI 说明。
        </p>
      </div>
    </section>
  )
}
