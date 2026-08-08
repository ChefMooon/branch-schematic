use serde::{Deserialize, Serialize};

pub const UNREACHABLE_FAILURE_THRESHOLD: u32 = 8;
pub const RETRY_CAP_SECONDS: u64 = 15 * 60;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HealthState {
    Unverified,
    Monitoring,
    MonitoringFailed,
    Healthy,
    Unreachable,
    Missing,
    Moved,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HealthTransition {
    pub state: HealthState,
    pub is_cache_stale: bool,
    pub failure_count: u32,
    pub error: Option<String>,
}

pub fn sanitize_verification_error(message: &str) -> String {
    let mut sanitized = message
        .split_whitespace()
        .filter(|part| {
            !part.contains("/Users/")
                && !part.contains("\\Users\\")
                && !part.contains("token")
                && !part.contains("Bearer")
                && !part.contains("oauth")
        })
        .collect::<Vec<_>>()
        .join(" ");
    if sanitized.len() > 240 {
        sanitized.truncate(240);
        sanitized.push_str("...");
    }
    if sanitized.is_empty() {
        "Repository verification failed".to_string()
    } else {
        sanitized
    }
}

pub fn verification_succeeded() -> HealthTransition {
    HealthTransition {
        state: HealthState::Healthy,
        is_cache_stale: false,
        failure_count: 0,
        error: None,
    }
}

pub fn verification_missing() -> HealthTransition {
    HealthTransition {
        state: HealthState::Missing,
        is_cache_stale: true,
        failure_count: 0,
        error: Some("Repository path is missing".to_string()),
    }
}

pub fn verification_failed(previous_failures: u32, message: &str) -> HealthTransition {
    let failure_count = previous_failures.saturating_add(1);
    HealthTransition {
        state: if failure_count >= UNREACHABLE_FAILURE_THRESHOLD {
            HealthState::Unreachable
        } else {
            HealthState::MonitoringFailed
        },
        is_cache_stale: true,
        failure_count,
        error: Some(sanitize_verification_error(message)),
    }
}

pub fn retry_delay_seconds(failure_count: u32, jitter_seconds: u64) -> u64 {
    let exponent = failure_count.saturating_sub(1).min(10);
    let base = 1_u64 << exponent;
    base.saturating_add(jitter_seconds).min(RETRY_CAP_SECONDS)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transitions_to_unreachable_only_at_threshold() {
        assert_eq!(
            verification_failed(6, "permission denied").state,
            HealthState::MonitoringFailed
        );
        assert_eq!(
            verification_failed(7, "permission denied").state,
            HealthState::Unreachable
        );
    }

    #[test]
    fn successful_verification_clears_stale_failure_state() {
        let transition = verification_succeeded();
        assert_eq!(transition.state, HealthState::Healthy);
        assert!(!transition.is_cache_stale);
        assert_eq!(transition.failure_count, 0);
        assert!(transition.error.is_none());
    }

    #[test]
    fn sanitized_errors_remove_sensitive_parts_and_are_bounded() {
        let message = "token=secret C:\\Users\\alice\\repo failed ".repeat(40);
        let sanitized = sanitize_verification_error(&message);
        assert!(!sanitized.contains("secret"));
        assert!(!sanitized.contains("Users"));
        assert!(sanitized.len() <= 243);
    }

    #[test]
    fn retry_delay_is_bounded() {
        assert_eq!(retry_delay_seconds(1, 0), 1);
        assert!(retry_delay_seconds(100, 1000) <= RETRY_CAP_SECONDS);
    }
}
