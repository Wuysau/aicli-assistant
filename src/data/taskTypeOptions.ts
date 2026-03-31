import type { TaskTypeOption } from '../types'

export const taskTypeOptions: TaskTypeOption[] = [
  {
    id: 'generate-command',
    title: '生成命令',
    description: '把一个任务翻译成适合 PowerShell、cmd、Bash/WSL 的命令。',
    inputLabel: '任务描述',
    placeholder: '例如：查看 8103 端口被谁占用，顺便给出 PowerShell 和 WSL 写法。',
  },
  {
    id: 'analyze-error',
    title: '分析报错',
    description: '结合当前环境给出更贴近 Windows 工作流的排查顺序。',
    inputLabel: '报错内容',
    placeholder: '例如：粘贴 Maven、Git、PowerShell、SSH、Docker 或端口占用报错。',
  },
  {
    id: 'judge-environment',
    title: '判断环境',
    description: '判断一条命令更适合在本机、WSL 还是远端 Linux 上执行。',
    inputLabel: '命令或任务',
    placeholder: '例如：grep "ERROR" application.log | wc -l 应该在哪个环境执行？',
  },
  {
    id: 'use-template',
    title: '使用模板',
    description: '直接套用内置的高频排障模板，避免每次从零组织步骤。',
    inputLabel: '补充说明',
    placeholder: '例如：服务跑在远端 Linux，但日志在本机同步目录里。',
  },
]
