import { useState, useEffect, useRef } from "react";
import { MagnifyingGlass, CaretDown } from "@phosphor-icons/react";
import { RepositoryCard } from "./RepositoryCard";
import { WorkspaceQuickFilters } from "./WorkspaceQuickFilters";
import { useWorkspaceStore } from "../../../stores/workspace-store";
import "./Dashboard.css";

type DashboardMainProps = {
  onOpenManagementModal?: () => void;
};

export function DashboardMain({ onOpenManagementModal }: DashboardMainProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "OWNED" | "FORK" | "LOCAL_ONLY">("ALL");
  const [sortBy, setSortBy] = useState<"LAST_VIEWED" | "ALPHABETICAL" | "PENDING_CHANGES">("LAST_VIEWED");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const provenanceSelectRef = useRef<HTMLSelectElement>(null);
  const sortSelectRef = useRef<HTMLSelectElement>(null);
  const {
    repos: allRepos,
    hydrateFromBackend: fetchRepositoriesData,
    quickFilterMetadata,
    hydrateQuickFilterMetadata,
    groupDirectory,
  } = useWorkspaceStore();

  useEffect(() => {
    void fetchRepositoriesData();
    void hydrateQuickFilterMetadata();
  }, []);

  const handleSelectShellPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    selectRef: React.RefObject<HTMLSelectElement | null>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const select = selectRef.current;
    if (!select) return;

    select.focus();

    try {
      if (typeof select.showPicker === "function") {
        void select.showPicker();
      } else {
        select.click();
      }
    } catch {
      select.click();
    }
  };

  const toggleTagFilter = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const processedRepositories = allRepos
    .filter(repo => {
      const matchesSearch = repo.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            repo.absolute_path.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === "ALL" || repo.repo_origin_type === filterType;
      const matchesFavorites = !favoritesOnly || (repo.is_favorite ?? 0) === 1;
      const matchesGroup = !selectedGroup || repo.custom_group === selectedGroup;
      const tagIds = (repo.tags ?? []).map((tag) => tag.id);
      const matchesTags =
        selectedTagIds.length === 0 || selectedTagIds.some((tagId) => tagIds.includes(tagId));
      return matchesSearch && matchesType && matchesFavorites && matchesGroup && matchesTags;
    })
    .sort((a, b) => {
      if (sortBy === "ALPHABETICAL") return a.display_name.localeCompare(b.display_name);
      if (sortBy === "PENDING_CHANGES") return (b.uncommitted_changes_count ?? 0) - (a.uncommitted_changes_count ?? 0);
      if (sortBy === "LAST_VIEWED") {
        const aTime = a.last_accessed_at ? new Date(a.last_accessed_at).getTime() : 0;
        const bTime = b.last_accessed_at ? new Date(b.last_accessed_at).getTime() : 0;
        return bTime - aTime;
      }
      return 0;
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

          <div className="dashboard-select-wrapper dashboard-control-shell" onPointerDown={(event) => handleSelectShellPointerDown(event, provenanceSelectRef)}>
            <select ref={provenanceSelectRef} className="dashboard-select" value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
              <option value="ALL">All</option>
              <option value="OWNED">Owned / Created</option>
              <option value="FORK">Forks Ecosystem</option>
              <option value="LOCAL_ONLY">Local-Only Frameworks</option>
            </select>
            <CaretDown size={16} className="dashboard-select-icon" />
          </div>

          <div className="dashboard-select-wrapper dashboard-control-shell" onPointerDown={(event) => handleSelectShellPointerDown(event, sortSelectRef)}>
            <select ref={sortSelectRef} className="dashboard-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="LAST_VIEWED">Last Accessed</option>
              <option value="ALPHABETICAL">Alphabetical</option>
              <option value="PENDING_CHANGES">Pending Changes</option>
            </select>
            <CaretDown size={16} className="dashboard-select-icon" />
          </div>
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
      />

      <section className="repo-grid-section">
        <h2 className="repo-grid-title">
          Tracked Ecosystem Workspaces ({processedRepositories.length})
        </h2>
        
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
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}