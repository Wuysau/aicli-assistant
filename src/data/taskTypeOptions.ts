import type { TaskTypeOption } from '../types'

export const taskTypeOptions: TaskTypeOption[] = [
  {
    id: 'generate-command',
    title: '跨 Shell 生成',
    description: '把同一任务整理成 PowerShell、cmd、WSL / Bash 可执行写法，并提示差异。',
    inputLabel: '任务描述',
    placeholder:
      '例如：查看 8103 端口被谁占用，并给出 PowerShell、cmd 和 WSL 的写法。',
  },
  {
    id: 'analyze-error',
    title: '报错拆解',
    description: '结合 Windows、本机、WSL 和 SSH 场景，给出更贴近工作流的排查顺序。',
    inputLabel: '报错内容',
    placeholder:
      '例如：Git push 被 hook 拒绝、PowerShell 执行策略报错、Java 端口冲突。',
  },
  {
    id: 'judge-environment',
    title: '环境判断',
    description: '判断任务更适合在 Windows 本机、WSL 还是远程 Linux 中执行。',
    inputLabel: '命令或任务',
    placeholder:
      '例如：`grep "ERROR" application.log | wc -l` 应该在哪个环境执行？',
  },
  {
    id: 'use-template',
    title: '使用模板',
    description: '直接套用高频内置场景，不从零组织命令和步骤。',
    inputLabel: '补充说明',
    placeholder:
      '例如：服务在本机，但日志在远程机器；或者直接从下方模板区选择场景。',
  },
]
