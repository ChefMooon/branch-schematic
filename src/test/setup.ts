import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

class MockIntersectionObserver implements IntersectionObserver {
	readonly root: Element | Document | null = null;
	readonly rootMargin = '0px';
	readonly scrollMargin = '0px';
	readonly thresholds: ReadonlyArray<number> = [0];

	disconnect(): void {}
	observe(): void {}
	takeRecords(): IntersectionObserverEntry[] {
		return [];
	}
	unobserve(): void {}
}

if (!globalThis.IntersectionObserver) {
	globalThis.IntersectionObserver = MockIntersectionObserver;
}

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
    label: 'main',
  })),
}));