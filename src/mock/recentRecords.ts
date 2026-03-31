import type { RecentRecord } from '../types'

export const recentRecords: RecentRecord[] = [
  {
    id: 'record-1',
    taskType: 'generate-command',
    title: '查看 8103 端口占用',
    summary: '生成了 PowerShell、cmd 和 WSL 三套写法。',
    timestamp: '今天 08:32',
    preferredShell: 'powershell',
    environment: 'windows-local',
  },
  {
    id: 'record-2',
    taskType: 'analyze-error',
    title: 'PowerShell 执行策略报错',
    summary: '建议先检查 ExecutionPolicy，再判断是否需要 RemoteSigned。',
    timestamp: '今天 07:58',
    preferredShell: 'powershell',
    environment: 'windows-local',
  },
  {
    id: 'record-3',
    taskType: 'judge-environment',
    title: 'grep 管道命令应该在哪执行',
    summary: '判定更适合 Bash / WSL，本机 PowerShell 需要改写。',
    timestamp: '昨天 22:14',
    preferredShell: 'wsl',
    environment: 'wsl',
  },
]
