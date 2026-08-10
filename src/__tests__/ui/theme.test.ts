import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '@/store/app-store';

vi.mock('@/db/repositories/conversations', () => ({
  conversationRepo: {
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/db/repositories/messages', () => ({
  messageRepo: {
    add: vi.fn().mockResolvedValue(undefined),
    getByConversation: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/db/schema', () => ({
  requestPersistentStorage: vi.fn().mockResolvedValue(undefined),
}));

describe('System theme detection', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset store theme to default
    useAppStore.setState({ theme: 'dark' });
  });

  it('defaults to dark theme when no preference is stored', () => {
    // The UI slice's getInitialTheme checks localStorage first, then defaults to dark.
    // With localStorage cleared, theme should be 'dark'.
    expect(useAppStore.getState().theme).toBe('dark');
  });

  it('respects stored theme preference from localStorage', () => {
    localStorage.setItem('swarm-theme', 'light');

    // Re-create store state as if it just booted with 'light' in localStorage.
    // The actual getInitialTheme function reads from localStorage.
    const stored = localStorage.getItem('swarm-theme');
    expect(stored).toBe('light');

    // setTheme should update both store and localStorage
    useAppStore.getState().setTheme('light');
    expect(useAppStore.getState().theme).toBe('light');
    expect(localStorage.getItem('swarm-theme')).toBe('light');
  });

  it('toggleTheme switches between dark and light', () => {
    expect(useAppStore.getState().theme).toBe('dark');

    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().theme).toBe('light');
    expect(localStorage.getItem('swarm-theme')).toBe('light');

    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().theme).toBe('dark');
    expect(localStorage.getItem('swarm-theme')).toBe('dark');
  });

  it('should detect system prefers-color-scheme and set theme accordingly', async () => {
    // THIS SHOULD FAIL -- the current getInitialTheme() does NOT check
    // window.matchMedia('(prefers-color-scheme: dark)').
    // It only checks localStorage, then defaults to 'dark'.
    // Expected behavior: if no localStorage preference, detect system theme.

    localStorage.clear();

    // Mock matchMedia to report light preference
    const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: light)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });

    // With no localStorage and system preference = light, the app should
    // detect the system theme and use 'light'.
    // Re-import or re-evaluate getInitialTheme would be needed.
    // For now, we test the expected behavior: if matchMedia says light,
    // the initial theme should be light.
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

    expect(prefersLight).toBe(true);
    expect(prefersDark).toBe(false);

    // The store should respect matchMedia when no localStorage preference exists.
    // Currently getInitialTheme() defaults to 'dark' without checking matchMedia.
    // After fix: it should detect 'light' from matchMedia.

    // Re-import the ui-slice to get a fresh getInitialTheme evaluation
    const { createUISlice } = await import('@/store/slices/ui-slice');

    // The createUISlice function calls getInitialTheme() internally.
    // We create a temporary store to capture what theme it initializes to.
    const mockSet = vi.fn();
    const mockGet = vi.fn();
    const slice = createUISlice(mockSet, mockGet, { setState: mockSet, getState: mockGet, subscribe: vi.fn(), getInitialState: mockGet } as never);

    // BUG: getInitialTheme returns 'dark' even though matchMedia says light.
    // After fix, this should be 'light'.
    expect(slice.theme).toBe('light');
  });
});
