import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { RepositoryCard } from "./RepositoryCard";
import { SearchBar } from "../../../components/search-bar/SearchBar";
import { OWNER_GROUPING_FILTER_VALUE, WorkspaceQuickFilters } from "./WorkspaceQuickFilters";
import { BulkActionToolbar } from "./BulkActionToolbar";
import { FilterDropdown } from "./common/FilterDropdown";
import { useWorkspaceStore } from "../../../stores/workspace-store";
import { useProfileStore } from "../../auth-profile/stores/profileStore";
import { resolveRepoOrigin } from "../hooks/useResolveRepoOrigin";
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
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const activeGithubUsername = useProfileStore((state) => {
    const activeProfile = state.profiles.find((profile) => profile.id === state.activeProfileId) ?? null;
    return activeProfile?.username?.trim() ?? null;
  });

  useEffect(() => {
    void fetchRepositoriesData();
    void hydrateQuickFilterMetadata();
  }, []);

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSearchClear = () => {
    setSearchQuery("");
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setSearchQuery("");
    }
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

  const groupByOwner = selectedGroup === OWNER_GROUPING_FILTER_VALUE;

  const resolvedOriginByRepoId = useMemo(() => {
    const entries = allRepos.map((repo) => [repo.id, resolveRepoOrigin(repo, activeGithubUsername)] as const);
    return Object.fromEntries(entries);
  }, [allRepos, activeGithubUsername]);

  useEffect(() => {
    const ownedCount = allRepos.reduce((count, repo) => {
      return resolvedOriginByRepoId[repo.id] === "OWNED" ? count + 1 : count;
    }, 0);

    console.info("[DashboardMain] profile origin recompute", {
      activeProfileId,
      activeGithubUsername,
      repositoryCount: allRepos.length,
      ownedCount,
    });
  }, [activeProfileId, activeGithubUsername, allRepos, resolvedOriginByRepoId]);

  const processedRepositories = allRepos
    .filter(repo => {
      const matchesSearch = repo.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            repo.absolute_path.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        selectedRepoTypeIds.length === 0 || selectedRepoTypeIds.includes(resolvedOriginByRepoId[repo.id]);
      const matchesFavorites = !favoritesOnly || (repo.is_favorite ?? 0) === 1;
      const matchesGroup =
        !selectedGroup ||
        groupByOwner ||
        repo.custom_group === selectedGroup ||
        repo.group_id === selectedGroup;
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

  const ownerGroupedRepositories = useMemo(() => {
    if (!groupByOwner) {
      return [] as Array<{ owner: string; repositories: typeof processedRepositories }>;
    }

    const grouped = new Map<string, typeof processedRepositories>();

    for (const repo of processedRepositories) {
      const owner = repo.github_owner_login?.trim() || "Local";
      const existing = grouped.get(owner);
      if (existing) {
        existing.push(repo);
        continue;
      }

      grouped.set(owner, [repo]);
    }

    return Array.from(grouped.entries())
      .sort(([leftOwner], [rightOwner]) => {
        if (leftOwner === "Local") return 1;
        if (rightOwner === "Local") return -1;
        return leftOwner.localeCompare(rightOwner, undefined, { sensitivity: "base" });
      })
      .map(([owner, repositories]) => ({ owner, repositories }));
  }, [groupByOwner, processedRepositories]);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header-actions">
        <div className="action-buttons-group" />

        <div className="filter-controls-group">
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={handleSearchClear}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search workspaces..."
            ariaLabel="Search workspaces"
            className="search-input-wrapper dashboard-control-shell"
            containerStyle={{ width: 280 }}
            showShellBorder={false}
            showFocusRing={false}
          />

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
        ) : groupByOwner ? (
          <div className="repo-owner-groups">
            {ownerGroupedRepositories.map(({ owner, repositories }) => (
              <section key={owner} className="repo-owner-group">
                <h3 className="repo-owner-group-heading">{owner}</h3>
                <div className="repo-responsive-grid repo-responsive-grid-grouped">
                  {repositories.map((repo) => (
                    <RepositoryCard
                      key={repo.id}
                      repo={repo}
                      resolvedOriginType={resolvedOriginByRepoId[repo.id]}
                      onRefresh={fetchRepositoriesData}
                      onOpenManagement={() => onOpenManagementModal?.()}
                      isSelected={selectedRepoIds.has(repo.id)}
                      onToggleSelection={() => toggleRepoSelection(repo.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="repo-responsive-grid">
            {processedRepositories.map(repo => (
              <RepositoryCard
                key={repo.id}
                repo={repo}
                resolvedOriginType={resolvedOriginByRepoId[repo.id]}
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