import type { RiskRuleVerificationCase } from '../types'

export const riskRuleCases: RiskRuleVerificationCase[] = [
  {
    id: 'risk-delete',
    title: '删除命令',
    command: 'rm -rf dist',
    expectedRuleIds: ['destructive-delete'],
    expectedHighestLevel: 'high',
  },
  {
    id: 'risk-force-push',
    title: 'Git force push',
    command: 'git push --force origin main',
    expectedRuleIds: ['git-force-push'],
    expectedHighestLevel: 'high',
  },
  {
    id: 'risk-hard-reset',
    title: 'Git hard reset',
    command: 'git reset --hard HEAD~1',
    expectedRuleIds: ['git-hard-reset'],
    expectedHighestLevel: 'high',
  },
  {
    id: 'risk-docker-cleanup',
    title: 'Docker 清理',
    command: 'docker system prune -af',
    expectedRuleIds: ['docker-cleanup'],
    expectedHighestLevel: 'high',
  },
  {
    id: 'risk-overwrite-output',
    title: '覆盖输出',
    command: 'echo done > result.txt',
    expectedRuleIds: ['overwrite-output'],
    expectedHighestLevel: 'medium',
  },
]
