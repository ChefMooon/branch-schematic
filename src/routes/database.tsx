import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from "react";
import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import { useWorkspaceStore } from "../stores/workspace-store";
import { TrackedPath, CachedBranch, DiscoveredBranch } from "../types/git";

export const Route = createFileRoute('/database')({
  component: DatabasePage,
})

function DatabasePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [trackedPaths, setTrackedPaths] = useState<TrackedPath[]>([]);
  const [branches, setBranches] = useState<CachedBranch[]>([]);
  
  const [newPath, setNewPath] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [selectedPathId, setSelectedPathId] = useState("");
  const [newBranchName, setNewBranchName] = useState("");

  // Diagnostic states for testing the scan_local_repository command
  const [scanPath, setScanPath] = useState("");
  const [scanResult, setScanResult] = useState<DiscoveredBranch[] | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const { addRepo, removeRepo, hydrateFromBackend } = useWorkspaceStore();

  async function refreshCacheData() {
    try {
      const db = await Database.load("sqlite:branch-schematic.db");
      
      const paths = await db.select<TrackedPath[]>(
        "SELECT id, display_name, absolute_path FROM tracked_paths WHERE is_active = 1"
      );
      setTrackedPaths(paths);

      const cachedBranches = await db.select<CachedBranch[]>(`
        SELECT 
          b.id, b.path_id, b.branch_name, b.is_head, b.last_commit_hash,
          c.author_name, c.commit_message
        FROM cached_git_branches b
        LEFT JOIN cached_git_commits c ON b.last_commit_hash = c.commit_hash
        ORDER BY b.is_head DESC, b.branch_name ASC
      `);
      setBranches(cachedBranches);
      
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed querying cached workspace metrics.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddAndWatchPath(e: React.FormEvent) {
    e.preventDefault();
    if (!newPath || !newDisplayName) return;

    try {
      setIsLoading(true);
      const db = await Database.load("sqlite:branch-schematic.db");
      const pathUuid = crypto.randomUUID();

      await db.execute(
        "INSERT INTO tracked_paths (id, display_name, absolute_path, is_active) VALUES ($1, $2, $3, 1)",
        [pathUuid, newDisplayName, newPath]
      );

      await invoke("watch_project_directory", {
        pathId: pathUuid,
        absolutePath: newPath,
      });

      addRepo({ id: pathUuid, display_name: newDisplayName, absolute_path: newPath, is_active: 1 });
      await hydrateFromBackend();

      setMessage(`Success: Daemon is now watching ${newDisplayName}`);
      setNewPath("");
      setNewDisplayName("");
      
      setTimeout(refreshCacheData, 500);
    } catch (err) {
      console.error(err);
      setError(String(err));
      setIsLoading(false);
    }
  }

  // Diagnostic Test Function for scan_local_repository
  async function handleTestScan(e: React.FormEvent) {
    e.preventDefault();
    if (!scanPath) return;

    try {
      setIsScanning(true);
      setError("");
      setScanResult(null);

      const result = await invoke<DiscoveredBranch[]>("scan_local_repository", {
        absolutePath: scanPath,
      });

      setScanResult(result);
      setMessage(`Successfully completed on-demand scan of repository.`);
    } catch (err) {
      console.error(err);
      setError(`Scan Command Diagnostic Error: ${String(err)}`);
    } finally {
      setIsScanning(false);
    }
  }

  async function handleUnmountPath(pathId: string, displayName: string) {
    try {
      setIsLoading(true);
      const db = await Database.load("sqlite:branch-schematic.db");
      
      await db.execute("UPDATE tracked_paths SET is_active = 0 WHERE id = $1", [pathId]);
      await db.execute("DELETE FROM cached_git_branches WHERE path_id = $1", [pathId]);

      removeRepo(pathId);
      await hydrateFromBackend();

      setMessage(`Unmounted repository: ${displayName}`);
      refreshCacheData();
    } catch (err) {
      console.error(err);
      setError(`Failed to unmount path: ${String(err)}`);
      setIsLoading(false);
    }
  }

  async function handleCheckout(absolutePath: string, branchName: string) {
    try {
      setIsLoading(true);
      const res = await invoke<string>("execute_git_checkout", {
        absolutePath,
        branchName,
      });
      setMessage(res);
      setTimeout(refreshCacheData, 500);
    } catch (err) {
      console.error(err);
      setError(String(err));
      setIsLoading(false);
    }
  }

  async function handleCreateBranch(e: React.FormEvent) {
    e.preventDefault();
    const activePathObj = trackedPaths.find(p => p.id === selectedPathId);
    if (!activePathObj || !newBranchName) return;

    try {
      setIsLoading(true);
      const res = await invoke<string>("create_git_branch", {
        absolutePath: activePathObj.absolute_path,
        newBranchName: newBranchName,
      });
      setMessage(res);
      setNewBranchName("");
      setTimeout(refreshCacheData, 500);
    } catch (err) {
      console.error(err);
      setError(String(err));
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshCacheData();
  }, []);

  return (
    <main className="container" style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto", color: "#fff" }}>
      <h1>Workspace Daemon Cache Testing Control Panel</h1>
      
      {message && <div style={{ padding: "1rem", backgroundColor: "#1e4620", color: "#a3cfbb", marginBottom: "1rem", borderRadius: "4px", border: "1px solid #a3cfbb" }}>{message}</div>}
      {error && <div style={{ padding: "1rem", backgroundColor: "#4c1d1d", color: "#f5c2c2", marginBottom: "1rem", borderRadius: "4px", border: "1px solid #f5c2c2" }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
        
        {/* Track and Watch Form */}
        <section style={{ border: "1px solid #444", padding: "1.5rem", borderRadius: "6px", backgroundColor: "#1e1e1e" }}>
          <h3>1. Track & Watch New Repository</h3>
          <form onSubmit={handleAddAndWatchPath} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input
              type="text"
              placeholder="Display Name (e.g., Core API)"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              style={{ padding: "0.5rem", background: "#2a2a2a", border: "1px solid #555", color: "#fff" }}
            />
            <input
              type="text"
              placeholder="Absolute Repository System Path"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              style={{ padding: "0.5rem", background: "#2a2a2a", border: "1px solid #555", color: "#fff" }}
            />
            <button type="submit" disabled={isLoading} style={{ padding: "0.6rem", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>
              Mount Repository Daemon
            </button>
          </form>
        </section>

        {/* Action Controls Branch Form */}
        <section style={{ border: "1px solid #444", padding: "1.5rem", borderRadius: "6px", backgroundColor: "#1e1e1e" }}>
          <h3>2. Dispatch Create Branch Action</h3>
          <form onSubmit={handleCreateBranch} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <select 
              value={selectedPathId} 
              onChange={(e) => setSelectedPathId(e.target.value)}
              style={{ padding: "0.5rem", background: "#2a2a2a", border: "1px solid #555", color: "#fff" }}
            >
              <option value="">-- Select Active Target Repo --</option>
              {trackedPaths.map(p => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="New Branch Name"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              style={{ padding: "0.5rem", background: "#2a2a2a", border: "1px solid #555", color: "#fff" }}
              disabled={!selectedPathId}
            />
            <button type="submit" disabled={isLoading || !selectedPathId || !newBranchName} style={{ padding: "0.6rem", background: "#10b981", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>
              Execute Git Branch Strategy
            </button>
          </form>
        </section>

      </div>

      {/* Manual Live Scanner Diagnostic Section */}
      <section style={{ marginBottom: "2rem", border: "1px solid #444", padding: "1.5rem", borderRadius: "6px", backgroundColor: "#1e1e1e" }}>
        <h3>3. On-Demand Live Repository Scanner Diagnostic</h3>
        <p style={{ fontSize: "0.85rem", color: "#aaa" }}>
          Directly execute the native <code>scan_local_repository</code> command to see real-time output data structure integrity:
        </p>
        <form onSubmit={handleTestScan} style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
          <input
            type="text"
            placeholder="Target Path for instant scanner testing..."
            value={scanPath}
            onChange={(e) => setScanPath(e.target.value)}
            style={{ flex: 1, padding: "0.5rem", background: "#2a2a2a", border: "1px solid #555", color: "#fff" }}
          />
          <button type="submit" disabled={isScanning} style={{ padding: "0.5rem 1rem", background: "#6366f1", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}>
            {isScanning ? "Scanning..." : "Execute Scan Command"}
          </button>
        </form>

        {scanResult && (
          <div style={{ marginTop: "1rem", background: "#111", border: "1px solid #333", borderRadius: "4px", padding: "1rem" }}>
            <h4 style={{ margin: "0 0 0.5rem 0", color: "#818cf8" }}>Discovered Relational Branches Dump:</h4>
            <pre style={{ margin: 0, fontSize: "0.85rem", overflowX: "auto", maxHeight: "250px", color: "#34d399" }}>
              {JSON.stringify(scanResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* Currently Tracked Repos / Unmount Zone */}
      <section style={{ marginBottom: "2rem", border: "1px solid #444", padding: "1.5rem", borderRadius: "6px", backgroundColor: "#1e1e1e" }}>
        <h3>Currently Mounted Repositories</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "1rem" }}>
          {trackedPaths.map(path => (
            <div key={path.id} style={{ padding: "0.75rem 1rem", background: "#2a2a2a", borderRadius: "4px", border: "1px solid #555", display: "flex", alignItems: "center", gap: "1.5rem" }}>
              <div>
                <strong>{path.display_name}</strong>
                <div style={{ fontSize: "0.8rem", color: "#aaa" }}>{path.absolute_path}</div>
              </div>
              <button 
                onClick={() => handleUnmountPath(path.id, path.display_name)}
                disabled={isLoading}
                style={{ background: "#ef4444", color: "#fff", border: "none", padding: "0.3rem 0.6rem", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
              >
                Unmount
              </button>
            </div>
          ))}
          {trackedPaths.length === 0 && <div style={{ color: "#aaa", fontSize: "0.9rem" }}>No active mounted repositories.</div>}
        </div>
      </section>

      {/* Render Workspace Database Cache */}
      <section style={{ border: "1px solid #444", padding: "1.5rem", borderRadius: "6px", backgroundColor: "#1e1e1e" }}>
        <h2>Live System Cached Relational Branches State ({branches.length} pointers)</h2>
        {isLoading ? (
          <div style={{ margin: "1rem 0" }}>Updating database state maps...</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
            <thead>
              <tr style={{ background: "#2d2d2d", color: "#ffffff", borderBottom: "2px solid #444", textAlign: "left" }}>
                <th style={{ padding: "0.75rem" }}>Repository Display</th>
                <th style={{ padding: "0.75rem" }}>Branch Reference</th>
                <th style={{ padding: "0.75rem" }}>HEAD Active</th>
                <th style={{ padding: "0.75rem" }}>Latest Commit Hash</th>
                <th style={{ padding: "0.75rem" }}>Author Log Details</th>
                <th style={{ padding: "0.75rem" }}>Commit Summary</th>
                <th style={{ padding: "0.75rem", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((branch) => {
                const parentRepo = trackedPaths.find(p => p.id === branch.path_id);
                return (
                  <tr key={branch.id} style={{ borderBottom: "1px solid #333", background: branch.is_head ? "#142c17" : "transparent" }}>
                    <td style={{ padding: "0.75rem" }}>{parentRepo?.display_name || "Unknown"}</td>
                    <td style={{ padding: "0.75rem", fontWeight: "bold" }}>{branch.branch_name}</td>
                    <td style={{ padding: "0.75rem" }}>{branch.is_head ? "🟢 ACTIVE HEAD" : "⚫"}</td>
                    <td style={{ padding: "0.75rem" }}><code style={{ fontSize: "0.85rem", background: "#2a2a2a", padding: "2px 6px", borderRadius: "3px" }}>{branch.last_commit_hash?.slice(0, 7)}</code></td>
                    <td style={{ padding: "0.75rem" }}>{branch.author_name || "N/A"}</td>
                    <td style={{ padding: "0.75rem", fontStyle: "italic", color: "#ccc" }}>"{branch.commit_message || "No message cached"}"</td>
                    <td style={{ padding: "0.75rem", textAlign: "right" }}>
                      <button
                        onClick={() => parentRepo && handleCheckout(parentRepo.absolute_path, branch.branch_name)}
                        disabled={!!branch.is_head || isLoading}
                        style={{ fontSize: "0.8rem", padding: "0.3rem 0.6rem", background: branch.is_head ? "#444" : "#3b82f6", color: "#fff", border: "none", borderRadius: "4px", cursor: branch.is_head ? "default" : "pointer" }}
                      >
                        Checkout
                      </button>
                    </td>
                  </tr>
                );
              })}
              {branches.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "2rem", color: "#aaa" }}>
                    No branch indexes currently active. Mount a local path directory to spin up database syncing.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}