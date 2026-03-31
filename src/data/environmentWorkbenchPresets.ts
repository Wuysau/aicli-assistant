import type { ScenarioId } from '../types'

export interface EnvironmentWorkbenchPreset {
  id: string
  title: string
  prompt: string
  scenarioId: ScenarioId
}

export const environmentWorkbenchPresets: EnvironmentWorkbenchPreset[] = [
  {
    id: 'preset-log',
    title: '日志 grep 管道',
    prompt: 'grep "ERROR" application.log | wc -l 应该在哪个环境执行？',
    scenarioId: 'count-log-signals',
  },
  {
    id: 'preset-ssh',
    title: 'SSH 连不上',
    prompt: 'SSH 连不上 10.0.0.15，先在哪个环境开始排查？',
    scenarioId: 'ssh-connection-basic',
  },
  {
    id: 'preset-docker',
    title: 'Docker 状态检查',
    prompt: '查看 Docker 容器状态和最近日志，应该先在本机还是远端执行？',
    scenarioId: 'docker-container-status',
  },
  {
    id: 'preset-port',
    title: '本机端口冲突',
    prompt: '查看 8080 端口是谁占用，应该优先在 Windows 本机还是 WSL 做？',
    scenarioId: 'port-occupancy',
  },
]
