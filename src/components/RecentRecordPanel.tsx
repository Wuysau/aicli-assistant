import type { RecentRecord } from '../types'

interface RecentRecordPanelProps {
  records: RecentRecord[]
  onPreviewRecord?: (record: RecentRecord) => void
  onReuseRecord?: (record: RecentRecord) => void
  onDeleteRecord?: (recordId: string) => void
}

const taskLabelMap = {
  'generate-command': '跨 Shell 生成',
  'analyze-error': '报错拆解',
  'judge-environment': '环境判断',
  'use-template': '使用模板',
} as const

const environmentLabelMap = {
  'windows-local': 'Windows 本机',
  wsl: 'WSL / Bash',
  'remote-linux': '远程 Linux / SSH',
} as const

const riskLabelMap = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
} as const

export function RecentRecordPanel({
  records,
  onPreviewRecord,
  onReuseRecord,
  onDeleteRecord,
}: RecentRecordPanelProps) {
  return (
    <aside className="panel history-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">最近记录</p>
          <h2>保留最近一次可复用的工作流上下文</h2>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="empty-state">
          <strong>还没有可回看的记录</strong>
          <p>完成一次分析后，这里会保留最近生成过的命令建议、环境判断和排查结果。</p>
          <ul className="plain-list">
            <li>可以先从模板快捷入口进入一个高频场景。</li>
            <li>也可以直接输入端口、日志、 Git、Docker 或 SSH 相关问题开始试用。</li>
          </ul>
        </div>
      ) : (
        <div className="history-list">
          {records.map((record) => (
            <article key={record.id} className="history-card">
              <div className="history-meta">
                <span>{record.timestamp}</span>
                <span>{riskLabelMap[record.riskLevel]}</span>
              </div>
              <h3>{record.title}</h3>
              <p>{record.summary}</p>
              <div className="history-tags">
                <span>{taskLabelMap[record.taskType]}</span>
                <span>{record.preferredShell}</span>
                <span>{environmentLabelMap[record.environment]}</span>
              </div>
              <div className="history-actions">
                {onPreviewRecord ? (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => onPreviewRecord(record)}
                  >
                    回看结果
                  </button>
                ) : null}
                {onReuseRecord ? (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => onReuseRecord(record)}
                  >
                    再次应用
                  </button>
                ) : null}
                {onDeleteRecord ? (
                  <button
                    type="button"
                    className="link-button destructive-link"
                    onClick={() => onDeleteRecord(record.id)}
                  >
                    删除
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </aside>
  )
}
