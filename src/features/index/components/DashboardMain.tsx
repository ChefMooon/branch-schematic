import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { MagnifyingGlass, FolderOpen } from "@phosphor-icons/react";
import { RepositoryCard } from "./RepositoryCard";
import { useWorkspaceStore } from "../../../stores/workspace-store";
import "./Dashboard.css";

export function DashboardMain() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "OWNED" | "FORK" | "LOCAL_ONLY">("ALL");
  const [sortBy] = useState<"LAST_VIEWED" | "ALPHABETICAL" | "PENDING_CHANGES">("LAST_VIEWED");
  const { repos: allRepos, hydrateFromBackend: fetchRepositoriesData } = useWorkspaceStore();

  useEffect(() => {
    fetchRepositoriesData();
  }, []);

  const handleOpenLocalDirectory = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Select Local Git Repository Location"
      });

      if (selectedPath && typeof selectedPath === 'string') {
        await invoke("add_new_tracked_path", { absolutePath: selectedPath });
        // Triggers an instant reactive interface sync right after insert completes!
        await fetchRepositoriesData();
      }
    } catch (err) {
      console.error("Directory onboarding exception encountered:", err);
    }
  };

  const processedRepositories = allRepos
    .filter(repo => {
      const matchesSearch = repo.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            repo.absolute_path.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === "ALL" || repo.repo_origin_type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === "ALPHABETICAL") return a.display_name.localeCompare(b.display_name);
      if (sortBy === "PENDING_CHANGES") return (b.uncommitted_changes_count ?? 0) - (a.uncommitted_changes_count ?? 0);
      return 0;
    });

  return (
    <div className="dashboard-container">
      <header className="dashboard-header-actions">
        <div className="action-buttons-group">
          <button className="btn-primary" onClick={handleOpenLocalDirectory}>
            <FolderOpen size={18} weight="bold" />
            <span>Open Local Repository</span>
          </button>
        </div>

        <div className="filter-controls-group">
          <div className="search-input-wrapper">
            <MagnifyingGlass size={16} className="search-icon-inside" />
            <input 
              type="text" 
              placeholder="Search workspaces..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <select className="sort-select" value={filterType} onChange={(e) => setFilterType(e.target.value as any)}>
            <option value="ALL">All Provenance Types</option>
            <option value="OWNED">Owned / Created</option>
            <option value="FORK">Forks Ecosystem</option>
            <option value="LOCAL_ONLY">Local-Only Frameworks</option>
          </select>
        </div>
      </header>

      <section className="repo-grid-section">
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.5rem' }}>
          Tracked Ecosystem Workspaces ({processedRepositories.length})
        </h2>
        
        {processedRepositories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed #e2e8f0', borderRadius: '12px', color: '#64748b' }}>
            No workspace references matching criteria found.
          </div>
        ) : (
          <div className="repo-responsive-grid">
            {processedRepositories.map(repo => (
              <RepositoryCard key={repo.id} repo={repo} onRefresh={fetchRepositoriesData} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}