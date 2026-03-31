import type { WorkflowTemplate } from '../types'

interface BuiltInTemplatePanelProps {
  templates: WorkflowTemplate[]
  activeTemplateId?: string
  onUseTemplate: (template: WorkflowTemplate) => void
  onBrowseLibrary: () => void
}

export function BuiltInTemplatePanel({
  templates,
  activeTemplateId,
  onUseTemplate,
  onBrowseLibrary,
}: BuiltInTemplatePanelProps) {
  return (
    <section className="panel template-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">模板快捷入口</p>
          <h2>优先展示最近用过的场景，缩短下一次任务闭环</h2>
        </div>
        <button type="button" className="ghost-button" onClick={onBrowseLibrary}>
          打开模板库
        </button>
      </div>

      <div className="template-list compact-template-list">
        {templates.slice(0, 4).map((template) => (
          <article
            key={template.id}
            className={`template-card${activeTemplateId === template.id ? ' is-active' : ''}`}
          >
            <div className="template-meta">
              <span>{template.category}</span>
              <span>{template.supportedShells.join(' / ')}</span>
            </div>
            <h3>{template.title}</h3>
            <p>{template.summary}</p>
            <div className="tag-list">
              {template.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => onUseTemplate(template)}
            >
              直接使用
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
