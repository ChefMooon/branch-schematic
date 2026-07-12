use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use rand::{rngs::StdRng, RngCore, SeedableRng};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{Row, SqlitePool};
use std::io::{BufRead, BufReader, Write};
use tauri::Emitter;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct AuthProfileRow {
    pub id: String,
    pub display_name: String,
    pub auth_level: String,
    pub username: Option<String>,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
    pub api_base_url: Option<String>,
    pub repository_scope: Option<Vec<String>>,
    pub folder_scope: Option<Vec<String>>,
    pub commit_name: Option<String>,
    pub commit_email: Option<String>,
    pub token_value: Option<String>,
    pub token_expires_at: Option<String>,
    pub last_token_check_at: Option<String>,
    pub is_active: i64,
    pub is_favorite: i64,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub struct AuthProfileInput {
    pub id: Option<String>,
    pub display_name: String,
    pub auth_level: String,
    pub username: Option<String>,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
    pub api_base_url: Option<String>,
    pub repository_scope: Option<Vec<String>>,
    pub folder_scope: Option<Vec<String>>,
    pub commit_name: Option<String>,
    pub commit_email: Option<String>,
    pub token_value: Option<String>,
    pub token_expires_at: Option<String>,
    pub last_token_check_at: Option<String>,
    pub is_active: Option<i64>,
    pub is_favorite: Option<i64>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TokenHealthPayload {
    pub profile_id: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OAuthExchangePayload {
    pub profile_id: String,
    pub code: String,
    pub redirect_uri: String,
    pub provider_url: Option<String>,
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub code_verifier: Option<String>,
    pub state: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitHubUserProfilePayload {
    pub username: Option<String>,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OAuthExchangeResponse {
    pub token: String,
    pub username: Option<String>,
    pub email: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
}

fn normalize_auth_level(value: &str) -> String {
    match value {
        "local_system" => "local_system".to_string(),
        "full_oauth" => "full_oauth".to_string(),
        _ => "basic".to_string(),
    }
}

fn generate_random_secret(length: usize) -> String {
    let mut bytes = vec![0u8; length];
    let mut rng = StdRng::from_os_rng();
    rng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn generate_code_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let hashed = hasher.finalize();
    URL_SAFE_NO_PAD.encode(hashed)
}

fn build_keyring_entry_name(profile_id: &str, provider: &str) -> String {
    format!("branch-schematic:{provider}:{profile_id}")
}

fn resolve_provider_name(provider_url: Option<&str>, provider_override: Option<&str>) -> String {
    if let Some(provider_override) = provider_override.filter(|value| !value.trim().is_empty()) {
        return provider_override.trim().to_lowercase();
    }

    if let Some(provider_url) = provider_url.filter(|value| !value.trim().is_empty()) {
        if provider_url.contains("github") {
            return "github".to_string();
        }
    }

    "github".to_string()
}

async fn persist_token_in_keyring(profile_id: &str, provider: &str, token: &str) -> Result<(), String> {
    let entry_name = build_keyring_entry_name(profile_id, provider);
    let entry = keyring::Entry::new("branch-schematic", &entry_name)
        .map_err(|error| format!("Unable to access keyring: {error}"))?;
    entry
        .set_password(token)
        .map_err(|error| format!("Unable to store token in keyring: {error}"))?;
    Ok(())
}

async fn load_token_from_keyring(profile_id: &str, provider: &str) -> Result<Option<String>, String> {
    let entry_name = build_keyring_entry_name(profile_id, provider);
    let entry = keyring::Entry::new("branch-schematic", &entry_name)
        .map_err(|error| format!("Unable to access keyring: {error}"))?;

    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(format!("Unable to read token from keyring: {error}")),
    }
}

async fn clear_token_from_keyring(profile_id: &str, provider: &str) -> Result<(), String> {
    let entry_name = build_keyring_entry_name(profile_id, provider);
    let entry = keyring::Entry::new("branch-schematic", &entry_name)
        .map_err(|error| format!("Unable to access keyring: {error}"))?;

    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(format!("Unable to remove token from keyring: {error}")),
    }
}

fn normalize_scope_values(values: Option<Vec<String>>) -> Vec<String> {
    values
        .unwrap_or_default()
        .into_iter()
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
        .collect()
}

fn determine_token_status(token_value: Option<&str>, token_expires_at: Option<&str>) -> String {
    let Some(token) = token_value else {
        return "none".to_string();
    };

    if token.trim().is_empty() {
        return "none".to_string();
    }

    if let Some(expires_at) = token_expires_at {
        if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(expires_at) {
            if parsed.timestamp() <= chrono::Utc::now().timestamp() {
                return "expired".to_string();
            }
        }
    }

    "healthy".to_string()
}

fn select_access_token(keyring_token: Option<String>, database_token: Option<String>) -> Option<String> {
    let keyring_token = keyring_token.and_then(|value| {
        let trimmed = value.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    });

    keyring_token.or_else(|| {
        database_token.and_then(|value| {
            let trimmed = value.trim();
            (!trimmed.is_empty()).then(|| trimmed.to_string())
        })
    })
}

fn select_access_token_with_keyring_fallback(
    keyring_token: Result<Option<String>, String>,
    database_token: Option<String>,
) -> Option<String> {
    match keyring_token {
        Ok(token) => select_access_token(token, database_token),
        Err(error) => {
            eprintln!("Unable to read token from keyring, falling back to database token: {error}");
            select_access_token(None, database_token)
        }
    }
}

fn resolve_oauth_token_url(provider_url: Option<&str>, api_base_url: Option<&str>) -> String {
    if let Some(provider_url) = provider_url.filter(|value| !value.trim().is_empty()) {
        return provider_url.trim().to_string();
    }

    if let Some(api_base_url) = api_base_url.filter(|value| !value.trim().is_empty()) {
        let trimmed = api_base_url.trim();
        if trimmed.contains("api.github.com") {
            return "https://github.com/login/oauth/access_token".to_string();
        }

        if let Ok(parsed) = url::Url::parse(trimmed) {
            if let Ok(joined) = parsed.join("/login/oauth/access_token") {
                return joined.to_string();
            }
        }
    }

    "https://github.com/login/oauth/access_token".to_string()
}

fn ensure_env_loaded() {
    let _ = dotenv::dotenv();
}

fn resolve_oauth_client_id(explicit_client_id: Option<&str>) -> String {
    ensure_env_loaded();
    explicit_client_id
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string)
        .or_else(|| std::env::var("GITHUB_CLIENT_ID").ok())
        .or_else(|| std::env::var("VITE_GITHUB_CLIENT_ID").ok())
        .unwrap_or_else(|| "branch-schematic".to_string())
}

fn resolve_oauth_redirect_uri(explicit_redirect_uri: Option<&str>) -> Result<(String, Option<Vec<u16>>), String> {
    ensure_env_loaded();
    let fallback_redirect_uri = "http://127.0.0.1:3000/callback";
    let configured_redirect_uri = explicit_redirect_uri
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string)
        .or_else(|| std::env::var("OAUTH_REDIRECT_URI").ok())
        .or_else(|| std::env::var("VITE_OAUTH_REDIRECT_URI").ok())
        .unwrap_or_else(|| fallback_redirect_uri.to_string());

    let redirect_uri = configured_redirect_uri.trim();

    let parsed = url::Url::parse(redirect_uri)
        .map_err(|_| format!("Invalid redirect URI: {redirect_uri}"))?;
    let host = parsed.host_str().unwrap_or_default();
    if !matches!(host, "127.0.0.1" | "localhost") {
        return Err(format!("OAuth redirect URI must use localhost: {redirect_uri}"));
    }

    let port = parsed.port().ok_or_else(|| format!("OAuth redirect URI must include a port: {redirect_uri}"))?;
    Ok((redirect_uri.to_string(), Some(vec![port])))
}

fn resolve_oauth_client_secret(explicit_client_secret: Option<&str>) -> Option<String> {
    ensure_env_loaded();
    explicit_client_secret
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string)
        .or_else(|| std::env::var("GITHUB_CLIENT_SECRET").ok())
        .or_else(|| std::env::var("VITE_GITHUB_CLIENT_SECRET").ok())
}

fn parse_access_token(body: &str) -> Option<String> {
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(body) {
        if let Some(token) = parsed.get("access_token").and_then(serde_json::Value::as_str) {
            return Some(token.to_string());
        }
    }

    for entry in body.split('&').filter(|segment| !segment.is_empty()) {
        let mut parts = entry.splitn(2, '=');
        let key = parts.next().unwrap_or_default();
        if key == "access_token" || key == "token" {
            if let Some(value) = parts.next() {
                return Some(value.to_string());
            }
        }
    }

    None
}

fn parse_github_user_profile(body: &str) -> Result<GitHubUserProfilePayload, String> {
    let parsed = serde_json::from_str::<serde_json::Value>(body)
        .map_err(|error| format!("Unable to parse GitHub user profile response: {error}"))?;

    let username = parsed
        .get("login")
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string);

    let display_name = parsed
        .get("name")
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string);

    let email = parsed
        .get("email")
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string);

    let avatar_url = parsed
        .get("avatar_url")
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string);

    Ok(GitHubUserProfilePayload {
        username,
        email,
        display_name,
        avatar_url,
    })
}

fn resolve_github_user_info_url(provider_url: Option<&str>) -> String {
    if let Some(provider_url) = provider_url.filter(|value| !value.trim().is_empty()) {
        let trimmed = provider_url.trim();
        if trimmed.contains("api.github.com") || trimmed.contains("github.com/login/oauth/access_token") {
            return "https://api.github.com/user".to_string();
        }

        if let Ok(parsed) = url::Url::parse(trimmed) {
            if let Ok(joined) = parsed.join("/user") {
                return joined.to_string();
            }
        }
    }

    "https://api.github.com/user".to_string()
}

async fn fetch_github_user_profile(access_token: &str, provider_url: Option<&str>) -> Result<GitHubUserProfilePayload, String> {
    let user_url = resolve_github_user_info_url(provider_url);
    let response = reqwest::Client::new()
        .get(&user_url)
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "branch-schematic")
        .send()
        .await
        .map_err(|error| format!("Unable to fetch GitHub user profile: {error}"))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("Unable to read GitHub user profile: {status}"));
    }

    let body = response.text().await.map_err(|error| error.to_string())?;
    parse_github_user_profile(&body)
}

async fn exchange_code_with_provider(payload: &OAuthExchangePayload) -> Result<String, String> {
    let normalized_code = payload.code.trim();
    if normalized_code.is_empty() {
        return Err("Missing OAuth code".to_string());
    }

    let provider_url = resolve_oauth_token_url(payload.provider_url.as_deref(), None);
    let client_id = resolve_oauth_client_id(payload.client_id.as_deref());
    let client_secret = resolve_oauth_client_secret(payload.client_secret.as_deref());
    let mut params = vec![
        ("code", normalized_code.to_string()),
        ("client_id", client_id),
        ("redirect_uri", payload.redirect_uri.clone()),
    ];

    if let Some(code_verifier) = payload.code_verifier.as_deref().filter(|value| !value.trim().is_empty()) {
        params.push(("code_verifier", code_verifier.to_string()));
    }

    if let Some(client_secret) = client_secret {
        params.push(("client_secret", client_secret));
    }

    let response = reqwest::Client::new()
        .post(provider_url)
        .form(&params)
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "OAuth token exchange failed ({}): {}",
            status,
            body
        ));
    }

    let body = response.text().await.map_err(|error| error.to_string())?;
    if let Some(token) = parse_access_token(&body) {
        return Ok(token);
    }

    Err("OAuth token exchange succeeded but access_token was missing from the response.".to_string())
}

async fn ensure_seed_profile(pool: &SqlitePool) -> Result<(), String> {
    let existing: Option<String> = sqlx::query_scalar::<_, String>("SELECT id FROM auth_profiles WHERE id = $1")
        .bind("local-basic-profile")
        .fetch_optional(pool)
        .await
        .map_err(|error| error.to_string())?;

    if existing.is_some() {
        return Ok(());
    }

    sqlx::query(
        "INSERT INTO auth_profiles (id, profile_name, is_active, is_favorite, auth_level, commit_name, commit_email, github_username, github_avatar_url, api_base_url, oauth_token) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)",
    )
    .bind("local-basic-profile")
    .bind("Local workspace")
    .bind(1_i64)
    .bind(0_i64)
    .bind("basic")
    .bind("Local user")
    .bind("local@example.com")
    .bind::<Option<String>>(None)
    .bind::<Option<String>>(None)
    .bind("https://api.github.com")
    .bind::<Option<String>>(None)
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    Ok(())
}

async fn fetch_profile_row(pool: &SqlitePool, profile_id: &str) -> Result<Option<AuthProfileRow>, String> {
    let row = sqlx::query(
        "SELECT id, profile_name AS display_name, is_active, is_favorite, auth_level, commit_name, commit_email, github_username, github_avatar_url, api_base_url, oauth_token FROM auth_profiles WHERE id = $1"
    )
    .bind(profile_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())?;

    let Some(row) = row else {
        return Ok(None);
    };

    let scopes = load_repo_scopes(pool, profile_id).await?;
    let provider_name = resolve_provider_name(row.get::<Option<String>, _>("api_base_url").as_deref(), None);
    let keyring_token = load_token_from_keyring(&profile_id, &provider_name).await;
    let database_token = row.get::<Option<String>, _>("oauth_token");
    let token_value = select_access_token_with_keyring_fallback(keyring_token, database_token);

    Ok(Some(AuthProfileRow {
        id: row.get("id"),
        display_name: row.get("display_name"),
        auth_level: row.get("auth_level"),
        username: row.get("github_username"),
        email: row.get("commit_email"),
        avatar_url: row.get("github_avatar_url"),
        api_base_url: row.get("api_base_url"),
        repository_scope: Some(scopes),
        folder_scope: Some(Vec::new()),
        commit_name: row.get("commit_name"),
        commit_email: row.get("commit_email"),
        token_value: token_value.or_else(|| row.get("oauth_token")),
        token_expires_at: None,
        last_token_check_at: None,
        is_active: row.get("is_active"),
        is_favorite: row.get("is_favorite"),
        created_at: None,
        updated_at: None,
    }))
}

async fn load_repo_scopes(pool: &SqlitePool, profile_id: &str) -> Result<Vec<String>, String> {
    let rows = sqlx::query("SELECT repo_path_id FROM profile_repo_scopes WHERE profile_id = $1 ORDER BY repo_path_id")
        .bind(profile_id)
        .fetch_all(pool)
        .await
        .map_err(|error| error.to_string())?;

    let mut scopes = Vec::new();
    for row in rows {
        scopes.push(row.get("repo_path_id"));
    }
    Ok(scopes)
}

async fn save_repo_scopes(pool: &SqlitePool, profile_id: &str, scopes: &[String]) -> Result<(), String> {
    sqlx::query("DELETE FROM profile_repo_scopes WHERE profile_id = $1")
        .bind(profile_id)
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;

    for scope in scopes.iter().filter(|entry| !entry.trim().is_empty()) {
        sqlx::query("INSERT OR IGNORE INTO profile_repo_scopes (repo_path_id, profile_id) VALUES ($1, $2)")
            .bind(scope)
            .bind(profile_id)
            .execute(pool)
            .await
            .map_err(|error| error.to_string())?;
    }

    Ok(())
}

async fn set_active_profile(pool: &SqlitePool, profile_id: &str) -> Result<(), String> {
    sqlx::query("UPDATE auth_profiles SET is_active = CASE WHEN id = $1 THEN 1 ELSE 0 END")
        .bind(profile_id)
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_profiles(state: tauri::State<'_, crate::DbState>) -> Result<Vec<AuthProfileRow>, String> {
    let pool = &state.0;
    ensure_seed_profile(pool).await?;

    let rows = sqlx::query(
        "SELECT id, profile_name AS display_name, is_active, is_favorite, auth_level, commit_name, commit_email, github_username, github_avatar_url, api_base_url, oauth_token FROM auth_profiles ORDER BY is_favorite DESC, is_active DESC, profile_name ASC"
    )
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;

    let mut profiles = Vec::new();
    for row in rows {
        let profile_id: String = row.get("id");
        let provider_name = resolve_provider_name(row.get::<Option<String>, _>("api_base_url").as_deref(), None);
        let keyring_token = load_token_from_keyring(&profile_id, &provider_name).await;
        let database_token = row.get::<Option<String>, _>("oauth_token");
        let token_value = select_access_token_with_keyring_fallback(keyring_token, database_token);
        let scopes = load_repo_scopes(pool, &profile_id).await?;
        profiles.push(AuthProfileRow {
            id: profile_id.clone(),
            display_name: row.get("display_name"),
            auth_level: row.get("auth_level"),
            username: row.get("github_username"),
            email: row.get("commit_email"),
            avatar_url: row.get("github_avatar_url"),
            api_base_url: row.get("api_base_url"),
            repository_scope: Some(scopes),
            folder_scope: Some(Vec::new()),
            commit_name: row.get("commit_name"),
            commit_email: row.get("commit_email"),
            token_value,
            token_expires_at: None,
            last_token_check_at: None,
            is_active: row.get("is_active"),
            is_favorite: row.get("is_favorite"),
            created_at: None,
            updated_at: None,
        });
    }

    Ok(profiles)
}

#[tauri::command]
pub async fn add_profile(state: tauri::State<'_, crate::DbState>, profile: AuthProfileInput) -> Result<AuthProfileRow, String> {
    let pool = &state.0;
    ensure_seed_profile(pool).await?;

    let profile_id = profile.id.unwrap_or_else(|| Uuid::new_v4().to_string());
    let provider_name = resolve_provider_name(profile.api_base_url.as_deref(), None);
    let should_activate = profile.is_active.unwrap_or(0) == 1 || sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM auth_profiles WHERE is_active = 1")
        .fetch_one(pool)
        .await
        .map_err(|error| error.to_string())? == 0;
    let persist_token = profile.token_value.as_deref().filter(|value| !value.trim().is_empty()).map(str::to_string);

    if let Some(token_value) = persist_token.as_deref() {
        persist_token_in_keyring(&profile_id, &provider_name, token_value).await?;
    }

    sqlx::query(
        "INSERT INTO auth_profiles (id, profile_name, is_active, is_favorite, auth_level, commit_name, commit_email, github_username, github_avatar_url, api_base_url, oauth_token) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"
    )
    .bind(&profile_id)
    .bind(profile.display_name.trim())
    .bind(if should_activate { 1_i64 } else { 0_i64 })
    .bind(profile.is_favorite.unwrap_or(0))
    .bind(normalize_auth_level(&profile.auth_level))
    .bind(profile.commit_name.unwrap_or_else(|| "Local user".to_string()))
    .bind(profile.commit_email.unwrap_or_else(|| "local@example.com".to_string()))
    .bind(profile.username)
    .bind(profile.avatar_url)
    .bind(profile.api_base_url.unwrap_or_else(|| "https://api.github.com".to_string()))
    .bind(persist_token.clone())
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    if should_activate {
        set_active_profile(pool, &profile_id).await?;
    }

    let scopes = normalize_scope_values(profile.repository_scope);
    save_repo_scopes(pool, &profile_id, &scopes).await?;

    fetch_profile_row(pool, &profile_id).await?.ok_or_else(|| "Unable to reload newly created profile".to_string())
}

#[tauri::command]
pub async fn update_profile(
    state: tauri::State<'_, crate::DbState>,
    profile_id: String,
    profile: AuthProfileInput,
) -> Result<AuthProfileRow, String> {
    let pool = &state.0;
    ensure_seed_profile(pool).await?;

    let should_activate = profile.is_active.unwrap_or(0) == 1;
    let provider_name = resolve_provider_name(profile.api_base_url.as_deref(), None);
    let persist_token = profile.token_value.as_deref().filter(|value| !value.trim().is_empty()).map(str::to_string);
    if should_activate {
        set_active_profile(pool, &profile_id).await?;
    }

    if let Some(token_value) = persist_token.as_deref() {
        persist_token_in_keyring(&profile_id, &provider_name, token_value).await?;
    }

    sqlx::query(
        "UPDATE auth_profiles SET profile_name = $1, auth_level = $2, commit_name = $3, commit_email = $4, github_username = $5, github_avatar_url = $6, api_base_url = $7, oauth_token = $8, is_favorite = $9 WHERE id = $10"
    )
    .bind(profile.display_name.trim())
    .bind(normalize_auth_level(&profile.auth_level))
    .bind(profile.commit_name.unwrap_or_else(|| "Local user".to_string()))
    .bind(profile.commit_email.unwrap_or_else(|| "local@example.com".to_string()))
    .bind(profile.username)
    .bind(profile.avatar_url)
    .bind(profile.api_base_url.unwrap_or_else(|| "https://api.github.com".to_string()))
    .bind(persist_token.clone())
    .bind(profile.is_favorite.unwrap_or(0))
    .bind(&profile_id)
    .execute(pool)
    .await
    .map_err(|error| error.to_string())?;

    if should_activate {
        sqlx::query("UPDATE auth_profiles SET is_active = CASE WHEN id = $1 THEN 1 ELSE 0 END")
            .bind(&profile_id)
            .execute(pool)
            .await
            .map_err(|error| error.to_string())?;
    }

    let scopes = normalize_scope_values(profile.repository_scope);
    save_repo_scopes(pool, &profile_id, &scopes).await?;

    fetch_profile_row(pool, &profile_id).await?.ok_or_else(|| "Unable to reload updated profile".to_string())
}

#[tauri::command]
pub async fn delete_profile(state: tauri::State<'_, crate::DbState>, profile_id: String) -> Result<(), String> {
    let pool = &state.0;
    ensure_seed_profile(pool).await?;

    let active_profile: Option<String> = sqlx::query_scalar::<_, String>("SELECT id FROM auth_profiles WHERE id = $1 AND is_active = 1")
        .bind(&profile_id)
        .fetch_optional(pool)
        .await
        .map_err(|error| error.to_string())?;

    sqlx::query("DELETE FROM auth_profiles WHERE id = $1")
        .bind(&profile_id)
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;

    let provider_name = resolve_provider_name(None, Some("github"));
    if let Err(error) = clear_token_from_keyring(&profile_id, &provider_name).await {
        eprintln!("Failed to clear stored token: {error}");
    }

    if active_profile.is_some() {
        let next_profile: Option<String> = sqlx::query_scalar::<_, String>("SELECT id FROM auth_profiles ORDER BY is_favorite DESC, is_active DESC, profile_name ASC LIMIT 1")
            .fetch_optional(pool)
            .await
            .map_err(|error| error.to_string())?;
        if let Some(next_profile_id) = next_profile {
            set_active_profile(pool, &next_profile_id).await?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn check_profile_tokens(
    state: tauri::State<'_, crate::DbState>,
    profile_ids: Vec<String>,
) -> Result<Vec<TokenHealthPayload>, String> {
    let pool = &state.0;
    ensure_seed_profile(pool).await?;

    let requested_ids = if profile_ids.is_empty() {
        let rows = sqlx::query_scalar::<_, String>("SELECT id FROM auth_profiles ORDER BY is_favorite DESC, is_active DESC, profile_name")
            .fetch_all(pool)
            .await
            .map_err(|error| error.to_string())?;
        rows
    } else {
        profile_ids
    };

    let mut payloads = Vec::new();
    for profile_id in requested_ids {
        let profile = fetch_profile_row(pool, &profile_id).await?;
        let Some(profile) = profile else {
            continue;
        };
        payloads.push(TokenHealthPayload {
            profile_id: profile.id,
            status: determine_token_status(profile.token_value.as_deref(), profile.token_expires_at.as_deref()),
        });
    }

    Ok(payloads)
}

#[tauri::command]
pub async fn begin_oauth_loopback_listener(
    window: tauri::Window,
    profile_id: String,
    redirect_uri: Option<String>,
) -> Result<String, String> {
    let (configured_redirect_uri, configured_ports) = resolve_oauth_redirect_uri(redirect_uri.as_deref())?;
    let selected_port = configured_ports
        .as_ref()
        .and_then(|ports| ports.first())
        .copied();
    let listener = if let Some(port) = selected_port {
        std::net::TcpListener::bind(("127.0.0.1", port))
            .map_err(|error| format!("Unable to start local OAuth listener on port {port}: {error}"))?
    } else {
        std::net::TcpListener::bind(("127.0.0.1", 0))
            .map_err(|error| format!("Unable to start local OAuth listener on an ephemeral port: {error}"))?
    };
    let actual_port = listener.local_addr().map(|address| address.port()).unwrap_or_else(|_| selected_port.unwrap_or(3000));

    let window_handle = window.clone();
    std::thread::spawn(move || {
        if let Ok((mut stream, _)) = listener.accept() {
            let mut reader = BufReader::new(stream.try_clone().unwrap_or_else(|_| stream.try_clone().unwrap()));
            let mut request_line = String::new();
            let _ = reader.read_line(&mut request_line);

            let callback_target = request_line
                .split_whitespace()
                .nth(1)
                .unwrap_or("/");
            let callback_url = if let Some((path, query)) = callback_target.split_once('?') {
                format!("http://127.0.0.1:{actual_port}{path}?{query}")
            } else {
                format!("http://127.0.0.1:{actual_port}{callback_target}")
            };

            if let Err(error) = window_handle.emit("oauth://url", callback_url) {
                eprintln!("Failed to emit OAuth redirect: {error}");
            }

            let response = "<html><body>Please return to the app.</body></html>";
            let response_bytes = response.as_bytes();
            let _ = write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                response_bytes.len()
            );
            let _ = stream.write_all(response_bytes);
            let _ = stream.flush();
        }
    });

    let redirect_uri = if configured_redirect_uri.is_empty() {
        format!("http://127.0.0.1:{actual_port}/callback")
    } else {
        configured_redirect_uri
    };
    let state = generate_random_secret(24);
    let code_verifier = generate_random_secret(64);
    let code_challenge = generate_code_challenge(&code_verifier);

    Ok(format!("{}|{}|{}|{}|{}", profile_id, redirect_uri, state, code_verifier, code_challenge))
}

#[tauri::command]
pub async fn exchange_code_for_token(
    state: tauri::State<'_, crate::DbState>,
    payload: OAuthExchangePayload,
) -> Result<OAuthExchangeResponse, String> {
    let pool = &state.0;
    let token = exchange_code_with_provider(&payload).await?;

    let github_profile = fetch_github_user_profile(&token, payload.provider_url.as_deref()).await.ok();
    let resolved_display_name = github_profile.as_ref().and_then(|profile| profile.display_name.clone()).or_else(|| github_profile.as_ref().and_then(|profile| profile.username.clone()));
    let resolved_username = github_profile.as_ref().and_then(|profile| profile.username.clone());
    let resolved_email = github_profile.as_ref().and_then(|profile| profile.email.clone());
    let resolved_avatar_url = github_profile.as_ref().and_then(|profile| profile.avatar_url.clone());

    if !payload.profile_id.trim().is_empty() {
        let provider_name = resolve_provider_name(payload.provider_url.as_deref(), None);
        persist_token_in_keyring(&payload.profile_id, &provider_name, &token).await?;

        sqlx::query(
            "UPDATE auth_profiles SET profile_name = CASE WHEN $1 IS NOT NULL AND $1 <> '' THEN $1 ELSE profile_name END, commit_name = CASE WHEN $2 IS NOT NULL AND $2 <> '' THEN $2 ELSE commit_name END, commit_email = CASE WHEN $3 IS NOT NULL AND $3 <> '' THEN $3 ELSE commit_email END, github_username = CASE WHEN $4 IS NOT NULL AND $4 <> '' THEN $4 ELSE github_username END, github_avatar_url = CASE WHEN $5 IS NOT NULL AND $5 <> '' THEN $5 ELSE github_avatar_url END, oauth_token = $6 WHERE id = $7"
        )
        .bind(resolved_display_name.clone())
        .bind(resolved_display_name.clone())
        .bind(resolved_email.clone())
        .bind(resolved_username.clone())
        .bind(resolved_avatar_url.clone())
        .bind(Some(token.clone()))
        .bind(&payload.profile_id)
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;
    }

    Ok(OAuthExchangeResponse {
        token: token.clone(),
        username: resolved_username,
        email: resolved_email,
        display_name: resolved_display_name,
        avatar_url: resolved_avatar_url,
    })
}

pub async fn resolve_profile_for_repository(
    pool: &SqlitePool,
    repo_path_id: &str,
) -> Result<Option<AuthProfileRow>, String> {
    let scope_profile_id: Option<String> = sqlx::query_scalar::<_, String>(
        "SELECT profile_id FROM profile_repo_scopes WHERE repo_path_id = $1 ORDER BY profile_id LIMIT 1"
    )
    .bind(repo_path_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())?;

    if let Some(profile_id) = scope_profile_id {
        return fetch_profile_row(pool, &profile_id).await;
    }

    let active_profile_id: Option<String> = sqlx::query_scalar::<_, String>(
        "SELECT id FROM auth_profiles WHERE is_active = 1 ORDER BY profile_name ASC LIMIT 1"
    )
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())?;

    if let Some(profile_id) = active_profile_id {
        return fetch_profile_row(pool, &profile_id).await;
    }

    let fallback_profile_id: Option<String> = sqlx::query_scalar::<_, String>(
        "SELECT id FROM auth_profiles WHERE id = $1 LIMIT 1"
    )
    .bind("local-basic-profile")
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())?;

    if let Some(profile_id) = fallback_profile_id {
        return fetch_profile_row(pool, &profile_id).await;
    }

    Ok(None)
}

pub async fn resolve_profile_for_remote(
    pool: &SqlitePool,
    profile_id: Option<&str>,
) -> Result<Option<AuthProfileRow>, String> {
    if let Some(explicit_profile_id) = profile_id.map(str::trim).filter(|value| !value.is_empty()) {
        return fetch_profile_row(pool, explicit_profile_id).await;
    }

    let active_profile_id: Option<String> = sqlx::query_scalar::<_, String>(
        "SELECT id FROM auth_profiles WHERE is_active = 1 ORDER BY profile_name ASC LIMIT 1"
    )
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())?;

    if let Some(active_id) = active_profile_id {
        return fetch_profile_row(pool, &active_id).await;
    }

    let fallback_profile_id: Option<String> = sqlx::query_scalar::<_, String>(
        "SELECT id FROM auth_profiles WHERE id = $1 LIMIT 1"
    )
    .bind("local-basic-profile")
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())?;

    if let Some(fallback_id) = fallback_profile_id {
        return fetch_profile_row(pool, &fallback_id).await;
    }

    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::{determine_token_status, generate_code_challenge, parse_access_token, parse_github_user_profile, resolve_oauth_redirect_uri, resolve_oauth_token_url, select_access_token, select_access_token_with_keyring_fallback};

    #[test]
    fn reports_token_as_none_when_missing() {
        assert_eq!(determine_token_status(None, None), "none");
    }

    #[test]
    fn reports_expired_when_expiration_has_passed() {
        let expired = (chrono::Utc::now() - chrono::Duration::minutes(5)).to_rfc3339();
        assert_eq!(determine_token_status(Some("token"), Some(&expired)), "expired");
    }

    #[test]
    fn resolves_github_token_endpoint_from_api_base_url() {
        assert_eq!(resolve_oauth_token_url(None, Some("https://api.github.com")), "https://github.com/login/oauth/access_token");
    }

    #[test]
    fn prefers_keyring_token_and_falls_back_to_database_token() {
        assert_eq!(select_access_token(Some("from-keyring".to_string()), Some("from-db".to_string())), Some("from-keyring".to_string()));
        assert_eq!(select_access_token(None, Some("from-db".to_string())), Some("from-db".to_string()));
        assert_eq!(select_access_token(Some("   ".to_string()), Some("from-db".to_string())), Some("from-db".to_string()));
        assert_eq!(select_access_token(None, None), None);
    }

    #[test]
    fn falls_back_to_database_token_when_keyring_lookup_errors() {
        assert_eq!(
            select_access_token_with_keyring_fallback(Ok(Some("from-keyring".to_string())), Some("from-db".to_string())),
            Some("from-keyring".to_string())
        );
        assert_eq!(
            select_access_token_with_keyring_fallback(Err("boom".to_string()), Some("from-db".to_string())),
            Some("from-db".to_string())
        );
        assert_eq!(
            select_access_token_with_keyring_fallback(Err("boom".to_string()), None),
            None
        );
    }

    #[test]
    fn parses_access_token_from_form_response() {
        assert_eq!(parse_access_token("access_token=abc123&scope=repo"), Some("abc123".to_string()));
    }

    #[test]
    fn derives_expected_pkce_challenge_for_known_verifier() {
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        assert_eq!(generate_code_challenge(verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    }

    #[test]
    fn resolves_fixed_loopback_redirect_uri_with_port() {
        let (redirect_uri, ports) = resolve_oauth_redirect_uri(Some("http://127.0.0.1:3000/callback")).unwrap();
        assert_eq!(redirect_uri, "http://127.0.0.1:3000/callback");
        assert_eq!(ports, Some(vec![3000]));
    }

    #[test]
    fn falls_back_to_fixed_loopback_redirect_uri_when_missing() {
        let (redirect_uri, ports) = resolve_oauth_redirect_uri(None).unwrap();
        assert_eq!(redirect_uri, "http://127.0.0.1:3000/callback");
        assert_eq!(ports, Some(vec![3000]));
    }

    #[test]
    fn parses_github_user_profile_from_api_payload() {
        let payload = r#"{
            "login": "octocat",
            "name": "The Octocat",
            "email": "octocat@example.com",
            "avatar_url": "https://avatars.githubusercontent.com/u/583231?v=4"
        }"#;

        let profile = parse_github_user_profile(payload).unwrap();
        assert_eq!(profile.username.as_deref(), Some("octocat"));
        assert_eq!(profile.email.as_deref(), Some("octocat@example.com"));
        assert_eq!(profile.display_name.as_deref(), Some("The Octocat"));
        assert_eq!(profile.avatar_url.as_deref(), Some("https://avatars.githubusercontent.com/u/583231?v=4"));
    }

    #[test]
    fn deserializes_auth_profile_input_from_snake_case_payload() {
        let payload = r#"{
            "display_name": "My profile",
            "auth_level": "full_oauth",
            "username": "octocat",
            "email": "octocat@example.com",
            "avatar_url": "https://avatars.githubusercontent.com/u/583231?v=4",
            "api_base_url": "https://api.github.com",
            "repository_scope": ["repo"],
            "folder_scope": ["."],
            "commit_name": "Octo Cat",
            "commit_email": "octocat@example.com"
        }"#;

        let profile = serde_json::from_str::<super::AuthProfileInput>(payload).unwrap();
        assert_eq!(profile.display_name, "My profile");
        assert_eq!(profile.auth_level, "full_oauth");
        assert_eq!(profile.username.as_deref(), Some("octocat"));
        assert_eq!(profile.email.as_deref(), Some("octocat@example.com"));
        assert_eq!(profile.api_base_url.as_deref(), Some("https://api.github.com"));
    }
}
