import type { WorkflowTemplate } from '../types'

interface BuiltInTemplatePanelProps {
  templates: WorkflowTemplate[]
  activeTemplateId?: string
  onUseTemplate: (template: WorkflowTemplate) => void
}

export function BuiltInTemplatePanel({
  templates,
  activeTemplateId,
  onUseTemplate,
}: BuiltInTemplatePanelProps) {
  return (
    <section className="panel template-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">内置模板区</p>
          <h2>先覆盖高频问题，再谈泛化</h2>
        </div>
      </div>

      <div className="template-list">
        {templates.map((template) => (
          <article
            key={template.id}
            className={`template-card${activeTemplateId === template.id ? ' is-active' : ''}`}
          >
            <div className="template-meta">
              <span>{template.category}</span>
              <span>{template.recommendedEnvironment}</span>
            </div>
            <h3>{template.name}</h3>
            <p>{template.description}</p>
            <div className="tag-list">
              {template.tags.map((tag) => (
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
              套用这个模板
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
