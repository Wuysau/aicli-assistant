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
    <section className="panel control-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">输入区</p>
          <h2>{activeTask.title}</h2>
        </div>
        <span className="panel-badge">本地规则优先</span>
      </div>

      <label className="field-label" htmlFor="main-input">
        {activeTask.inputLabel}
      </label>
      <textarea
        id="main-input"
        className="prompt-input"
        rows={7}
        value={input}
        placeholder={activeTask.placeholder}
        onChange={(event) => onInputChange(event.target.value)}
      />

      <div className="selection-grid">
        <div className="selection-panel">
          <p className="field-label">Shell 选择</p>
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

        <div className="selection-panel">
          <p className="field-label">执行环境</p>
          <div className="environment-list">
            {environmentOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`environment-card${environment === option.id ? ' is-active' : ''}`}
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

      <div className="panel-actions">
        <button type="button" className="primary-button" onClick={onSubmit}>
          {loading ? '正在生成结果...' : '开始分析'}
        </button>
        <p className="helper-text">
          默认优先使用本地模板库、关键词匹配和风险规则；只有必要时才会追加 AI 补充。
        </p>
      </div>
    </section>
  )
}
