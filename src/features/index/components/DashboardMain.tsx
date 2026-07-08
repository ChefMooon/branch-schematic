import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { RepositoryCard } from "./RepositoryCard";
import { WorkspaceQuickFilters } from "./WorkspaceQuickFilters";
import { BulkActionToolbar } from "./BulkActionToolbar";
import { FilterDropdown } from "./common/FilterDropdown";
import { useWorkspaceStore } from "../../../stores/workspace-store";
import "./Dashboard.css";

type DashboardMainProps = {
  onOpenManagementModal?: () => void;
  onCleanupDanglingTags?: () => Promise<number>;
};

type SortOption = "LAST_VIEWED" | "ALPHABETICAL" | "PENDING_CHANGES";

export function DashboardMain({ onOpenManagementModal, onCleanupDanglingTags }: DashboardMainProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepoTypeIds, setSelectedRepoTypeIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("LAST_VIEWED");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(new Set());
  const {
    repos: allRepos,
    hydrateFromBackend: fetchRepositoriesData,
    quickFilterMetadata,
    hydrateQuickFilterMetadata,
    groupDirectory,
    refreshRepositoryGitStatus,
    cleanupDanglingTags: cleanupDanglingTagsFromStore,
  } = useWorkspaceStore();

  useEffect(() => {
    void fetchRepositoriesData();
    void hydrateQuickFilterMetadata();
  }, []);

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const toggleRepoSelection = (repoId: string) => {
    setSelectedRepoIds((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  };

  const handleBulkRefresh = async () => {
    const selectedRepos = allRepos.filter((repo) => selectedRepoIds.has(repo.id));
    if (selectedRepos.length === 0) return;

    await Promise.allSettled(
      selectedRepos.map((repo) => refreshRepositoryGitStatus(repo.id, repo.absolute_path))
    );
    setSelectedRepoIds(new Set());
  };

  const handleBulkUntrack = async () => {
    const selectedRepos = allRepos.filter((repo) => selectedRepoIds.has(repo.id));
    if (selectedRepos.length === 0) return;

    const confirmed = window.confirm(
      `Untrack ${selectedRepos.length} selected workspace${selectedRepos.length === 1 ? "" : "s"}?`
    );
    if (!confirmed) return;

    await Promise.allSettled(
      selectedRepos.map((repo) => invoke("untrack_repository", { pathId: repo.id }))
    );
    await fetchRepositoriesData();
    setSelectedRepoIds(new Set());
  };

  const repoTypeOptions = useMemo(
    () => [
      { label: "Owned / Created", value: "OWNED" },
      { label: "Forks Ecosystem", value: "FORK" },
      { label: "Local-Only Frameworks", value: "LOCAL_ONLY" },
      { label: "Contributors", value: "CONTRIBUTOR" },
    ],
    []
  );

  const sortOptions = useMemo(
    () => [
      { label: "Last Accessed", value: "LAST_VIEWED" },
      { label: "Alphabetical", value: "ALPHABETICAL" },
      { label: "Pending Changes", value: "PENDING_CHANGES" },
    ],
    []
  );

  const processedRepositories = allRepos
    .filter(repo => {
      const matchesSearch = repo.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            repo.absolute_path.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        selectedRepoTypeIds.length === 0 || selectedRepoTypeIds.includes(repo.repo_origin_type ?? "LOCAL_ONLY");
      const matchesFavorites = !favoritesOnly || (repo.is_favorite ?? 0) === 1;
      const matchesGroup =
        !selectedGroup || repo.custom_group === selectedGroup || repo.group_id === selectedGroup;
      const tagIds = (repo.tags ?? []).map((tag) => tag.id);
      const matchesTags =
        selectedTagIds.length === 0 || selectedTagIds.some((tagId) => tagIds.includes(tagId));
      return matchesSearch && matchesType && matchesFavorites && matchesGroup && matchesTags;
    })
    .sort((a, b) => {
      if (sortBy === "ALPHABETICAL") return a.display_name.localeCompare(b.display_name);
      if (sortBy === "PENDING_CHANGES") return (b.uncommitted_changes_count ?? 0) - (a.uncommitted_changes_count ?? 0);
      const aTime = a.last_accessed_at ? new Date(a.last_accessed_at).getTime() : 0;
      const bTime = b.last_accessed_at ? new Date(b.last_accessed_at).getTime() : 0;
      return bTime - aTime;
    });

  return (
    <div className="dashboard-container">
      <header className="dashboard-header-actions">
        <div className="action-buttons-group" />

        <div className="filter-controls-group">
          <div className="search-input-wrapper dashboard-control-shell">
            <MagnifyingGlass size={16} className="search-icon-inside" />
            <input 
              type="text" 
              placeholder="Search workspaces..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <FilterDropdown
            value={selectedRepoTypeIds}
            options={repoTypeOptions}
            onChange={(value) => setSelectedRepoTypeIds(Array.isArray(value) ? value : [])}
            multi
            placeholder="All repo types"
            aria-label="Filter by repository type"
            className="filter-dropdown-fixed"
          />

          <FilterDropdown
            value={sortBy}
            options={sortOptions}
            onChange={(value) => setSortBy(typeof value === "string" ? (value as SortOption) : "LAST_VIEWED")}
            placeholder="Sort by"
            hidePlaceholderOption
            aria-label="Sort repositories"
            className="filter-dropdown-fixed"
          />
        </div>
      </header>

      <WorkspaceQuickFilters
        metadata={quickFilterMetadata}
        groupOptions={groupDirectory.map((group) => group.group_name)}
        selectedTagIds={selectedTagIds}
        selectedGroup={selectedGroup}
        favoritesOnly={favoritesOnly}
        onToggleTag={toggleTagFilter}
        onGroupChange={setSelectedGroup}
        onFavoritesToggle={() => setFavoritesOnly((prev) => !prev)}
        onCleanupDanglingTags={onCleanupDanglingTags ?? cleanupDanglingTagsFromStore}
      />

      <section className="repo-grid-section">
        <h2 className="repo-grid-title">
          Tracked Repositories ({processedRepositories.length})
        </h2>

        {selectedRepoIds.size > 0 ? (
        <BulkActionToolbar
          selectedCount={selectedRepoIds.size}
          onBulkRefresh={handleBulkRefresh}
          onBulkUntrack={handleBulkUntrack}
          onClearSelection={() => setSelectedRepoIds(new Set())}
        />
      ) : null}
        
        {processedRepositories.length === 0 ? (
          <div className="repo-grid-empty-state">
            No workspace references matching criteria found.
          </div>
        ) : (
          <div className="repo-responsive-grid">
            {processedRepositories.map(repo => (
              <RepositoryCard
                key={repo.id}
                repo={repo}
                onRefresh={fetchRepositoriesData}
                onOpenManagement={() => onOpenManagementModal?.()}
                isSelected={selectedRepoIds.has(repo.id)}
                onToggleSelection={() => toggleRepoSelection(repo.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}