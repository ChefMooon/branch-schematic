import type { RepoTag } from '../../../../types/git';

type RepoCardTagsProps = {
  tags: RepoTag[];
  isAnyLoading: boolean;
  onOpenTagModal: () => void;
  onRemoveTag: (tagName: string) => Promise<void>;
};

export function RepoCardTags({ tags, isAnyLoading, onOpenTagModal, onRemoveTag }: RepoCardTagsProps) {

  return (
    <div className="repo-tags-section">
      <div className="repo-tags-list">
        {tags.map((tag) => (
          <span key={tag.id} className="repo-tag-pill" style={{ borderColor: tag.color_hex, backgroundColor: `${tag.color_hex}1a` }}>
            <span className="repo-tag-dot" style={{ backgroundColor: tag.color_hex }} />
            {tag.tag_name}
            <button
              type="button"
              className="repo-tag-remove"
              onClick={() => void onRemoveTag(tag.tag_name)}
              disabled={isAnyLoading}
              title={`Remove ${tag.tag_name}`}
            >
              ×
            </button>
          </span>
        ))}

        <button
          type="button"
          className="repo-tag-add"
          onClick={onOpenTagModal}
          disabled={isAnyLoading}
        >
          + Add Tag
        </button>
      </div>
    </div>
  );
}
