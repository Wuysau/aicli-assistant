import type { AppViewOption } from '../types'

export const appViewOptions: AppViewOption[] = [
  {
    id: 'workbench',
    label: '工作台',
    description: '围绕一次具体任务生成命令、排查建议和风险提示。',
  },
  {
    id: 'template-library',
    label: '模板库',
    description: '浏览首批 10 个内置场景，支持搜索、排序和查看详情。',
  },
  {
    id: 'environment-lab',
    label: '环境判断',
    description: '先判断任务该在哪里执行，再决定要用哪个 Shell 和哪条命令。',
  },
  {
    id: 'settings',
    label: 'AI 设置',
    description: '管理多 provider 配置、默认 provider、测试连接和 AI 增强模式。',
  },
]
