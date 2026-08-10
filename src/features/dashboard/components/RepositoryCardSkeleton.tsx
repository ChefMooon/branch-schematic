const SKELETON_COUNT = 6;

export function RepositoryCardSkeletons() {
  return (
    <>
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          key={index}
          className="repo-card repo-card-skeleton"
          data-testid="repository-card-skeleton"
          aria-hidden="true"
        >
          <div className="repo-card-top">
            <div className="repo-skeleton-icon" />
            <div className="repo-meta-details">
              <div className="repo-skeleton-line repo-skeleton-title" />
              <div className="repo-skeleton-line repo-skeleton-path" />
            </div>
          </div>
          <div className="repo-skeleton-branch" />
          <div className="repo-skeleton-line repo-skeleton-footer" />
        </div>
      ))}
    </>
  );
}
