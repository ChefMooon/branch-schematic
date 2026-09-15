# Database Map

## Sources

- `src-tauri/src/db.rs`

## Entity Relationship Diagram

```mermaid
erDiagram
    auth_profiles {
        TEXT id PK
        TEXT profile_name
        INTEGER is_active
        INTEGER is_favorite
        TEXT auth_level
        TEXT commit_name
        TEXT commit_email
        TEXT github_username
        TEXT github_avatar_url
        TEXT api_base_url
    }

    cached_git_branches {
        TEXT id PK
        TEXT path_id
        TEXT branch_name
        INTEGER is_head
        INTEGER ahead_count
        INTEGER behind_count
        INTEGER has_upstream
        INTEGER ahead_of_default_count
        INTEGER behind_default_count
        TEXT last_commit_hash
        DATETIME updated_at
        INTEGER unpushed_commit_count
    }

    cached_git_commit_branches {
        TEXT commit_hash
        TEXT branch_id
    }

    cached_git_commits {
        TEXT commit_hash PK
        TEXT branch_id
        TEXT author_name
        TEXT commit_message
        DATETIME committed_at
        TEXT signature_status
    }

    canvas_manual_edges {
        TEXT id PK
        TEXT view_id
        TEXT source_repo_id
        TEXT target_repo_id
        TEXT edge_style
        DATETIME created_at
    }

    canvas_view_branch_cards {
        TEXT view_id
        TEXT branch_id
        REAL pos_x
        REAL pos_y
    }

    canvas_view_cards {
        TEXT view_id
        TEXT repo_path_id
        REAL pos_x
        REAL pos_y
        TEXT view_mode
        INTEGER commit_density
        TEXT theme_color_hex
        INTEGER explode_branches
    }

    canvas_view_visible_branches {
        TEXT view_id
        TEXT branch_id
        INTEGER is_visible
    }

    canvas_view_visible_paths {
        TEXT view_id
        TEXT repo_path_id
        INTEGER is_visible
    }

    canvas_views {
        TEXT id PK
        TEXT view_name
        REAL zoom_level
        REAL pan_x
        REAL pan_y
        INTEGER is_favorite
        INTEGER display_order
        TEXT card_state_json
        DATETIME created_at
        DATETIME archived_at
        REAL baseline_zoom
        REAL baseline_pan_x
        REAL baseline_pan_y
    }

    custom_groups {
        TEXT id PK
        TEXT group_name
        TEXT color_hex
        TEXT created_at
    }

    global_tags {
        TEXT id PK
        TEXT tag_name
        TEXT color_hex
    }

    notifications {
        TEXT id PK
        TEXT title
        TEXT message
        TEXT variant
        INTEGER is_read
        INTEGER is_pinned
        INTEGER is_archived
        TEXT created_at
        TEXT route
        TEXT route_params_json
    }

    repository_profile_assignments {
        TEXT repo_path_id PK
        TEXT profile_id
        DATETIME assigned_at
    }

    settings {
        INTEGER id PK
        INTEGER hide_to_tray
        INTEGER restore_window
        INTEGER launch_at_login
        INTEGER start_minimized
        TEXT theme
        INTEGER detail_status_refresh_interval
        INTEGER onboarding_version
        TEXT onboarding_status
    }

    tracked_path_tags {
        TEXT repo_path_id
        TEXT tag_id
    }

    tracked_paths {
        TEXT id PK
        TEXT display_name
        TEXT alias_name
        TEXT absolute_path UK
        TEXT remote_url
        TEXT repo_origin_type
        INTEGER uncommitted_changes_count
        DATETIME last_viewed_at
        TEXT group_id
        INTEGER is_favorite
        TEXT last_accessed_at
        TEXT default_branch_name
        TEXT theme_color_hex
        TEXT icon_name
        TEXT github_owner_login
        INTEGER is_pinned
        TEXT health_state
        INTEGER is_cache_stale
        DATETIME last_verified_at
        DATETIME last_successful_verification_at
        INTEGER verification_failure_count
        TEXT last_verification_error
        INTEGER is_active
        DATETIME created_at
        DATETIME archived_at
    }

    auth_profiles ||--o{ repository_profile_assignments : "profile_id"
    cached_git_branches ||--o{ cached_git_commit_branches : "branch_id"
    cached_git_branches ||--o{ cached_git_commits : "branch_id"
    cached_git_branches ||--o{ canvas_view_branch_cards : "branch_id"
    cached_git_branches ||--o{ canvas_view_visible_branches : "branch_id"
    cached_git_commits ||--o{ cached_git_commit_branches : "commit_hash"
    canvas_views ||--o{ canvas_manual_edges : "view_id"
    canvas_views ||--o{ canvas_view_branch_cards : "view_id"
    canvas_views ||--o{ canvas_view_cards : "view_id"
    canvas_views ||--o{ canvas_view_visible_branches : "view_id"
    canvas_views ||--o{ canvas_view_visible_paths : "view_id"
    custom_groups ||--o{ tracked_paths : "group_id"
    global_tags ||--o{ tracked_path_tags : "tag_id"
    tracked_paths ||--o{ cached_git_branches : "path_id"
    tracked_paths ||--o{ canvas_manual_edges : "source_repo_id"
    tracked_paths ||--o{ canvas_manual_edges : "target_repo_id"
    tracked_paths ||--o{ canvas_view_cards : "repo_path_id"
    tracked_paths ||--o{ canvas_view_visible_paths : "repo_path_id"
    tracked_paths ||--o| repository_profile_assignments : "repo_path_id"
    tracked_paths ||--o{ tracked_path_tags : "repo_path_id"
```

## Tables

| Table | Columns |
| --- | --- |
| `auth_profiles` | 10 |
| `cached_git_branches` | 12 |
| `cached_git_commit_branches` | 2 |
| `cached_git_commits` | 6 |
| `canvas_manual_edges` | 6 |
| `canvas_view_branch_cards` | 4 |
| `canvas_view_cards` | 8 |
| `canvas_view_visible_branches` | 3 |
| `canvas_view_visible_paths` | 3 |
| `canvas_views` | 13 |
| `custom_groups` | 4 |
| `global_tags` | 3 |
| `notifications` | 10 |
| `repository_profile_assignments` | 3 |
| `settings` | 9 |
| `tracked_path_tags` | 2 |
| `tracked_paths` | 25 |

## Profile assignment and alpha reset policy

`repository_profile_assignments` contains at most one row per tracked repository. The
assignment is authoritative and uses a restrictive profile foreign key: deleting a
profile is blocked until its repositories are reassigned or explicitly cleared.
Repositories without a row inherit the persisted active non-fallback profile, or
`local-basic-profile` when no user profile exists. Clearing a row restores that
inheritance.

The former `profile_repo_scopes` data is intentionally not migrated. Alpha databases
may contain ambiguous many-to-many mappings, so users must delete the SQLite database
(including `-wal` and `-shm` files), launch once to recreate and migrate a blank
database, and re-import repositories. Do not attempt to select a winner from legacy
assignment rows.
