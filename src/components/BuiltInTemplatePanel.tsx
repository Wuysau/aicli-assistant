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
    <section className="panel template-panel compact-template-panel">
      <div className="panel-heading compact-panel-heading">
        <div>
          <p className="eyebrow">常用模板</p>
          <h2>最近常用场景</h2>
        </div>
        <button type="button" className="ghost-button" onClick={onBrowseLibrary}>
          模板库
        </button>
      </div>

      <div className="template-list compact-template-shortcuts">
        {templates.slice(0, 4).map((template) => (
          <button
            key={template.id}
            type="button"
            className={`template-browser-card compact-template-shortcut${activeTemplateId === template.id ? ' is-active' : ''}`}
            onClick={() => onUseTemplate(template)}
          >
            <strong>{template.title}</strong>
            <span>{template.category}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
