// ==========================================
// 1. Core Git Raw Discovered Structures
// Matches structs used by: git::scan_local_repository
// ==========================================

/**
 * Metadata structural layout detailing a single individual commit snapshot log.
 */
export interface CommitLog {
  /** The full hexadecimal SHA-1 string identifier of the commit object */
  hash: string;
  /** The plain text configuration name of the commit author */
  author: string;
  /** First line description summary message slice of the commit body */
  summary: string;
  /** Epoch timestamp in seconds when this commit was created */
  timestamp: number;
}

/**
 * Wrapper object representing a local branch discovered via native file system evaluation.
 */
export interface DiscoveredBranch {
  /** Plain text string label of the branch (e.g., 'main', 'feature/auth') */
  name: string;
  /** Flag detailing whether this branch represents the current active workspace checkout */
  is_head: boolean;
  /** Nested instance record detailing the absolute tip commit object metadata */
  latest_commit: CommitLog;
}

// ==========================================
// 2. Database Relational Schema Matches
// Matches rows queried from your custom sqlite schema migrations
// ==========================================

/**
 * Representation of a workspace project directory being continuously observed by notify events.
 * Matches: 'tracked_paths' schema table
 */
export interface TrackedPath {
  /** Deterministic UUID string identifier unique to this local track path mapping instance */
  id: string;
  /** Custom presentation display name assigned to this repository context target */
  display_name: string;
  /** Absolute target platform file path location point pointing to the project root directory */
  absolute_path: string;
  /** Optional URL remote tracking coordinate string configuration if registered */
  remote_url?: string | null;
  /** Numeric boolean flag mapping (1 = True, 0 = False) tracking active visibility initialization */
  is_active: number;
  /** ISO datetime text format string recording entry initialization timestamps */
  created_at?: string;
  /** Optional archival status datetime text track if unmounted historical tracking is queried */
  archived_at?: string | null;
}

/**
 * Combined database row format displaying a cached Git branch merged with its contextual commit.
 * Matches structural queries containing: 'cached_git_branches' LEFT JOIN 'cached_git_commits'
 */
export interface CachedBranch {
  /** Composite UUID string key formatting: '{path_id}-{branch_name}' */
  id: string;
  /** Foreign key pointing to the target parent record index inside 'tracked_paths' table */
  path_id: string;
  /** Local branch label reference matching git configuration properties */
  branch_name: string;
  /** Numeric boolean flag specifying if this local record reference holds current checkout priority (1 = Active HEAD, 0 = Inactive) */
  is_head: number;
  /** Relative offset tracking distance metrics ahead of upstream references */
  ahead_count?: number;
  /** Relative offset tracking distance metrics behind upstream references */
  behind_count?: number;
  /** Primary target hash key matching the tip commit row entry record data string */
  last_commit_hash: string;
  /** Timestamp track detailing database lifecycle evaluation mutations */
  updated_at?: string;
  
  // Optional parameters provided during JOIN queries tracking commit metadata log context:
  /** Author name retrieved from database execution query contexts */
  author_name?: string;
  /** Extracted raw string body summary or description attached to tracking commit structures */
  commit_message?: string;
}