import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  GitBranch,
  ArrowDown,
  ArrowUp,
  Desktop,
  Cloud,
  CircleNotch,
  WarningCircle,
  UsersThree,
  Star,
} from "@phosphor-icons/react";
import { repositoryIconRegistry } from "../../icon/utils/iconRegistry";
import type { TrackedPath } from "../../../types/git";
import { useWorkspaceStore } from "../../../stores/workspace-store";
import { RepoCardHeader } from "./RepositoryCard/RepoCardHeader";
import { RepoGroupMenu } from "./RepositoryCard/RepoGroupMenu";
import { RepoCardTags } from "./RepositoryCard/RepoCardTags";
import { TagSelectionModal } from "./RepositoryCard/RepoTagSelectionMenu";
import { RepoThemeModal } from "./RepositoryCard/RepoThemeModal";
import { RepoBranchDropdown } from "./RepositoryCard/RepoBranchDropdown";
import { useNotifications } from "../../../components/notifications/NotificationProvider";
import { ConfirmationModal } from "../../../components/Modal/ConfirmationModal";
import { Button } from "../../../components/button/Button";
import { useResolveRepoOrigin } from "../hooks/useResolveRepoOrigin";
import { useRepoOriginBadgeState } from "../hooks/useResolveRepoOrigin";
import type { RepoOriginType } from "../hooks/useResolveRepoOrigin";
import { RepositoryDetail } from "../../repository-detail/components/RepositoryDetail";

interface RepositoryCardProps {
  repo: TrackedPath;
  onRefresh: () => void;
  onOpenManagement?: () => void;
  onOpenManagementModal?: () => void;
  resolvedOriginType?: RepoOriginType;
  isSelected?: boolean;
  onToggleSelection?: () => void;
}

export function RepositoryCard({ repo, onRefresh, onOpenManagement, onOpenManagementModal, resolvedOriginType, isSelected = false, onToggleSelection }: RepositoryCardProps) {
  const computedOriginType = useResolveRepoOrigin(repo);
  const originType = resolvedOriginType ?? computedOriginType;
  const originBadgeState = useRepoOriginBadgeState(repo, originType);
  const setRepositoryFavorite = useWorkspaceStore((state) => state.setRepositoryFavorite);
  const setRepositoryGroup = useWorkspaceStore((state) => state.setRepositoryGroup);
  const updateRepositoryTheme = useWorkspaceStore((state) => state.updateRepositoryTheme);
  const refreshRepositoryGitStatus = useWorkspaceStore((state) => state.refreshRepositoryGitStatus);
  const markRepositoryResolved = useWorkspaceStore((state) => state.markRepositoryResolved);
  const setRepositoriesStatus = useWorkspaceStore((state) => state.setRepositoriesStatus);
  const addTag = useWorkspaceStore((state) => state.addTag);
  const removeTag = useWorkspaceStore((state) => state.removeTag);
  const createGlobalTag = useWorkspaceStore((state) => state.createGlobalTag);
  const deleteGlobalTag = useWorkspaceStore((state) => state.deleteGlobalTag);
  const getCustomGroups = useWorkspaceStore((state) => state.getCustomGroups);
  const createCustomGroup = useWorkspaceStore((state) => state.createCustomGroup);
  const tagDirectory = useWorkspaceStore((state) => state.tagDirectory);
  const groupDirectory = useWorkspaceStore((state) => state.groupDirectory);
  const { addToast } = useNotifications();
  
  // ALIAS LAYOUT STATE TRACKERS
  const [isEditingAlias, setIsEditingAlias] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  const [isRepositoryDetailOpen, setIsRepositoryDetailOpen] = useState(false);
  const [aliasInput, setAliasInput] = useState("");
  const [loadingAction, setLoadingAction] = useState<"fetch" | "pull" | "push" | "checkout" | "alias" | "refresh" | null>(null);

  // PREPOPULATE ON START EDITING
  const handleStartEditing = () => {
    setAliasInput(repo.alias_name || repo.display_name);
    setIsEditingAlias(true);
  };

  const handleBranchChange = async (targetBranch: string) => {
    setLoadingAction("checkout");
    try {
      // Matches the Rust implementation signature: execute_git_checkout(absolute_path, branch_name)
      await invoke("execute_git_checkout", {
        absolutePath: repo.absolute_path,
        branchName: targetBranch,
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
      const message = await invoke<string>(`git_${operation}_operation`, { pathId: repo.id });
      addToast({
        variant: "success",
        title: operation === "fetch" ? "Fetch Complete" : operation === "pull" ? "Pull Complete" : "Push Complete",
        message: message || "Operation completed successfully.",
      });
    } catch (err) {
      console.error(`Git execution failure during ${operation}:`, err);
      addToast({
        variant: "error",
        title: operation === "fetch" ? "Fetch Failed" : operation === "pull" ? "Pull Failed" : "Push Failed",
        message: typeof err === "string" ? err : `Could not ${operation} ${repo.display_name}.`,
      });
    } finally {
      setLoadingAction(null);
      onRefresh();
    }
  };

  const handleRefreshGitStatus = async () => {
    setLoadingAction("refresh");
    try {
      await refreshRepositoryGitStatus(repo.id, repo.absolute_path);
    } catch (err) {
      console.error("Failed to refresh branch & sync status:", err);
      addToast({
        variant: "error",
        title: "Refresh Failed",
        message: `Could not refresh branch status for ${repo.display_name}.`,
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUntrackProject = async (e: React.MouseEvent<HTMLButtonElement>) => {
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
  const isMissing = repo.status === 'missing';

  const resolvedGroupColor = useMemo(() => {
    return groupDirectory.find((group) => group.id === repo.group_id)?.color_hex ?? null;
  }, [groupDirectory, repo.group_id]);

  const resolvedThemeColor = repo.theme_color_hex ?? resolvedGroupColor ?? '#4F46E5';
  const isFavorite = (repo.is_favorite ?? 0) === 1;
  const ResolvedIcon = (repo.icon_name ? repositoryIconRegistry[repo.icon_name as keyof typeof repositoryIconRegistry] : undefined) ?? (
    originType === 'FORK' ? GitBranch : originType === 'OWNED' ? Cloud : originType === 'CONTRIBUTOR' ? UsersThree : Desktop
  );

  const handleFavoriteToggle = async () => {
    await setRepositoryFavorite(repo.id, (repo.is_favorite ?? 0) !== 1);
  };

  const handleGroupChange = async (groupId: string | null) => {
    await setRepositoryGroup(repo.id, groupId);
  };

  const handleThemeChange = async (nextColor: string | null, nextIcon: string | null) => {
    await updateRepositoryTheme(repo.id, nextColor, nextIcon);
  };

  const handleCreateGroup = async (groupName: string) => {
    const name = groupName.trim();
    if (!name) return;

    try {
      const createdId = await createCustomGroup(name);
      if (createdId) {
        await setRepositoryGroup(repo.id, createdId);
      }
    } catch (error) {
      addToast({
        variant: "error",
        title: "Group creation failed",
        message: error instanceof Error ? error.message : "The group could not be created.",
      });
    }
  };

  const handleIconClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  const handleIconDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsThemeModalOpen(true);
  };

  const handleCardDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    const interactiveSelector = [
      '.repo-icon-wrapper',
      '.repo-title-row',
      '.repo-title-shell',
      '.repo-card-selection-control',
      '.repo-card-overflow-menu',
      '.repo-card-action-button',
      '.repo-branch-section',
      '.branch-dropdown-root',
      '.branch-dropdown-trigger',
      '.repo-secondary-row',
      '.repo-card-missing-state__actions',
      'button',
      'input',
      'select',
      'textarea',
      '[role="menu"]',
      '[role="dialog"]',
      '[aria-haspopup]'
    ].join(', ');

    const clickedInteractiveElement = target.closest(interactiveSelector);
    if (clickedInteractiveElement) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setIsRepositoryDetailOpen(true);
  };

  const handleLocateRepository = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: `Locate ${repo.display_name}`,
      });

      if (typeof selectedPath === 'string' && selectedPath.trim()) {
        await invoke('relink_repository_path', { pathId: repo.id, absolutePath: selectedPath });
        await refreshRepositoryGitStatus(repo.id, selectedPath);
        markRepositoryResolved(repo.id, selectedPath);
        addToast({
          variant: 'success',
          title: 'Repository located',
          message: `${repo.display_name} was reattached to the selected folder.`,
        });
      }
    } catch (error) {
      console.error('Failed to locate repository path:', error);
      addToast({
        variant: 'error',
        title: 'Locate failed',
        message: 'The selected folder could not be attached to this repository.',
      });
    }
  };

  const handleCloneAgain = () => {
    window.dispatchEvent(new CustomEvent('open-repository-modal', { detail: { action: 'clone' } }));
  };

  const handleValidateRepository = async () => {
    try {
      const isValid = await invoke<boolean>('validate_repository_path', { path: repo.absolute_path });
      if (isValid) {
        markRepositoryResolved(repo.id, repo.absolute_path);
        addToast({
          variant: 'success',
          title: 'Repository verified',
          message: `${repo.display_name} still points to a valid Git repository.`,
        });
      } else {
        setRepositoriesStatus([repo.id], 'missing');
        addToast({
          variant: 'warning',
          title: 'Repository invalid',
          message: `${repo.display_name} no longer points to a valid Git repository.`,
        });
      }
    } catch (error) {
      console.error('Failed to validate repository path:', error);
      addToast({
        variant: 'error',
        title: 'Validation failed',
        message: 'The repository path could not be validated right now.',
      });
    }
  };

  const handleRemoveRepository = async () => {
    try {
      await invoke('untrack_repository', { pathId: repo.id });
      setIsConfirmingRemove(false);
      onRefresh();
    } catch (error) {
      console.error('Failed to remove missing repository:', error);
      addToast({
        variant: 'error',
        title: 'Remove failed',
        message: 'The repository could not be removed from the workspace.',
      });
    }
  };

  return (
    <div
      className={`repo-card origin-${originType.toLowerCase()} ${(repo.is_favorite ?? 0) === 1 ? 'is-favorited' : ''} ${isSelected ? 'is-selected' : ''} ${isMissing ? 'is-missing' : ''}`}
      style={{ borderColor: `${resolvedThemeColor}55` }}
      onDoubleClick={handleCardDoubleClick}
    >
      {/* Top Header Information Stack */}
      <div className="repo-card-top">
        <div
          className="repo-icon-wrapper"
          style={{ color: resolvedThemeColor, borderColor: `${resolvedThemeColor}55` }}
          onClick={handleIconClick}
          onDoubleClick={handleIconDoubleClick}
          title="Double-click to edit theme"
        >
          <ResolvedIcon size={20} weight={repo.icon_name ? 'fill' : 'regular'} />
          {isFavorite && (
            <span className="repo-icon-favorite-badge" aria-hidden="true">
              <Star size={10} weight="fill" />
            </span>
          )}
        </div>
        <RepoCardHeader
          repo={repo}
          originType={originType}
          isSelected={isSelected}
          onToggleSelection={onToggleSelection}
          isEditingAlias={isEditingAlias}
          aliasInput={aliasInput}
          isAnyLoading={isAnyLoading}
          onAliasInputChange={setAliasInput}
          onStartEditing={handleStartEditing}
          onSaveAlias={saveAlias}
          onResetAlias={() => {
            void saveAlias("");
          }}
          onStopEditing={() => setIsEditingAlias(false)}
          onOpenDetails={() => setIsRepositoryDetailOpen(true)}
          onRefreshStatus={handleRefreshGitStatus}
          onFetch={() => {
            void executeGitOperation("fetch");
          }}
          onPull={() => {
            void executeGitOperation("pull");
          }}
          onPush={() => {
            void executeGitOperation("push");
          }}
          onToggleFavorite={() => {
            void handleFavoriteToggle();
          }}
          onValidate={() => {
            void handleValidateRepository();
          }}
          onUntrack={handleUntrackProject}
          onThemeChange={handleThemeChange}
          isOriginInactive={originBadgeState.isInactiveByProfile}
          originBadgeTitle={originBadgeState.title}
        />
      </div>

      {isMissing ? (
        <div className="repo-card-missing-state">
          <div className="repo-card-missing-state__header">
            <WarningCircle size={16} weight="fill" />
            <span>We could not find this repository at its saved location.</span>
          </div>
          <div className="repo-card-missing-state__actions">
            <Button type="button" className="repo-card-missing-state__button" onClick={() => { void handleLocateRepository(); }}>
              Locate
            </Button>
            {originType !== 'LOCAL_ONLY' ? (
              <Button type="button" className="repo-card-missing-state__button" onClick={handleCloneAgain}>
                Clone Again
              </Button>
            ) : null}
            <Button type="button" variant="danger" className="repo-card-missing-state__button" onClick={() => setIsConfirmingRemove(true)}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="repo-secondary-row">
          <RepoGroupMenu
            repo={repo}
            availableGroups={availableGroups}
            onGroupChange={(group) => {
              void handleGroupChange(group);
            }}
            onCreateGroup={(groupName) => {
              void handleCreateGroup(groupName);
            }}
            onOpenManagement={onOpenManagement}
            onOpenManagementModal={onOpenManagementModal}
          />
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
        </div>
      )}

      <TagSelectionModal
        isOpen={isTagModalOpen}
        availableTags={tagDirectory}
        assignedTagNames={(repo.tags ?? []).map((tag) => tag.tag_name)}
        onClose={() => setIsTagModalOpen(false)}
        onCreateTag={createGlobalTag}
        onDeleteTag={deleteGlobalTag}
        onOpenManagement={onOpenManagement}
        onOpenManagementModal={onOpenManagementModal}
        onApply={async (nextTagNames: string[]) => {
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

          await onRefresh();
        }}
      />

      <ConfirmationModal
        isOpen={isConfirmingRemove}
        title="Remove repository"
        message={`Remove ${repo.display_name} from the workspace catalog?`}
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={() => { void handleRemoveRepository(); }}
        onCancel={() => setIsConfirmingRemove(false)}
      />

      <RepoThemeModal
        isOpen={isThemeModalOpen}
        isBusy={isAnyLoading}
        currentThemeColor={repo.theme_color_hex ?? resolvedGroupColor ?? null}
        currentIconName={repo.icon_name ?? null}
        onClose={() => setIsThemeModalOpen(false)}
        onThemeChange={handleThemeChange}
      />

      <RepositoryDetail
        isOpen={isRepositoryDetailOpen}
        repo={repo}
        onClose={() => setIsRepositoryDetailOpen(false)}
      />

      {!isMissing ? (
        <>
          {/* Dynamic Embedded Branch Selector Dropper */}
          <RepoBranchDropdown
            branches={repo.available_branches && repo.available_branches.length > 0 ? repo.available_branches : [repo.current_branch ?? "main"]}
            currentBranch={repo.current_branch ?? "main"}
            defaultBranch={repo.default_branch_name}
            isLoading={loadingAction === "checkout"}
            disabled={isAnyLoading}
            onSelect={handleBranchChange}
          />

          {/* Sync Status Aggregator Metrics */}
          <div className="repo-sync-actions-row">
            <div className="status-indicator-pills">
              {(repo.uncommitted_changes_count ?? 0) > 0 && (
                <div className="status-pill changes-pending" title="Uncommitted items local stack">
                  <WarningCircle size={14} weight="fill" />
                  <span>{repo.uncommitted_changes_count} modified</span>
                </div>
              )}
              {originType !== "LOCAL_ONLY" && (
                <div className="status-pills-group">
                  {repo.has_upstream ? (
                    <>
                      <div className="status-pill" title="Commits ahead of the upstream remote branch">
                        <ArrowUp size={14} />
                        <span>{repo.ahead_count ?? 0}</span>
                      </div>
                      <div className="status-pill" title="Commits behind the upstream remote branch">
                        <ArrowDown size={14} />
                        <span>{repo.behind_count ?? 0}</span>
                      </div>
                    </>
                  ) : (
                    <div className="status-pill no-upstream" title="No upstream remote-tracking branch configured for this branch">
                      <span>No upstream</span>
                    </div>
                  )}
                </div>
              )}
              {repo.default_branch_name && repo.current_branch !== repo.default_branch_name && (
                <div className="status-pills-group">
                  <div className="status-pill vs-default" title={`Commits ahead of ${repo.default_branch_name}`}>
                    <ArrowUp size={14} />
                    <span>{repo.ahead_of_default_count ?? 0}</span>
                  </div>
                  <div className="status-pill vs-default" title={`Commits behind ${repo.default_branch_name}`}>
                    <ArrowDown size={14} />
                    <span>{repo.behind_default_count ?? 0}</span>
                  </div>
                </div>
              )}
            </div>
            {isAnyLoading && (
              <div className="sync-loading-indicator" title="A repository action is in progress">
                <CircleNotch size={16} className="animate-spin-svg" />
              </div>
            )}
          </div>
        </>
      ) : null}

    </div>
  );
}