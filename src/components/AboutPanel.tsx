export function AboutPanel() {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">关于当前版本</p>
          <h2>这是一款以本地规则为主的终端工作流助手</h2>
        </div>
      </div>

      <div className="about-grid">
        <article className="empty-state">
          <strong>当前能做什么</strong>
          <ul className="plain-list">
            <li>围绕首批 10 个高频场景生成命令、解释和排查建议。</li>
            <li>保存最近记录、模板活跃度、Shell / 环境偏好和搜索关键词。</li>
            <li>在 Windows 桌面端把推荐命令插入终端输入框，但不会自动执行。</li>
          </ul>
        </article>

        <article className="empty-state">
          <strong>当前不做什么</strong>
          <ul className="plain-list">
            <li>不接管终端，不自动执行高风险命令，不做云同步和账号系统。</li>
            <li>AI 只做受约束的补充解释，不负责决定删除、强推或清理类动作。</li>
            <li>当前场景仍然固定为首批 10 个内置模板，不是开放式聊天或通用 Agent。</li>
          </ul>
        </article>
      </div>
    </section>
  )
}
