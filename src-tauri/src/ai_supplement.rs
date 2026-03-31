use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AiRuntimeStatus {
  pub enabled: bool,
  pub configured: bool,
  pub available: bool,
  pub mode: String,
  pub model: Option<String>,
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
struct ChatCompletionResponse {
  choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
  message: ChatMessage,
}

#[derive(Debug, Deserialize)]
struct ChatMessage {
  content: Option<String>,
}

fn ai_runtime_status_from_env() -> AiRuntimeStatus {
  let mode = env::var("AICLI_AI_MODE").unwrap_or_else(|_| "disabled".to_string());
  let model = env::var("AICLI_AI_MODEL").ok();
  let base_url = env::var("AICLI_AI_BASE_URL").ok();
  let api_key = env::var("AICLI_AI_API_KEY").ok();
  let enabled = mode == "supplemental";
  let configured = enabled && model.is_some() && base_url.is_some() && api_key.is_some();

  AiRuntimeStatus {
    enabled,
    configured,
    available: configured,
    mode,
    model,
    message: if configured {
      "AI 补充能力已启用，仅在规则未命中、置信度较低或说明不足时补充解释。".to_string()
    } else {
      "当前保持离线或仅规则模式；未启用 AI 补充能力。".to_string()
    },
  }
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

#[tauri::command]
pub fn get_ai_runtime_status() -> AiRuntimeStatus {
  ai_runtime_status_from_env()
}

#[tauri::command]
pub async fn generate_ai_supplement(
  payload: AiSupplementRequestPayload,
) -> Result<AiSupplementResponse, String> {
  let runtime = ai_runtime_status_from_env();

  if !runtime.available {
    return Err(runtime.message);
  }

  let base_url =
    env::var("AICLI_AI_BASE_URL").map_err(|_| "缺少 AICLI_AI_BASE_URL 配置。".to_string())?;
  let api_key =
    env::var("AICLI_AI_API_KEY").map_err(|_| "缺少 AICLI_AI_API_KEY 配置。".to_string())?;
  let model =
    env::var("AICLI_AI_MODEL").map_err(|_| "缺少 AICLI_AI_MODEL 配置。".to_string())?;

  let client = reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(20))
    .build()
    .map_err(|_| "无法创建 AI 请求客户端。".to_string())?;

  let response = client
    .post(format!("{}/chat/completions", base_url.trim_end_matches('/')))
    .bearer_auth(api_key)
    .json(&serde_json::json!({
      "model": model,
      "temperature": 0.2,
      "response_format": { "type": "json_object" },
      "messages": [
        { "role": "system", "content": build_system_prompt() },
        { "role": "user", "content": build_user_prompt(&payload) }
      ]
    }))
    .send()
    .await
    .map_err(|_| "AI 请求失败，请检查网络或接口配置。".to_string())?;

  if !response.status().is_success() {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    return Err(format!("AI 接口返回异常状态：{} {}", status, body));
  }

  let data: ChatCompletionResponse = response
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

  Ok(sanitize_supplement(&payload, parsed))
}
