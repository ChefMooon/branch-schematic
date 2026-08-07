import { useEffect, useState } from 'react';
import type { FilterOption } from './FilterDropdown';

const GROUP_CACHE_TTL_MS = 5 * 60 * 1000;
const GROUP_CACHE_MAX_AGE_MS = 30 * 60 * 1000;
const groupCache = new Map<string, { value: FilterOption[]; fetchedAt: number }>();

async function fetchGroupOptions(): Promise<FilterOption[]> {
  const response = await fetch('/api/groups', { cache: 'force-cache' });
  if (!response.ok) {
    throw new Error('Failed to load groups');
  }

  const payload = await response.json();
  const groups = Array.isArray(payload) ? payload : payload?.groups ?? [];
  return groups
    .filter((group: { label?: string; value?: string; group_name?: string; id?: string }) => {
      const label = typeof group?.label === 'string' ? group.label : typeof group?.group_name === 'string' ? group.group_name : '';
      const value = typeof group?.value === 'string' ? group.value : typeof group?.id === 'string' ? group.id : '';
      return Boolean(label && value);
    })
    .map((group: { label?: string; value?: string; group_name?: string; id?: string }) => ({
      label: typeof group.label === 'string' ? group.label : group.group_name ?? '',
      value: typeof group.value === 'string' ? group.value : group.id ?? '',
    }));
}

export function useGroupOptions() {
  const [options, setOptions] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const now = Date.now();
      const cachedEntry = groupCache.get('groups');
      if (cachedEntry && now - cachedEntry.fetchedAt < GROUP_CACHE_TTL_MS) {
        if (isMounted) {
          setOptions(cachedEntry.value);
          setLoading(false);
          setError(null);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const nextOptions = await fetchGroupOptions();
        if (isMounted) {
          setOptions(nextOptions);
          setError(null);
        }
        groupCache.set('groups', { value: nextOptions, fetchedAt: Date.now() });
        if (groupCache.size > 1) {
          const oldestKey = groupCache.keys().next().value;
          if (oldestKey && Date.now() - groupCache.get(oldestKey)!.fetchedAt > GROUP_CACHE_MAX_AGE_MS) {
            groupCache.delete(oldestKey);
          }
        }
      } catch {
        if (isMounted) {
          setError('Unable to load options');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  return { options, loading, error };
}
