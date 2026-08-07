import { describe, expect, it } from 'vitest';
import type { NotificationToast } from './NotificationProvider';
import {
  initialToastLifecycleState,
  toastLifecycleReducer,
} from './toastLifecycle';

function toast(id: number, duration = 1000): NotificationToast {
  return { id, title: `Toast ${id}`, message: `Message ${id}`, variant: 'info', duration };
}

describe('toastLifecycleReducer', () => {
  it('keeps only three toasts visible and queues later notifications in FIFO order', () => {
    let state = initialToastLifecycleState;
    for (let id = 1; id <= 4; id += 1) {
      state = toastLifecycleReducer(state, { type: 'enqueue', toast: toast(id), now: id });
    }

    expect(state.visible.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(state.queued.map((item) => item.id)).toEqual([4]);
    expect(state.queued[0]?.startedAt).toBeNull();
  });

  it('promotes the oldest queued toast after an exiting toast finishes', () => {
    let state = initialToastLifecycleState;
    for (let id = 1; id <= 4; id += 1) {
      state = toastLifecycleReducer(state, { type: 'enqueue', toast: toast(id), now: 0 });
    }

    state = toastLifecycleReducer(state, { type: 'begin-exit', id: 1 });
    expect(state.visible.find((item) => item.id === 1)?.lifecycle).toBe('exiting');

    state = toastLifecycleReducer(state, { type: 'finish-exit', id: 1, now: 500 });
    expect(state.visible.map((item) => item.id)).toEqual([2, 3, 4]);
    expect(state.visible.find((item) => item.id === 4)?.startedAt).toBe(500);
  });

  it('pauses with the exact remaining duration and resumes from that point', () => {
    let state = toastLifecycleReducer(initialToastLifecycleState, {
      type: 'enqueue',
      toast: toast(1, 1000),
      now: 100,
    });

    state = toastLifecycleReducer(state, { type: 'pause', id: 1, now: 350 });
    expect(state.visible[0]?.remainingMs).toBe(750);
    expect(state.visible[0]?.startedAt).toBeNull();
    expect(state.visible[0]?.isPaused).toBe(true);

    state = toastLifecycleReducer(state, { type: 'resume', id: 1, now: 900 });
    expect(state.visible[0]?.remainingMs).toBe(750);
    expect(state.visible[0]?.startedAt).toBe(900);
    expect(state.visible[0]?.isPaused).toBe(false);
  });

  it('ignores repeated exit completion for an already removed toast', () => {
    let state = toastLifecycleReducer(initialToastLifecycleState, {
      type: 'enqueue',
      toast: toast(1),
      now: 0,
    });
    state = toastLifecycleReducer(state, { type: 'begin-exit', id: 1 });
    state = toastLifecycleReducer(state, { type: 'finish-exit', id: 1, now: 10 });

    expect(toastLifecycleReducer(state, { type: 'finish-exit', id: 1, now: 20 })).toEqual(state);
  });
});
