import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CaretDown } from '@phosphor-icons/react';
import styles from './FilterDropdown.module.css';

export type FilterOption = {
  label: string;
  value: string;
  disabled?: boolean;
};

type FilterDropdownProps = {
  label?: string;
  value?: string | string[] | null;
  onChange?: (value: string | string[] | null) => void;
  options?: FilterOption[];
  fetchOptions?: () => Promise<FilterOption[]>;
  placeholder?: string;
  multi?: boolean;
  hidePlaceholderOption?: boolean;
  className?: string;
  loadingText?: string;
  errorText?: string;
  'aria-label'?: string;
  disabled?: boolean;
};

export function FilterDropdown({
  label,
  value,
  onChange,
  options,
  fetchOptions,
  placeholder = 'Select an option',
  multi = false,
  hidePlaceholderOption = false,
  className,
  loadingText = 'Loading…',
  errorText = 'Unable to load options',
  'aria-label': ariaLabel,
  disabled = false,
}: FilterDropdownProps) {
  const [loadedOptions, setLoadedOptions] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(Boolean(fetchOptions));
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState<string | string[] | null>(value ?? (multi ? [] : null));
  const containerRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const controlId = `${generatedId}-filter-dropdown`;
  const resolvedOptions = useMemo(() => options ?? loadedOptions, [options, loadedOptions]);

  useEffect(() => {
    setInternalValue(value ?? (multi ? [] : null));
  }, [value, multi]);

  useEffect(() => {
    if (!fetchOptions) return;

    let isMounted = true;
    const loadOptions = async () => {
      setLoading(true);
      setError(null);
      try {
        const nextOptions = await fetchOptions();
        if (isMounted) {
          setLoadedOptions(nextOptions);
        }
      } catch {
        if (isMounted) {
          setError(errorText);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadOptions();
    return () => {
      isMounted = false;
    };
  }, [fetchOptions, errorText]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const container = containerRef.current;
      if (!container || container.contains(event.target as Node)) {
        return;
      }

      setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen]);

  const handleSelectChange = (nextValue: string) => {
    if (!multi) {
      const next = nextValue === '' ? null : nextValue;
      setInternalValue(next);
      setIsOpen(false);
      onChange?.(next);
      return;
    }

    const selectedValues = Array.isArray(internalValue) ? internalValue : [];
    const nextValues = selectedValues.includes(nextValue)
      ? selectedValues.filter((current) => current !== nextValue)
      : [...selectedValues, nextValue];

    setInternalValue(nextValues);
    onChange?.(nextValues);
  };

  const selectedLabel = useMemo(() => {
    if (multi) {
      if (!Array.isArray(internalValue) || internalValue.length === 0) {
        return placeholder;
      }
      const selected = resolvedOptions.filter((option) => internalValue.includes(option.value));
      return selected.length > 0 ? selected.map((option) => option.label).join(', ') : placeholder;
    }

    const selected = resolvedOptions.find((option) => option.value === internalValue);
    return selected?.label ?? placeholder;
  }, [internalValue, multi, placeholder, resolvedOptions]);

  return (
    <div ref={containerRef} className={[styles.dropdownShell, className].filter(Boolean).join(' ')}>
      {label ? (
        <label className={styles.dropdownLabel} htmlFor={controlId}>
          {label}
        </label>
      ) : null}
      <div className={styles.dropdownControlShell}>
        <button
          id={controlId}
          type="button"
          className={styles.dropdownButton}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={`${controlId}-panel`}
          aria-label={ariaLabel ?? label ?? placeholder}
          disabled={disabled}
          onClick={() => {
            if (fetchOptions && !loadedOptions.length && !loading && !error) {
              setIsOpen(true);
              return;
            }
            setIsOpen((prev) => !prev);
          }}
        >
          <span className={styles.dropdownButtonText}>{loading ? loadingText : error ? errorText : selectedLabel}</span>
          <CaretDown size={16} className={styles.dropdownIcon} />
        </button>
        {isOpen ? (
          <div id={`${controlId}-panel`} className={styles.dropdownPanel} role="listbox" aria-multiselectable={multi}>
            {loading ? (
              <div className={styles.dropdownOption} role="status">
                {loadingText}
              </div>
            ) : error ? (
              <div className={styles.dropdownOption} role="alert">
                {errorText}
              </div>
            ) : (
              <>
                {!multi && !hidePlaceholderOption ? (
                  <button
                    type="button"
                    className={styles.dropdownOption}
                    onClick={() => handleSelectChange('')}
                    data-active={!internalValue}
                  >
                    {placeholder}
                  </button>
                ) : null}
                {resolvedOptions.map((option) => {
                  const isActive = multi
                    ? Array.isArray(internalValue) && internalValue.includes(option.value)
                    : internalValue === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={[styles.dropdownOption, isActive ? styles.dropdownOptionActive : ''].filter(Boolean).join(' ')}
                      onClick={() => handleSelectChange(option.value)}
                      disabled={option.disabled}
                      data-active={isActive}
                      role="option"
                      aria-selected={isActive}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
