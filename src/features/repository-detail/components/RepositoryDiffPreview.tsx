import type { RepositoryFileDiff } from '../../../types/git';

type DiffLineKind = 'context' | 'added' | 'deleted';

interface DiffLine {
  content: string;
  kind: DiffLineKind;
  oldLine: number | null;
  newLine: number | null;
}

interface RepositoryDiffPreviewProps {
  diff: RepositoryFileDiff | null;
  isLoading: boolean;
  error: string | null;
  viewMode: 'unified' | 'split';
}

interface SplitDiffRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

function parsePatch(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldLine = 0;
  let newLine = 0;
  let hasHunk = false;

  for (const rawLine of patch.split('\n')) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(rawLine);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      hasHunk = true;
      continue;
    }

    if (rawLine.startsWith('+++ ') || rawLine.startsWith('--- ') || rawLine.startsWith('diff --git') || rawLine.startsWith('index ')) {
      continue;
    }

    const prefix = rawLine[0];
    const content = rawLine.slice(1);
    if (prefix === ' ') {
      lines.push({ content, kind: 'context', oldLine, newLine });
      oldLine += 1;
      newLine += 1;
    } else if (prefix === '-') {
      lines.push({ content, kind: 'deleted', oldLine, newLine: null });
      oldLine += 1;
    } else if (prefix === '+') {
      if (!hasHunk && newLine === 0) newLine = 1;
      lines.push({ content, kind: 'added', oldLine: null, newLine });
      newLine += 1;
    }
  }

  return lines;
}

function buildSplitRows(lines: DiffLine[]): SplitDiffRow[] {
  const rows: SplitDiffRow[] = [];

  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (line.kind === 'context') {
      rows.push({ left: line, right: line });
      index += 1;
      continue;
    }

    const deleted: DiffLine[] = [];
    const added: DiffLine[] = [];
    while (lines[index]?.kind === 'deleted') deleted.push(lines[index++]);
    while (lines[index]?.kind === 'added') added.push(lines[index++]);
    const count = Math.max(deleted.length, added.length);
    for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
      rows.push({ left: deleted[rowIndex] ?? null, right: added[rowIndex] ?? null });
    }
  }

  return rows;
}

function DiffCell({ line, side }: { line: DiffLine | null; side: 'left' | 'right' }) {
  const lineNumber = side === 'left' ? line?.oldLine : line?.newLine;
  return (
    <div className={`repository-view-diff-cell ${line ? `repository-view-diff-cell--${line.kind}` : 'is-empty'}`}>
      <span className="repository-view-diff-line-number">{lineNumber ?? ''}</span>
      <code>{line?.content ?? ''}</code>
    </div>
  );
}

export function RepositoryDiffPreview({ diff, isLoading, error, viewMode }: RepositoryDiffPreviewProps) {
  if (isLoading) return <div className="repository-view-empty-state">Loading diff…</div>;
  if (error) return <div className="repository-view-empty-state repository-view-empty-state--error">{error}</div>;
  if (!diff?.patch) return <div className="repository-view-empty-state">{diff?.unavailableReason ?? 'No text diff is available for the selected file.'}</div>;

  const lines = parsePatch(diff.patch);
  if (lines.length === 0) return <div className="repository-view-empty-state">No changed text lines are available to preview.</div>;

  return (
    <div className="repository-view-diff-content" aria-label={`${viewMode} diff`}>
      {viewMode === 'unified' ? lines.map((line, index) => (
        <div key={`${line.kind}-${line.oldLine}-${line.newLine}-${index}`} className={`repository-view-diff-row repository-view-diff-row--${line.kind}`}>
          <span className="repository-view-diff-line-number">{line.oldLine ?? ''}</span>
          <span className="repository-view-diff-line-number">{line.newLine ?? ''}</span>
          <span className="repository-view-diff-prefix">{line.kind === 'added' ? '+' : line.kind === 'deleted' ? '-' : ' '}</span>
          <code>{line.content}</code>
        </div>
      )) : buildSplitRows(lines).map((row, index) => (
        <div key={`${row.left?.oldLine ?? 'none'}-${row.right?.newLine ?? 'none'}-${index}`} className="repository-view-diff-split-row">
          <DiffCell line={row.left} side="left" />
          <DiffCell line={row.right} side="right" />
        </div>
      ))}
    </div>
  );
}