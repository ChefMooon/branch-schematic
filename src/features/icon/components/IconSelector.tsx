import { repositoryIconNames, repositoryIconRegistry, type RepositoryIconName } from "../utils/iconRegistry";

type IconSelectorProps = {
  value: string | null;
  colorHex: string | null;
  onChange: (nextValue: string | null) => void;
};

export function IconSelector({ value, colorHex, onChange }: IconSelectorProps) {
  const accentColor = colorHex ?? "#4F46E5";

  return (
    <div className="theme-picker-shell">
      <div className="theme-icon-grid" role="listbox" aria-label="Repository icon selection">
        <button
          type="button"
          className={`theme-icon-option ${value === null ? "is-active" : ""}`}
          onClick={() => onChange(null)}
          style={value === null ? { color: accentColor } : undefined}
          aria-selected={value === null}
          title="Use automatic icon"
        >
          <span>Auto</span>
        </button>

        {repositoryIconNames.map((iconName) => {
          const IconComponent = repositoryIconRegistry[iconName as RepositoryIconName];
          const isActive = value === iconName;

          return (
            <button
              key={iconName}
              type="button"
              className={`theme-icon-option ${isActive ? "is-active" : ""}`}
              onClick={() => onChange(iconName)}
              style={isActive ? { color: accentColor } : undefined}
              aria-selected={isActive}
              title={iconName}
            >
              <IconComponent size={18} weight={isActive ? "fill" : "regular"} />
              <span>{iconName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
