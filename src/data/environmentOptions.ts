import type { EnvironmentOption } from '../types'

export const environmentOptions: EnvironmentOption[] = [
  {
    id: 'windows-local',
    label: 'Windows 本机',
    description: '适合 PowerShell、cmd、本机端口排查和 Windows 路径处理。',
  },
  {
    id: 'wsl',
    label: 'WSL / Bash',
    description: '适合 grep、awk、find、lsof 和 Linux 风格的文本与管道处理。',
  },
  {
    id: 'remote-linux',
    label: '远程 Linux / SSH',
    description: '适合 systemctl、journalctl、容器排查和服务端操作。',
  },
]
