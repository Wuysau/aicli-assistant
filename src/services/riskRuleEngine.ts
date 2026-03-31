import type { CommandVariant, RiskHint, RiskRuleDefinition } from '../types'

const riskRules: RiskRuleDefinition[] = [
  {
    id: 'destructive-delete',
    title: '删除类命令需要确认目标路径',
    level: 'high',
    patterns: [
      /\brm\s+-rf\b/i,
      /\brm\s+-r\b/i,
      /\bremove-item\b/i,
      /\bdel\s+\/[a-z]*[pqfs]/i,
      /\brmdir\b/i,
      /\brd\s+\/s\b/i,
    ],
    reason: '删除类命令往往直接作用于文件或目录，目标一旦判断错误，恢复成本很高。',
    impact: '可能删除当前项目、构建产物、日志或机器上的其他关键目录。',
    impactScope: 'current-machine',
    reversibility: 'hard',
    saferAlternative: '先列出目标路径并做只读确认，必要时先移动到临时目录而不是直接删除。',
  },
  {
    id: 'git-force-push',
    title: 'force push 会改写远端分支历史',
    level: 'high',
    patterns: [/\bgit\s+push\b.*(?:--force|-f)\b/i],
    reason: '强推会直接覆盖远端分支历史，尤其在共享分支上风险很高。',
    impact: '可能导致他人提交丢失、PR 基线变化或分支历史难以追溯。',
    impactScope: 'current-repo',
    reversibility: 'hard',
    saferAlternative: '先确认是否可以用普通 push、rebase 或新分支提交，必要时至少改用 `--force-with-lease`。',
  },
  {
    id: 'git-hard-reset',
    title: 'git reset --hard 会丢弃本地修改',
    level: 'high',
    patterns: [/\bgit\s+reset\s+--hard\b/i],
    reason: '`git reset --hard` 会直接丢弃工作区和暂存区中的未保存改动。',
    impact: '当前仓库中的本地改动和未提交内容可能直接消失。',
    impactScope: 'current-repo',
    reversibility: 'hard',
    saferAlternative: '先用 `git status`、`git diff` 或 `git stash` 保留现场，再决定是否需要 reset。',
  },
  {
    id: 'docker-cleanup',
    title: 'Docker 清理命令可能删除共享资源',
    level: 'high',
    patterns: [
      /\bdocker\s+(?:system|image|container|volume|builder)\s+prune\b/i,
      /\bdocker\s+rm\b.*\s-f\b/i,
    ],
    reason: 'Docker 清理命令可能同时删掉镜像、容器、卷或缓存，不一定只影响当前问题场景。',
    impact: '可能导致本机其他项目容器、镜像缓存或卷数据被清掉。',
    impactScope: 'current-machine',
    reversibility: 'hard',
    saferAlternative: '先用 `docker ps -a` 和 `docker logs` 定位问题，只清理明确无用的目标资源。',
  },
  {
    id: 'overwrite-output',
    title: '覆盖输出会直接改写现有文件',
    level: 'medium',
    patterns: [
      /(^|[^>])>\s*[^\s]/,
      /\bout-file\b(?!.*-append)/i,
      /\bset-content\b/i,
      /\btee\b(?!.*-a)/i,
    ],
    reason: '覆盖式输出会直接改写目标文件，如果文件已有内容，原始信息可能被覆盖。',
    impact: '可能覆盖日志、配置文件或中间结果，影响后续排查与回滚。',
    impactScope: 'current-command',
    reversibility: 'partial',
    saferAlternative: '优先使用追加写入或先输出到临时文件，再决定是否覆盖正式文件。',
  },
]

const toRiskHint = (rule: RiskRuleDefinition): RiskHint => ({
  id: `rule-${rule.id}`,
  level: rule.level,
  title: rule.title,
  reason: rule.reason,
  impact: rule.impact,
  impactScope: rule.impactScope,
  reversibility: rule.reversibility,
  saferAlternative: rule.saferAlternative,
})

export function evaluateRiskRules(commands: CommandVariant[]): RiskHint[] {
  const matched = new Map<string, RiskHint>()

  commands.forEach((variant) => {
    riskRules.forEach((rule) => {
      if (rule.patterns.some((pattern) => pattern.test(variant.command))) {
        matched.set(rule.id, toRiskHint(rule))
      }
    })
  })

  return Array.from(matched.values())
}
