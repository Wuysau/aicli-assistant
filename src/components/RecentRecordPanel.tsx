import type { RecentRecord } from '../types'

interface RecentRecordPanelProps {
  records: RecentRecord[]
}

export function RecentRecordPanel({ records }: RecentRecordPanelProps) {
  return (
    <aside className="panel history-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">最近记录占位区</p>
          <h2>保留最近的工作流上下文</h2>
        </div>
      </div>

      <div className="history-list">
        {records.map((record) => (
          <article key={record.id} className="history-card">
            <div className="history-meta">
              <span>{record.timestamp}</span>
              <span>{record.environment}</span>
            </div>
            <h3>{record.title}</h3>
            <p>{record.summary}</p>
            <div className="history-tags">
              <span>{record.taskType}</span>
              <span>{record.preferredShell}</span>
            </div>
          </article>
        ))}
      </div>
    </aside>
  )
}
