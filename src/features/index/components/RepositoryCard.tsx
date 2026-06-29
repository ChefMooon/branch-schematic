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
} from "@phosphor-icons/react";
import type { TrackedPath } from "../../../types/git";
import { useWorkspaceStore } from "../../../stores/workspace-store";
import { RepoCardHeader } from "./RepositoryCard/RepoCardHeader";
import { RepoCardTags } from "./RepositoryCard/RepoCardTags";
import { TagSelectionModal } from "../../../components/Modal/TagSelectionModal";
import { useNotifications } from "../../../components/notifications/notification-provider";

interface RepositoryCardProps {
  repo: TrackedPath;
  onRefresh: () => void;
  onOpenManagement: () => void;
}

export function RepositoryCard({ repo, onRefresh, onOpenManagement }: RepositoryCardProps) {
  const originType = repo.repo_origin_type ?? "LOCAL_ONLY";
  const setRepositoryFavorite = useWorkspaceStore((state) => state.setRepositoryFavorite);
  const setRepositoryGroup = useWorkspaceStore((state) => state.setRepositoryGroup);
  const addTag = useWorkspaceStore((state) => state.addTag);
  const removeTag = useWorkspaceStore((state) => state.removeTag);
  const getCustomGroups = useWorkspaceStore((state) => state.getCustomGroups);
  const createCustomGroup = useWorkspaceStore((state) => state.createCustomGroup);
  const tagDirectory = useWorkspaceStore((state) => state.tagDirectory);
  const { addToast } = useNotifications();
  
  // ALIAS LAYOUT STATE TRACKERS
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
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

  const saveAlias = async (nextAliasInput: string = aliasInput) => {
    const cleanInput = nextAliasInput.trim();
    const currentAlias = repo.alias_name ?? "";
    const matchesRepoName = cleanInput === repo.display_name;

    if (cleanInput === currentAlias) {
      setIsEditingAlias(false);
      return;
    }

    if (matchesRepoName && currentAlias === "") {
      setIsEditingAlias(false);
      addToast({
        variant: "warning",
        title: "Alias Matches Repository Name",
        message: "No custom alias was saved because it matches the repository name.",
      });
      return;
    }

    const aliasToPersist = cleanInput === "" || matchesRepoName ? "" : cleanInput;
    const isClearingAlias = aliasToPersist === "";

    setLoadingAction("alias");
    try {
      // Matches the new Rust signature: set_repository_alias(path_id, alias)
      await invoke("set_repository_alias", { pathId: repo.id, alias: aliasToPersist });
      setIsEditingAlias(false);
      if (matchesRepoName) {
        addToast({
          variant: "warning",
          title: "Alias Matches Repository Name",
          message: "Custom alias was removed and the repository name is now used.",
        });
      } else {
        addToast({
          variant: "success",
          title: isClearingAlias ? "Alias Cleared" : "Alias Updated",
          message: isClearingAlias
            ? `${repo.display_name} now uses the default repository name.`
            : `Alias saved as \"${aliasToPersist}\".`,
        });
      }
    } catch (err) {
      console.error("Failed to safely commit alias name alteration:", err);
      addToast({
        variant: "error",
        title: "Alias Update Failed",
        message: `Could not update alias for ${repo.display_name}.`,
      });
    } finally {
      setLoadingAction(null);
      onRefresh(); // Instantly triggers store re-hydration with the new persistent alias assignment
    }
  };

  const isAnyLoading = loadingAction !== null;
  const availableGroups = getCustomGroups();

  const handleFavoriteToggle = async () => {
    await setRepositoryFavorite(repo.id, (repo.is_favorite ?? 0) !== 1);
  };

  const handleGroupChange = async (groupId: string | null) => {
    await setRepositoryGroup(repo.id, groupId);
  };

  const handleCreateGroup = async () => {
    const name = window.prompt("Enter a new group name:");
    if (!name || !name.trim()) return;
    const createdId = await createCustomGroup(name.trim());
    if (createdId) {
      await setRepositoryGroup(repo.id, createdId);
    }
  };

  return (
    <div
      className={`repo-card origin-${originType.toLowerCase()} ${(repo.is_favorite ?? 0) === 1 ? 'is-favorited' : ''}`}
    >
      
      {/* Top Header Information Stack */}
      <div className="repo-card-top">
        <div className="repo-icon-wrapper">
          {getOriginIcon()}
        </div>
        <RepoCardHeader
          repo={repo}
          originType={originType}
          isEditingAlias={isEditingAlias}
          aliasInput={aliasInput}
          isAnyLoading={isAnyLoading}
          availableGroups={availableGroups}
          onAliasInputChange={setAliasInput}
          onStartEditing={handleStartEditing}
          onSaveAlias={saveAlias}
          onResetAlias={() => {
            void saveAlias("");
          }}
          onStopEditing={() => setIsEditingAlias(false)}
          onUntrack={handleUntrackProject}
          onFavoriteToggle={() => {
            void handleFavoriteToggle();
          }}
          onGroupChange={(group) => {
            void handleGroupChange(group);
          }}
          onCreateGroup={() => {
            void handleCreateGroup();
          }}
          onOpenManagement={onOpenManagement}
        />
      </div>

      <RepoCardTags
        tags={repo.tags ?? []}
        isAnyLoading={isAnyLoading}
        onOpenTagModal={() => {
          setIsTagModalOpen(true);
        }}
        onRemoveTag={async (tagName) => {
          await removeTag(repo.id, tagName);
          await onRefresh();
        }}
      />

      <TagSelectionModal
        isOpen={isTagModalOpen}
        availableTags={tagDirectory}
        assignedTagNames={(repo.tags ?? []).map((tag) => tag.tag_name)}
        onClose={() => setIsTagModalOpen(false)}
        onOpenManagement={onOpenManagement}
        onApply={async (nextTagNames) => {
          const current = new Set((repo.tags ?? []).map((tag) => tag.tag_name));
          const next = new Set(nextTagNames);

          for (const tagName of current) {
            if (!next.has(tagName)) {
              await removeTag(repo.id, tagName);
            }
          }

          for (const tagName of next) {
            if (!current.has(tagName)) {
              await addTag(repo.id, tagName);
            }
          }

          setIsTagModalOpen(false);
          await onRefresh();
        }}
      />

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
        <div className={`sync-buttons-cluster ${isAnyLoading ? 'is-loading' : ''}`}>
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