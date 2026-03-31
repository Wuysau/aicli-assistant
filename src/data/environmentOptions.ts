import type { EnvironmentOption } from '../types'

export const environmentOptions: EnvironmentOption[] = [
  {
    id: 'windows-local',
    label: 'Windows 本机',
    description: '适合 PowerShell、cmd、本机文件路径和端口排查。',
  },
  {
    id: 'wsl',
    label: 'WSL / Bash',
    description: '适合 grep、find、awk、Linux 风格路径和 Bash 管道。',
  },
  {
    id: 'remote-linux',
    label: '远端 Linux / SSH',
    description: '适合 systemctl、journalctl、容器排查和服务器侧操作。',
  },
]
