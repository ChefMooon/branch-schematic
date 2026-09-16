import { useSyncExternalStore } from 'react';
import { UpdateCoordinator } from './coordinator';

export const defaultUpdateCoordinator = new UpdateCoordinator();

export function useAutoUpdate(coordinator: UpdateCoordinator = defaultUpdateCoordinator) {
  const snapshot = useSyncExternalStore(coordinator.subscribe, coordinator.getSnapshot, coordinator.getSnapshot);
  return { coordinator, snapshot };
}
