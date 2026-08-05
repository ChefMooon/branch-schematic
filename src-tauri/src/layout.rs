use git2::Repository;
use notify::RecursiveMode;
use serde::{Deserialize, Serialize};
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RepositoryLayoutKind {
    Conventional,
    Gitfile,
    LinkedWorktree,
    Submodule,
    Bare,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum RepositoryPathState {
    Valid,
    Missing,
    NotGit,
    InvalidMetadata,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RepositoryLayout {
    pub kind: RepositoryLayoutKind,
    pub identity_path: PathBuf,
    pub metadata_root: PathBuf,
    pub working_tree_root: Option<PathBuf>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RepositoryPathCategory {
    Head,
    LocalRefs,
    RemoteRefs,
    PackedRefs,
    Index,
    ObjectStore,
    Worktree,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WatchTarget {
    pub path: PathBuf,
    pub mode: RecursiveMode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WatchTrigger {
    Metadata,
    Status,
    Full,
    Verification,
}

pub fn watch_targets(layout: &RepositoryLayout, detail_active: bool) -> Vec<WatchTarget> {
    let mut targets = Vec::new();
    let metadata_root = &layout.metadata_root;

    let head = metadata_root.join("HEAD");
    targets.push(WatchTarget {
        path: if head.exists() {
            head
        } else {
            metadata_root.clone()
        },
        mode: RecursiveMode::NonRecursive,
    });

    let refs = metadata_root.join("refs");
    let refs_exists = refs.exists();
    targets.push(WatchTarget {
        path: if refs_exists {
            refs
        } else {
            metadata_root.clone()
        },
        mode: if refs_exists {
            RecursiveMode::Recursive
        } else {
            RecursiveMode::NonRecursive
        },
    });

    for file_name in ["packed-refs", "index"] {
        let path = metadata_root.join(file_name);
        targets.push(WatchTarget {
            path: if path.exists() {
                path
            } else {
                metadata_root.clone()
            },
            mode: RecursiveMode::NonRecursive,
        });
    }

    if detail_active {
        if let Some(working_tree_root) = &layout.working_tree_root {
            targets.push(WatchTarget {
                path: working_tree_root.clone(),
                mode: RecursiveMode::Recursive,
            });
        }
    }

    targets.sort_by(|left, right| left.path.cmp(&right.path));
    targets.dedup_by(|left, right| left.path == right.path && left.mode == right.mode);
    targets
}

pub fn classify_watch_trigger(
    layout: &RepositoryLayout,
    path: &Path,
    detail_active: bool,
) -> Option<WatchTrigger> {
    if path
        .extension()
        .is_some_and(|extension| extension == "lock")
    {
        return None;
    }

    Some(match classify_repository_path(layout, path) {
        RepositoryPathCategory::Head => WatchTrigger::Metadata,
        RepositoryPathCategory::LocalRefs => WatchTrigger::Full,
        RepositoryPathCategory::RemoteRefs => WatchTrigger::Metadata,
        RepositoryPathCategory::PackedRefs => WatchTrigger::Full,
        RepositoryPathCategory::Index | RepositoryPathCategory::Worktree if detail_active => {
            WatchTrigger::Status
        }
        RepositoryPathCategory::ObjectStore => WatchTrigger::Verification,
        RepositoryPathCategory::Index | RepositoryPathCategory::Worktree => return None,
        RepositoryPathCategory::Unknown => WatchTrigger::Full,
    })
}

pub fn normalize_repository_path(path: &Path) -> Result<PathBuf, String> {
    let canonical = std::fs::canonicalize(path)
        .map_err(|error| format!("Failed to canonicalize repository path: {error}"))?;
    let mut normalized = PathBuf::new();
    for component in canonical.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            other => normalized.push(other.as_os_str()),
        }
    }
    Ok(normalized)
}

pub fn resolve_repository_layout(path: &Path) -> Result<RepositoryLayout, String> {
    if !path.exists() {
        return Err("missing repository path".to_string());
    }
    let identity_path = normalize_repository_path(path)?;
    let repository = Repository::open(&identity_path)
        .map_err(|error| format!("invalid Git metadata: {error}"))?;
    let metadata_root = repository.path().to_path_buf();
    let working_tree_root = repository.workdir().map(Path::to_path_buf);
    let metadata_components = metadata_root.components().collect::<Vec<_>>();
    let is_submodule_metadata = metadata_components
        .windows(2)
        .any(|pair| pair[0].as_os_str() == ".git" && pair[1].as_os_str() == "modules");
    let kind = if repository.is_bare() {
        RepositoryLayoutKind::Bare
    } else if is_submodule_metadata {
        RepositoryLayoutKind::Submodule
    } else if identity_path.join(".git").is_file() {
        if metadata_root.join("commondir").exists() {
            RepositoryLayoutKind::LinkedWorktree
        } else {
            RepositoryLayoutKind::Gitfile
        }
    } else if metadata_root.join("commondir").exists() {
        RepositoryLayoutKind::LinkedWorktree
    } else {
        RepositoryLayoutKind::Conventional
    };

    Ok(RepositoryLayout {
        kind,
        identity_path,
        metadata_root,
        working_tree_root,
    })
}

pub fn classify_repository_path(layout: &RepositoryLayout, path: &Path) -> RepositoryPathCategory {
    let normalized = path.to_path_buf();
    if normalized == layout.metadata_root.join("HEAD") {
        return RepositoryPathCategory::Head;
    }
    if normalized == layout.metadata_root.join("packed-refs") {
        return RepositoryPathCategory::PackedRefs;
    }
    if normalized == layout.metadata_root.join("index") {
        return RepositoryPathCategory::Index;
    }
    if normalized.starts_with(layout.metadata_root.join("objects")) {
        return RepositoryPathCategory::ObjectStore;
    }
    if normalized.starts_with(layout.metadata_root.join("refs").join("heads")) {
        return RepositoryPathCategory::LocalRefs;
    }
    if normalized.starts_with(layout.metadata_root.join("refs").join("remotes")) {
        return RepositoryPathCategory::RemoteRefs;
    }
    if layout
        .working_tree_root
        .as_ref()
        .is_some_and(|root| normalized.starts_with(root))
    {
        return RepositoryPathCategory::Worktree;
    }
    RepositoryPathCategory::Unknown
}

pub fn classify_repository_path_state(path: &Path) -> RepositoryPathState {
    if !path.exists() {
        return RepositoryPathState::Missing;
    }
    match Repository::open(path) {
        Ok(_) => RepositoryPathState::Valid,
        Err(_) => RepositoryPathState::NotGit,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn classifies_metadata_paths_without_string_fragment_matching() {
        let directory = tempdir().unwrap();
        let git_root = directory.path().join(".git");
        fs::create_dir_all(git_root.join("refs/heads")).unwrap();
        fs::create_dir_all(git_root.join("refs/remotes")).unwrap();
        fs::create_dir_all(git_root.join("objects/ab")).unwrap();
        let layout = RepositoryLayout {
            kind: RepositoryLayoutKind::Conventional,
            identity_path: directory.path().to_path_buf(),
            metadata_root: git_root.clone(),
            working_tree_root: Some(directory.path().to_path_buf()),
        };

        assert_eq!(
            classify_repository_path(&layout, &git_root.join("HEAD")),
            RepositoryPathCategory::Head
        );
        assert_eq!(
            classify_repository_path(&layout, &git_root.join("refs/remotes/origin/main")),
            RepositoryPathCategory::RemoteRefs
        );
        assert_eq!(
            classify_repository_path(&layout, &git_root.join("objects/ab/value")),
            RepositoryPathCategory::ObjectStore
        );
        assert_eq!(
            classify_repository_path(&layout, &directory.path().join("src/main.rs")),
            RepositoryPathCategory::Worktree
        );
    }

    #[test]
    fn reports_missing_and_not_git_paths() {
        let directory = tempdir().unwrap();
        assert_eq!(
            classify_repository_path_state(&directory.path().join("missing")),
            RepositoryPathState::Missing
        );
        assert_eq!(
            classify_repository_path_state(directory.path()),
            RepositoryPathState::NotGit
        );
    }

    #[test]
    fn classifies_watch_triggers_and_ignores_lock_files() {
        let directory = tempdir().unwrap();
        let metadata_root = directory.path().join(".git");
        let layout = RepositoryLayout {
            kind: RepositoryLayoutKind::Conventional,
            identity_path: directory.path().to_path_buf(),
            metadata_root: metadata_root.clone(),
            working_tree_root: Some(directory.path().to_path_buf()),
        };

        assert_eq!(
            classify_watch_trigger(&layout, &metadata_root.join("HEAD"), false),
            Some(WatchTrigger::Metadata)
        );
        assert_eq!(
            classify_watch_trigger(&layout, &metadata_root.join("refs/heads/main"), false),
            Some(WatchTrigger::Full)
        );
        assert_eq!(
            classify_watch_trigger(&layout, &metadata_root.join("objects/ab/value"), false),
            Some(WatchTrigger::Verification)
        );
        assert_eq!(
            classify_watch_trigger(&layout, &metadata_root.join("index"), true),
            Some(WatchTrigger::Status)
        );
        assert_eq!(
            classify_watch_trigger(&layout, &metadata_root.join("index.lock"), true),
            None
        );
    }

    #[test]
    fn watch_scopes_exclude_object_store_and_worktree_without_detail_priority() {
        let directory = tempdir().unwrap();
        let metadata_root = directory.path().join(".git");
        fs::create_dir_all(metadata_root.join("refs")).unwrap();
        let layout = RepositoryLayout {
            kind: RepositoryLayoutKind::Conventional,
            identity_path: directory.path().to_path_buf(),
            metadata_root: metadata_root.clone(),
            working_tree_root: Some(directory.path().to_path_buf()),
        };

        let background_targets = watch_targets(&layout, false);
        assert!(!background_targets.iter().any(|target| {
            target.path.ends_with("objects") && target.mode == RecursiveMode::Recursive
        }));
        assert!(!background_targets
            .iter()
            .any(|target| target.path == directory.path()));

        let detail_targets = watch_targets(&layout, true);
        assert!(detail_targets.iter().any(
            |target| target.path == directory.path() && target.mode == RecursiveMode::Recursive
        ));
    }
}
