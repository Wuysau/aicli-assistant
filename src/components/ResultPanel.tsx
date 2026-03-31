import type { AssistantResult, CommandVariant, WorkflowStep } from '../types'

interface ResultPanelProps {
  result: AssistantResult
}

function renderCommandVariants(title: string, variants: CommandVariant[]) {
  if (variants.length === 0) {
    return null
  }

  return (
    <section className="result-block">
      <h3>{title}</h3>
      <div className="variant-list">
        {variants.map((variant) => (
          <article key={`${variant.shell}-${variant.command}`} className="variant-card">
            <div className="variant-header">
              <strong>{variant.label}</strong>
              <span>{variant.shell}</span>
            </div>
            <pre>
              <code>{variant.command}</code>
            </pre>
            {variant.notes ? <p>{variant.notes}</p> : null}
          </article>
        ))}
      </div>
    </section>
  )
}

function renderSteps(steps: WorkflowStep[]) {
  if (steps.length === 0) {
    return null
  }

  return (
    <section className="result-block">
      <h3>排查步骤</h3>
      <div className="step-list">
        {steps.map((step, index) => (
          <article key={step.id} className="step-card">
            <div className="step-index">{index + 1}</div>
            <div className="step-content">
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
              <span className="step-environment">{step.environment}</span>
              {step.commands?.length ? renderCommandVariants('对应命令', step.commands) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function ResultPanel({ result }: ResultPanelProps) {
  return (
    <section className="panel result-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">结果展示区</p>
          <h2>{result.title}</h2>
        </div>
        <span className="panel-badge">{result.recommendedEnvironment}</span>
      </div>

      <p className="result-summary">{result.summary}</p>

      {result.kind === 'command-generation'
        ? renderCommandVariants('跨 shell 命令', result.variants)
        : null}

      {result.kind === 'environment-judgement'
        ? (
          <>
            <section className="result-block">
              <h3>判断依据</h3>
              <ul className="plain-list">
                {result.reasoning.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="confidence-line">判断置信度：{result.confidence}</p>
            </section>
            {renderCommandVariants('可执行写法', result.variants)}
          </>
        )
        : null}

      {result.kind === 'error-analysis'
        ? (
          <>
            <section className="result-block">
              <h3>可能原因</h3>
              <ul className="plain-list">
                {result.probableCauses.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
            {renderSteps(result.investigationSteps)}
            {renderCommandVariants('快速检查命令', result.quickChecks)}
          </>
        )
        : null}

      {result.kind === 'workflow-template'
        ? (
          <>
            <section className="result-block">
              <h3>模板信息</h3>
              <p>{result.template.description}</p>
              <div className="tag-list">
                {result.template.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </section>
            {renderSteps(result.template.steps)}
            {renderCommandVariants('模板起始命令', result.starterCommands)}
          </>
        )
        : null}

      {'differenceNotes' in result && result.differenceNotes.length > 0 ? (
        <section className="result-block">
          <h3>差异说明</h3>
          <ul className="plain-list">
            {result.differenceNotes.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.risks.length > 0 ? (
        <section className="result-block">
          <h3>风险提示</h3>
          <div className="risk-list">
            {result.risks.map((risk) => (
              <article key={risk.id} className={`risk-card risk-${risk.level}`}>
                <strong>{risk.title}</strong>
                <p>{risk.detail}</p>
                {risk.saferAlternative ? (
                  <span>更稳妥方案：{risk.saferAlternative}</span>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="result-block">
        <h3>下一步建议</h3>
        <ul className="plain-list">
          {result.nextSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </section>
  )
}
