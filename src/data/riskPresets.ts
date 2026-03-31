import type { RiskHint } from '../types'

export const stopProcessRisk: RiskHint = {
  id: 'risk-stop-process',
  level: 'medium',
  title: '结束进程前先确认归属',
  reason:
    '开发机上常见的是旧服务、IDE 辅助进程或代理程序残留，不一定都应该直接结束。',
  impact:
    '如果误杀数据库、IDE 辅助进程或代理服务，当前开发链路可能会同时中断。',
  impactScope: 'current-machine',
  reversibility: 'partial',
  saferAlternative: '先核对 PID、进程名和路径，能改端口时优先改端口。',
}

export const forceKillRisk: RiskHint = {
  id: 'risk-force-kill',
  level: 'high',
  title: '强制结束进程存在误伤风险',
  reason:
    'PID 判断错误时，`taskkill /F` 或 `kill -9` 会直接中止目标进程，没有确认缓冲。',
  impact: '可能让当前 shell、后台服务或正在运行的调试会话同时失效。',
  impactScope: 'current-machine',
  reversibility: 'hard',
  saferAlternative: '先确认目标进程身份，必要时优先换端口或用非强制方式结束。',
}

export const gitHookBypassRisk: RiskHint = {
  id: 'risk-git-hook-bypass',
  level: 'medium',
  title: '未定位原因前不要绕过 hook',
  reason:
    'pre-commit、commit-msg、pre-push 和远端 pre-receive 的失败原因并不相同。',
  impact:
    '直接使用 `--no-verify` 或强推，可能把未验证代码推进远端分支，影响团队仓库质量。',
  impactScope: 'current-repo',
  reversibility: 'partial',
  saferAlternative: '先保留原始报错，再区分本地 hook 还是远端保护策略。',
}

export const executionPolicyRisk: RiskHint = {
  id: 'risk-execution-policy',
  level: 'medium',
  title: '修改执行策略会影响本机脚本行为',
  reason:
    'PowerShell 执行策略属于 Windows 侧的安全边界，放宽后会影响后续脚本入口。',
  impact:
    '同一台机器上的 npm、pnpm 或其他脚本命令，也可能受到相同策略变化影响。',
  impactScope: 'current-machine',
  reversibility: 'partial',
  saferAlternative:
    '先用 `.cmd` 入口验证工具链，必须调整时优先改 `CurrentUser` 范围。',
}
