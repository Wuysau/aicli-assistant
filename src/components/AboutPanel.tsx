export function AboutPanel() {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">关于当前版本</p>
          <h2>规则 / 模板是主流程，AI 只做受约束的补充说明</h2>
        </div>
      </div>

      <div className="about-grid">
        <article className="empty-state">
          <strong>当前能做什么</strong>
          <ul className="plain-list">
            <li>围绕首批 10 个高频场景生成命令、解释和排查建议。</li>
            <li>保存最近记录、模板活跃度、Shell / 环境偏好和最近搜索关键词。</li>
            <li>在桌面版中可选启用 AI 增强，并按 provider 单独测试连接。</li>
          </ul>
        </article>

        <article className="empty-state">
          <strong>当前不做什么</strong>
          <ul className="plain-list">
            <li>不接管终端，不自动执行高风险命令，不做云同步和账号系统。</li>
            <li>AI 不负责决定删除、强推、重置或清理类高风险动作。</li>
            <li>Anthropic-compatible 当前只预留了结构，尚未直接发起请求。</li>
          </ul>
        </article>
      </div>
    </section>
  )
}
