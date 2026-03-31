import type { AiProviderType } from '../types'

export interface AiProviderExample {
  id: string
  type: AiProviderType
  title: string
  summary: string
  baseUrl: string
  authHint: string
  modelHint: string
}

export const aiProviderExamples: AiProviderExample[] = [
  {
    id: 'openai',
    type: 'openai-compatible',
    title: 'OpenAI-compatible: OpenAI',
    summary: '适合直接使用标准 OpenAI-compatible Chat Completions 接口。',
    baseUrl: 'https://api.openai.com/v1',
    authHint: '使用标准 Bearer API Key。',
    modelHint: '例如 gpt-4.1-mini、gpt-4.1 或其他兼容模型。',
  },
  {
    id: 'gemini-openai',
    type: 'openai-compatible',
    title: 'OpenAI-compatible: Gemini',
    summary: 'Gemini 提供 OpenAI-compatible endpoint 时可按兼容模式接入。',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    authHint: '填写对应平台签发的 API Key。',
    modelHint: '例如 gemini-2.5-flash 等兼容模型名。',
  },
  {
    id: 'custom-openai',
    type: 'openai-compatible',
    title: '自定义兼容端点',
    summary: '适用于各类私有代理、网关或第三方 OpenAI-compatible 服务。',
    baseUrl: 'https://your-endpoint.example.com/v1',
    authHint: '可使用 API Key，也可补充自定义 headers。',
    modelHint: '填写该服务实际支持的模型名。',
  },
  {
    id: 'ollama',
    type: 'ollama',
    title: 'Ollama / Local',
    summary: '适合本地模型，默认接口通常运行在本机 11434 端口。',
    baseUrl: 'http://127.0.0.1:11434',
    authHint: '通常不需要 API Key；如经过反向代理可补自定义 headers。',
    modelHint: '例如 qwen2.5:7b、llama3.1:8b 或本地已拉取的模型。',
  },
  {
    id: 'anthropic-reserved',
    type: 'anthropic-compatible',
    title: 'Anthropic-compatible（预留）',
    summary: '已预留数据结构，当前版本暂不直接发起 Anthropic-compatible 请求。',
    baseUrl: 'https://api.anthropic.com',
    authHint: '当前版本仅作为未来扩展占位。',
    modelHint: '后续可在不改前端结构的前提下补充支持。',
  },
]
