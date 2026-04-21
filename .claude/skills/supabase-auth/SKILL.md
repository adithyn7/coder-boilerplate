---
name: supabase-auth
description: "Supabase auth flow playbook: sign-up, sign-in, sign-out, password reset, protected routes via React Router, session restore on page load, safe redirect-after-auth. Covers common pitfalls (flash of unauth'd content, expired JWTs, stale session). Use whenever building auth or a protected feature."
when-to-use: "User asks to add authentication, sign-in/sign-up, protected routes, user menu, log-out, password reset, or anything where app behavior depends on whether a user is logged in."
context: inline
allowed-tools: [read, write, edit, grep, glob]
---

# Supabase Auth Playbook

Use the Supabase JS SDK (`@supabase/supabase-js`) that's already installed. Never roll your own auth. Never store JWTs in localStorage manually — the SDK handles session persistence.

## The single source of truth: `AuthProvider`

Create `src/lib/auth-context.tsx` (or use it if it exists). Everyone reads auth state from here via `useAuth()`.

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;  // true until first onAuthStateChange fires
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Restore session from storage on mount.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    // 2. Subscribe to changes (sign-in, sign-out, token refresh).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
```

Wrap `<AuthProvider>` at the top of `src/main.tsx` around `<BrowserRouter>`.

## Sign-up

```tsx
async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) throw error;
  return data;
}
```

- Email confirmation ON (default): user sees "check your email" UI after sign-up.
- Email confirmation OFF: user is signed in immediately — redirect to `/`.
- Handle the "already registered" case: the SDK returns `data.user` but `data.user.identities.length === 0`.

## Sign-in (email + password)

```tsx
async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  // `onAuthStateChange` will fire and update context; no manual state sync needed.
}
```

Render errors with `Alert variant="destructive"`. Map `error.message` to user-friendly copy — "Invalid login credentials" → "Wrong email or password."

## Sign-out

```tsx
async function signOut() {
  await supabase.auth.signOut();
  // Context updates via onAuthStateChange → protected routes re-render → user lands on /signin.
}
```

## Password reset

Two-step flow:

1. Request email:
   ```ts
   await supabase.auth.resetPasswordForEmail(email, {
     redirectTo: `${window.location.origin}/auth/reset`,
   });
   ```
2. On the reset page, the user is already in a recovery session. Update password:
   ```ts
   await supabase.auth.updateUser({ password: newPassword });
   ```

## Protected routes (React Router v6)

Create a `<RequireAuth>` wrapper:

```tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenSkeleton />;  // prevents flash of unauth'd content
  if (!session) return <Navigate to="/signin" state={{ from: location }} replace />;
  return children;
}
```

Use in routes:
```tsx
<Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
```

After sign-in, redirect back to `location.state?.from?.pathname ?? '/'`.

## Session restore on page load

`AuthProvider.loading` handles this. Never render protected content while `loading === true` — show `<Skeleton>`. Users hate the flash.

## Common pitfalls

| Pitfall | Fix |
|---|---|
| Flash of unauth'd content before session restores | Gate on `loading` from `useAuth()` |
| Auth state drifts after a token refresh | Always use `onAuthStateChange`, never cache `user` in your own state |
| Sign-out on one tab doesn't log out others | `onAuthStateChange` handles this automatically — don't short-circuit |
| RLS policies block reads after sign-in | The session *is* set; check `auth.uid()` in your RLS policy, not the JWT directly |
| Email-confirmation link opens the wrong port | `emailRedirectTo` must use the preview URL, not `localhost` — use `window.location.origin` |
| "Auth session missing" on refresh | `getSession()` not awaited before a protected query fires; gate the query on `session !== undefined` |

## Role-based access

Supabase stores user roles in `auth.users.raw_user_meta_data` or a separate `profiles` table. For anything beyond basic login:

1. Create a `profiles` table with a `role` column (`'admin' | 'user'`).
2. Join the profile in your fetches: `supabase.from('profiles').select('*').eq('id', user.id).single()`.
3. Gate UI with a `<RequireRole role="admin">` wrapper.
4. **Enforce in the database with RLS policies**, not just in the UI. Frontend checks are advisory; backend RLS is authoritative. See `use_skill({name: "add-rls-policy"})` if this isn't wired yet.

## UI details

- Sign-in / sign-up pages: center the form, `max-w-sm`, `shadow-sm border rounded-lg p-6`. Use `Form` + `react-hook-form` + `zod` for validation.
- Password field: `type="password"` + optional show/hide toggle using `Eye`/`EyeOff` lucide icons.
- Submit button: `disabled={isSubmitting}` with loading spinner inside.
- Post-signup "check your email" state: use a dedicated success screen, not a toast — users often miss toasts.

## What NOT to do

- Don't roll JWT parsing yourself — use `session.user` from the SDK.
- Don't store the anon key in the client secret vault. It's public by design — shipped in the bundle is fine.
- Don't build a "remember me" checkbox — Supabase sessions persist by default; the checkbox would be cosmetic.
- Don't call `supabase.auth.getUser()` on every render — use the context's `user`. `getUser()` makes a network call.
