use crate::db::TrackedPathRow;
use crate::git::{collect_repository_changes, RepositoryChangesSnapshot};
use crate::health;
use crate::layout::{
    classify_watch_trigger, resolve_repository_layout, watch_targets, WatchTrigger,
};
use crate::refresh::{refresh_repository_full, RefreshOutcome, RepositoryCacheWriter};
use notify::{Event, RecommendedWatcher, Watcher};
use serde::Serialize;
use sqlx::SqlitePool;
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::Path;
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    mpsc, Arc,
};
use std::time::{Duration, Instant};
use tauri::Emitter;
use tokio::sync::{Mutex, Notify, Semaphore};
use uuid::Uuid;

pub const WORKSPACE_UPDATED_EVENT: &str = "workspace-updated";
pub const REPOSITORY_CHANGES_INVALIDATED_EVENT: &str = "repository-changes-invalidated";
const MAX_WORKSPACE_UPDATED_BATCH_SIZE: usize = 250;
const STARTUP_REGISTRATION_CONCURRENCY: usize = 8;
const STARTUP_PIN_BOOST: Duration = Duration::from_secs(5 * 60);
const POLLING_INTERVAL: Duration = Duration::from_secs(30);
const VISIBLE_REFRESH_DELAY: Duration = Duration::from_millis(25);
const BACKGROUND_REFRESH_DELAY: Duration = Duration::from_millis(100);
const VISIBLE_POLLING_INTERVAL: Duration = Duration::from_secs(15);
const MAX_CONCURRENT_REFRESHES: usize = 8;
const MAX_FOREGROUND_REFRESHES: usize = 2;
const MAX_VISIBLE_REFRESHES: usize = 4;
const MAX_BACKGROUND_REFRESHES: usize = 2;
const WORKSPACE_UPDATE_FLUSH_DELAY: Duration = Duration::from_millis(50);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceUpdatedEvent {
    pub version: u32,
    pub event_id: String,
    pub revision: u64,
    pub repository_ids: Vec<String>,
    pub trigger_reason: String,
    pub batch_index: usize,
    pub batch_count: usize,
    pub emitted_at: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryChangesInvalidatedEvent {
    pub version: u32,
    pub event_id: String,
    pub repository_id: String,
    pub revision: u64,
    pub trigger_reason: String,
    pub emitted_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum RefreshPriority {
    Background,
    Visible,
    Foreground,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum RefreshKind {
    Status,
    Full,
}

enum RefreshResult {
    Status(RepositoryChangesSnapshot),
    Full(RefreshOutcome),
}

fn refresh_kind_for_watch_trigger(trigger: WatchTrigger) -> RefreshKind {
    match trigger {
        WatchTrigger::Status => RefreshKind::Status,
        WatchTrigger::Metadata | WatchTrigger::Full | WatchTrigger::Verification => {
            RefreshKind::Full
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagerDiagnostics {
    pub active_entries: usize,
    pub running_refreshes: usize,
    pub registration_attempts: u64,
    pub coalesced_requests: u64,
    pub cancellations: u64,
    pub terminal_failures: u64,
    pub shutting_down: bool,
    pub watcher_count: usize,
    pub polling_count: usize,
    pub degraded_entries: usize,
    pub wake_recoveries: u64,
    pub refresh_attempts: u64,
    pub refresh_successes: u64,
    pub refresh_failures: u64,
    pub refresh_duration_ms_total: u64,
    pub watcher_registrations: u64,
    pub watcher_registration_failures: u64,
    pub watcher_starts: u64,
    pub watcher_stops: u64,
    pub event_batches: u64,
    pub stale_state_rate_15m: f64,
    pub registration_failure_rate_10m: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepositoryDebugEntry {
    pub repository_id: String,
    pub priority: String,
    pub visible_in_active_view: bool,
    pub explicitly_selected: bool,
    pub startup_pin_active: bool,
    pub detail_active: bool,
    pub running: bool,
    pub follow_up: bool,
    pub failure_count: u32,
    pub trigger_reason: String,
    pub monitor_mode: String,
    pub generation: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatcherDebugSnapshot {
    pub captured_at: String,
    pub diagnostics: ManagerDiagnostics,
    pub repositories: Vec<RepositoryDebugEntry>,
}

struct MetricSample {
    recorded_at: Instant,
    registration_attempt: bool,
    registration_failure: bool,
    stale_state: Option<bool>,
}

#[derive(Default)]
struct ObservabilityState {
    refresh_attempts: u64,
    refresh_successes: u64,
    refresh_failures: u64,
    refresh_duration_ms_total: u64,
    watcher_registrations: u64,
    watcher_registration_failures: u64,
    watcher_starts: u64,
    watcher_stops: u64,
    samples: VecDeque<MetricSample>,
}

struct RuntimeEntry {
    absolute_path: String,
    generation: u64,
    priority: RefreshPriority,
    visible_in_active_view: bool,
    detail_active: bool,
    detail_sessions: HashSet<String>,
    explicitly_selected: bool,
    startup_pin_until: Option<Instant>,
    running: bool,
    follow_up: bool,
    failure_count: u32,
    trigger_reason: String,
    refresh_kind: RefreshKind,
    pending_refresh_kind: Option<RefreshKind>,
    changes_revision: u64,
    changes_snapshot: Option<RepositoryChangesSnapshot>,
    changes_status_in_flight: bool,
    changes_status_error: Option<String>,
    changes_status_ready: Arc<Notify>,
}

struct ManagerState {
    entries: Mutex<HashMap<String, RuntimeEntry>>,
    watcher_tasks: Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>,
    polling_tasks: Mutex<HashMap<String, tauri::async_runtime::JoinHandle<()>>>,
    shutting_down: AtomicBool,
    registration_attempts: AtomicU64,
    coalesced_requests: AtomicU64,
    cancellations: AtomicU64,
    terminal_failures: AtomicU64,
    wake_recoveries: AtomicU64,
    revision: AtomicU64,
    event_batches: AtomicU64,
    active_view_visible_ids: Mutex<HashSet<String>>,
    selected_repository_id: Mutex<Option<String>>,
    refresh_slots: Arc<Semaphore>,
    foreground_refresh_slots: Arc<Semaphore>,
    visible_refresh_slots: Arc<Semaphore>,
    background_refresh_slots: Arc<Semaphore>,
    pending_workspace_updates: Mutex<HashMap<String, String>>,
    observability: Mutex<ObservabilityState>,
}

#[derive(Clone)]
pub struct WatcherManager {
    pool: SqlitePool,
    writer: RepositoryCacheWriter,
    app_handle: Option<tauri::AppHandle>,
    state: Arc<ManagerState>,
}

impl WatcherManager {
    fn effective_priority(entry: &RuntimeEntry, now: Instant) -> RefreshPriority {
        if entry.detail_active || entry.explicitly_selected {
            RefreshPriority::Foreground
        } else if entry.visible_in_active_view
            || entry
                .startup_pin_until
                .is_some_and(|expires_at| expires_at > now)
        {
            RefreshPriority::Visible
        } else {
            RefreshPriority::Background
        }
    }

    fn refresh_delay(priority: RefreshPriority) -> Duration {
        match priority {
            RefreshPriority::Foreground => Duration::ZERO,
            RefreshPriority::Visible => VISIBLE_REFRESH_DELAY,
            RefreshPriority::Background => BACKGROUND_REFRESH_DELAY,
        }
    }

    fn polling_interval(priority: RefreshPriority) -> Duration {
        match priority {
            RefreshPriority::Foreground | RefreshPriority::Visible => VISIBLE_POLLING_INTERVAL,
            RefreshPriority::Background => POLLING_INTERVAL,
        }
    }

    pub fn new(pool: SqlitePool, writer: RepositoryCacheWriter) -> Self {
        Self {
            pool,
            writer,
            app_handle: None,
            state: Arc::new(ManagerState {
                entries: Mutex::new(HashMap::new()),
                watcher_tasks: Mutex::new(HashMap::new()),
                polling_tasks: Mutex::new(HashMap::new()),
                shutting_down: AtomicBool::new(false),
                registration_attempts: AtomicU64::new(0),
                coalesced_requests: AtomicU64::new(0),
                cancellations: AtomicU64::new(0),
                terminal_failures: AtomicU64::new(0),
                wake_recoveries: AtomicU64::new(0),
                revision: AtomicU64::new(0),
                event_batches: AtomicU64::new(0),
                active_view_visible_ids: Mutex::new(HashSet::new()),
                selected_repository_id: Mutex::new(None),
                refresh_slots: Arc::new(Semaphore::new(MAX_CONCURRENT_REFRESHES)),
                foreground_refresh_slots: Arc::new(Semaphore::new(MAX_FOREGROUND_REFRESHES)),
                visible_refresh_slots: Arc::new(Semaphore::new(MAX_VISIBLE_REFRESHES)),
                background_refresh_slots: Arc::new(Semaphore::new(MAX_BACKGROUND_REFRESHES)),
                pending_workspace_updates: Mutex::new(HashMap::new()),
                observability: Mutex::new(ObservabilityState::default()),
            }),
        }
    }

    pub fn with_app_handle(mut self, app_handle: tauri::AppHandle) -> Self {
        self.app_handle = Some(app_handle);
        self
    }

    pub fn is_shutting_down(&self) -> bool {
        self.state.shutting_down.load(Ordering::Acquire)
    }

    pub async fn ensure_monitored(
        &self,
        path_id: String,
        absolute_path: String,
        priority: RefreshPriority,
    ) -> Result<(), String> {
        if self.state.shutting_down.load(Ordering::Acquire) {
            return Err("Watcher manager is shutting down".to_string());
        }
        self.state
            .registration_attempts
            .fetch_add(1, Ordering::Relaxed);

        let visible_in_active_view = self
            .state
            .active_view_visible_ids
            .lock()
            .await
            .contains(&path_id);
        let mut entries = self.state.entries.lock().await;
        if let Some(entry) = entries.get_mut(&path_id) {
            entry.visible_in_active_view = visible_in_active_view;
            entry.priority = Self::effective_priority(entry, Instant::now());
            if entry.running {
                entry.follow_up = true;
                self.state
                    .coalesced_requests
                    .fetch_add(1, Ordering::Relaxed);
                return Ok(());
            }
            entry.running = true;
            entry.generation = entry.generation.wrapping_add(1);
            let generation = entry.generation;
            drop(entries);
            if !self.ensure_watcher(&path_id).await {
                self.ensure_polling_fallback(&path_id).await;
            }
            self.spawn_refresh(path_id, generation);
            return Ok(());
        }

        let startup_pin_until = (priority == RefreshPriority::Visible && !visible_in_active_view)
            .then(|| Instant::now() + STARTUP_PIN_BOOST);
        let explicitly_selected = priority == RefreshPriority::Foreground;
        let effective_priority = if explicitly_selected {
            RefreshPriority::Foreground
        } else if visible_in_active_view || startup_pin_until.is_some() {
            RefreshPriority::Visible
        } else {
            RefreshPriority::Background
        };

        entries.insert(
            path_id.clone(),
            RuntimeEntry {
                absolute_path,
                generation: 1,
                priority: effective_priority,
                visible_in_active_view,
                detail_active: false,
                detail_sessions: HashSet::new(),
                explicitly_selected,
                startup_pin_until,
                running: true,
                follow_up: false,
                failure_count: 0,
                trigger_reason: "startup".to_string(),
                refresh_kind: RefreshKind::Full,
                pending_refresh_kind: None,
                changes_revision: 0,
                changes_snapshot: None,
                changes_status_in_flight: false,
                changes_status_error: None,
                changes_status_ready: Arc::new(Notify::new()),
            },
        );
        drop(entries);
        if !self.ensure_watcher(&path_id).await {
            self.ensure_polling_fallback(&path_id).await;
        }
        self.spawn_refresh(path_id, 1);
        Ok(())
    }

    async fn ensure_changes_entry(
        &self,
        path_id: String,
        absolute_path: String,
    ) -> Result<(), String> {
        if self.state.shutting_down.load(Ordering::Acquire) {
            return Err("Watcher manager is shutting down".to_string());
        }

        self.state
            .registration_attempts
            .fetch_add(1, Ordering::Relaxed);
        let visible_in_active_view = self
            .state
            .active_view_visible_ids
            .lock()
            .await
            .contains(&path_id);
        let mut entries = self.state.entries.lock().await;
        if let Some(entry) = entries.get_mut(&path_id) {
            entry.absolute_path = absolute_path;
            entry.visible_in_active_view = visible_in_active_view;
            return Ok(());
        }

        entries.insert(
            path_id.clone(),
            RuntimeEntry {
                absolute_path,
                generation: 0,
                priority: RefreshPriority::Foreground,
                visible_in_active_view,
                detail_active: false,
                detail_sessions: HashSet::new(),
                explicitly_selected: false,
                startup_pin_until: None,
                running: false,
                follow_up: false,
                failure_count: 0,
                trigger_reason: "changes_prefetch".to_string(),
                refresh_kind: RefreshKind::Status,
                pending_refresh_kind: None,
                changes_revision: 0,
                changes_snapshot: None,
                changes_status_in_flight: false,
                changes_status_error: None,
                changes_status_ready: Arc::new(Notify::new()),
            },
        );
        drop(entries);
        Ok(())
    }

    async fn restart_watch_scope(&self, path_id: &str) {
        if let Some(task) = self.state.watcher_tasks.lock().await.remove(path_id) {
            task.abort();
            self.record_watcher_stop().await;
        }
        if let Some(task) = self.state.polling_tasks.lock().await.remove(path_id) {
            task.abort();
        }
        if !self.ensure_watcher(path_id).await {
            self.ensure_polling_fallback(path_id).await;
        }
    }

    pub async fn begin_detail_session(
        &self,
        path_id: String,
        absolute_path: String,
        session_id: String,
    ) -> Result<(), String> {
        if session_id.trim().is_empty() {
            return Err("Detail session ID cannot be empty".to_string());
        }

        self.ensure_changes_entry(path_id.clone(), absolute_path)
            .await?;
        {
            let mut entries = self.state.entries.lock().await;
            let entry = entries
                .get_mut(&path_id)
                .ok_or_else(|| "Repository is not monitored".to_string())?;
            if entry.running
                && entry.refresh_kind == RefreshKind::Full
                && entry.trigger_reason == "startup"
            {
                entry.generation = entry.generation.wrapping_add(1);
                entry.running = false;
                entry.follow_up = false;
                entry.pending_refresh_kind = None;
            }
            entry.detail_sessions.insert(session_id);
            entry.detail_active = true;
            entry.priority = RefreshPriority::Foreground;
        }
        let refresh_result = self
            .request_refresh_with_reason_and_kind(
                path_id.clone(),
                "detail_active",
                RefreshKind::Status,
            )
            .await;
        self.restart_watch_scope(&path_id).await;
        refresh_result
    }

    pub async fn set_visible_repositories(
        &self,
        repository_ids: Vec<String>,
    ) -> Result<(), String> {
        if self.state.shutting_down.load(Ordering::Acquire) {
            return Err("Watcher manager is shutting down".to_string());
        }

        let visible_ids = repository_ids
            .into_iter()
            .filter(|repository_id| !repository_id.trim().is_empty())
            .collect::<HashSet<_>>();
        let previous_visible_ids = self.state.active_view_visible_ids.lock().await.clone();
        *self.state.active_view_visible_ids.lock().await = visible_ids.clone();

        let mut entries = self.state.entries.lock().await;
        let newly_visible_ids = visible_ids
            .difference(&previous_visible_ids)
            .filter(|repository_id| entries.contains_key(*repository_id))
            .cloned()
            .collect::<Vec<_>>();
        for (repository_id, entry) in entries.iter_mut() {
            entry.visible_in_active_view = visible_ids.contains(repository_id);
            entry.priority = Self::effective_priority(entry, Instant::now());
        }
        drop(entries);

        for repository_id in newly_visible_ids {
            self.request_refresh_with_reason(
                repository_id,
                RefreshPriority::Visible,
                "active_view_visible",
            )
            .await?;
        }

        Ok(())
    }

    pub async fn set_selected_repository(
        &self,
        repository_id: Option<String>,
    ) -> Result<(), String> {
        if self.state.shutting_down.load(Ordering::Acquire) {
            return Err("Watcher manager is shutting down".to_string());
        }

        let mut selected_id = self.state.selected_repository_id.lock().await;
        let previous_id = std::mem::replace(&mut *selected_id, repository_id.clone());
        drop(selected_id);

        let mut entries = self.state.entries.lock().await;
        if let Some(previous_id) = previous_id {
            if let Some(entry) = entries.get_mut(&previous_id) {
                entry.explicitly_selected = false;
                entry.priority = Self::effective_priority(entry, Instant::now());
            }
        }
        if let Some(repository_id) = repository_id {
            if let Some(entry) = entries.get_mut(&repository_id) {
                entry.explicitly_selected = true;
                entry.priority = Self::effective_priority(entry, Instant::now());
            }
        }

        Ok(())
    }

    pub async fn set_pinned_repository(&self, path_id: &str, pinned: bool) -> Result<(), String> {
        let mut entries = self.state.entries.lock().await;
        let Some(entry) = entries.get_mut(path_id) else {
            return Ok(());
        };

        entry.startup_pin_until = pinned.then(|| Instant::now() + STARTUP_PIN_BOOST);
        entry.priority = Self::effective_priority(entry, Instant::now());
        Ok(())
    }

    pub async fn request_refresh(
        &self,
        path_id: String,
        priority: RefreshPriority,
    ) -> Result<(), String> {
        self.request_refresh_with_reason(path_id, priority, "on_demand")
            .await
    }

    pub async fn refresh_after_mutation(
        &self,
        path_id: &str,
        trigger_reason: &str,
    ) -> Result<RefreshOutcome, String> {
        let absolute_path = self
            .state
            .entries
            .lock()
            .await
            .get(path_id)
            .map(|entry| entry.absolute_path.clone())
            .ok_or_else(|| "Repository is not monitored".to_string())?;
        let outcome =
            refresh_repository_full(&self.pool, &self.writer, path_id, &absolute_path).await?;
        self.queue_workspace_updated(&outcome.path_id, trigger_reason)
            .await;
        Ok(outcome)
    }

    pub async fn wait_for_changes_snapshot(
        &self,
        path_id: &str,
        absolute_path: &str,
        known_revision: Option<u64>,
    ) -> Result<(u64, bool, Option<RepositoryChangesSnapshot>), String> {
        self.ensure_changes_entry(path_id.to_string(), absolute_path.to_string())
            .await?;

        loop {
            let (notified, should_start) = {
                let entries = self.state.entries.lock().await;
                let entry = entries
                    .get(path_id)
                    .ok_or_else(|| "Repository is not monitored".to_string())?;
                if known_revision.is_some_and(|known| {
                    known > 0 && known == entry.changes_revision && entry.changes_snapshot.is_some()
                }) {
                    return Ok((entry.changes_revision, true, None));
                }
                if let Some(snapshot) = entry.changes_snapshot.clone() {
                    return Ok((entry.changes_revision, false, Some(snapshot)));
                }

                let should_start = !entry.changes_status_in_flight;
                let notified = entry.changes_status_ready.clone().notified_owned();
                (notified, should_start)
            };

            if should_start {
                self.request_refresh_with_reason_and_kind(
                    path_id.to_string(),
                    "changes_read",
                    RefreshKind::Status,
                )
                .await?;
                continue;
            }
            notified.await;
        }
    }

    pub async fn publish_changes_snapshot_for_path(
        &self,
        absolute_path: &str,
        snapshot: RepositoryChangesSnapshot,
        trigger_reason: &str,
    ) {
        let published = {
            let mut entries = self.state.entries.lock().await;
            entries
                .iter_mut()
                .find(|(_, entry)| entry.absolute_path == absolute_path && entry.detail_active)
                .map(|(repository_id, entry)| {
                    entry.changes_revision = entry.changes_revision.wrapping_add(1);
                    entry.changes_snapshot = Some(snapshot);
                    (repository_id.clone(), entry.changes_revision)
                })
        };

        if let Some((repository_id, revision)) = published {
            self.emit_repository_changes_invalidated(&repository_id, revision, trigger_reason);
        }
    }

    async fn request_refresh_with_reason(
        &self,
        path_id: String,
        _priority: RefreshPriority,
        trigger_reason: &str,
    ) -> Result<(), String> {
        self.request_refresh_with_reason_and_kind(path_id, trigger_reason, RefreshKind::Full)
            .await
    }

    async fn request_refresh_with_reason_and_kind(
        &self,
        path_id: String,
        trigger_reason: &str,
        refresh_kind: RefreshKind,
    ) -> Result<(), String> {
        let mut entries = self.state.entries.lock().await;
        let entry = entries
            .get_mut(&path_id)
            .ok_or_else(|| "Repository is not monitored".to_string())?;
        if refresh_kind == RefreshKind::Status
            && trigger_reason == "changes_read"
            && entry.changes_snapshot.is_some()
        {
            return Ok(());
        }
        if entry.detail_active || entry.explicitly_selected {
            entry.priority = RefreshPriority::Foreground;
        }
        if !(entry.detail_active && trigger_reason == "on_demand") {
            entry.trigger_reason = trigger_reason.to_string();
        }
        if refresh_kind == RefreshKind::Status {
            entry.changes_status_in_flight = true;
            entry.changes_status_error = None;
        }
        if entry.running {
            let same_status_read_is_running = refresh_kind == RefreshKind::Status
                && entry.refresh_kind == RefreshKind::Status
                && entry.changes_status_in_flight
                && matches!(trigger_reason, "changes_read" | "detail_active");
            if same_status_read_is_running {
                return Ok(());
            }
            entry.pending_refresh_kind = Some(
                entry
                    .pending_refresh_kind
                    .unwrap_or(RefreshKind::Status)
                    .max(refresh_kind),
            );
            entry.follow_up = true;
            self.state
                .coalesced_requests
                .fetch_add(1, Ordering::Relaxed);
            return Ok(());
        }
        entry.refresh_kind = refresh_kind;
        entry.pending_refresh_kind = None;
        entry.running = true;
        entry.generation = entry.generation.wrapping_add(1);
        let generation = entry.generation;
        drop(entries);
        self.spawn_refresh(path_id, generation);
        Ok(())
    }

    pub async fn set_detail_session(
        &self,
        path_id: &str,
        session_id: &str,
        active: bool,
    ) -> Result<(), String> {
        if session_id.trim().is_empty() {
            return Err("Detail session ID cannot be empty".to_string());
        }

        let mut status_ready = None;
        let mut entries = self.state.entries.lock().await;
        let entry = entries
            .get_mut(path_id)
            .ok_or_else(|| "Repository is not monitored".to_string())?;
        if active {
            entry.detail_sessions.insert(session_id.to_string());
        } else {
            entry.detail_sessions.remove(session_id);
        }
        entry.detail_active = !entry.detail_sessions.is_empty();
        entry.priority = Self::effective_priority(entry, Instant::now());
        if !active && !entry.detail_active {
            entry.generation = entry.generation.wrapping_add(1);
            entry.running = false;
            entry.follow_up = false;
            entry.pending_refresh_kind = None;
            entry.changes_status_in_flight = false;
            entry.changes_status_error = Some("Repository detail session closed".to_string());
            status_ready = Some(entry.changes_status_ready.clone());
        }
        if active
            && entry.running
            && entry.refresh_kind == RefreshKind::Full
            && entry.trigger_reason == "startup"
        {
            entry.generation = entry.generation.wrapping_add(1);
            entry.running = false;
            entry.follow_up = false;
            entry.pending_refresh_kind = None;
        }
        if !entry.detail_active {
            entry.changes_snapshot = None;
        }

        let detail_active = entry.detail_active;
        drop(entries);

        self.restart_watch_scope(path_id).await;
        if detail_active {
            let session_is_still_active = self
                .state
                .entries
                .lock()
                .await
                .get(path_id)
                .is_some_and(|entry| entry.detail_sessions.contains(session_id));
            if session_is_still_active {
                self.request_refresh_with_reason_and_kind(
                    path_id.to_string(),
                    "detail_active",
                    RefreshKind::Status,
                )
                .await?;
            }
        }
        if let Some(status_ready) = status_ready {
            status_ready.notify_waiters();
        }
        Ok(())
    }

    pub async fn stop_monitored(&self, path_id: &str) -> Result<(), String> {
        if let Some(task) = self.state.watcher_tasks.lock().await.remove(path_id) {
            task.abort();
            self.record_watcher_stop().await;
        }
        if let Some(task) = self.state.polling_tasks.lock().await.remove(path_id) {
            task.abort();
        }
        let removed = self.state.entries.lock().await.remove(path_id).is_some();
        if removed {
            self.state.cancellations.fetch_add(1, Ordering::Relaxed);
        }
        Ok(())
    }

    pub async fn stop_all(&self) {
        self.state.shutting_down.store(true, Ordering::Release);
        let watcher_tasks = {
            let mut tasks = self.state.watcher_tasks.lock().await;
            let watcher_stop_count = tasks.len() as u64;
            let tasks = tasks.drain().map(|(_, task)| task).collect::<Vec<_>>();
            (watcher_stop_count, tasks)
        };
        for task in watcher_tasks.1 {
            task.abort();
        }
        if watcher_tasks.0 > 0 {
            self.record_watcher_stop_n(watcher_tasks.0).await;
        }
        let polling_tasks = {
            let mut tasks = self.state.polling_tasks.lock().await;
            tasks.drain().map(|(_, task)| task).collect::<Vec<_>>()
        };
        for task in polling_tasks {
            task.abort();
        }
        let mut entries = self.state.entries.lock().await;
        self.state
            .cancellations
            .fetch_add(entries.len() as u64, Ordering::Relaxed);
        entries.clear();
        self.state.pending_workspace_updates.lock().await.clear();
    }

    pub async fn recover_after_wake(&self) {
        if self.state.shutting_down.load(Ordering::Acquire) {
            return;
        }

        self.state.wake_recoveries.fetch_add(1, Ordering::Relaxed);
        let repository_ids = {
            let entries = self.state.entries.lock().await;
            entries.keys().cloned().collect::<Vec<_>>()
        };

        for path_id in repository_ids {
            if self.state.shutting_down.load(Ordering::Acquire) {
                break;
            }
            if let Some(task) = self.state.watcher_tasks.lock().await.remove(&path_id) {
                task.abort();
            }
            if !self.ensure_watcher(&path_id).await {
                self.ensure_polling_fallback(&path_id).await;
            }
            let _ = self
                .request_refresh_with_reason(path_id, RefreshPriority::Background, "wake_recovery")
                .await;
        }
    }

    pub async fn diagnostics(&self) -> ManagerDiagnostics {
        let entries = self.state.entries.lock().await;
        let observability = self.state.observability.lock().await;
        let now = Instant::now();
        let recent_15m = observability
            .samples
            .iter()
            .filter(|sample| now.duration_since(sample.recorded_at) <= Duration::from_secs(900))
            .collect::<Vec<_>>();
        let recent_10m = observability
            .samples
            .iter()
            .filter(|sample| now.duration_since(sample.recorded_at) <= Duration::from_secs(600))
            .collect::<Vec<_>>();
        let recent_stale_observations = recent_15m
            .iter()
            .filter_map(|sample| sample.stale_state)
            .collect::<Vec<_>>();
        let recent_registrations = recent_10m
            .iter()
            .filter(|sample| sample.registration_attempt)
            .count() as f64;
        ManagerDiagnostics {
            active_entries: entries.len(),
            running_refreshes: entries.values().filter(|entry| entry.running).count(),
            registration_attempts: self.state.registration_attempts.load(Ordering::Relaxed),
            coalesced_requests: self.state.coalesced_requests.load(Ordering::Relaxed),
            cancellations: self.state.cancellations.load(Ordering::Relaxed),
            terminal_failures: self.state.terminal_failures.load(Ordering::Relaxed),
            shutting_down: self.state.shutting_down.load(Ordering::Acquire),
            watcher_count: self.state.watcher_tasks.lock().await.len(),
            polling_count: self.state.polling_tasks.lock().await.len(),
            degraded_entries: entries
                .values()
                .filter(|entry| entry.failure_count > 0)
                .count(),
            wake_recoveries: self.state.wake_recoveries.load(Ordering::Relaxed),
            refresh_attempts: observability.refresh_attempts,
            refresh_successes: observability.refresh_successes,
            refresh_failures: observability.refresh_failures,
            refresh_duration_ms_total: observability.refresh_duration_ms_total,
            watcher_registrations: observability.watcher_registrations,
            watcher_registration_failures: observability.watcher_registration_failures,
            watcher_starts: observability.watcher_starts,
            watcher_stops: observability.watcher_stops,
            event_batches: self.state.event_batches.load(Ordering::Relaxed),
            stale_state_rate_15m: if recent_stale_observations.is_empty() {
                0.0
            } else {
                recent_stale_observations
                    .iter()
                    .filter(|stale| **stale)
                    .count() as f64
                    / recent_stale_observations.len() as f64
            },
            registration_failure_rate_10m: if recent_registrations == 0.0 {
                0.0
            } else {
                recent_10m
                    .iter()
                    .filter(|sample| sample.registration_failure)
                    .count() as f64
                    / recent_registrations
            },
        }
    }

    pub async fn debug_snapshot(&self) -> WatcherDebugSnapshot {
        let diagnostics = self.diagnostics().await;
        let entries = self.state.entries.lock().await;
        let watcher_ids = self.state.watcher_tasks.lock().await;
        let polling_ids = self.state.polling_tasks.lock().await;
        let mut repositories = entries
            .iter()
            .map(|(repository_id, entry)| {
                let effective_priority = Self::effective_priority(entry, Instant::now());
                RepositoryDebugEntry {
                    repository_id: repository_id.clone(),
                    priority: match effective_priority {
                        RefreshPriority::Background => "background",
                        RefreshPriority::Visible => "visible",
                        RefreshPriority::Foreground => "foreground",
                    }
                    .to_string(),
                    visible_in_active_view: entry.visible_in_active_view,
                    explicitly_selected: entry.explicitly_selected,
                    startup_pin_active: entry
                        .startup_pin_until
                        .is_some_and(|expires_at| expires_at > Instant::now()),
                    detail_active: entry.detail_active,
                    running: entry.running,
                    follow_up: entry.follow_up,
                    failure_count: entry.failure_count,
                    trigger_reason: entry.trigger_reason.clone(),
                    monitor_mode: if watcher_ids.contains_key(repository_id) {
                        "watcher"
                    } else if polling_ids.contains_key(repository_id) {
                        "polling"
                    } else {
                        "pending"
                    }
                    .to_string(),
                    generation: entry.generation,
                }
            })
            .collect::<Vec<_>>();
        repositories.sort_by(|left, right| left.repository_id.cmp(&right.repository_id));

        WatcherDebugSnapshot {
            captured_at: chrono::Utc::now().to_rfc3339(),
            diagnostics,
            repositories,
        }
    }

    pub async fn register_active_paths(&self, paths: Vec<TrackedPathRow>) {
        let permits = Arc::new(Semaphore::new(STARTUP_REGISTRATION_CONCURRENCY));
        let mut registrations = Vec::with_capacity(paths.len());
        for path in paths {
            let manager = self.clone();
            let permits = Arc::clone(&permits);
            registrations.push(tauri::async_runtime::spawn(async move {
                let Ok(_permit) = permits.acquire_owned().await else {
                    return;
                };
                let priority = if path.is_pinned != 0 {
                    RefreshPriority::Visible
                } else {
                    RefreshPriority::Background
                };
                let _ = manager
                    .ensure_monitored(path.id, path.absolute_path, priority)
                    .await;
            }));
        }
        for registration in registrations {
            let _ = registration.await;
        }
    }

    pub async fn reconcile_active_paths(&self, paths: Vec<TrackedPathRow>) {
        let desired_ids = paths
            .iter()
            .map(|path| path.id.as_str())
            .collect::<HashSet<_>>();
        let current_ids = self
            .state
            .entries
            .lock()
            .await
            .keys()
            .cloned()
            .collect::<Vec<_>>();
        for path_id in current_ids {
            if !desired_ids.contains(path_id.as_str()) {
                let still_active = sqlx::query_scalar::<_, i64>(
                    "SELECT is_active FROM tracked_paths WHERE id = ? AND archived_at IS NULL",
                )
                .bind(&path_id)
                .fetch_optional(&self.pool)
                .await
                .ok()
                .flatten()
                .is_some_and(|is_active| is_active != 0);
                if still_active {
                    continue;
                }
                let _ = self.stop_monitored(&path_id).await;
            }
        }
        self.register_active_paths(paths).await;
    }

    pub async fn notify_workspace_updated(
        &self,
        repository_ids: Vec<String>,
        trigger_reason: &str,
    ) {
        if repository_ids.is_empty() {
            let Some(app_handle) = &self.app_handle else {
                return;
            };
            let revision = self.state.revision.fetch_add(1, Ordering::AcqRel) + 1;
            for event in workspace_updated_events(revision, Vec::new(), trigger_reason.to_string())
            {
                self.state.event_batches.fetch_add(1, Ordering::Relaxed);
                let _ = app_handle.emit(WORKSPACE_UPDATED_EVENT, event);
            }
            return;
        }
        for repository_id in repository_ids {
            self.queue_workspace_updated(&repository_id, trigger_reason)
                .await;
        }
    }

    fn spawn_refresh(&self, path_id: String, generation: u64) {
        let manager = self.clone();
        tauri::async_runtime::spawn(async move {
            manager.run_refresh_loop(path_id, generation).await;
        });
    }

    async fn ensure_watcher(&self, path_id: &str) -> bool {
        if self.state.watcher_tasks.lock().await.contains_key(path_id) {
            return true;
        }
        let Some((absolute_path, detail_active)) = self
            .state
            .entries
            .lock()
            .await
            .get(path_id)
            .map(|entry| (entry.absolute_path.clone(), entry.detail_active))
        else {
            self.record_watcher_registration(false).await;
            return false;
        };
        let Ok(layout) = resolve_repository_layout(Path::new(&absolute_path)) else {
            self.record_watcher_registration(false).await;
            return false;
        };
        let targets = watch_targets(&layout, detail_active);
        let (sender, receiver) = mpsc::sync_channel::<notify::Result<Event>>(128);
        let overflowed = Arc::new(AtomicBool::new(false));
        let callback_overflow = Arc::clone(&overflowed);
        let watcher_result = RecommendedWatcher::new(
            move |event| {
                if sender.try_send(event).is_err() {
                    callback_overflow.store(true, Ordering::Release);
                }
            },
            notify::Config::default(),
        );
        let Ok(mut watcher) = watcher_result else {
            self.record_watcher_registration(false).await;
            return false;
        };
        for target in targets {
            if watcher.watch(&target.path, target.mode).is_err() {
                overflowed.store(true, Ordering::Release);
            }
        }

        let manager = self.clone();
        let path_id = path_id.to_string();
        let task_path_id = path_id.clone();
        let task = tauri::async_runtime::spawn(async move {
            let _watcher = watcher;
            let mut pending_since = None;
            let mut pending_refresh_kind = RefreshKind::Status;
            let mut interval = tokio::time::interval(Duration::from_millis(50));
            loop {
                interval.tick().await;
                let mut force_flush = overflowed.swap(false, Ordering::AcqRel);
                while let Ok(result) = receiver.try_recv() {
                    match result {
                        Ok(event) => {
                            let event_kind = event
                                .paths
                                .iter()
                                .filter_map(|path| {
                                    classify_watch_trigger(&layout, path, detail_active)
                                })
                                .map(refresh_kind_for_watch_trigger)
                                .max();
                            if let Some(event_kind) = event_kind {
                                pending_since.get_or_insert_with(Instant::now);
                                pending_refresh_kind = pending_refresh_kind.max(event_kind);
                            }
                        }
                        Err(_) => {
                            force_flush = true;
                            pending_refresh_kind = RefreshKind::Full;
                        }
                    }
                }
                if force_flush {
                    pending_since = Some(Instant::now() - Duration::from_secs(1));
                    pending_refresh_kind = RefreshKind::Full;
                }
                if pending_since.is_some_and(|started| {
                    started.elapsed() >= Duration::from_millis(200)
                        || started.elapsed() >= Duration::from_secs(1)
                }) {
                    pending_since = None;
                    let refresh_kind = pending_refresh_kind;
                    pending_refresh_kind = RefreshKind::Status;
                    let _ = manager
                        .request_refresh_with_reason_and_kind(
                            task_path_id.clone(),
                            "filesystem",
                            refresh_kind,
                        )
                        .await;
                }
            }
        });
        let mut watcher_tasks = self.state.watcher_tasks.lock().await;
        if watcher_tasks.contains_key(path_id.as_str()) {
            task.abort();
        } else {
            watcher_tasks.insert(path_id, task);
            self.record_watcher_registration(true).await;
            self.record_watcher_start().await;
        }
        true
    }

    async fn ensure_polling_fallback(&self, path_id: &str) {
        if self.state.polling_tasks.lock().await.contains_key(path_id) {
            return;
        }
        let manager = self.clone();
        let task_path_id = path_id.to_string();
        let initial_delay = polling_initial_delay(&task_path_id);
        let task = tauri::async_runtime::spawn(async move {
            tokio::time::sleep(initial_delay).await;
            loop {
                if manager.state.shutting_down.load(Ordering::Acquire) {
                    break;
                }
                let refresh_kind = manager
                    .state
                    .entries
                    .lock()
                    .await
                    .get(&task_path_id)
                    .filter(|entry| entry.detail_active)
                    .map(|_| RefreshKind::Status)
                    .unwrap_or(RefreshKind::Full);
                let _ = manager
                    .request_refresh_with_reason_and_kind(
                        task_path_id.clone(),
                        "polling_fallback",
                        refresh_kind,
                    )
                    .await;
                let priority = manager
                    .state
                    .entries
                    .lock()
                    .await
                    .get(&task_path_id)
                    .map(|entry| Self::effective_priority(entry, Instant::now()))
                    .unwrap_or(RefreshPriority::Background);
                tokio::time::sleep(Self::polling_interval(priority)).await;
            }
        });
        let mut polling_tasks = self.state.polling_tasks.lock().await;
        if polling_tasks.contains_key(path_id) {
            task.abort();
        } else {
            polling_tasks.insert(path_id.to_string(), task);
        }
    }

    async fn run_refresh_loop(&self, path_id: String, generation: u64) {
        let outcome = {
            let mut entries = self.state.entries.lock().await;
            entries.get_mut(&path_id).and_then(|entry| {
                (entry.generation == generation).then(|| {
                    entry.priority = Self::effective_priority(entry, Instant::now());
                    (
                        entry.absolute_path.clone(),
                        entry.detail_active,
                        entry.priority,
                    )
                })
            })
        };
        let Some((absolute_path, _detail_active, priority)) = outcome else {
            return;
        };

        let _refresh_slot = match self.state.refresh_slots.clone().acquire_owned().await {
            Ok(permit) => permit,
            Err(_) => return,
        };
        let tier_slot = match priority {
            RefreshPriority::Foreground => {
                self.state.foreground_refresh_slots.clone().acquire_owned()
            }
            RefreshPriority::Visible => self.state.visible_refresh_slots.clone().acquire_owned(),
            RefreshPriority::Background => {
                self.state.background_refresh_slots.clone().acquire_owned()
            }
        };
        let _tier_slot = match tier_slot.await {
            Ok(permit) => permit,
            Err(_) => return,
        };

        tokio::time::sleep(Self::refresh_delay(priority)).await;

        let (trigger_reason, refresh_kind) = {
            let entries = self.state.entries.lock().await;
            entries
                .get(&path_id)
                .map(|entry| (entry.trigger_reason.clone(), entry.refresh_kind))
                .unwrap_or_else(|| ("unknown".to_string(), RefreshKind::Full))
        };

        let refresh_started = Instant::now();
        let refresh_result = match refresh_kind {
            RefreshKind::Status => {
                let status_path = absolute_path.clone();
                match tauri::async_runtime::spawn_blocking(move || {
                    collect_repository_changes(&status_path)
                })
                .await
                {
                    Ok(result) => result.map(RefreshResult::Status),
                    Err(error) => Err(format!("Failed to join repository status refresh: {error}")),
                }
            }
            RefreshKind::Full => {
                refresh_repository_full(&self.pool, &self.writer, &path_id, &absolute_path)
                    .await
                    .map(RefreshResult::Full)
            }
        };
        let refresh_failed = refresh_result.is_err();
        self.record_refresh(refresh_failed, refresh_started.elapsed())
            .await;
        if let Ok(stale_state) =
            sqlx::query_scalar::<_, i64>("SELECT is_cache_stale FROM tracked_paths WHERE id = ?")
                .bind(&path_id)
                .fetch_optional(&self.pool)
                .await
        {
            if let Some(stale_state) = stale_state {
                self.record_stale_state(stale_state != 0).await;
            }
        }
        if refresh_failed {
            self.state.terminal_failures.fetch_add(1, Ordering::Relaxed);
        }

        let mut entries = self.state.entries.lock().await;
        let Some(entry) = entries.get_mut(&path_id) else {
            return;
        };
        if entry.generation != generation {
            return;
        }
        let mut status_ready = None;
        let changes_revision = match &refresh_result {
            Ok(RefreshResult::Status(snapshot)) => {
                entry.changes_snapshot = Some(snapshot.clone());
                entry.changes_revision = entry.changes_revision.wrapping_add(1);
                entry.changes_status_in_flight = false;
                entry.changes_status_error = None;
                status_ready = Some(entry.changes_status_ready.clone());
                entry.detail_active.then_some(entry.changes_revision)
            }
            Ok(RefreshResult::Full(_)) if entry.detail_active => {
                entry.changes_status_in_flight = true;
                entry.changes_status_error = None;
                entry.pending_refresh_kind = Some(
                    entry
                        .pending_refresh_kind
                        .unwrap_or(RefreshKind::Status)
                        .max(RefreshKind::Status),
                );
                entry.follow_up = true;
                None
            }
            Err(error) if refresh_kind == RefreshKind::Status => {
                entry.changes_status_in_flight = false;
                entry.changes_status_error = Some(error.clone());
                status_ready = Some(entry.changes_status_ready.clone());
                None
            }
            _ => None,
        };
        if let Ok(RefreshResult::Full(outcome)) = &refresh_result {
            self.queue_workspace_updated(&outcome.path_id, &trigger_reason)
                .await;
        }
        drop(entries);
        if let Some(changes_revision) = changes_revision {
            self.emit_repository_changes_invalidated(&path_id, changes_revision, &trigger_reason);
        }
        if let Some(status_ready) = status_ready {
            status_ready.notify_waiters();
        }
        let mut entries = self.state.entries.lock().await;
        let Some(entry) = entries.get_mut(&path_id) else {
            return;
        };
        if entry.generation != generation {
            return;
        }
        let retry_delay = if refresh_failed {
            entry.failure_count = entry.failure_count.saturating_add(1);
            Some(health::retry_delay_seconds(entry.failure_count, 0))
        } else {
            entry.failure_count = 0;
            None
        };
        if (entry.follow_up || retry_delay.is_some())
            && !self.state.shutting_down.load(Ordering::Acquire)
        {
            entry.follow_up = false;
            if let Some(next_refresh_kind) = entry.pending_refresh_kind.take() {
                entry.refresh_kind = next_refresh_kind;
            }
            if entry.refresh_kind == RefreshKind::Status {
                entry.changes_status_in_flight = true;
                entry.changes_status_error = None;
            }
            let next_generation = entry.generation;
            drop(entries);
            if let Some(delay_seconds) = retry_delay {
                tokio::time::sleep(std::time::Duration::from_secs(delay_seconds)).await;
            }
            self.spawn_refresh(path_id, next_generation);
        } else {
            entry.running = false;
        }
    }

    fn emit_repository_changes_invalidated(
        &self,
        repository_id: &str,
        revision: u64,
        trigger_reason: &str,
    ) {
        let Some(app_handle) = &self.app_handle else {
            return;
        };
        let event = RepositoryChangesInvalidatedEvent {
            version: 1,
            event_id: Uuid::new_v4().to_string(),
            repository_id: repository_id.to_string(),
            revision,
            trigger_reason: trigger_reason.to_string(),
            emitted_at: chrono::Utc::now().to_rfc3339(),
        };
        let _ = app_handle.emit(REPOSITORY_CHANGES_INVALIDATED_EVENT, event);
    }

    async fn queue_workspace_updated(&self, repository_id: &str, trigger_reason: &str) {
        let should_schedule = {
            let mut pending = self.state.pending_workspace_updates.lock().await;
            let was_empty = pending.is_empty();
            pending
                .entry(repository_id.to_string())
                .or_insert_with(|| trigger_reason.to_string());
            was_empty
        };
        if should_schedule {
            let manager = self.clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(WORKSPACE_UPDATE_FLUSH_DELAY).await;
                manager.flush_workspace_updates().await;
            });
        }
    }

    async fn flush_workspace_updates(&self) {
        let Some(app_handle) = &self.app_handle else {
            return;
        };
        if self.state.shutting_down.load(Ordering::Acquire) {
            return;
        }
        let updates = {
            let mut pending = self.state.pending_workspace_updates.lock().await;
            std::mem::take(&mut *pending)
        };
        if updates.is_empty() {
            return;
        }
        let mut trigger_reasons = updates.values().cloned().collect::<Vec<_>>();
        trigger_reasons.sort();
        trigger_reasons.dedup();
        let trigger_reason = if trigger_reasons.len() == 1 {
            trigger_reasons.remove(0)
        } else {
            "managed_batch".to_string()
        };
        let revision = self.state.revision.fetch_add(1, Ordering::AcqRel) + 1;
        for event in
            workspace_updated_events(revision, updates.into_keys().collect(), trigger_reason)
        {
            self.state.event_batches.fetch_add(1, Ordering::Relaxed);
            let _ = app_handle.emit(WORKSPACE_UPDATED_EVENT, event);
        }
    }

    async fn record_refresh(&self, failed: bool, duration: Duration) {
        let mut observability = self.state.observability.lock().await;
        observability.refresh_attempts += 1;
        observability.refresh_duration_ms_total += duration.as_millis() as u64;
        if failed {
            observability.refresh_failures += 1;
        } else {
            observability.refresh_successes += 1;
        }
        observability.samples.push_back(MetricSample {
            recorded_at: Instant::now(),
            registration_attempt: false,
            registration_failure: false,
            stale_state: None,
        });
        Self::trim_samples(&mut observability.samples);
    }

    async fn record_stale_state(&self, stale: bool) {
        let mut observability = self.state.observability.lock().await;
        observability.samples.push_back(MetricSample {
            recorded_at: Instant::now(),
            registration_attempt: false,
            registration_failure: false,
            stale_state: Some(stale),
        });
        Self::trim_samples(&mut observability.samples);
    }

    async fn record_watcher_registration(&self, failed: bool) {
        let mut observability = self.state.observability.lock().await;
        observability.watcher_registrations += 1;
        if failed {
            observability.watcher_registration_failures += 1;
        }
        observability.samples.push_back(MetricSample {
            recorded_at: Instant::now(),
            registration_attempt: true,
            registration_failure: failed,
            stale_state: None,
        });
        Self::trim_samples(&mut observability.samples);
    }

    async fn record_watcher_start(&self) {
        self.state.observability.lock().await.watcher_starts += 1;
    }

    async fn record_watcher_stop(&self) {
        self.record_watcher_stop_n(1).await;
    }

    async fn record_watcher_stop_n(&self, count: u64) {
        self.state.observability.lock().await.watcher_stops += count;
    }

    fn trim_samples(samples: &mut VecDeque<MetricSample>) {
        let cutoff = Instant::now() - Duration::from_secs(900);
        while samples
            .front()
            .is_some_and(|sample| sample.recorded_at < cutoff)
        {
            samples.pop_front();
        }
    }

    #[cfg(test)]
    async fn entry_count(&self) -> usize {
        self.state.entries.lock().await.len()
    }
}

fn polling_initial_delay(path_id: &str) -> Duration {
    let hash = path_id.bytes().fold(0_u64, |state, byte| {
        state
            .wrapping_mul(1_099_511_628_211)
            .wrapping_add(byte as u64)
    });
    Duration::from_millis(hash % POLLING_INTERVAL.as_millis() as u64)
}

fn workspace_updated_events(
    revision: u64,
    repository_ids: Vec<String>,
    trigger_reason: String,
) -> Vec<WorkspaceUpdatedEvent> {
    let batch_count = repository_ids
        .len()
        .div_ceil(MAX_WORKSPACE_UPDATED_BATCH_SIZE)
        .max(1);
    let emitted_at = chrono::Utc::now().to_rfc3339();
    repository_ids
        .chunks(MAX_WORKSPACE_UPDATED_BATCH_SIZE)
        .enumerate()
        .map(|(batch_index, ids)| WorkspaceUpdatedEvent {
            version: 1,
            event_id: Uuid::new_v4().to_string(),
            revision,
            repository_ids: ids.to_vec(),
            trigger_reason: trigger_reason.clone(),
            batch_index,
            batch_count,
            emitted_at: emitted_at.clone(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn polling_initial_delay_is_deterministic_and_spread() {
        let first = polling_initial_delay("repo-1");
        let second = polling_initial_delay("repo-2");

        assert_eq!(first, polling_initial_delay("repo-1"));
        assert!(first < POLLING_INTERVAL);
        assert!(second < POLLING_INTERVAL);
        assert_ne!(first, second);
    }

    #[tokio::test]
    async fn concurrent_changes_reads_share_one_status_refresh() {
        let directory = tempfile::tempdir().unwrap();
        git2::Repository::init(directory.path()).unwrap();
        std::fs::write(directory.path().join("notes.txt"), "pending change").unwrap();

        let pool = SqlitePool::connect_lazy("sqlite::memory:").unwrap();
        let manager = WatcherManager::new(pool, RepositoryCacheWriter::default());
        let absolute_path = directory.path().to_string_lossy().into_owned();

        let first = manager.wait_for_changes_snapshot("repo", &absolute_path, None);
        let second = manager.wait_for_changes_snapshot("repo", &absolute_path, None);
        let (first, second) = tokio::join!(first, second);
        let first = first.unwrap();
        let second = second.unwrap();

        assert!(!first.1);
        assert!(!second.1);
        assert_eq!(first.0, 1);
        assert_eq!(second.0, 1);
        assert_eq!(first.2.as_ref().unwrap().entries.len(), 1);
        assert_eq!(second.2.as_ref().unwrap().entries.len(), 1);
        assert_eq!(
            manager.state.entries.lock().await["repo"].changes_revision,
            1
        );

        manager.stop_monitored("repo").await.unwrap();
    }

    #[tokio::test]
    async fn registration_is_idempotent_and_coalesces_running_work() {
        let pool = SqlitePool::connect_lazy("sqlite::memory:").unwrap();
        let manager = WatcherManager::new(pool, RepositoryCacheWriter::default());
        manager
            .ensure_monitored(
                "repo".to_string(),
                "C:\\missing".to_string(),
                RefreshPriority::Background,
            )
            .await
            .unwrap();
        manager
            .ensure_monitored(
                "repo".to_string(),
                "C:\\missing".to_string(),
                RefreshPriority::Foreground,
            )
            .await
            .unwrap();
        assert_eq!(manager.entry_count().await, 1);
        let diagnostics = manager.diagnostics().await;
        assert_eq!(diagnostics.registration_attempts, 2);
        assert_eq!(diagnostics.coalesced_requests, 1);
    }

    #[tokio::test]
    async fn generic_registration_keeps_siblings_background_when_detail_promotes_one_repository() {
        let pool = SqlitePool::connect_lazy("sqlite::memory:").unwrap();
        let manager = WatcherManager::new(pool, RepositoryCacheWriter::default());

        for repository_id in ["repo-a", "repo-b"] {
            manager
                .ensure_monitored(
                    repository_id.to_string(),
                    "C:\\missing".to_string(),
                    RefreshPriority::Background,
                )
                .await
                .unwrap();
        }

        manager
            .set_detail_session("repo-a", "dashboard-detail", true)
            .await
            .unwrap();
        manager
            .request_refresh("repo-a".to_string(), RefreshPriority::Foreground)
            .await
            .unwrap();

        let entries = manager.state.entries.lock().await;
        assert_eq!(entries["repo-a"].priority, RefreshPriority::Foreground);
        assert_eq!(entries["repo-b"].priority, RefreshPriority::Background);
        assert!(entries["repo-a"].startup_pin_until.is_none());
        assert!(entries["repo-b"].startup_pin_until.is_none());
        assert_eq!(entries["repo-a"].trigger_reason, "detail_active");
    }

    #[tokio::test]
    async fn active_view_scope_applies_before_registration_and_demotes_on_clear() {
        let pool = SqlitePool::connect_lazy("sqlite::memory:").unwrap();
        let manager = WatcherManager::new(pool, RepositoryCacheWriter::default());

        manager
            .set_visible_repositories(vec!["repo".to_string()])
            .await
            .unwrap();
        manager
            .ensure_monitored(
                "repo".to_string(),
                "C:\\missing".to_string(),
                RefreshPriority::Background,
            )
            .await
            .unwrap();

        assert_eq!(
            manager.state.entries.lock().await["repo"].priority,
            RefreshPriority::Visible
        );

        manager.set_visible_repositories(Vec::new()).await.unwrap();
        assert_eq!(
            manager.state.entries.lock().await["repo"].priority,
            RefreshPriority::Background
        );
    }

    #[tokio::test]
    async fn pinning_reconciles_live_priority_without_overriding_foreground_signals() {
        let pool = SqlitePool::connect_lazy("sqlite::memory:").unwrap();
        let manager = WatcherManager::new(pool, RepositoryCacheWriter::default());

        manager
            .ensure_monitored(
                "repo".to_string(),
                "C:\\missing".to_string(),
                RefreshPriority::Background,
            )
            .await
            .unwrap();
        manager.set_pinned_repository("repo", true).await.unwrap();

        let entries = manager.state.entries.lock().await;
        assert_eq!(entries["repo"].priority, RefreshPriority::Visible);
        assert!(entries["repo"].startup_pin_until.is_some());
        drop(entries);

        manager
            .set_selected_repository(Some("repo".to_string()))
            .await
            .unwrap();
        assert_eq!(
            manager.state.entries.lock().await["repo"].priority,
            RefreshPriority::Foreground
        );

        manager.set_pinned_repository("repo", false).await.unwrap();
        let entries = manager.state.entries.lock().await;
        assert_eq!(entries["repo"].priority, RefreshPriority::Foreground);
        assert!(entries["repo"].startup_pin_until.is_none());
    }

    #[tokio::test]
    async fn detail_signal_protects_foreground_priority_during_scope_reconciliation() {
        let pool = SqlitePool::connect_lazy("sqlite::memory:").unwrap();
        let manager = WatcherManager::new(pool, RepositoryCacheWriter::default());
        manager
            .ensure_monitored(
                "repo".to_string(),
                "C:\\missing".to_string(),
                RefreshPriority::Background,
            )
            .await
            .unwrap();
        manager
            .set_detail_session("repo", "test-detail-session", true)
            .await
            .unwrap();

        manager.set_visible_repositories(Vec::new()).await.unwrap();

        assert_eq!(
            manager.state.entries.lock().await["repo"].priority,
            RefreshPriority::Foreground
        );
    }

    #[tokio::test]
    async fn selection_replacement_and_clear_restore_context_priority() {
        let pool = SqlitePool::connect_lazy("sqlite::memory:").unwrap();
        let manager = WatcherManager::new(pool, RepositoryCacheWriter::default());
        for repository_id in ["repo-a", "repo-b"] {
            manager
                .ensure_monitored(
                    repository_id.to_string(),
                    "C:\\missing".to_string(),
                    RefreshPriority::Background,
                )
                .await
                .unwrap();
        }
        manager
            .set_visible_repositories(vec!["repo-a".to_string()])
            .await
            .unwrap();

        manager
            .set_selected_repository(Some("repo-a".to_string()))
            .await
            .unwrap();
        assert_eq!(
            manager.state.entries.lock().await["repo-a"].priority,
            RefreshPriority::Foreground
        );

        manager
            .set_selected_repository(Some("repo-b".to_string()))
            .await
            .unwrap();
        let entries = manager.state.entries.lock().await;
        assert_eq!(entries["repo-a"].priority, RefreshPriority::Visible);
        assert_eq!(entries["repo-b"].priority, RefreshPriority::Foreground);
        drop(entries);

        manager.set_selected_repository(None).await.unwrap();
        assert_eq!(
            manager.state.entries.lock().await["repo-b"].priority,
            RefreshPriority::Background
        );
    }

    #[tokio::test]
    async fn multiple_detail_sessions_require_all_sessions_to_close() {
        let pool = SqlitePool::connect_lazy("sqlite::memory:").unwrap();
        let manager = WatcherManager::new(pool, RepositoryCacheWriter::default());
        manager
            .ensure_monitored(
                "repo".to_string(),
                "C:\\missing".to_string(),
                RefreshPriority::Background,
            )
            .await
            .unwrap();

        manager
            .set_detail_session("repo", "one", true)
            .await
            .unwrap();
        manager
            .set_detail_session("repo", "two", true)
            .await
            .unwrap();
        manager
            .set_detail_session("repo", "one", false)
            .await
            .unwrap();
        assert!(manager.state.entries.lock().await["repo"].detail_active);

        manager
            .set_detail_session("repo", "two", false)
            .await
            .unwrap();
        assert!(!manager.state.entries.lock().await["repo"].detail_active);
    }

    #[tokio::test]
    async fn stopping_a_repository_removes_its_runtime_entry() {
        let pool = SqlitePool::connect_lazy("sqlite::memory:").unwrap();
        let manager = WatcherManager::new(pool, RepositoryCacheWriter::default());
        manager
            .ensure_monitored(
                "repo".to_string(),
                "C:\\missing".to_string(),
                RefreshPriority::Background,
            )
            .await
            .unwrap();
        manager.stop_monitored("repo").await.unwrap();
        assert_eq!(manager.entry_count().await, 0);
        assert_eq!(manager.diagnostics().await.cancellations, 1);
    }

    #[tokio::test]
    async fn diagnostics_report_aggregate_rates_without_repository_details() {
        let pool = SqlitePool::connect_lazy("sqlite::memory:").unwrap();
        let manager = WatcherManager::new(pool, RepositoryCacheWriter::default());
        manager
            .record_refresh(false, Duration::from_millis(12))
            .await;
        manager
            .record_refresh(true, Duration::from_millis(20))
            .await;
        manager.record_stale_state(true).await;
        manager.record_stale_state(false).await;
        manager.record_watcher_registration(true).await;

        let diagnostics = manager.diagnostics().await;
        assert_eq!(diagnostics.refresh_attempts, 2);
        assert_eq!(diagnostics.refresh_successes, 1);
        assert_eq!(diagnostics.refresh_failures, 1);
        assert_eq!(diagnostics.refresh_duration_ms_total, 32);
        assert_eq!(diagnostics.watcher_registration_failures, 1);
        assert_eq!(diagnostics.stale_state_rate_15m, 0.5);
        assert_eq!(diagnostics.registration_failure_rate_10m, 1.0);
    }

    #[tokio::test]
    async fn shutdown_and_diagnostics_complete_concurrently() {
        let pool = SqlitePool::connect_lazy("sqlite::memory:").unwrap();
        let manager = WatcherManager::new(pool, RepositoryCacheWriter::default());
        let shutdown_manager = manager.clone();
        let diagnostics_manager = manager.clone();
        let shutdown = tokio::spawn(async move {
            shutdown_manager.stop_all().await;
        });
        let diagnostics = tokio::spawn(async move { diagnostics_manager.diagnostics().await });

        tokio::time::timeout(Duration::from_secs(1), shutdown)
            .await
            .unwrap()
            .unwrap();
        tokio::time::timeout(Duration::from_secs(1), diagnostics)
            .await
            .unwrap()
            .unwrap();
    }

    #[test]
    fn workspace_updated_events_are_versioned_bounded_and_share_revision() {
        let repository_ids = (0..251).map(|index| format!("repo-{index}")).collect();
        let events = workspace_updated_events(7, repository_ids, "filesystem".to_string());

        assert_eq!(events.len(), 2);
        assert_eq!(events[0].version, 1);
        assert_eq!(events[0].repository_ids.len(), 250);
        assert_eq!(events[1].repository_ids.len(), 1);
        assert!(events.iter().all(|event| event.revision == 7));
        assert_ne!(events[0].event_id, events[1].event_id);
        assert_eq!(events[0].batch_count, 2);
        assert_eq!(events[1].batch_index, 1);
    }
}
