import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  GitBranch,
  ArrowClockwise,
  ArrowDown,
  ArrowUp,
  Desktop,
  GitFork,
  Cloud,
  CircleNotch,
  WarningCircle,
  Trash,
  PencilSimple,
  Check,
  X,
} from "@phosphor-icons/react";
import type { TrackedPath } from "../../../types/git";

interface RepositoryCardProps {
  repo: TrackedPath;
  onRefresh: () => void;
}

export function RepositoryCard({ repo, onRefresh }: RepositoryCardProps) {
  const originType = repo.repo_origin_type ?? "LOCAL_ONLY";
  
  // ALIAS LAYOUT STATE TRACKERS
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState("");
  const [loadingAction, setLoadingAction] = useState<"fetch" | "pull" | "push" | "checkout" | "alias" | null>(null);

  // Helper template assignment for classification visual elements
  const getOriginIcon = () => {
    switch (originType) {
      case "FORK": return <GitFork size={20} />;
      case "OWNED": return <Cloud size={20} />;
      default: return <Desktop size={20} />;
    }
  };

  // PREPOPULATE ON START EDITING
  const handleStartEditing = () => {
    setAliasInput(repo.alias_name || repo.display_name);
    setIsEditingAlias(true);
  };

  const handleBranchChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetBranch = e.target.value;
    setLoadingAction("checkout");
    try {
      // Matches the Rust implementation signature: execute_git_checkout(absolute_path, branch_name)
      await invoke("execute_git_checkout", { 
        absolutePath: repo.absolute_path, 
        branchName: targetBranch 
      });
    } catch (err) {
      console.error("Branch transition anomaly:", err);
    } finally {
      setLoadingAction(null);
      onRefresh(); // Re-hydrates state to dynamically read the modified checked-out head
    }
  };

  const executeGitOperation = async (operation: "fetch" | "pull" | "push") => {
    setLoadingAction(operation);
    try {
      await invoke(`git_${operation}_operation`, { pathId: repo.id });
    } catch (err) {
      console.error(`Git execution failure during ${operation}:`, err);
    } finally {
      setLoadingAction(null);
      onRefresh();
    }
  };

  const handleUntrackProject = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering any higher-level card selection flows
    if (confirm(`Are you sure you want to stop tracking ${repo.display_name}?`)) {
      try {
        await invoke("untrack_repository", { pathId: repo.id });
        onRefresh(); // Refresh the parent dashboard list reactively
      } catch (err) {
        console.error("Failed to safely disconnect project node reference:", err);
      }
    }
  };

  const saveAlias = async () => {
    setLoadingAction("alias");
    try {
      // Matches the new Rust signature: set_repository_alias(path_id, alias)
      await invoke("set_repository_alias", { pathId: repo.id, alias: aliasInput });
      setIsEditingAlias(false);
    } catch (err) {
      console.error("Failed to safely commit alias name alteration:", err);
    } finally {
      setLoadingAction(null);
      onRefresh(); // Instantly triggers store re-hydration with the new persistent alias assignment
    }
  };

  const isAnyLoading = loadingAction !== null;

  return (
    <div className={`repo-card origin-${originType.toLowerCase()}`}>
      
      {/* Top Header Information Stack */}
      <div className="repo-card-top">
        <div className="repo-icon-wrapper">
          {getOriginIcon()}
        </div>
        <div className="repo-meta-details">
          <div className="repo-title-row">
            
            {/* DYNAMIC TITLE EDITABLE LAYERING */}
            {isEditingAlias ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                  type="text"
                  className="alias-input-field"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value)}
                  placeholder="Revert to folder name..."
                  style={{ fontSize: '1rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid #6366f1' }}
                  autoFocus
                  disabled={isAnyLoading}
                />
                <button onClick={saveAlias} style={{ border: 'none', background: 'none', color: '#10b981', cursor: 'pointer' }}><Check size={16} /></button>
                <button onClick={() => { setIsEditingAlias(false); }} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={16} /></button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Double click to add alias context">
                <h3 onDoubleClick={handleStartEditing}>
                  {repo.alias_name || repo.display_name}
                </h3>
                
                {repo.alias_name && (
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                    ({repo.display_name})
                  </span>
                )}
                
                <button 
                  onClick={handleStartEditing}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', opacity: 0.5 }}
                >
                  <PencilSimple size={14} />
                </button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="badge-origin-type">{originType.replace('_', ' ')}</span>
              <button 
                onClick={handleUntrackProject}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                title="Untrack Repository"
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
              >
                <Trash size={16} />
              </button>
            </div>
          </div>
          <span className="repo-absolute-path" title={repo.absolute_path}>
            {repo.absolute_path}
          </span>
        </div>
      </div>

      {/* Dynamic Embedded Branch Selector Dropper */}
      <div className="repo-branch-section">
        {loadingAction === "checkout" ? (
          <CircleNotch size={16} className="animate-spin-svg" />
        ) : (
          <GitBranch size={16} weight="bold" />
        )}
        <select 
          className="inline-branch-dropdown"
          value={repo.current_branch ?? "main"}
          onChange={handleBranchChange}
          disabled={isAnyLoading}
        >
          {(repo.available_branches && repo.available_branches.length > 0 
            ? repo.available_branches 
            : [repo.current_branch ?? "main"]
          ).map((br) => (
            <option key={br} value={br}>{br}</option>
          ))}
        </select>
      </div>

      {/* Sync Status Aggregator Metrics & Interactive Cluster Buttons */}
      <div className="repo-sync-actions-row">
        <div className="status-indicator-pills">
          {(repo.uncommitted_changes_count ?? 0) > 0 && (
            <div className="status-pill changes-pending" title="Uncommitted items local stack">
              <WarningCircle size={14} weight="fill" />
              <span>{repo.uncommitted_changes_count} modified</span>
            </div>
          )}
          {originType !== "LOCAL_ONLY" && (
            <>
              <div className="status-pill" title="Ahead of origin remote context">
                <ArrowUp size={14} />
                <span>{repo.ahead_count ?? 0}</span>
              </div>
              <div className="status-pill" title="Behind origin remote context">
                <ArrowDown size={14} />
                <span>{repo.behind_count ?? 0}</span>
              </div>
            </>
          )}
        </div>

        {/* Sync Trigger Grid Layout Elements */}
        <div className="sync-buttons-cluster">
          <button 
            className="btn-sync-action" 
            onClick={() => executeGitOperation("fetch")}
            disabled={isAnyLoading}
            title="Fetch Origin"
          >
            {loadingAction === "fetch" ? <CircleNotch size={16} className="animate-spin-svg" /> : <ArrowClockwise size={16} />}
          </button>
          
          {originType !== "LOCAL_ONLY" && (
            <>
              <button 
                className="btn-sync-action" 
                onClick={() => executeGitOperation("pull")}
                disabled={isAnyLoading}
                title="Pull Remote Upstream"
              >
                {loadingAction === "pull" ? <CircleNotch size={16} className="animate-spin-svg" /> : <ArrowDown size={16} />}
              </button>
              <button 
                className="btn-sync-action" 
                onClick={() => executeGitOperation("push")}
                disabled={isAnyLoading}
                title="Push Local Changes"
              >
                {loadingAction === "push" ? <CircleNotch size={16} className="animate-spin-svg" /> : <ArrowUp size={16} />}
              </button>
            </>
          )}
        </div>
      </div>

    </div>
  );
}