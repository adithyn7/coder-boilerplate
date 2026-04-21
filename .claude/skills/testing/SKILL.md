---
name: testing
description: "Test-writing playbook for our stack: Vitest for unit/component tests, React Testing Library for UI, Playwright for E2E when asked. Covers Supabase client mocking, async assertions, and the file conventions this codebase expects."
when-to-use: "User asks to add tests, verify coverage, write a regression test for a bug, or test a hook/component/function. Also after fixing a non-trivial bug — a regression test prevents it coming back."
context: inline
allowed-tools: [read, write, grep, glob, bash, run_tests, typecheck]
---

# Testing Playbook (Vitest + React Testing Library + Playwright)

## Test file layout

- Unit/component tests: co-located as `<file>.test.ts` / `<file>.test.tsx` next to the thing being tested.
- E2E tests: `tests/e2e/<flow>.spec.ts` (Playwright convention).
- Fixtures/helpers: `src/test-utils/` — create if missing.

## Vitest config expectations

Your Vite project already includes a `vitest.config.ts` (or vitest block in `vite.config.ts`). If it doesn't, add it:

```ts
// vite.config.ts
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: './src/test-utils/setup.ts',
}
```

Setup file:
```ts
// src/test-utils/setup.ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
afterEach(() => cleanup());
```

Packages you'll likely need: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `@playwright/test` (E2E only). Use `add_dependency` to install.

## Component tests — patterns

**Rendering with providers**: wrap in your app's providers (Router, QueryClient, AuthProvider) via a `renderWithProviders` helper in `src/test-utils/`.

```tsx
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function renderWithProviders(ui: React.ReactElement, { route = '/' } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}
```

**User interaction** (prefer `userEvent` over `fireEvent`):
```tsx
import userEvent from '@testing-library/user-event';
const user = userEvent.setup();
await user.click(screen.getByRole('button', { name: /save/i }));
await user.type(screen.getByLabelText(/email/i), 'a@b.com');
```

**Finding elements** (in priority order):
1. `getByRole` — best. Matches how screen readers / users perceive the UI.
2. `getByLabelText` — for form inputs.
3. `getByText` — for content.
4. `getByTestId` — last resort. Add `data-testid` only when the above don't work.

Never use class-name queries.

## Hook tests

```tsx
import { renderHook, waitFor } from '@testing-library/react';
const { result } = renderHook(() => useMyHook(id), { wrapper: Providers });
await waitFor(() => expect(result.current.data).toBeDefined());
expect(result.current.data).toMatchObject({ id, name: 'foo' });
```

## Async assertions

- **Always** use `findBy*` or wrap in `waitFor` for anything that happens after a render/fetch. Never `setTimeout` in tests.
- `findByRole('alert')` waits up to 1s for the alert to appear.
- For stable async: `await waitFor(() => expect(...).toBe(...))`.

## Mocking Supabase

Use `vi.mock` to replace the client with a controllable stub. Centralize it:

```ts
// src/test-utils/supabase-mock.ts
import { vi } from 'vitest';

export function mockSupabase(overrides: Record<string, any> = {}) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      ...overrides.auth,
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockResolvedValue({ data: null, error: null }),
      ...overrides.from,
    })),
  };
}

// In a test:
vi.mock('@/lib/supabase', () => ({ supabase: mockSupabase() }));
```

Don't hit the real Supabase from tests. For integration coverage, use Playwright E2E with a dedicated test project.

## E2E tests (Playwright — use when user asks)

Install: `add_dependency @playwright/test`. Scaffold: `bash: npx playwright install`.

```ts
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('sign in redirects to dashboard', async ({ page }) => {
  await page.goto('/signin');
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL('/dashboard');
});
```

Playwright config points at `http://localhost:5173` (our Vite dev port). For CI, run `npm run build && npm run preview` and test against the preview server.

## Running tests

- Unit/component: `run_tests` (or `bash: npm run test`).
- Single file: `bash: npx vitest run src/foo.test.ts`.
- Watch mode: not useful here — we don't have an interactive loop.
- Typecheck before test: `typecheck` — a failing type is a test failure waiting to happen.

## What to test

**Always**:
- Components with branching UI (loading / error / empty / data).
- Hooks that contain logic (not thin wrappers).
- Utility functions with edge cases (empty input, large input, boundary values).
- Bug regression: a test that fails before the fix and passes after.

**Rarely**:
- Pure presentational components with no logic.
- Third-party libraries themselves (trust them; test your *integration*).

## Anti-patterns

- Snapshot tests everywhere — they pass noise for signal.
- Testing implementation details (internal state, private methods). Test the observable behavior.
- `await new Promise(r => setTimeout(r, 500))` — use `waitFor`.
- Shared mutable state across tests — use `beforeEach` to reset.
- Massive `beforeAll` setup — prefer composition / factories in each test.
- `.only` or `.skip` left in committed code. Remove before finishing.

Report what you tested, not just "tests added." Example: *"Added 4 tests covering happy path, empty state, invalid email, and Supabase error. All pass. Coverage on `useSignIn` hook is now 100%."*
