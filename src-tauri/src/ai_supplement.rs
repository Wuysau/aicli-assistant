use reqwest::{
  header::{HeaderName, HeaderValue},
  Client, RequestBuilder,
};
use serde::{Deserialize, Serialize};
use std::{
  fs,
  path::PathBuf,
  time::{SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Manager};

const DEFAULT_OLLAMA_BASE_URL: &str = "http://127.0.0.1:11434";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderHeader {
  pub id: String,
  pub key: String,
  pub value: String,
  pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderConfig {
  pub id: String,
  #[serde(rename = "type")]
  pub provider_type: String,
  pub name: String,
  pub enabled: bool,
  pub is_default: bool,
  pub base_url: String,
  pub api_key: Option<String>,
  pub model: String,
  #[serde(default)]
  pub custom_headers: Vec<AiProviderHeader>,
  pub created_at: String,
  pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderStore {
  pub schema_version: u8,
  pub mode: String,
  pub default_provider_id: Option<String>,
  #[serde(default)]
  pub providers: Vec<AiProviderConfig>,
  pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProviderTestResult {
  pub success: bool,
  pub provider_id: String,
  pub provider_name: String,
  pub provider_type: String,
  pub message: String,
  pub checked_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRuntimeStatus {
  pub enabled: bool,
  pub configured: bool,
  pub available: bool,
  pub mode: String,
  pub model: Option<String>,
  pub provider_count: usize,
  pub default_provider_id: Option<String>,
  pub default_provider_name: Option<String>,
  pub default_provider_type: Option<String>,
  pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSupplementRequestPayload {
  pub trigger: String,
  pub user_input: String,
  pub task_type: String,
  pub preferred_shell: String,
  pub environment: String,
  pub r#match: AiMatchPayload,
  pub local_result_summary: Option<String>,
  pub local_recommended_environment: Option<String>,
  pub allowed_templates: Vec<AiAllowedTemplate>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiMatchPayload {
  pub matched: bool,
  pub scenario_id: Option<String>,
  pub suggested_scenario_ids: Vec<String>,
  pub matched_terms: Vec<String>,
  pub score: i32,
  pub confidence: String,
  pub reason: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiAllowedTemplate {
  pub id: String,
  pub title: String,
  pub category: String,
  pub summary: String,
  pub recommended_environment: String,
  pub supported_shells: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSupplementResponse {
  pub trigger: String,
  pub summary: String,
  pub explanation_bullets: Vec<String>,
  pub environment_suggestion: Option<String>,
  pub related_template_ids: Vec<String>,
  pub recommended_next_steps: Vec<String>,
  pub difference_notes: Vec<String>,
  pub safety_notes: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAiChatCompletionResponse {
  choices: Vec<OpenAiChatChoice>,
}

#[derive(Debug, Deserialize)]
struct OpenAiChatChoice {
  message: OpenAiChatMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAiChatMessage {
  content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaGenerateResponse {
  response: String,
}

fn now_string() -> String {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_secs().to_string())
    .unwrap_or_else(|_| "0".to_string())
}

fn default_provider_store() -> AiProviderStore {
  AiProviderStore {
    schema_version: 1,
    mode: "rules-only".to_string(),
    default_provider_id: None,
    providers: vec![],
    updated_at: now_string(),
  }
}

fn provider_store_path(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app
    .path()
    .app_config_dir()
    .map_err(|_| "无法解析应用本地配置目录。".to_string())?;

  fs::create_dir_all(&dir).map_err(|_| "无法创建应用本地配置目录。".to_string())?;

  Ok(dir.join("ai-providers.json"))
}

fn normalize_provider_type(provider_type: &str) -> String {
  match provider_type.trim() {
    "ollama" => "ollama".to_string(),
    "anthropic-compatible" => "anthropic-compatible".to_string(),
    _ => "openai-compatible".to_string(),
  }
}

fn normalize_provider(mut provider: AiProviderConfig) -> AiProviderConfig {
  provider.provider_type = normalize_provider_type(&provider.provider_type);
  provider.name = provider.name.trim().to_string();
  provider.base_url = if provider.provider_type == "ollama" && provider.base_url.trim().is_empty()
  {
    DEFAULT_OLLAMA_BASE_URL.to_string()
  } else {
    provider.base_url.trim().trim_end_matches('/').to_string()
  };
  provider.model = provider.model.trim().to_string();
  provider.api_key = provider
    .api_key
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty());
  provider.custom_headers = provider
    .custom_headers
    .into_iter()
    .map(|header| AiProviderHeader {
      id: header.id,
      key: header.key.trim().to_string(),
      value: header.value.trim().to_string(),
      enabled: header.enabled,
    })
    .filter(|header| !header.key.is_empty())
    .collect();
  provider.updated_at = now_string();
  provider
}

fn normalize_store(mut store: AiProviderStore) -> AiProviderStore {
  if store.schema_version != 1 {
    return default_provider_store();
  }

  store.mode = match store.mode.as_str() {
    "supplemental" => "supplemental".to_string(),
    _ => "rules-only".to_string(),
  };

  store.providers = store
    .providers
    .into_iter()
    .map(normalize_provider)
    .collect::<Vec<_>>();

  let existing_default = store.default_provider_id.clone().and_then(|provider_id| {
    store
      .providers
      .iter()
      .find(|provider| provider.id == provider_id)
      .map(|provider| provider.id.clone())
  });

  let fallback_default = store
    .providers
    .iter()
    .find(|provider| provider.enabled)
    .map(|provider| provider.id.clone());

  let resolved_default = existing_default.or(fallback_default);

  store.default_provider_id = resolved_default.clone();
  store.providers = store
    .providers
    .into_iter()
    .map(|mut provider| {
      provider.is_default = resolved_default
        .as_ref()
        .map(|provider_id| provider.id == *provider_id)
        .unwrap_or(false);
      provider
    })
    .collect();
  store.updated_at = now_string();
  store
}

fn load_provider_store(app: &AppHandle) -> Result<AiProviderStore, String> {
  let path = provider_store_path(app)?;

  if !path.exists() {
    return Ok(default_provider_store());
  }

  let raw = fs::read_to_string(&path).map_err(|_| "无法读取 provider 配置文件。".to_string())?;
  let parsed: AiProviderStore =
    serde_json::from_str(&raw).map_err(|_| "provider 配置文件格式无效。".to_string())?;

  Ok(normalize_store(parsed))
}

fn save_provider_store_to_disk(
  app: &AppHandle,
  store: AiProviderStore,
) -> Result<AiProviderStore, String> {
  let normalized = normalize_store(store);
  let path = provider_store_path(app)?;
  let serialized = serde_json::to_string_pretty(&normalized)
    .map_err(|_| "无法序列化 provider 配置。".to_string())?;

  fs::write(path, serialized).map_err(|_| "无法写入 provider 配置文件。".to_string())?;

  Ok(normalized)
}

fn provider_is_supported(provider: &AiProviderConfig) -> bool {
  matches!(provider.provider_type.as_str(), "openai-compatible" | "ollama")
}

fn provider_is_configured(provider: &AiProviderConfig) -> bool {
  if !provider.enabled {
    return false;
  }

  match provider.provider_type.as_str() {
    "openai-compatible" => {
      !provider.base_url.is_empty()
        && !provider.model.is_empty()
        && provider.api_key.as_ref().map(|key| !key.is_empty()).unwrap_or(false)
    }
    "ollama" => !provider.model.is_empty(),
    "anthropic-compatible" => {
      !provider.base_url.is_empty()
        && !provider.model.is_empty()
        && provider.api_key.as_ref().map(|key| !key.is_empty()).unwrap_or(false)
    }
    _ => false,
  }
}

fn resolve_default_provider(store: &AiProviderStore) -> Option<AiProviderConfig> {
  if store.mode != "supplemental" {
    return None;
  }

  let preferred = store
    .default_provider_id
    .as_ref()
    .and_then(|provider_id| {
      store
        .providers
        .iter()
        .find(|provider| provider.id == *provider_id)
    })
    .filter(|provider| provider_is_supported(provider) && provider_is_configured(provider))
    .cloned();

  if preferred.is_some() {
    return preferred;
  }

  store
    .providers
    .iter()
    .find(|provider| provider.enabled && provider_is_supported(provider) && provider_is_configured(provider))
    .cloned()
}

fn apply_custom_headers(
  mut request: RequestBuilder,
  headers: &[AiProviderHeader],
) -> RequestBuilder {
  for header in headers.iter().filter(|header| header.enabled) {
    if let (Ok(name), Ok(value)) = (
      HeaderName::from_bytes(header.key.as_bytes()),
      HeaderValue::from_str(&header.value),
    ) {
      request = request.header(name, value);
    }
  }

  request
}

fn build_http_client() -> Result<Client, String> {
  Client::builder()
    .timeout(std::time::Duration::from_secs(20))
    .build()
    .map_err(|_| "无法创建 AI 请求客户端。".to_string())
}

fn build_system_prompt() -> String {
  [
    "You are a constrained AI supplement for Windows Terminal Workflow Assistant.",
    "Return strict JSON only.",
    "Do not answer as free chat.",
    "You may only help with explanation, environment suggestion, difference notes, and nearby template recommendations.",
    "Do not decide or encourage destructive execution such as rm -rf, force push, hard reset, docker prune, destructive overwrite, or any automatic execution.",
    "If uncertain, be conservative and leave optional fields empty.",
  ]
  .join(" ")
}

fn build_user_prompt(payload: &AiSupplementRequestPayload) -> String {
  let templates_json =
    serde_json::to_string_pretty(&payload.allowed_templates).unwrap_or_else(|_| "[]".to_string());
  let match_json =
    serde_json::to_string_pretty(&payload.r#match).unwrap_or_else(|_| "{}".to_string());

  format!(
    "Return JSON with this shape: \
    {{\"trigger\":string,\"summary\":string,\"explanationBullets\":string[],\"environmentSuggestion\":\"windows-local\"|\"wsl\"|\"remote-linux\"|null,\"relatedTemplateIds\":string[],\"recommendedNextSteps\":string[],\"differenceNotes\":string[],\"safetyNotes\":string[]}}.\n\
    Allowed relatedTemplateIds must come only from the allowed templates list.\n\
    Current request:\n\
    userInput: {}\n\
    taskType: {}\n\
    preferredShell: {}\n\
    environment: {}\n\
    trigger: {}\n\
    localResultSummary: {}\n\
    localRecommendedEnvironment: {}\n\
    localMatch: {}\n\
    allowedTemplates: {}",
    payload.user_input,
    payload.task_type,
    payload.preferred_shell,
    payload.environment,
    payload.trigger,
    payload
      .local_result_summary
      .clone()
      .unwrap_or_else(|| "null".to_string()),
    payload
      .local_recommended_environment
      .clone()
      .unwrap_or_else(|| "null".to_string()),
    match_json,
    templates_json,
  )
}

fn truncate_items(items: Vec<String>, max_len: usize, max_items: usize) -> Vec<String> {
  items
    .into_iter()
    .map(|item| item.trim().to_string())
    .filter(|item| !item.is_empty())
    .take(max_items)
    .map(|item| item.chars().take(max_len).collect::<String>())
    .collect()
}

fn sanitize_environment(value: Option<String>) -> Option<String> {
  match value.as_deref() {
    Some("windows-local") | Some("wsl") | Some("remote-linux") => value,
    _ => None,
  }
}

fn sanitize_related_template_ids(
  response_ids: Vec<String>,
  allowed_templates: &[AiAllowedTemplate],
) -> Vec<String> {
  let allowed_ids: Vec<&str> = allowed_templates.iter().map(|item| item.id.as_str()).collect();

  response_ids
    .into_iter()
    .filter(|id| allowed_ids.iter().any(|allowed| *allowed == id))
    .take(3)
    .collect()
}

fn sanitize_supplement(
  payload: &AiSupplementRequestPayload,
  mut response: AiSupplementResponse,
) -> AiSupplementResponse {
  response.summary = response.summary.chars().take(240).collect();
  response.explanation_bullets = truncate_items(response.explanation_bullets, 120, 3);
  response.recommended_next_steps = truncate_items(response.recommended_next_steps, 120, 3);
  response.difference_notes = truncate_items(response.difference_notes, 120, 3);
  response.safety_notes = truncate_items(response.safety_notes, 120, 3);
  response.environment_suggestion = sanitize_environment(response.environment_suggestion);
  response.related_template_ids =
    sanitize_related_template_ids(response.related_template_ids, &payload.allowed_templates);
  response.trigger = payload.trigger.clone();
  response
}

async fn test_openai_compatible(
  client: &Client,
  provider: &AiProviderConfig,
) -> Result<String, String> {
  let base_url = provider.base_url.trim_end_matches('/');
  let api_key = provider
    .api_key
    .clone()
    .ok_or_else(|| "当前 provider 缺少 API Key。".to_string())?;

  let request = client
    .post(format!("{}/chat/completions", base_url))
    .bearer_auth(api_key)
    .json(&serde_json::json!({
      "model": provider.model,
      "temperature": 0,
      "max_tokens": 8,
      "messages": [
        { "role": "user", "content": "Reply with exactly OK." }
      ]
    }));

  let response = apply_custom_headers(request, &provider.custom_headers)
    .send()
    .await
    .map_err(|_| "无法连接到 OpenAI-compatible endpoint。".to_string())?;

  if !response.status().is_success() {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    return Err(format!("连接失败：{} {}", status, body));
  }

  Ok(format!(
    "连接成功，{} 可通过 OpenAI-compatible 接口访问。",
    provider.model
  ))
}

async fn test_ollama(
  client: &Client,
  provider: &AiProviderConfig,
) -> Result<String, String> {
  let base_url = if provider.base_url.trim().is_empty() {
    DEFAULT_OLLAMA_BASE_URL.to_string()
  } else {
    provider.base_url.trim_end_matches('/').to_string()
  };

  let request = client
    .post(format!("{}/api/generate", base_url))
    .json(&serde_json::json!({
      "model": provider.model,
      "prompt": "Reply with exactly OK.",
      "stream": false,
    }));

  let response = apply_custom_headers(request, &provider.custom_headers)
    .send()
    .await
    .map_err(|_| "无法连接到 Ollama 本地接口。".to_string())?;

  if !response.status().is_success() {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    return Err(format!("连接失败：{} {}", status, body));
  }

  Ok(format!("连接成功，本地模型 {} 可用。", provider.model))
}

async fn request_openai_compatible_supplement(
  client: &Client,
  provider: &AiProviderConfig,
  payload: &AiSupplementRequestPayload,
) -> Result<AiSupplementResponse, String> {
  let base_url = provider.base_url.trim_end_matches('/');
  let api_key = provider
    .api_key
    .clone()
    .ok_or_else(|| "当前 provider 缺少 API Key。".to_string())?;

  let request = client
    .post(format!("{}/chat/completions", base_url))
    .bearer_auth(api_key)
    .json(&serde_json::json!({
      "model": provider.model,
      "temperature": 0.2,
      "response_format": { "type": "json_object" },
      "messages": [
        { "role": "system", "content": build_system_prompt() },
        { "role": "user", "content": build_user_prompt(payload) }
      ]
    }));

  let response = apply_custom_headers(request, &provider.custom_headers)
    .send()
    .await
    .map_err(|_| "AI 请求失败，请检查网络或 provider 配置。".to_string())?;

  if !response.status().is_success() {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    return Err(format!("AI 接口返回异常状态：{} {}", status, body));
  }

  let data: OpenAiChatCompletionResponse = response
    .json()
    .await
    .map_err(|_| "AI 接口返回了无法解析的响应。".to_string())?;

  let content = data
    .choices
    .first()
    .and_then(|choice| choice.message.content.clone())
    .ok_or_else(|| "AI 没有返回可用内容。".to_string())?;

  let parsed: AiSupplementResponse = serde_json::from_str(&content)
    .map_err(|_| "AI 返回内容不是合法的结构化 JSON。".to_string())?;

  Ok(sanitize_supplement(payload, parsed))
}

async fn request_ollama_supplement(
  client: &Client,
  provider: &AiProviderConfig,
  payload: &AiSupplementRequestPayload,
) -> Result<AiSupplementResponse, String> {
  let base_url = if provider.base_url.trim().is_empty() {
    DEFAULT_OLLAMA_BASE_URL.to_string()
  } else {
    provider.base_url.trim_end_matches('/').to_string()
  };

  let prompt = format!(
    "System:\n{}\n\nUser:\n{}",
    build_system_prompt(),
    build_user_prompt(payload)
  );

  let request = client
    .post(format!("{}/api/generate", base_url))
    .json(&serde_json::json!({
      "model": provider.model,
      "prompt": prompt,
      "stream": false,
      "format": "json",
      "options": { "temperature": 0.2 }
    }));

  let response = apply_custom_headers(request, &provider.custom_headers)
    .send()
    .await
    .map_err(|_| "Ollama 请求失败，请检查本地服务是否已启动。".to_string())?;

  if !response.status().is_success() {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    return Err(format!("Ollama 接口返回异常状态：{} {}", status, body));
  }

  let data: OllamaGenerateResponse = response
    .json()
    .await
    .map_err(|_| "Ollama 返回了无法解析的响应。".to_string())?;

  let parsed: AiSupplementResponse = serde_json::from_str(&data.response)
    .map_err(|_| "Ollama 返回内容不是合法的结构化 JSON。".to_string())?;

  Ok(sanitize_supplement(payload, parsed))
}

#[tauri::command]
pub fn get_ai_provider_store(app: AppHandle) -> Result<AiProviderStore, String> {
  load_provider_store(&app)
}

#[tauri::command]
pub fn save_ai_provider_store(
  app: AppHandle,
  store: AiProviderStore,
) -> Result<AiProviderStore, String> {
  save_provider_store_to_disk(&app, store)
}

#[tauri::command]
pub fn get_ai_runtime_status(app: AppHandle) -> AiRuntimeStatus {
  match load_provider_store(&app) {
    Ok(store) => {
      let default_provider = resolve_default_provider(&store);
      let provider_count = store.providers.len();

      AiRuntimeStatus {
        enabled: store.mode == "supplemental",
        configured: default_provider.is_some(),
        available: default_provider.is_some(),
        mode: store.mode.clone(),
        model: default_provider.as_ref().map(|provider| provider.model.clone()),
        provider_count,
        default_provider_id: default_provider.as_ref().map(|provider| provider.id.clone()),
        default_provider_name: default_provider.as_ref().map(|provider| provider.name.clone()),
        default_provider_type: default_provider
          .as_ref()
          .map(|provider| provider.provider_type.clone()),
        message: if store.mode != "supplemental" {
          "当前处于基础规则 / 模板模式；未启用 AI 增强。".to_string()
        } else if let Some(provider) = default_provider {
          format!(
            "AI 增强已启用，当前默认 provider 为 {}（{}）。",
            provider.name, provider.model
          )
        } else if provider_count == 0 {
          "已切换到 AI 增强模式，但尚未配置任何 provider。".to_string()
        } else {
          "已切换到 AI 增强模式，但默认 provider 未启用、未配置完成或当前类型尚未支持。"
            .to_string()
        },
      }
    }
    Err(_) => AiRuntimeStatus {
      enabled: false,
      configured: false,
      available: false,
      mode: "rules-only".to_string(),
      model: None,
      provider_count: 0,
      default_provider_id: None,
      default_provider_name: None,
      default_provider_type: None,
      message: "无法读取本地 provider 配置，当前退回基础规则 / 模板模式。".to_string(),
    },
  }
}

#[tauri::command]
pub async fn test_ai_provider_connection(
  provider: AiProviderConfig,
) -> Result<AiProviderTestResult, String> {
  let provider = normalize_provider(provider);
  let client = build_http_client()?;

  let message = match provider.provider_type.as_str() {
    "openai-compatible" => test_openai_compatible(&client, &provider).await?,
    "ollama" => test_ollama(&client, &provider).await?,
    "anthropic-compatible" => {
      return Ok(AiProviderTestResult {
        success: false,
        provider_id: provider.id,
        provider_name: provider.name,
        provider_type: provider.provider_type,
        checked_at: now_string(),
        message: "Anthropic-compatible 已预留数据结构，当前版本暂未直接支持测试连接。"
          .to_string(),
      })
    }
    _ => return Err("未知 provider 类型。".to_string()),
  };

  Ok(AiProviderTestResult {
    success: true,
    provider_id: provider.id,
    provider_name: provider.name,
    provider_type: provider.provider_type,
    message,
    checked_at: now_string(),
  })
}

#[tauri::command]
pub async fn generate_ai_supplement(
  app: AppHandle,
  payload: AiSupplementRequestPayload,
) -> Result<AiSupplementResponse, String> {
  let store = load_provider_store(&app)?;
  let provider = resolve_default_provider(&store).ok_or_else(|| {
    "当前没有可用的默认 provider；请先在设置页启用 AI 增强并配置 provider。".to_string()
  })?;

  let client = build_http_client()?;

  match provider.provider_type.as_str() {
    "openai-compatible" => request_openai_compatible_supplement(&client, &provider, &payload).await,
    "ollama" => request_ollama_supplement(&client, &provider, &payload).await,
    "anthropic-compatible" => Err(
      "Anthropic-compatible 已预留结构，当前版本尚未直接支持请求补充结果。".to_string(),
    ),
    _ => Err("未知 provider 类型。".to_string()),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn provider(
    id: &str,
    provider_type: &str,
    enabled: bool,
    is_default: bool,
    base_url: &str,
    model: &str,
    api_key: Option<&str>,
  ) -> AiProviderConfig {
    AiProviderConfig {
      id: id.to_string(),
      provider_type: provider_type.to_string(),
      name: id.to_string(),
      enabled,
      is_default,
      base_url: base_url.to_string(),
      api_key: api_key.map(|value| value.to_string()),
      model: model.to_string(),
      custom_headers: vec![],
      created_at: "0".to_string(),
      updated_at: "0".to_string(),
    }
  }

  #[test]
  fn resolves_first_usable_provider_when_default_is_disabled() {
    let store = AiProviderStore {
      schema_version: 1,
      mode: "supplemental".to_string(),
      default_provider_id: Some("default".to_string()),
      providers: vec![
        provider(
          "default",
          "openai-compatible",
          false,
          true,
          "https://api.openai.com/v1",
          "gpt-4.1-mini",
          Some("sk-test"),
        ),
        provider(
          "fallback",
          "openai-compatible",
          true,
          false,
          "https://dashscope.aliyuncs.com/compatible-mode/v1",
          "qwen-plus",
          Some("sk-live"),
        ),
      ],
      updated_at: "0".to_string(),
    };

    let resolved = resolve_default_provider(&store).expect("expected a usable fallback provider");

    assert_eq!(resolved.id, "fallback");
  }

  #[test]
  fn skips_unsupported_default_provider_and_uses_supported_fallback() {
    let store = AiProviderStore {
      schema_version: 1,
      mode: "supplemental".to_string(),
      default_provider_id: Some("anthropic".to_string()),
      providers: vec![
        provider(
          "anthropic",
          "anthropic-compatible",
          true,
          true,
          "https://api.anthropic.com",
          "claude-sonnet-4-0",
          Some("sk-test"),
        ),
        provider(
          "ollama",
          "ollama",
          true,
          false,
          "http://127.0.0.1:11434",
          "qwen2.5:7b",
          None,
        ),
      ],
      updated_at: "0".to_string(),
    };

    let resolved = resolve_default_provider(&store).expect("expected supported fallback provider");

    assert_eq!(resolved.id, "ollama");
  }
}
