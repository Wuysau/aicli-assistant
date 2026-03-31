import { useMemo } from 'react'
import { environmentOptions } from '../data/environmentOptions'
import type {
  RecentSearchKeyword,
  ScenarioId,
  TemplateActivity,
  TemplateFilterState,
  TemplateSortMode,
  WorkflowTemplate,
} from '../types'

interface TemplateLibraryPageProps {
  templates: WorkflowTemplate[]
  activeTemplateId: ScenarioId
  filterState: TemplateFilterState
  sortMode: TemplateSortMode
  recentSearches: RecentSearchKeyword[]
  recentTemplateIds: ScenarioId[]
  frequentTemplateIds: ScenarioId[]
  templateActivities: TemplateActivity[]
  onSelectTemplate: (templateId: ScenarioId) => void
  onFilterChange: (nextFilter: TemplateFilterState) => void
  onSortModeChange: (nextSortMode: TemplateSortMode) => void
  onUseTemplate: (template: WorkflowTemplate) => void
  onSearchCommitted: (query: string) => void
}

const sortModeLabelMap: Record<TemplateSortMode, string> = {
  default: '默认顺序',
  recent: '最近使用优先',
  frequent: '常用优先',
}

export function TemplateLibraryPage({
  templates,
  activeTemplateId,
  filterState,
  sortMode,
  recentSearches,
  recentTemplateIds,
  frequentTemplateIds,
  templateActivities,
  onSelectTemplate,
  onFilterChange,
  onSortModeChange,
  onUseTemplate,
  onSearchCommitted,
}: TemplateLibraryPageProps) {
  const categories = Array.from(new Set(templates.map((template) => template.category)))
  const activityMap = useMemo(
    () => new Map(templateActivities.map((item) => [item.scenarioId, item] as const)),
    [templateActivities],
  )

  const filteredTemplates = templates.filter((template) => {
    const normalizedQuery = filterState.query.trim().toLowerCase()
    const matchesQuery =
      normalizedQuery.length === 0 ||
      template.title.toLowerCase().includes(normalizedQuery) ||
      template.aliases.some((alias) => alias.toLowerCase().includes(normalizedQuery)) ||
      template.summary.toLowerCase().includes(normalizedQuery) ||
      template.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)) ||
      template.promptExamples.some((example) => example.toLowerCase().includes(normalizedQuery)) ||
      template.mainCommand.command.toLowerCase().includes(normalizedQuery)

    const matchesCategory =
      filterState.category === 'all' || template.category === filterState.category
    const matchesEnvironment =
      filterState.environment === 'all' ||
      template.recommendedEnvironment === filterState.environment

    return matchesQuery && matchesCategory && matchesEnvironment
  })

  const activeTemplate =
    filteredTemplates.find((template) => template.id === activeTemplateId) ??
    filteredTemplates[0]

  const recentTemplateTitles = recentTemplateIds
    .map((scenarioId) => templates.find((template) => template.id === scenarioId)?.title)
    .filter((item): item is string => Boolean(item))

  const frequentTemplateTitles = frequentTemplateIds
    .map((scenarioId) => templates.find((template) => template.id === scenarioId)?.title)
    .filter((item): item is string => Boolean(item))

  const handleQueryChange = (query: string) => {
    onFilterChange({
      ...filterState,
      query,
    })
  }

  const handleQueryCommit = () => {
    onSearchCommitted(filterState.query)
  }

  if (templates.length === 0) {
    return (
      <section className="panel template-library-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">模板库</p>
            <h2>当前还没有可用模板</h2>
          </div>
        </div>
        <div className="empty-state">
          <strong>模板目录为空</strong>
          <p>当前项目还没有加载任何模板数据，建议先检查本地模板目录是否可用。</p>
        </div>
      </section>
    )
  }

  return (
    <section className="panel template-library-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">模板库</p>
          <h2>按最近使用、常用频率和搜索关键词组织模板</h2>
        </div>
        <span className="panel-badge">
          {filteredTemplates.length} / {templates.length}
        </span>
      </div>

      <div className="library-toolbar">
        <label className="toolbar-field">
          <span>搜索模板</span>
          <input
            type="text"
            value={filterState.query}
            placeholder="按标题、别名、标签或示例输入搜索"
            onChange={(event) => handleQueryChange(event.target.value)}
            onBlur={handleQueryCommit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleQueryCommit()
              }
            }}
          />
        </label>

        <label className="toolbar-field">
          <span>分类</span>
          <select
            value={filterState.category}
            onChange={(event) =>
              onFilterChange({
                ...filterState,
                category: event.target.value,
              })
            }
          >
            <option value="all">全部分类</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="toolbar-field">
          <span>推荐环境</span>
          <select
            value={filterState.environment}
            onChange={(event) =>
              onFilterChange({
                ...filterState,
                environment: event.target.value as TemplateFilterState['environment'],
              })
            }
          >
            <option value="all">全部环境</option>
            {environmentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="template-library-meta">
        <div className="tag-list">
          <span className="tag">当前排序：{sortModeLabelMap[sortMode]}</span>
          {recentTemplateTitles.slice(0, 2).map((title) => (
            <span key={title} className="tag">
              最近：{title}
            </span>
          ))}
          {frequentTemplateTitles.slice(0, 2).map((title) => (
            <span key={title} className="tag">
              常用：{title}
            </span>
          ))}
        </div>

        <div className="sort-chip-row">
          {(['default', 'recent', 'frequent'] as TemplateSortMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`choice-chip${sortMode === mode ? ' is-active' : ''}`}
              onClick={() => onSortModeChange(mode)}
            >
              {sortModeLabelMap[mode]}
            </button>
          ))}
        </div>
      </div>

      {recentSearches.length > 0 ? (
        <div className="result-block">
          <h3>最近搜索</h3>
          <div className="tag-list">
            {recentSearches.map((item) => (
              <button
                key={item.id}
                type="button"
                className="tag interactive-tag"
                onClick={() => {
                  onFilterChange({
                    ...filterState,
                    query: item.query,
                  })
                  onSearchCommitted(item.query)
                }}
              >
                {item.query}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="template-library-grid">
        <div className="template-browser-list">
          {filteredTemplates.length === 0 ? (
            <div className="empty-state">
              <strong>没有找到匹配的模板</strong>
              <p>可以缩短关键词，或者取消分类和环境筛选后再试一次。</p>
            </div>
          ) : (
            filteredTemplates.map((template) => {
              const activity = activityMap.get(template.id)

              return (
                <button
                  key={template.id}
                  type="button"
                  className={`template-browser-card${activeTemplate?.id === template.id ? ' is-active' : ''}`}
                  onClick={() => onSelectTemplate(template.id)}
                >
                  <strong>{template.title}</strong>
                  <span>{template.category}</span>
                  <p>{template.summary}</p>
                  {activity ? (
                    <div className="history-tags">
                      {activity.lastUsedAt ? <span>最近使用</span> : null}
                      {activity.usageCount > 0 ? <span>套用 {activity.usageCount}</span> : null}
                      {activity.matchCount > 0 ? <span>命中 {activity.matchCount}</span> : null}
                    </div>
                  ) : null}
                </button>
              )
            })
          )}
        </div>

        {activeTemplate ? (
          <article className="template-detail-card">
            <div className="template-meta">
              <span>{activeTemplate.category}</span>
              <span>{activeTemplate.supportedShells.join(' / ')}</span>
            </div>
            <h3>{activeTemplate.title}</h3>
            <p>{activeTemplate.summary}</p>

            <div className="tag-list">
              {activeTemplate.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>

            <section className="detail-block">
              <h4>别名 / 常见说法</h4>
              {activeTemplate.aliases.length > 0 ? (
                <div className="tag-list">
                  {activeTemplate.aliases.map((alias) => (
                    <span key={alias} className="tag">
                      {alias}
                    </span>
                  ))}
                </div>
              ) : (
                <p>当前模板还没有补充别名。</p>
              )}
            </section>

            <section className="detail-block">
              <h4>推荐环境</h4>
              <p>
                {environmentOptions.find(
                  (option) => option.id === activeTemplate.recommendedEnvironment,
                )?.label ?? '尚未标注推荐环境'}
              </p>
            </section>

            <section className="detail-block">
              <h4>推荐命令</h4>
              <pre>
                <code>{activeTemplate.mainCommand.command}</code>
              </pre>
            </section>

            <section className="detail-block">
              <h4>模板解释</h4>
              {activeTemplate.explanation.length > 0 ? (
                <ul className="plain-list">
                  {activeTemplate.explanation.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p>当前模板还没有补充解释说明。</p>
              )}
            </section>

            <section className="detail-block">
              <h4>示例输入</h4>
              {activeTemplate.promptExamples.length > 0 ? (
                <ul className="plain-list">
                  {activeTemplate.promptExamples.map((example) => (
                    <li key={example}>{example}</li>
                  ))}
                </ul>
              ) : (
                <p>当前模板还没有补充示例输入。</p>
              )}
            </section>

            <section className="detail-block">
              <h4>模板步骤</h4>
              {activeTemplate.steps.length > 0 ? (
                <ol className="detail-steps">
                  {activeTemplate.steps.map((step) => (
                    <li key={step.id}>
                      <strong>{step.title}</strong>
                      <p>{step.detail}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>当前模板详情尚未补齐步骤。</p>
              )}
            </section>

            <div className="detail-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => onUseTemplate(activeTemplate)}
              >
                带入工作台
              </button>
            </div>
          </article>
        ) : (
          <article className="template-detail-card">
            <div className="empty-state">
              <strong>当前没有可展示的模板详情</strong>
              <p>请先取消部分筛选，或从左侧列表里重新选择一个模板。</p>
            </div>
          </article>
        )}
      </div>
    </section>
  )
}
