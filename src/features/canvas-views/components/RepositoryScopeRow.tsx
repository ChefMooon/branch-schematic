import { CaretDown, CaretRight } from '@phosphor-icons/react';

type WorkspaceScopeRecord = {
  id: string;
  display_name: string;
  alias_name?: string | null;
  available_branches: string[];
};

type RepositoryScopeRowProps = {
  repo: WorkspaceScopeRecord;
  isDark: boolean;
  repoSelected: boolean;
  isExpanded: boolean;
  selectedBranches: string[];
  onToggleExpand: (id: string) => void;
  onToggleRepo: (id: string, checked: boolean) => void;
  onToggleBranch: (repoId: string, branchName: string, checked: boolean) => void;
};

export function RepositoryScopeRow({
  repo,
  isDark,
  repoSelected,
  isExpanded,
  selectedBranches,
  onToggleExpand,
  onToggleRepo,
  onToggleBranch,
}: RepositoryScopeRowProps) {
  return (
    <div style={{ border: `1px solid ${isDark ? '#2f2f2f' : '#e2e8f0'}`, borderRadius: 8, background: isDark ? '#0f0f10' : '#ffffff', overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px' }}>
        <button type="button" onClick={() => onToggleExpand(repo.id)} style={{ border: 'none', background: 'transparent', color: isDark ? '#d4d4d8' : '#475569', cursor: 'pointer', padding: 0, display: 'flex' }}>
          {isExpanded ? <CaretDown size={14} /> : <CaretRight size={14} />}
        </button>
        <input type="checkbox" checked={repoSelected} onChange={(e) => onToggleRepo(repo.id, e.target.checked)} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, color: isDark ? '#f5f5f5' : '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {repo.alias_name || repo.display_name}
        </span>
      </div>
      {isExpanded && (
        <div style={{ borderTop: `1px solid ${isDark ? '#2f2f2f' : '#e2e8f0'}`, padding: '6px 10px 10px 28px', display: 'grid', gap: 6 }}>
          {(repo.available_branches ?? []).length === 0 && <div style={{ fontSize: 11, color: isDark ? '#a3a3a3' : '#64748b' }}>No branches detected.</div>}
          {(repo.available_branches ?? []).map((branchName) => (
            <label key={`${repo.id}::${branchName}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: isDark ? '#d4d4d8' : '#334155' }}>
              <input type="checkbox" checked={selectedBranches.includes(branchName)} disabled={!repoSelected} onChange={(e) => onToggleBranch(repo.id, branchName, e.target.checked)} />
              <span>{branchName}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
