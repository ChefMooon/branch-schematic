import type { NotificationToast } from './NotificationProvider';

export const MAX_VISIBLE_TOASTS = 3;
export const DEFAULT_TOAST_DURATION = 6000;
export const TOAST_EXIT_DURATION = 180;

export type ToastLifecycle = 'visible' | 'exiting';

export interface ManagedToast extends NotificationToast {
  lifecycle: ToastLifecycle;
  remainingMs: number;
  startedAt: number | null;
  isPaused: boolean;
}

export interface ToastLifecycleState {
  visible: ManagedToast[];
  queued: ManagedToast[];
}

export type ToastLifecycleAction =
  | { type: 'enqueue'; toast: NotificationToast; now: number }
  | { type: 'begin-exit'; id: number }
  | { type: 'finish-exit'; id: number; now: number }
  | { type: 'pause'; id: number; now: number }
  | { type: 'resume'; id: number; now: number };

export const initialToastLifecycleState: ToastLifecycleState = {
  visible: [],
  queued: [],
};

function toManagedToast(toast: NotificationToast, now: number, isVisible: boolean): ManagedToast {
  return {
    ...toast,
    lifecycle: 'visible',
    remainingMs: toast.duration,
    startedAt: isVisible ? now : null,
    isPaused: false,
  };
}

function promoteNext(state: ToastLifecycleState, now: number): ToastLifecycleState {
  const [nextToast, ...queued] = state.queued;
  if (!nextToast) return { ...state, queued };

  return {
    visible: [...state.visible, { ...nextToast, startedAt: now }],
    queued,
  };
}

export function toastLifecycleReducer(
  state: ToastLifecycleState,
  action: ToastLifecycleAction,
): ToastLifecycleState {
  switch (action.type) {
    case 'enqueue': {
      const isVisible = state.visible.length < MAX_VISIBLE_TOASTS;
      const managedToast = toManagedToast(action.toast, action.now, isVisible);
      return isVisible
        ? { ...state, visible: [...state.visible, managedToast] }
        : { ...state, queued: [...state.queued, managedToast] };
    }

    case 'begin-exit':
      return {
        ...state,
        visible: state.visible.map((toast) => toast.id === action.id
          ? { ...toast, lifecycle: 'exiting', startedAt: null, isPaused: false }
          : toast),
      };

    case 'finish-exit': {
      const remainingVisible = state.visible.filter((toast) => toast.id !== action.id);
      if (remainingVisible.length === state.visible.length) return state;
      return promoteNext({ visible: remainingVisible, queued: state.queued }, action.now);
    }

    case 'pause':
      return {
        ...state,
        visible: state.visible.map((toast) => {
          if (toast.id !== action.id || toast.lifecycle !== 'visible' || toast.isPaused) return toast;
          const elapsed = toast.startedAt === null ? 0 : Math.max(0, action.now - toast.startedAt);
          return {
            ...toast,
            remainingMs: Math.max(0, toast.remainingMs - elapsed),
            startedAt: null,
            isPaused: true,
          };
        }),
      };

    case 'resume':
      return {
        ...state,
        visible: state.visible.map((toast) => toast.id === action.id && toast.lifecycle === 'visible' && toast.isPaused
          ? { ...toast, startedAt: action.now, isPaused: false }
          : toast),
      };
  }
}

export function getVisibleToasts(state: ToastLifecycleState): ManagedToast[] {
  return state.visible;
}

export function getQueuedToasts(state: ToastLifecycleState): ManagedToast[] {
  return state.queued;
}
